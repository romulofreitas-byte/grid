import type { Metadata } from "next";
import { Sora } from "next/font/google";
import { Providers } from "@/components/Providers";
import "./globals.css";

const sora = Sora({
  subsets: ["latin"],
  variable: "--font-sora",
  weight: ["400", "500", "600", "700", "800"],
});

export const metadata: Metadata = {
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000",
  ),
  title: "GRID · Mundo Pódium",
  description:
    "Escolha o nicho. Saia com a lista na ordem de quem ligar — telefone da empresa e sócio que decide.",
  icons: {
    icon: [{ url: "/brand/grid-favicon.svg", type: "image/svg+xml" }],
    apple: [{ url: "/brand/grid.svg", type: "image/svg+xml" }],
  },
  openGraph: {
    title: "GRID · Mundo Pódium",
    description:
      "Escolha o nicho. Saia com a lista na ordem de quem ligar — telefone da empresa e sócio que decide.",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR">
      <body className={`${sora.variable} font-sans antialiased`}>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
