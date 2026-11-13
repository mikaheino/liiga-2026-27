// Agentin työkalujen nimet ja tilarivit: samat Snowflaken Cortex-agentilla (lib/agent.ts)
// ja paikallisella Claudella (lib/localClaude.ts, MCP scripts/local/liiga_mcp.py).
export const TOOL: Record<string, string> = {
  liiga_ennuste: "Haetaan ennustetta", liiga_kausi: "Haetaan kauden tilastoja", liiga_skenaario: "Simuloidaan 10 000 kautta",
  liiga_kokoonpanot: "Haetaan illan kokoonpanoja", liiga_tieto: "Haetaan tietopankista", system_execute_sql: "Ajetaan kysely",
};

// Kuka vastasi (13.11.2026): paikallisesti vastaus tulee Qwenilta ("qwen"/"ennuste" työkalulistassa,
// lib/localClaude.ts) tai Claudelta ("claude"); Snowflakessa aina Cortex-agentilta. Luetaan vastauksen
// omasta datasta, ei arvata ympäristöstä. Työkalulista puuttuu -> ympäristön oletus.
export function modelLabel(source: string, tools?: string[]): string {
  if (source !== "local") return "Snowflake Intelligence";
  if (tools?.includes("claude")) return "Claude (paikallinen)";
  if (tools?.some((t) => t === "qwen" || t === "ennuste")) return "Qwen (paikallinen)";
  return "Paikallinen (Qwen / Claude)";
}
