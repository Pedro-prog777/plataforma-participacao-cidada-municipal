/** Arquivos de texto importados como string no build (regra `?raw` em next.config.ts; nativo no Vitest). */
declare module "*.md?raw" {
  const conteudo: string;
  export default conteudo;
}
