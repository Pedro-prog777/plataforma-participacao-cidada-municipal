/**
 * Parâmetros configuráveis sem alterar código (RNF12). Valores marcados como `pendente`
 * dependem de validação do cliente (*) — ver docs/PENDENCIAS_CLIENTE.md.
 */
import { eq } from "drizzle-orm";
import { getDb, type DbOrTx } from "../db/client";
import { settings } from "../db/schema";

type SettingDef = { default: unknown; label: string; group: string; pendente?: boolean; source: string; kind: "number" | "boolean" | "text" | "select"; options?: string[] };

export const SETTINGS = {
  "consulta.prazo_padrao_dias": { default: 20, label: "Prazo padrão de participação (dias)", group: "Consultas", pendente: true, source: "RF025/RN14", kind: "number" },
  "consulta.prazo_excepcional_dias": { default: 10, label: "Prazo excepcional por emergência (dias)", group: "Consultas", pendente: true, source: "RF025/RF029/RN14", kind: "number" },
  "consulta.antecedencia_minima_horas": { default: 24, label: "Antecedência mínima entre aprovação/publicação e abertura (horas)", group: "Consultas", pendente: true, source: "RN15 (valor não definido no documento)", kind: "number" },
  "consulta.publico_padrao": { default: "domicilio", label: "Público-alvo padrão de novas consultas", group: "Consultas", pendente: true, source: "RF027", kind: "select", options: ["domicilio", "aberta"] },
  "consulta.baixa_participacao_percentual": { default: 5, label: "Alerta de baixa participação (% dos elegíveis estimados, na metade do prazo)", group: "Consultas", source: "RF048", kind: "number" },
  "proposta.limite_em_analise": { default: 3, label: "Limite de propostas em análise por cidadão", group: "Propostas", pendente: true, source: "RF020", kind: "number" },
  "proposta.prazo_ajuste_dias": { default: 15, label: "Prazo para o autor atender ajuste solicitado (dias)", group: "Propostas", pendente: true, source: "RF021 (parâmetro pendente)", kind: "number" },
  "denuncia.limite_ocultacao": { default: 3, label: "Denúncias para ocultar conteúdo até a decisão", group: "Moderação", source: "RF065 (parâmetro)", kind: "number" },
  "sessao.inatividade_minutos": { default: 30, label: "Expiração da sessão por inatividade — cidadão (min)", group: "Segurança", pendente: true, source: "RN26 (valor não definido)", kind: "number" },
  "sessao.inatividade_admin_minutos": { default: 15, label: "Expiração da sessão por inatividade — administração (min)", group: "Segurança", pendente: true, source: "RN26 (valor não definido)", kind: "number" },
  "login.max_falhas": { default: 5, label: "Falhas seguidas até bloquear a conta", group: "Segurança", source: "RN24/RS007", kind: "number" },
  "login.bloqueio_minutos": { default: 15, label: "Tempo de bloqueio temporário (min)", group: "Segurança", source: "RN24/RS007", kind: "number" },
  "login.captcha_falhas_ip": { default: 10, label: "Falhas do mesmo IP (1 hora) para exigir CAPTCHA", group: "Segurança", pendente: true, source: "RF010", kind: "number" },
  "relatorio.supressao_minima": { default: 10, label: "Tamanho mínimo de grupo exibido em relatórios", group: "Privacidade", source: "RF049/RS002", kind: "number" },
  "lembrete.horas_antes": { default: 48, label: "Lembrete antes do encerramento (horas)", group: "Notificações", source: "RF055", kind: "number" },
  "divulgacao.sugerir_dias_antes": { default: 3, label: "Sugerir nova divulgação a X dias do fim", group: "Divulgação", source: "RF062", kind: "number" },
  "resultado.publicar_preliminar": { default: false, label: "Publicar resultado preliminar antes da homologação", group: "Resultados", pendente: true, source: "RF043 (*)", kind: "boolean" },
  "recursos.comentarios": { default: false, label: "Comentários e perguntas (RF064)", group: "Recursos condicionados (*)", pendente: true, source: "RF064", kind: "boolean" },
  "comentarios.moderacao_previa": { default: false, label: "Comentário sinalizado só é publicado após revisão", group: "Recursos condicionados (*)", pendente: true, source: "RF064", kind: "boolean" },
  "recursos.apoios": { default: false, label: "Apoio a propostas cidadãs (RF067)", group: "Recursos condicionados (*)", pendente: true, source: "RF067", kind: "boolean" },
  "apoios.meta": { default: 0, label: "Meta de apoios (0 = não definida; obrigatório antes de habilitar)", group: "Recursos condicionados (*)", pendente: true, source: "RF067", kind: "number" },
  "apoios.prazo_dias": { default: 0, label: "Prazo para atingir a meta (dias; 0 = não definido)", group: "Recursos condicionados (*)", pendente: true, source: "RF067", kind: "number" },
  "recursos.eventos": { default: false, label: "Eventos participativos e perguntas (RF068)", group: "Recursos condicionados (*)", pendente: true, source: "RF068", kind: "boolean" },
  "termos.versao": { default: "1.0", label: "Versão vigente dos Termos de Uso e Política de Privacidade", group: "Privacidade", source: "RF001", kind: "text" },
} satisfies Record<string, SettingDef>;

export type SettingKey = keyof typeof SETTINGS;
type ValueOf<K extends SettingKey> = (typeof SETTINGS)[K]["default"] extends number
  ? number
  : (typeof SETTINGS)[K]["default"] extends boolean
    ? boolean
    : string;

let cache: { at: number; values: Map<string, unknown> } | null = null;
const TTL = 5_000;

export function invalidateSettingsCache() {
  cache = null;
}

async function load(db: DbOrTx): Promise<Map<string, unknown>> {
  if (cache && Date.now() - cache.at < TTL) return cache.values;
  const rows = await db.select().from(settings);
  const values = new Map(rows.map((r) => [r.key, r.value]));
  cache = { at: Date.now(), values };
  return values;
}

export async function getSetting<K extends SettingKey>(key: K, db: DbOrTx = getDb()): Promise<ValueOf<K>> {
  const values = await load(db);
  return (values.has(key) ? values.get(key) : SETTINGS[key].default) as ValueOf<K>;
}

export async function getAllSettings(db: DbOrTx = getDb()) {
  const values = await load(db);
  return Object.entries(SETTINGS).map(([key, def]) => ({ key: key as SettingKey, ...def, value: values.has(key) ? values.get(key) : def.default }));
}

export async function writeSetting(db: DbOrTx, key: SettingKey, value: unknown, userId: string | null) {
  await db
    .insert(settings)
    .values({ key, value, updatedBy: userId, updatedAt: new Date() })
    .onConflictDoUpdate({ target: settings.key, set: { value, updatedBy: userId, updatedAt: new Date() } });
  invalidateSettingsCache();
}

export async function deleteSetting(db: DbOrTx, key: SettingKey) {
  await db.delete(settings).where(eq(settings.key, key));
  invalidateSettingsCache();
}
