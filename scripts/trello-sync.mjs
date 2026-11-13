/**
 * Monta o quadro Trello do projeto a partir de docs/trello/quadro.json:
 * listas, etiquetas, cartões, checklists, links para o GitHub e capturas de tela.
 *
 * Uso (passo a passo em docs/trello/PLANO_TRELLO.md):
 *   npm run trello:sync -- --dry-run     só mostra o plano; não acessa o Trello
 *   npm run trello:sync -- --autorizar   abre no navegador a página que gera o token
 *   npm run trello:sync -- --verificar   confere a chave e o token e mostra o que já existe no quadro
 *   npm run trello:sync                  aplica no quadro
 *
 * Credenciais: variáveis TRELLO_KEY e TRELLO_TOKEN, ou arquivo .env.trello na raiz
 * (ignorado pelo Git). Nunca coloque a chave ou o token em arquivos versionados.
 *
 * O script não apaga nem arquiva nada e não altera cartões que já existem. Ele cria o que
 * falta e coloca as listas do plano na ordem definida. Pode ser executado de novo: o que já
 * foi criado é reaproveitado pelo nome.
 */
import { spawn } from "node:child_process";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const arg = (name) => process.argv.includes(name);
const def = JSON.parse(readFileSync(path.join(root, "docs/trello/quadro.json"), "utf8"));
const API = "https://api.trello.com/1";

function credentials() {
  const env = { TRELLO_KEY: process.env.TRELLO_KEY, TRELLO_TOKEN: process.env.TRELLO_TOKEN };
  const file = path.join(root, ".env.trello");
  if (existsSync(file)) {
    for (const line of readFileSync(file, "utf8").replace(/^\uFEFF/, "").split(/\r?\n/)) {
      const m = line.match(/^\s*(TRELLO_KEY|TRELLO_TOKEN)\s*=\s*(.+?)\s*$/);
      if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, "");
    }
  }
  return { key: env.TRELLO_KEY ?? "", token: env.TRELLO_TOKEN ?? "" };
}

/** Confere o formato sem nunca mostrar os valores. Devolve a lista de problemas encontrados. */
function credentialProblems(need = { token: true }) {
  const { key, token } = credentials();
  const problems = [];
  if (!key) problems.push("TRELLO_KEY está vazio. É a 'Chave de API' do seu Power-Up (32 letras e números).");
  else if (!/^[0-9a-f]{32}$/i.test(key)) problems.push(`TRELLO_KEY não parece uma chave de API do Trello: tem ${key.length} caracteres e o esperado são 32 (só letras de a a f e números). Copie a 'Chave de API', não o nome do Power-Up nem o 'Segredo'.`);
  if (need.token) {
    if (!token) problems.push("TRELLO_TOKEN está vazio. Gere o token com: npm run trello:sync -- --autorizar");
    else if (token.length < 60) problems.push(`TRELLO_TOKEN parece incompleto: tem ${token.length} caracteres e o esperado são 64 ou mais. Copie o texto inteiro mostrado depois de clicar em "Permitir".`);
  }
  return problems;
}

