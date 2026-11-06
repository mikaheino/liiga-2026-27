// Agentin työkalujen nimet ja tilarivit: samat Snowflaken Cortex-agentilla (lib/agent.ts)
// ja paikallisella Claudella (lib/localClaude.ts, MCP scripts/local/liiga_mcp.py).
export const TOOL: Record<string, string> = {
  liiga_ennuste: "Haetaan ennustetta", liiga_kausi: "Haetaan kauden tilastoja", liiga_skenaario: "Simuloidaan 10 000 kautta",
  liiga_kokoonpanot: "Haetaan illan kokoonpanoja", liiga_tieto: "Haetaan tietopankista", system_execute_sql: "Ajetaan kysely",
};
