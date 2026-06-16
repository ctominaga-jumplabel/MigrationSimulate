import type { Metadata } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { Providers } from "./providers";
import { Sidebar } from "@/components/layout/Sidebar";
import { Topbar } from "@/components/layout/Topbar";

const inter = Inter({ subsets: ["latin"], variable: "--font-sans", display: "swap" });
const mono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Cogna Migration Mission Control",
  description:
    "Central executiva de simulação de esforço, duração e sprints para a migração SAS → Databricks.",
  icons: { icon: "/cogna-logo.png" },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="pt-BR" className={`${inter.variable} ${mono.variable}`}>
      <body className="grad-bg">
        <Providers>
          <Sidebar />
          <div className="lg:pl-64">
            <Topbar />
            <main className="mx-auto max-w-[1400px] px-5 py-7 md:px-8">
              {children}
            </main>
          </div>
        </Providers>
      </body>
    </html>
  );
}
