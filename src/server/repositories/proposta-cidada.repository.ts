/**
 * Persistência da entidade PropostaCidada na tabela `citizen_proposals` (Drizzle ORM, PostgreSQL).
 */
import { eq } from "drizzle-orm";
import type { DbOrTx } from "../db/client";
import { citizenProposals } from "../db/schema";
import { PropostaCidada, type PropriedadesProposta } from "../domain/entities/proposta-cidada";
import { RepositorioDeEntidade } from "./repositorio-de-entidade";

type RegistroProposta = typeof citizenProposals.$inferSelect;
type ColunaProposta = keyof typeof citizenProposals.$inferInsert;

const COLUNAS: Record<keyof PropriedadesProposta, ColunaProposta> = {
  id: "id",
  protocolo: "protocol",
  autorId: "authorId",
  situacao: "status",
  titulo: "title",
  problema: "problem",
  solucao: "solution",
  temaId: "themeId",
  bairroId: "districtId",
  autorizaPublicacao: "authorizePublication",
  textoDeBusca: "searchText",
  tipoDeResposta: "responseType",
  textoDaResposta: "responseText",
  orientacaoDoAjuste: "adjustmentGuidance",
  prazoDoAjuste: "adjustmentDeadline",
  propostaMunicipalId: "municipalProposalId",
  publicadaEm: "publishedAt",
  atualizadaEm: "updatedAt",
};

export class PropostaCidadaRepository extends RepositorioDeEntidade<PropostaCidada, PropriedadesProposta, RegistroProposta> {
  constructor(db: DbOrTx) {
    super(db);
  }

  protected get naoEncontrado(): string {
    return "Registro não encontrado.";
  }

  protected async buscarRegistro(id: string, paraAtualizar: boolean): Promise<RegistroProposta | undefined> {
    const consulta = this.db.select().from(citizenProposals).where(eq(citizenProposals.id, id));
    const [registro] = paraAtualizar ? await consulta.for("update") : await consulta;
    return registro;
  }

  protected paraPropriedades(r: RegistroProposta): PropriedadesProposta {
    return {
      id: r.id,
      protocolo: r.protocol,
      autorId: r.authorId,
      situacao: r.status,
      titulo: r.title,
      problema: r.problem,
      solucao: r.solution,
      temaId: r.themeId,
      bairroId: r.districtId,
      autorizaPublicacao: r.authorizePublication,
      textoDeBusca: r.searchText,
      tipoDeResposta: r.responseType,
      textoDaResposta: r.responseText,
      orientacaoDoAjuste: r.adjustmentGuidance,
      prazoDoAjuste: r.adjustmentDeadline,
      propostaMunicipalId: r.municipalProposalId,
      publicadaEm: r.publishedAt,
      atualizadaEm: r.updatedAt,
    };
  }

  protected criarEntidade(propriedades: PropriedadesProposta): PropostaCidada {
    return PropostaCidada.reconstituir(propriedades);
  }

  protected colunaDe(propriedade: keyof PropriedadesProposta): string {
    return COLUNAS[propriedade];
  }

  protected async gravarColunas(id: string, colunas: Record<string, unknown>): Promise<void> {
    await this.db
      .update(citizenProposals)
      .set(colunas as Partial<typeof citizenProposals.$inferInsert>)
      .where(eq(citizenProposals.id, id));
  }
}
