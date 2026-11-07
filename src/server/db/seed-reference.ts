/**
 * Dados de referência (fictícios) — regiões, bairros, temas, órgãos e papéis administrativos.
 * Idempotente. O município é fictício para a demonstração acadêmica.
 */
import type { DbOrTx } from "./client";
import { districts, organs, regions, roles, themes } from "./schema";
import { eq } from "drizzle-orm";
import type { Permission } from "@/lib/permissions";

export const REGIONS: Record<string, string[]> = {
  "Região Central": ["Centro", "Jardim Alecrim", "Bela Vista"],
  "Região Norte": ["Vila Esperança", "Alto do Cruzeiro", "Santa Luzia"],
  "Região Sul": ["Lagoa Azul", "Recanto do Sol", "Morada Nova"],
  "Região Leste": ["Parque das Árvores", "São Jorge"],
  "Zona Rural": ["Distrito de Boa Água"],
};

export const THEMES = [
  "Saúde",
  "Educação",
  "Mobilidade e Transporte",
  "Meio Ambiente",
  "Cultura e Lazer",
  "Esporte",
  "Segurança Pública",
  "Urbanismo e Habitação",
  "Assistência Social",
  "Desenvolvimento Econômico",
  "Infraestrutura e Iluminação",
  "Gestão e Finanças",
];

export const ORGANS: [string, string][] = [
  ["Secretaria Municipal de Saúde", "SMS"],
  ["Secretaria Municipal de Educação", "SEMED"],
  ["Secretaria Municipal de Mobilidade", "SEMOB"],
  ["Secretaria Municipal de Meio Ambiente", "SEMA"],
  ["Secretaria Municipal de Cultura, Esporte e Lazer", "SECEL"],
  ["Secretaria Municipal de Infraestrutura", "SEINFRA"],
  ["Secretaria Municipal de Planejamento e Gestão", "SEPLAG"],
  ["Secretaria Municipal de Assistência Social", "SEMAS"],
  ["Ouvidoria-Geral do Município", "OGM"],
];

/** Papéis administrativos previstos no documento (seção 2.1) (*). */
export const SYSTEM_ROLES: { key: string; name: string; description: string; permissions: Permission[] }[] = [
  {
    key: "gestor_acessos",
    name: "Gestor de acessos",
    description: "Cria contas administrativas, atribui papéis, designa responsáveis por consulta, consulta a auditoria e trata incidentes.",
    permissions: ["usuarios.gerenciar", "papeis.gerenciar", "responsaveis.designar", "auditoria.consultar", "incidentes.tratar", "configuracoes.gerenciar"],
  },
  { key: "responsavel", name: "Responsável pela consulta", description: "Conduz a consulta: publica, altera, suspende, retoma, cancela e cadastra eventos.", permissions: ["consultas.conduzir", "consultas.acompanhar", "eventos.gerenciar"] },
  { key: "elaborador", name: "Elaborador", description: "Cadastra propostas municipais e elabora consultas.", permissions: ["propostas_municipais.gerenciar", "consultas.elaborar"] },
  { key: "revisor", name: "Revisor", description: "Revisa a consulta com a lista de verificação antes da aprovação.", permissions: ["consultas.revisar"] },
  { key: "aprovador", name: "Aprovador", description: "Aprova ou rejeita consultas que não elaborou nem revisou.", permissions: ["consultas.aprovar"] },
  { key: "autorizador_prazo", name: "Autorizador de prazo excepcional", description: "Decide sobre a redução do prazo para 10 dias por emergência.", permissions: ["consultas.autorizar_prazo"] },
  { key: "divulgacao", name: "Divulgação", description: "Gera material de divulgação e registra os canais usados.", permissions: ["consultas.divulgar"] },
  { key: "acompanhamento", name: "Acompanhamento", description: "Acompanha o painel de consultas em andamento e gera relatórios agregados.", permissions: ["consultas.acompanhar", "relatorios.gerar"] },
  { key: "publicacao_resultados", name: "Publicação de resultados", description: "Homologa e publica resultados e retificações.", permissions: ["resultados.publicar"] },
  { key: "encaminhamentos", name: "Encaminhamentos", description: "Registra e atualiza os encaminhamentos após o resultado.", permissions: ["encaminhamentos.registrar"] },
  { key: "analise_propostas", name: "Análise de propostas", description: "Analisa e responde propostas cidadãs.", permissions: ["propostas_cidadas.analisar"] },
  { key: "moderacao", name: "Moderação", description: "Decide sobre conteúdos denunciados.", permissions: ["moderacao.moderar"] },
  { key: "atendimento", name: "Atendimento", description: "Atendimento assistido, análise documental de identidade e registro de perguntas por telefone.", permissions: ["atendimento.registrar", "identidade.analisar"] },
];

export async function seedReferenceData(db: DbOrTx) {
  for (const [regionName, ds] of Object.entries(REGIONS)) {
    await db.insert(regions).values({ name: regionName }).onConflictDoNothing();
    const [r] = await db.select().from(regions).where(eq(regions.name, regionName));
    for (const d of ds) await db.insert(districts).values({ name: d, regionId: r.id }).onConflictDoNothing();
  }
  for (const t of THEMES) await db.insert(themes).values({ name: t }).onConflictDoNothing();
  for (const [name, acronym] of ORGANS) await db.insert(organs).values({ name, acronym }).onConflictDoNothing();
  for (const r of SYSTEM_ROLES) {
    await db.insert(roles).values({ key: r.key, name: r.name, description: r.description, permissions: r.permissions, system: true }).onConflictDoNothing();
  }
}
