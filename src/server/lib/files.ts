/**
 * Recebimento seguro de arquivos (RF023, RF004, RF020, RS012):
 *  1) tamanho máximo; 2) formato REAL pela assinatura (magic bytes), não pela extensão;
 *  3) verificação antivírus (ClamAV via clamd, se configurado; senão verificação embutida);
 *  4) hash SHA-256; 5) armazenamento fora da pasta pública, com nome aleatório.
 */
import crypto from "node:crypto";
import fs from "node:fs/promises";
import net from "node:net";
import path from "node:path";
import { DomainError } from "./errors";
import { env } from "./env";

export type MediaType = "documento" | "imagem" | "audio" | "video";
export type DetectedFile = { mime: string; ext: string; mediaType: MediaType };

const startsWith = (buf: Buffer, bytes: number[], offset = 0) => bytes.every((b, i) => buf[offset + i] === b);

/** Detecta o tipo real do arquivo pelos primeiros bytes. */
export function detectFileType(buf: Buffer, filename: string): DetectedFile | null {
  const ext = path.extname(filename).toLowerCase().replace(".", "");
  if (startsWith(buf, [0x25, 0x50, 0x44, 0x46, 0x2d])) return { mime: "application/pdf", ext: "pdf", mediaType: "documento" };
  if (startsWith(buf, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return { mime: "image/png", ext: "png", mediaType: "imagem" };
  if (startsWith(buf, [0xff, 0xd8, 0xff])) return { mime: "image/jpeg", ext: "jpg", mediaType: "imagem" };
  if (startsWith(buf, [0x52, 0x49, 0x46, 0x46]) && buf.subarray(8, 12).toString("latin1") === "WEBP") return { mime: "image/webp", ext: "webp", mediaType: "imagem" };
  if (startsWith(buf, [0x52, 0x49, 0x46, 0x46]) && buf.subarray(8, 12).toString("latin1") === "WAVE") return { mime: "audio/wav", ext: "wav", mediaType: "audio" };
  if (startsWith(buf, [0x49, 0x44, 0x33]) || startsWith(buf, [0xff, 0xfb]) || startsWith(buf, [0xff, 0xf3])) return { mime: "audio/mpeg", ext: "mp3", mediaType: "audio" };
  if (startsWith(buf, [0x4f, 0x67, 0x67, 0x53])) return { mime: "audio/ogg", ext: "ogg", mediaType: "audio" };
  if (buf.subarray(4, 8).toString("latin1") === "ftyp") return { mime: "video/mp4", ext: "mp4", mediaType: "video" };
  if (startsWith(buf, [0x1a, 0x45, 0xdf, 0xa3])) return { mime: "video/webm", ext: "webm", mediaType: "video" };
  if (startsWith(buf, [0x50, 0x4b, 0x03, 0x04])) {
    // Contêiner ZIP: ODS e XLSX. Confirma pelo conteúdo, não só pela extensão.
    const head = buf.subarray(0, Math.min(buf.length, 4096)).toString("latin1");
    if (ext === "ods" && head.includes("application/vnd.oasis.opendocument.spreadsheet")) return { mime: "application/vnd.oasis.opendocument.spreadsheet", ext: "ods", mediaType: "documento" };
    if (ext === "xlsx" && (head.includes("[Content_Types].xml") || head.includes("xl/"))) return { mime: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", ext: "xlsx", mediaType: "documento" };
    return null;
  }
  if (ext === "csv" && isPlainText(buf)) return { mime: "text/csv", ext: "csv", mediaType: "documento" };
  return null;
}

function isPlainText(buf: Buffer): boolean {
  const sample = buf.subarray(0, Math.min(buf.length, 8192));
  for (const b of sample) {
    if (b === 0) return false;
    if (b < 0x09 || (b > 0x0d && b < 0x20 && b !== 0x1b)) return false;
  }
  return true;
}

const EICAR = "X5O!P%@AP[4\\PZX54(P^)7CC)7}$EICAR-STANDARD-ANTIVIRUS-TEST-FILE!$H+H*";

/** Verificação antivírus. Retorna o nome da ameaça encontrada ou null. */
export async function scanForViruses(buf: Buffer): Promise<string | null> {
  const host = process.env.CLAMAV_HOST?.trim();
  if (host) return clamdScan(buf, host, Number(process.env.CLAMAV_PORT || 3310));
  // Verificação embutida (demonstração): assinatura de teste EICAR e executáveis disfarçados.
  const text = buf.toString("latin1");
  if (text.includes(EICAR)) return "EICAR-Test-Signature";
  if (startsWith(buf, [0x4d, 0x5a])) return "Executavel-Windows (PE)";
  if (startsWith(buf, [0x7f, 0x45, 0x4c, 0x46])) return "Executavel-ELF";
  return null;
}

function clamdScan(buf: Buffer, host: string, port: number): Promise<string | null> {
  return new Promise((resolve, reject) => {
    const socket = net.createConnection({ host, port }, () => {
      socket.write("zINSTREAM\0");
      const chunk = 64 * 1024;
      for (let i = 0; i < buf.length; i += chunk) {
        const part = buf.subarray(i, i + chunk);
        const len = Buffer.alloc(4);
        len.writeUInt32BE(part.length);
        socket.write(len);
        socket.write(part);
      }
      socket.write(Buffer.alloc(4));
    });
    let response = "";
    socket.setTimeout(30_000, () => socket.destroy(new Error("ClamAV sem resposta")));
    socket.on("data", (d) => (response += d.toString()));
    socket.on("end", () => {
      if (response.includes("FOUND")) resolve(response.replace(/^stream:\s*/, "").replace(/\s*FOUND.*$/s, "").trim());
      else if (response.includes("OK")) resolve(null);
      else reject(new Error(`Resposta inesperada do ClamAV: ${response}`));
    });
    socket.on("error", reject);
  });
}

export type StoredFile = { storagePath: string; sha256: string; sizeBytes: number; mime: string; mediaType: MediaType; filename: string };

export async function receiveFile(file: File, opts: { maxBytes: number; allowed: MediaType[] }): Promise<StoredFile> {
  if (!file || file.size === 0) throw new DomainError("Selecione um arquivo.", "arquivo_vazio");
  if (file.size > opts.maxBytes) {
    throw new DomainError(`O arquivo excede o limite de ${Math.round(opts.maxBytes / 1024 / 1024)} MB.`, "arquivo_grande");
  }
  const buf = Buffer.from(await file.arrayBuffer());
  const detected = detectFileType(buf, file.name);
  if (!detected || !opts.allowed.includes(detected.mediaType)) {
    throw new DomainError("Formato de arquivo não permitido ou conteúdo não corresponde à extensão.", "formato_invalido");
  }
  const threat = await scanForViruses(buf);
  if (threat) throw new DomainError(`Arquivo recusado pela verificação antivírus (${threat}).`, "virus");
  const sha = crypto.createHash("sha256").update(buf).digest("hex");
  const rel = path.join(sha.slice(0, 2), `${crypto.randomUUID()}.${detected.ext}`);
  const abs = path.resolve(env.storageDir, rel);
  await fs.mkdir(path.dirname(abs), { recursive: true });
  await fs.writeFile(abs, buf, { mode: 0o600 });
  const safeName = path.basename(file.name).replace(/[^\p{L}\p{N}._ -]/gu, "_").slice(0, 120);
  return { storagePath: rel, sha256: sha, sizeBytes: buf.length, mime: detected.mime, mediaType: detected.mediaType, filename: safeName };
}

export async function readStoredFile(rel: string): Promise<Buffer> {
  const base = path.resolve(env.storageDir);
  const abs = path.resolve(base, rel);
  if (!abs.startsWith(base + path.sep)) throw new DomainError("Caminho inválido.");
  return fs.readFile(abs);
}
