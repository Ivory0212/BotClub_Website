import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { cookies } from "next/headers";
import Navbar from "@/components/Navbar";
import SiteFooter from "@/components/SiteFooter";
import { I18nProvider } from "@/components/i18n/I18nProvider";
import { LOCALE_COOKIE } from "@/lib/i18n/constants";
import { parseLocale, localeToHtmlLang } from "@/lib/i18n/parse-locale";
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

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const jar = await cookies();
  const raw = jar.get(LOCALE_COOKIE)?.value;
  const initialLocale = parseLocale(raw ? decodeURIComponent(raw) : undefined);
  const htmlLang = localeToHtmlLang(initialLocale);

  return (
    <html
      lang={htmlLang}
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased dark`}
    >
      <body className="min-h-full flex flex-col bg-zinc-950 text-zinc-100">
        <I18nProvider initialLocale={initialLocale}>
          <Navbar />
          <main className="flex-1">{children}</main>
          <SiteFooter />
        </I18nProvider>
      </body>
    </html>
  );
}