function stopOnCredentialProblems(need) {
  const problems = credentialProblems(need);
  if (!problems.length) return;
  console.error("Não foi possível continuar — confira o arquivo .env.trello na pasta do projeto:\n");
  for (const p of problems) console.error(`  • ${p}`);
  console.error("\nPasso a passo completo: docs/trello/PLANO_TRELLO.md");
  process.exit(2);
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let calls = 0;
async function api(method, route, params = {}, form = null) {
  const { key, token } = credentials();
  const url = new URL(API + route);
  url.searchParams.set("key", key);
  url.searchParams.set("token", token);
  if (!form) for (const [k, v] of Object.entries(params)) url.searchParams.set(k, String(v));
  for (let attempt = 1; ; attempt++) {
    calls++;
    await sleep(120); // respeita o limite de requisições do Trello
    const res = await fetch(url, { method, body: form ?? undefined });
    if (res.status === 429 && attempt <= 5) {
      await sleep(11_000);
      continue;
    }
    if (!res.ok) {
      const body = (await res.text()).slice(0, 200);
      // Nunca incluir a URL na mensagem: ela carrega a chave e o token.
      const hint =
        res.status === 401
          ? " — a chave ou o token foram recusados (token vencido ou sem permissão de escrita?). Gere outro com: npm run trello:sync -- --autorizar"
          : res.status === 404
            ? " — quadro não encontrado para esta conta. O token precisa ser de uma conta que seja membro do quadro."
            : "";
      throw new Error(`Trello respondeu ${res.status} em ${method} ${route}: ${body}${hint}`);
    }
    return res.json();
  }
}

function imagesOf(card) {
  if (!card.pastaDeImagens) return [];
  const dir = path.join(root, card.pastaDeImagens);
  if (!existsSync(dir)) throw new Error(`Pasta de imagens não encontrada: ${card.pastaDeImagens}`);
  return readdirSync(dir).filter((f) => f.toLowerCase().endsWith(".png")).sort().map((f) => ({ name: f, file: path.join(dir, f) }));
}

function plan() {
  console.log(`Quadro ${def.quadro} — ${def.listas.length} listas, ${Object.keys(def.etiquetas).length} etiquetas, ${def.cartoes.length} cartões\n`);
  let images = 0;
  for (const list of def.listas) {
    const cards = def.cartoes.filter((c) => c.lista === list);
    console.log(`▸ ${list} (${cards.length})`);
    for (const c of cards) {
      const imgs = imagesOf(c);
      images += imgs.length;
      const done = c.checklist.filter((i) => i.feito).length;
      console.log(`    • ${c.nome}  [${c.etiquetas.join(", ")}]  checklist ${done}/${c.checklist.length} · ${c.links.length} link(s) · ${imgs.length} imagem(ns)`);
    }
  }
  console.log(`\nTotal de imagens a anexar: ${images}`);
}

/** Abre no navegador a página do Trello que gera o token (válido por 1 dia, leitura e escrita). */
function authorize() {
  stopOnCredentialProblems({ token: false });
  const url = new URL("https://trello.com/1/authorize");
  url.searchParams.set("expiration", "1day");
  url.searchParams.set("name", "PPCM - montagem do quadro");
  url.searchParams.set("scope", "read,write");
  url.searchParams.set("response_type", "token");
  url.searchParams.set("key", credentials().key);
  const [cmd, args] = process.platform === "win32" ? ["rundll32", ["url.dll,FileProtocolHandler", url.href]] : process.platform === "darwin" ? ["open", [url.href]] : ["xdg-open", [url.href]];
  spawn(cmd, args, { stdio: "ignore", detached: true }).on("error", () => undefined).unref();
  console.log("Abri a página de autorização do Trello no seu navegador.");
  console.log('1. Confira que está logado na conta que é membro do quadro e clique em "Permitir".');
  console.log("2. O Trello mostra um texto comprido: é o token. Copie tudo.");
  console.log("3. Cole depois de TRELLO_TOKEN= no arquivo .env.trello e salve.");
  console.log("4. Confira com: npm run trello:sync -- --verificar");
  console.log(`\nSe o navegador não abriu, copie este endereço:\n${url.href}`);
}

async function loadBoard() {
  stopOnCredentialProblems({ token: true });
  const me = await api("GET", "/members/me", { fields: "fullName,username" });
  const board = await api("GET", `/boards/${def.quadro}`, { fields: "name,url,prefs" });
  const lists = await api("GET", `/boards/${board.id}/lists`, { filter: "open", fields: "name,pos" });
  const cards = await api("GET", `/boards/${board.id}/cards`, { filter: "open", fields: "name,idList" });
  return { me, board, lists, cards };
}

async function verify() {
  const { me, board, lists, cards } = await loadBoard();
  console.log(`Chave e token aceitos. Conta: ${me.fullName} (@${me.username})`);
  console.log(`Quadro: ${board.name.trim()} — visibilidade: ${board.prefs?.permissionLevel}`);
  console.log(`Hoje no quadro: ${lists.length} lista(s) e ${cards.length} cartão(ões).`);
  for (const l of lists) console.log(`  ▸ ${l.name} (${cards.filter((c) => c.idList === l.id).length})`);
  const missing = def.cartoes.filter((c) => !cards.some((x) => x.name === c.nome)).length;
  console.log(`\nO plano tem ${def.cartoes.length} cartões; faltam criar ${missing}. Para aplicar: npm run trello:sync`);
}

async function sync() {
  const { board, lists: currentLists, cards: currentCards } = await loadBoard();
  console.log(`Quadro: ${board.name.trim()}`);

  // Listas: cria as que faltam e coloca as do plano na ordem definida.
  const lists = new Map(currentLists.map((l) => [l.name, l.id]));
  for (const name of def.listas) {
    if (lists.has(name)) continue;
    const l = await api("POST", "/lists", { name, idBoard: board.id, pos: "bottom" });
    lists.set(name, l.id);
    console.log(`+ lista: ${name}`);
  }
  for (const [i, name] of def.listas.entries()) await api("PUT", `/lists/${lists.get(name)}`, { pos: (i + 1) * 65536 });

  // Etiquetas
  const labels = new Map((await api("GET", `/boards/${board.id}/labels`, { fields: "name,color", limit: 1000 })).filter((l) => l.name).map((l) => [l.name, l.id]));
  for (const [name, color] of Object.entries(def.etiquetas)) {
    if (labels.has(name)) continue;
    const l = await api("POST", "/labels", { name, color, idBoard: board.id });
    labels.set(name, l.id);
    console.log(`+ etiqueta: ${name}`);
  }

  // Cartões
  const existing = new Map(currentCards.map((c) => [c.name, c.id]));
  const stats = { created: 0, reused: 0, checklists: 0, links: 0, images: 0 };
  for (const c of def.cartoes) {
    let id = existing.get(c.nome);
    if (id) stats.reused++;
    else {
      const created = await api("POST", "/cards", { idList: lists.get(c.lista), name: c.nome, desc: c.descricao, idLabels: c.etiquetas.map((e) => labels.get(e)).join(","), pos: "bottom" });
      id = created.id;
      stats.created++;
      console.log(`+ cartão: ${c.nome}`);
    }
    // Checklist (só se o cartão ainda não tiver nenhuma)
    if (c.checklist.length && (await api("GET", `/cards/${id}/checklists`, { fields: "name" })).length === 0) {
      const cl = await api("POST", "/checklists", { idCard: id, name: "Itens" });
      for (const item of c.checklist) await api("POST", `/checklists/${cl.id}/checkItems`, { name: item.nome, checked: item.feito, pos: "bottom" });
      stats.checklists++;
    }
    // Anexos: links e imagens que ainda não estão no cartão
    const attached = new Set((await api("GET", `/cards/${id}/attachments`, { fields: "name" })).map((a) => a.name));
    for (const link of c.links) {
      if (attached.has(link.nome)) continue;
      await api("POST", `/cards/${id}/attachments`, { url: link.url, name: link.nome });
      stats.links++;
    }
    for (const img of imagesOf(c)) {
      if (attached.has(img.name)) continue;
      const form = new FormData();
      form.set("name", img.name);
      form.set("file", new Blob([readFileSync(img.file)], { type: "image/png" }), img.name);
      await api("POST", `/cards/${id}/attachments`, {}, form);
      stats.images++;
    }
  }
  console.log(`\nConcluído: ${stats.created} cartões criados, ${stats.reused} já existiam, ${stats.checklists} checklists, ${stats.links} links e ${stats.images} imagens anexados (${calls} chamadas).`);
  console.log(`Abra: ${board.url}`);
}

const run = arg("--dry-run") ? plan : arg("--autorizar") ? authorize : arg("--verificar") ? verify : sync;
Promise.resolve()
  .then(run)
  .catch((e) => {
    console.error(`Falhou: ${e.message}`);
    process.exit(1);
  });
