import type { Metadata, Viewport } from "next";
import { Public_Sans } from "next/font/google";
import { Suspense } from "react";
import { ContrastPreference, NavigationProgress, TamanhoTextoPreferencia } from "@/components/layout/client-bits";
import { ProvedorCatalogoRequisitos } from "@/components/requisitos/ref-text";
import { resumoCatalogoRequisitos } from "@/server/lib/documento-requisitos";
import "./globals.css";

const publicSans = Public_Sans({ subsets: ["latin"], variable: "--font-public-sans", display: "swap" });

// Todas as páginas dependem de sessão e do nonce da CSP: renderização dinâmica.
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: { default: "Participação Cidadã", template: "%s · Participação Cidadã" },
  description: "Plataforma de Participação Cidadã Municipal: consultas públicas, votação consultiva, propostas e transparência.",
  applicationName: "PPCM",
  robots: { index: false, follow: false },
};

export const viewport: Viewport = { width: "device-width", initialScale: 1, themeColor: "#134074" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" className={publicSans.variable}>
      <body className="min-h-dvh antialiased">
        <Suspense>
          <NavigationProgress />
        </Suspense>
        <ContrastPreference />
        <TamanhoTextoPreferencia />
        {/* Catálogo de requisitos extraído do documento: transforma RF/RNF/RN/RS citados na interface em links (DT-24). */}
        <ProvedorCatalogoRequisitos catalogo={resumoCatalogoRequisitos()}>{children}</ProvedorCatalogoRequisitos>
      </body>
    </html>
  );
}
