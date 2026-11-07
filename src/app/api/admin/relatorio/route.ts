/** Exportação de relatórios agregados (RF049) — CSV e PDF, auditada. */
import { NextResponse, type NextRequest } from "next/server";
import { getCurrentActor } from "@/server/auth/current";
import { generateReport } from "@/server/modules/admin/monitoring.service";
import { buildPdf, toCsv } from "@/server/lib/export-formats";
import { ForbiddenError } from "@/server/lib/errors";
import { CITIZEN_PROPOSAL_STATUS, CONSULTATION_STATUS, fmtDateTime } from "@/lib/labels";

export async function GET(req: NextRequest) {
  const actor = await getCurrentActor();
  const sp = req.nextUrl.searchParams;
  const formato = sp.get("formato") === "pdf" ? "pdf" : "csv";
  try {
    const r = await generateReport(actor!, { from: sp.get("de") ?? undefined, to: sp.get("ate") ?? undefined, themeId: sp.get("tema") ?? undefined, regionId: sp.get("regiao") ?? undefined, status: sp.get("situacao") ?? undefined }, { export: formato });
    if (formato === "csv") {
      const rows = [
        ...r.consultasPorSituacao.map((x) => ({ secao: "consultas_por_situacao", item: CONSULTATION_STATUS[x.situacao as "aberta"]?.label ?? x.situacao, valor: x.quantidade })),
        ...r.participacaoPorConsulta.map((x) => ({ secao: "participacao_por_consulta", item: x.consulta, valor: x.participacoes })),
        ...r.cadastrosPorRegiao.map((x) => ({ secao: "cadastros_por_regiao", item: x.regiao, valor: x.cadastros })),
        ...r.propostasPorEstado.map((x) => ({ secao: "propostas_por_estado", item: CITIZEN_PROPOSAL_STATUS[x.estado as "recebida"]?.label ?? x.estado, valor: x.quantidade })),
        { secao: "tempo_medio_resposta_propostas_dias", item: "média", valor: r.tempoMedioRespostaPropostasDias ?? "" },
      ];
      return new NextResponse(toCsv(rows, ["secao", "item", "valor"]), { headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": 'attachment; filename="relatorio-ppcm.csv"', "Cache-Control": "no-store" } });
    }
    const pdf = await buildPdf(
      [
        { type: "title", text: "Relatório agregado de participação" },
        { type: "text", text: r.supressao },
        { type: "subtitle", text: "Consultas por situação" },
        { type: "table", head: ["Situação", "Quantidade"], rows: r.consultasPorSituacao.map((x) => [CONSULTATION_STATUS[x.situacao as "aberta"]?.label ?? x.situacao, String(x.quantidade)]) },
        { type: "subtitle", text: "Participação por consulta" },
        { type: "table", head: ["Consulta", "Participações"], rows: r.participacaoPorConsulta.map((x) => [x.consulta, String(x.participacoes)]) },
        { type: "subtitle", text: "Cadastros por região" },
        { type: "table", head: ["Região", "Cadastros"], rows: r.cadastrosPorRegiao.map((x) => [x.regiao, String(x.cadastros)]) },
        { type: "subtitle", text: "Propostas por estado" },
        { type: "table", head: ["Estado", "Quantidade"], rows: r.propostasPorEstado.map((x) => [CITIZEN_PROPOSAL_STATUS[x.estado as "recebida"]?.label ?? x.estado, String(x.quantidade)]) },
        { type: "text", text: `Tempo médio até a resposta das propostas: ${r.tempoMedioRespostaPropostasDias ?? "—"} dias.` },
      ],
      `Gerado em ${fmtDateTime(new Date())}`,
    );
    return new NextResponse(new Uint8Array(pdf), { headers: { "Content-Type": "application/pdf", "Content-Disposition": 'attachment; filename="relatorio-ppcm.pdf"', "Cache-Control": "no-store" } });
  } catch (e) {
    if (e instanceof ForbiddenError || !actor) return NextResponse.json({ erro: "Acesso negado." }, { status: 403 });
    throw e;
  }
}
