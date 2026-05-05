/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  // Rewrites no Next (não só em vercel.json) para a Vercel tratar o projeto como Next.js e servir /api/*.
  async rewrites() {
    return [
      { source: "/", destination: "/app.html" },
      { source: "/app", destination: "/app.html" },
      { source: "/amplipatio", destination: "/app.html" },
      { source: "/patio", destination: "/app.html" },
    ];
  },
  async headers() {
    const noStore = [{ key: "Cache-Control", value: "no-store, must-revalidate" }];
    const htmlUtf8 = [{ key: "Content-Type", value: "text/html; charset=utf-8" }];
    return [
      { source: "/app.html", headers: [...htmlUtf8, ...noStore] },
      { source: "/", headers: [...htmlUtf8, ...noStore] },
      { source: "/app", headers: [...htmlUtf8, ...noStore] },
      { source: "/amplipatio", headers: [...htmlUtf8, ...noStore] },
      { source: "/patio", headers: [...htmlUtf8, ...noStore] },
    ];
  },
};

module.exports = nextConfig;
