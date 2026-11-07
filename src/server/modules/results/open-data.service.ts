/**
 * Exportação em formato aberto (RF045, RNF13 — LAI art. 8º §3º): CSV, JSON e PDF com contagens,
 * percentuais, datas e hash. SEM dados pessoais e SEM votos individuais (RN07, RN27).
 */
import { and, asc, eq, gte, inArray, lte } from "drizzle-orm";
import { getDb, type DbOrTx } from "../../db/client";
import { consultations, organs, outcomeEntries, outcomes, results, themes } from "../../db/schema";
import { env } from "../../lib/env";
import { buildPdf, toCsv } from "../../lib/export-formats";
import { clock } from "../../lib/clock";
import { fmtDate, fmtDateTime, OUTCOME_STATUS } from "@/lib/labels";

export const DATA_DICTIONARY = {
  resultados: [
    { campo: "consulta_id", tipo: "uuid", descricao: "Identificador permanente da consulta." },
    { campo: "consulta", tipo: "texto", descricao: "Título da consulta." },
    { campo: "tema", tipo: "texto", descricao: "Área temática." },
    { campo: "abertura", tipo: "data e hora (ISO 8601, UTC)", descricao: "Início do período de participação." },
    { campo: "encerramento", tipo: "data e hora (ISO 8601, UTC)", descricao: "Fim do período de participação." },
    { campo: "tipo_resultado", tipo: "texto", descricao: "final ou retificacao." },
    { campo: "alternativa", tipo: "texto", descricao: "Rótulo da alternativa (ou ABSTENÇÕES / TOTAL)." },
    { campo: "votos", tipo: "inteiro", descricao: "Votos agregados na alternativa." },
    { campo: "percentual_validos", tipo: "decimal (2 casas)", descricao: "Percentual sobre os votos válidos (abstenção não é voto válido)." },
    { campo: "participacoes", tipo: "inteiro", descricao: "Total de participações registradas." },
    { campo: "elegiveis_estimados", tipo: "inteiro", descricao: "Estimativa de elegíveis no retrato da abertura (indicador descritivo)." },
    { campo: "quorum_referencia_atingido", tipo: "booleano", descricao: "Se havia quórum de referência e se foi atingido." },
    { campo: "condicao", tipo: "texto", descricao: "vencedora, empate, sem_votos ou abaixo_quorum." },
    { campo: "hash_resultado", tipo: "texto (SHA-256)", descricao: "Hash do resultado publicado." },
    { campo: "hash_base_apurada", tipo: "texto (SHA-256)", descricao: "Hash da base de votos apurada (votos sem identificação)." },
    { campo: "publicado_em", tipo: "data e hora (ISO 8601, UTC)", descricao: "Data da publicação do resultado." },
  ],
  encaminhamentos: [
    { campo: "consulta_id", tipo: "uuid", descricao: "Consulta relacionada." },
    { campo: "consulta", tipo: "texto", descricao: "Título da consulta." },
    { campo: "decisao", tipo: "texto", descricao: "Decisão relacionada." },
    { campo: "providencias", tipo: "texto", descricao: "Providências registradas." },
    { campo: "orgao", tipo: "texto", descricao: "Órgão responsável." },
    { campo: "situacao", tipo: "texto", descricao: "Prevista, Em andamento, Concluída ou Não realizada." },
    { campo: "justificativa", tipo: "texto", descricao: "Obrigatória quando Não realizada." },
    { campo: "data_prevista", tipo: "data (AAAA-MM-DD)", descricao: "Data prevista, se informada." },
    { campo: "registrado_em", tipo: "data e hora (ISO 8601, UTC)", descricao: "Data do registro da situação." },
  ],
};

