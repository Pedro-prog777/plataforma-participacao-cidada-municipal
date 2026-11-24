/**
 * Provedor de identidade (RF004, RF005, RF011).
 *
 * A integração REAL com o gov.br exige credenciamento oficial (client_id/secret emitidos pelo
 * governo federal) e ambiente homologado. Sem isso, NÃO há integração real: o sistema usa o
 * `SimulatedIdentityProvider`, claramente identificado como DEMONSTRAÇÃO ACADÊMICA, que não
 * usa marca, layout ou endereços do gov.br.
 */
import { env, demoMode } from "./env";

export type IdentityLevel = "bronze" | "prata" | "ouro";
export type IdentityAssertion = { cpf: string; name: string; level: IdentityLevel; providerName: string; simulated: boolean };

export interface IdentityProvider {
  readonly name: string;
  readonly simulated: boolean;
  /** URL para iniciar a autenticação no provedor. */
  authorizationUrl(state: string, returnTo: string): string;
}

export class SimulatedIdentityProvider implements IdentityProvider {
  readonly name = "gov.br (simulado)";
  readonly simulated = true;
  authorizationUrl(state: string, returnTo: string) {
    return `/demo/provedor-identidade?state=${encodeURIComponent(state)}&retorno=${encodeURIComponent(returnTo)}`;
  }
}

/**
 * Esqueleto do adaptador oficial. A troca do código de autorização por tokens e a leitura dos
 * selos de confiabilidade devem seguir a documentação oficial do Login Único quando houver
 * credenciais. Mantido sem implementação de rede para não simular uma integração inexistente.
 */
export class OfficialGovBrProvider implements IdentityProvider {
  readonly name = "gov.br";
  readonly simulated = false;
  authorizationUrl(): string {
    throw new Error("Integração oficial com o gov.br não configurada: requer credenciamento junto ao Login Único. Veja docs/arquitetura/DECISOES_TECNICAS.md (DT-09).");
  }
}

export function getIdentityProvider(): IdentityProvider {
  if (process.env.GOVBR_CLIENT_ID && process.env.GOVBR_ISSUER) return new OfficialGovBrProvider();
  if (!demoMode()) throw new Error("Nenhum provedor de identidade disponível fora do modo demonstração.");
  return new SimulatedIdentityProvider();
}

export const LEVEL_ORDER: Record<IdentityLevel, number> = { bronze: 1, prata: 2, ouro: 3 };
export const appUrl = () => env.appUrl;
