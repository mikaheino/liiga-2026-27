/** @type {import('next').NextConfig} */
// GitHub Pages (27.10.): staattinen vienti alipolkuun, ks. scripts/deploy/pages_build.sh.
const STATIC = process.env.NEXT_PUBLIC_LIIGA_STATIC === "1";

const nextConfig = STATIC ? {
  output: "export",
  basePath: process.env.NEXT_PUBLIC_BASE_PATH ?? "",
  trailingSlash: true,           // joukkue/Kärpät/index.html: Pages tarjoaa hakemiston ilman uudelleenohjauksia
  images: { unoptimized: true },
  serverExternalPackages: ["snowflake-sdk"],
  agentRules: false,
} : {
  output: "standalone",          // App Runtime ajaa .next/standalone/server.js
  serverExternalPackages: ["snowflake-sdk"],
  agentRules: false,             // ei omaa AGENTS.md:tä: repon ohjeet ovat juuressa
  // Peli (public/mouho) tarkistetaan palvelimelta joka latauksella: välimuistista
  // tullut vanha game.js jätti 16.10. uuden kohtauksen pelaajalta näkymättä.
  async headers() {
    return [{ source: "/mouho/:path*", headers: [{ key: "Cache-Control", value: "no-cache" }] }];
  },
};
export default nextConfig;