export async function resultRows(filter: { consultationId?: string; from?: string; to?: string } = {}, db: DbOrTx = getDb()) {
  const conds = [inArray(results.kind, ["final", "retificacao"])];
  if (filter.consultationId) conds.push(eq(results.consultationId, filter.consultationId));
  if (filter.from) conds.push(gte(results.createdAt, new Date(`${filter.from}T00:00:00-03:00`)));
  if (filter.to) conds.push(lte(results.createdAt, new Date(`${filter.to}T23:59:59-03:00`)));
  const rs = await db
    .select({ r: results, title: consultations.title, opensAt: consultations.opensAt, closesAt: consultations.closesAt, theme: themes.name })
    .from(results)
    .innerJoin(consultations, eq(consultations.id, results.consultationId))
    .leftJoin(themes, eq(themes.id, consultations.themeId))
    .where(and(...conds))
    .orderBy(asc(results.createdAt));
  const rows: Record<string, unknown>[] = [];
  for (const { r, title, opensAt, closesAt, theme } of rs) {
    const base = {
      consulta_id: r.consultationId,
      consulta: title,
      tema: theme,
      abertura: opensAt?.toISOString(),
      encerramento: closesAt?.toISOString(),
      tipo_resultado: r.kind,
      participacoes: r.data.participations,
      elegiveis_estimados: r.data.estimatedEligible,
      quorum_referencia_atingido: r.data.quorum.met,
      condicao: r.data.condition,
      hash_resultado: r.hash,
      hash_base_apurada: r.baseHash,
      publicado_em: r.createdAt.toISOString(),
    };
    for (const a of r.data.alternatives) rows.push({ ...base, alternativa: a.label, votos: a.votes, percentual_validos: a.percentage });
    rows.push({ ...base, alternativa: "ABSTENÇÕES", votos: r.data.abstentions, percentual_validos: "" });
    rows.push({ ...base, alternativa: "TOTAL", votos: r.data.totalVotes, percentual_validos: "" });
  }
  return rows;
}

export async function outcomeRows(filter: { consultationId?: string } = {}, db: DbOrTx = getDb()) {
  const rs = await db
    .select({ o: outcomes, e: outcomeEntries, title: consultations.title, organ: organs.name })
    .from(outcomeEntries)
    .innerJoin(outcomes, eq(outcomes.id, outcomeEntries.outcomeId))
    .innerJoin(consultations, eq(consultations.id, outcomes.consultationId))
    .innerJoin(organs, eq(organs.id, outcomes.organId))
    .where(filter.consultationId ? eq(outcomes.consultationId, filter.consultationId) : undefined)
    .orderBy(asc(outcomeEntries.createdAt));
  return rs.map(({ o, e, title, organ }) => ({
    consulta_id: o.consultationId,
    consulta: title,
    decisao: o.decision,
    providencias: o.actions,
    orgao: organ,
    situacao: OUTCOME_STATUS[e.status].label,
    justificativa: e.justification ?? "",
    data_prevista: e.expectedDate ?? "",
    registrado_em: e.createdAt.toISOString(),
  }));
}

const RESULT_COLS = DATA_DICTIONARY.resultados.map((d) => d.campo);
const OUTCOME_COLS = DATA_DICTIONARY.encaminhamentos.map((d) => d.campo);

export async function exportDataset(dataset: "resultados" | "encaminhamentos", format: "csv" | "json" | "pdf", filter: { consultationId?: string; from?: string; to?: string } = {}, db: DbOrTx = getDb()) {
  const rows: Record<string, unknown>[] = dataset === "resultados" ? await resultRows(filter, db) : await outcomeRows(filter, db);
  const cols = dataset === "resultados" ? RESULT_COLS : OUTCOME_COLS;
  const stamp = clock.now().toISOString().slice(0, 10);
  const filename = `ppcm-${dataset}-${stamp}.${format}`;
  if (format === "csv") return { filename, contentType: "text/csv; charset=utf-8", body: toCsv(rows, cols), empty: rows.length === 0 };
  if (format === "json") {
    return {
      filename,
      contentType: "application/json; charset=utf-8",
      body: JSON.stringify({ fonte: `${env.municipio} — Plataforma de Participação Cidadã`, gerado_em: clock.now().toISOString(), licenca: "Dados abertos (LAI, art. 8º, §3º)", dicionario: DATA_DICTIONARY[dataset], registros: rows }, null, 2),
      empty: rows.length === 0,
    };
  }
  const pdf = await buildPdf(
    [
      { type: "title", text: dataset === "resultados" ? "Resultados de consultas públicas" : "Encaminhamentos registrados" },
      { type: "text", text: `${env.municipio}. Dados agregados, sem dados pessoais nem votos individuais. Resultado de participação voluntária; não representa estatisticamente toda a população do município.` },
      { type: "space" },
      dataset === "resultados"
        ? { type: "table", head: ["Consulta", "Alternativa", "Votos", "% válidos", "Publicado"], rows: rows.map((r) => [String(r.consulta), String(r.alternativa), String(r.votos), String(r.percentual_validos), fmtDate(String(r.publicado_em))]) }
        : { type: "table", head: ["Consulta", "Decisão", "Órgão", "Situação", "Registro"], rows: rows.map((r) => [String(r.consulta), String(r.decisao), String(r.orgao), String(r.situacao), fmtDateTime(String(r.registrado_em))]) },
    ],
    `Gerado em ${fmtDateTime(clock.now())}`,
  );
  return { filename, contentType: "application/pdf", body: Buffer.from(pdf), empty: rows.length === 0 };
}
