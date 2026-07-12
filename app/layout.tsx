import type { Metadata, Viewport } from "next";
import "./globals.css";

// Это ЕДИНСТВЕННЫЙ layout в дереве, который обязан рендерить <html> и <body> —
// Next.js App Router требует ровно один корневой layout с этими тегами.
// Route groups (marketing) и (app) со своими layout.tsx оборачиваются ВНУТРИ
// этого <body>, а не заменяют его — поэтому их layout'ы содержат только
// <header>/<main>/<footer>, без html/body.
export const metadata: Metadata = {
  title: "Flowora — фокус-таймер Помодоро",
  description: "Минималистичный Pomodoro-таймер с историей прогресса, задачами и блокировкой отвлекающих сайтов.",
  manifest: "/manifest.json",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#7c3aed",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ru" suppressHydrationWarning>
      <head>
        {/*
          Этот скрипт выполняется синхронно ДО того, как React вообще
          начнёт рендерить страницу (он лежит в <head>, парсится раньше
          <body>) — благодаря этому класс .dark применяется к <html> ещё
          до первой отрисовки, и пользователь не видит вспышку светлой
          темы на долю секунды перед тем как подхватится тёмная.
          suppressHydrationWarning на <html> нужен по той же причине:
          React иначе ругался бы на несовпадение серверного и клиентского
          рендера (сервер не знает про localStorage).
        */}
        <script
          dangerouslySetInnerHTML={{
            __html: `
              try {
                var theme = localStorage.getItem('flowora-theme');
                var prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
                if (theme === 'dark' || (!theme && prefersDark)) {
                  document.documentElement.classList.add('dark');
                }
              } catch (e) {}
            `,
          }}
        />
      </head>
      <body className="min-h-screen bg-background font-sans antialiased">{children}</body>
    </html>
  );
}
