/**
 * Monta o quadro Trello do projeto a partir de docs/trello/quadro.json:
 * listas, etiquetas, cartões, checklists, links para o GitHub e capturas de tela.
 *
 * Uso:
 *   node scripts/trello-sync.mjs --dry-run   (só mostra o que seria feito; não acessa o Trello)
 *   node scripts/trello-sync.mjs             (aplica no quadro)
 *
 * Credenciais: variáveis TRELLO_KEY e TRELLO_TOKEN, ou arquivo .env.trello na raiz
 * (ignorado pelo Git). Nunca coloque a chave ou o token em arquivos versionados.
 *
 * O script só ACRESCENTA: não apaga, não arquiva e não altera listas ou cartões que já
 * existem. Pode ser executado de novo: o que já foi criado é reaproveitado pelo nome.
 */
import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const dryRun = process.argv.includes("--dry-run");
const def = JSON.parse(readFileSync(path.join(root, "docs/trello/quadro.json"), "utf8"));
const API = "https://api.trello.com/1";

function credentials() {
  const env = { ...process.env };
  const file = path.join(root, ".env.trello");
  if (existsSync(file)) {
    for (const line of readFileSync(file, "utf8").split(/\r?\n/)) {
      const m = line.match(/^\s*(TRELLO_KEY|TRELLO_TOKEN)\s*=\s*(.+?)\s*$/);
      if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, "");
    }
  }
  return { key: env.TRELLO_KEY, token: env.TRELLO_TOKEN };
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
      // Nunca incluir a URL na mensagem: ela carrega a chave e o token.
      throw new Error(`Trello respondeu ${res.status} em ${method} ${route}: ${(await res.text()).slice(0, 200)}`);
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

async function sync() {
  const { key, token } = credentials();
  if (!key || !token) {
    console.error("Faltam as credenciais. Defina TRELLO_KEY e TRELLO_TOKEN (variáveis de ambiente ou arquivo .env.trello).\nVeja docs/trello/PLANO_TRELLO.md.");
    process.exit(2);
  }
  const board = await api("GET", `/boards/${def.quadro}`, { fields: "name,url" });
  console.log(`Quadro: ${board.name}`);

  // Listas (na ordem definida; as que já existem são mantidas como estão)
  const lists = new Map((await api("GET", `/boards/${board.id}/lists`, { filter: "open", fields: "name" })).map((l) => [l.name, l.id]));
  for (const name of def.listas) {
    if (lists.has(name)) continue;
    const l = await api("POST", "/lists", { name, idBoard: board.id, pos: "bottom" });
    lists.set(name, l.id);
    console.log(`+ lista: ${name}`);
  }

  // Etiquetas
  const labels = new Map((await api("GET", `/boards/${board.id}/labels`, { fields: "name,color", limit: 1000 })).filter((l) => l.name).map((l) => [l.name, l.id]));
  for (const [name, color] of Object.entries(def.etiquetas)) {
    if (labels.has(name)) continue;
    const l = await api("POST", "/labels", { name, color, idBoard: board.id });
    labels.set(name, l.id);
    console.log(`+ etiqueta: ${name}`);
  }

  // Cartões
  const existing = new Map((await api("GET", `/boards/${board.id}/cards`, { filter: "open", fields: "name" })).map((c) => [c.name, c.id]));
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

if (dryRun) plan();
else sync().catch((e) => {
  console.error(`Falhou: ${e.message}`);
  process.exit(1);
});
