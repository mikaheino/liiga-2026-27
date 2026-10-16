/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "standalone",          // App Runtime ajaa .next/standalone/server.js
  serverExternalPackages: ["snowflake-sdk"],
  agentRules: false,             // ei omaa AGENTS.md:tä: repon ohjeet ovat juuressa
};
export default nextConfig;
