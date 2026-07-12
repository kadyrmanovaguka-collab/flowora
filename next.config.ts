import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,

  // Supabase Storage может отдавать аватарки/картинки — разрешаем домен,
  // чтобы next/image мог их оптимизировать без ошибки "Invalid src prop".
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "*.supabase.co",
        pathname: "/storage/v1/object/public/**",
      },
      {
        protocol: "https",
        hostname: "lh3.googleusercontent.com", // аватарки Google OAuth
      },
    ],
  },

  // Заголовки безопасности. Особенно важно для PWA-таймера, который должен
  // работать оффлайн, и для страницы с Stripe-редиректами.
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
        ],
      },
      {
        // service worker не должен кэшироваться агрессивно — иначе обновления
        // PWA будут доходить до пользователей с задержкой в дни
        source: "/sw.js",
        headers: [
          { key: "Cache-Control", value: "public, max-age=0, must-revalidate" },
        ],
      },
    ];
  },
};

export default nextConfig;
