import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-inter",
});

export const metadata: Metadata = {
  title: "Espaço Criativo — Área de Membros",
  description: "Acesse seus produtos do Espaço Criativo",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Espaço Criativo",
  },
  icons: {
    icon: "/icon-192.png",
    apple: "/icon-192.png",
  },
  other: {
    // legado: garante tela cheia (standalone) em iOS mais antigos
    "apple-mobile-web-app-capable": "yes",
  },
};

export const viewport: Viewport = {
  themeColor: "#EA580C",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="pt-BR" className={inter.variable}>
      <body>
        {/* Captura o evento de instalação cedo (antes da hidratação) para não perdê-lo */}
        <script
          dangerouslySetInnerHTML={{
            __html: `window.__deferredBIP=null;window.addEventListener('beforeinstallprompt',function(e){e.preventDefault();window.__deferredBIP=e;window.dispatchEvent(new Event('bip-ready'));});`,
          }}
        />
        {children}
      </body>
    </html>
  );
}
