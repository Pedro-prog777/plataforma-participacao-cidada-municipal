/** Inicializa o banco e a rotina automática de 1 minuto (RF019) somente no runtime Node.js. */
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("./instrumentation-node");
  }
}
