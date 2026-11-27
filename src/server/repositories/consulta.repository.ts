/**
 * Persistência da entidade Consulta na tabela `consultations` (Drizzle ORM, PostgreSQL).
 * Os serviços carregam a consulta, chamam os métodos de negócio e pedem `salvar()`: só as colunas
 * alteradas são gravadas, na mesma transação da auditoria e dos avisos.
 */
import { eq } from "drizzle-orm";
import type { DbOrTx } from "../db/client";
import { consultations } from "../db/schema";
import { Consulta, type PropriedadesConsulta } from "../domain/entities/consulta";
import { RepositorioDeEntidade } from "./repositorio-de-entidade";

type RegistroConsulta = typeof consultations.$inferSelect;
type ColunaConsulta = keyof typeof consultations.$inferInsert;

const COLUNAS: Record<keyof PropriedadesConsulta, ColunaConsulta> = {
  id: "id",
  titulo: "title",
  slug: "slug",
  propostaMunicipalId: "municipalProposalId",
  situacao: "status",
  situacaoAntesDaSuspensao: "statusBeforeSuspension",
  motivoDaSituacao: "statusReason",
  abertura: "opensAt",
  encerramento: "closesAt",
  abertaEm: "openedAt",
  encerradaEm: "closedAt",
  prazoExcepcional: "exceptionalDeadline",
  autorizacaoDoPrazo: "deadlineAuthorization",
  justificativaDoPrazo: "deadlineDecisionJustification",
  prazoDecididoPor: "deadlineAuthorizedBy",
  versao: "version",
  versaoCongelada: "frozenVersion",
  criadaPor: "createdBy",
  editadaPorUltimo: "lastEditedBy",
  aprovadaPor: "approvedBy",
  aprovadaEm: "approvedAt",
  publicadaEm: "publishedAt",
  observacoesDaRevisao: "reviewObservations",
  retratoDaAbertura: "openSnapshot",
  elegiveisEstimados: "estimatedEligible",
  atualizadaEm: "updatedAt",
};

export class ConsultaRepository extends RepositorioDeEntidade<Consulta, PropriedadesConsulta, RegistroConsulta> {
  constructor(db: DbOrTx) {
    super(db);
  }

  protected get naoEncontrado(): string {
    return "Consulta não encontrada.";
  }

  protected async buscarRegistro(id: string, paraAtualizar: boolean): Promise<RegistroConsulta | undefined> {
    const consulta = this.db.select().from(consultations).where(eq(consultations.id, id));
    const [registro] = paraAtualizar ? await consulta.for("update") : await consulta;
    return registro;
  }

  protected paraPropriedades(r: RegistroConsulta): PropriedadesConsulta {
    return {
      id: r.id,
      titulo: r.title,
      slug: r.slug,
      propostaMunicipalId: r.municipalProposalId,
      situacao: r.status,
      situacaoAntesDaSuspensao: r.statusBeforeSuspension,
      motivoDaSituacao: r.statusReason,
      abertura: r.opensAt,
      encerramento: r.closesAt,
      abertaEm: r.openedAt,
      encerradaEm: r.closedAt,
      prazoExcepcional: r.exceptionalDeadline,
      autorizacaoDoPrazo: r.deadlineAuthorization,
      justificativaDoPrazo: r.deadlineDecisionJustification,
      prazoDecididoPor: r.deadlineAuthorizedBy,
      versao: r.version,
      versaoCongelada: r.frozenVersion,
      criadaPor: r.createdBy,
      editadaPorUltimo: r.lastEditedBy,
      aprovadaPor: r.approvedBy,
      aprovadaEm: r.approvedAt,
      publicadaEm: r.publishedAt,
      observacoesDaRevisao: r.reviewObservations,
      retratoDaAbertura: r.openSnapshot,
      elegiveisEstimados: r.estimatedEligible,
      atualizadaEm: r.updatedAt,
    };
  }

  protected criarEntidade(propriedades: PropriedadesConsulta): Consulta {
    return Consulta.reconstituir(propriedades);
  }

  protected colunaDe(propriedade: keyof PropriedadesConsulta): string {
    return COLUNAS[propriedade];
  }

  protected async gravarColunas(id: string, colunas: Record<string, unknown>): Promise<void> {
    await this.db
      .update(consultations)
      .set(colunas as Partial<typeof consultations.$inferInsert>)
      .where(eq(consultations.id, id));
  }
}
