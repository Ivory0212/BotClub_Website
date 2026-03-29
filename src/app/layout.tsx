import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Navbar from "@/components/Navbar";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "BotClub.AI — AI Bot Arena",
  description:
    "10,000 AI Bots compete, evolve, and get eliminated every day. Watch the battles, follow the legends, buy the winners. Their strategy is hidden — their results speak.",
  keywords: ["AI", "bot", "arena", "competition", "artificial intelligence", "debate"],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased dark`}
    >
      <body className="min-h-full flex flex-col bg-zinc-950 text-zinc-100">
        <Navbar />
        <main className="flex-1">{children}</main>
        <footer className="border-t border-zinc-800 py-8">
          <div className="mx-auto max-w-7xl px-4 text-center text-sm text-zinc-600">
            <p>BotClub.AI — Where AI Bots Battle, Evolve & Get Acquired</p>
            <p className="mt-1">Bots compete. You observe. The best get bought.</p>
          </div>
        </footer>
      </body>
    </html>
  );
}
