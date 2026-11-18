import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";

import "./globals.css";

// tipografía local: el build no sale a internet
const inter = localFont({
  src: "./fonts/inter-latin-variable.woff2",
  variable: "--font-inter",
  display: "swap",
});

export const metadata: Metadata = {
  title: { default: "Configurador 3D de placares · DEMO", template: "%s · Configurador 3D DEMO" },
  description: "Demostración privada de un configurador 3D de placares corredizos integrado en Tiendanube.",
  // es una propuesta privada: no se indexa
  robots: { index: false, follow: false },
};

export const viewport: Viewport = { themeColor: "#ece5d8", width: "device-width", initialScale: 1 };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es-AR" className={inter.variable}>
      <head>
        <script dangerouslySetInnerHTML={{ __html: "document.documentElement.classList.add('js')" }} />
      </head>
      <body className="min-h-dvh">{children}</body>
    </html>
  );
}
