// "Kuvaile skenaario omin sanoin" (6.11.2026, docs/claude/skenaario.md J1/V5).
// Agentti (Snowflakessa Cortex LIIGA_ENNUSTAJA, paikallisesti Claude MCP:llä) hoitaa
// VAIN kielen: se muuntaa lauseen liiga_skenaario-työkalun skenaarioksi. Sovellus lukee
// työkalukutsun syötteen ja ratkaisee sen moottorilla kanonisiksi riveiksi (sirut).
// Luvut tulevat moottorista, eivät agentilta. Epäselvässä kohdassa agentti kysyy yhden
// tarkentavan kysymyksen eikä kutsu työkalua.
// Käyttäjän lausetta ei tallenneta (ei KORTTI_VASTAUS-riviä): talteen jäävät vain
// selaimen sessioon kanoniset rivit.
//   POST { text } -> { answer, items: [{...kanoninen, label}], tools, error? }
import { NextResponse } from "next/server";
import { askOnce } from "@/lib/agent";
import { loadTeams } from "@/lib/data";
import { runEngine } from "@/lib/scenarioEngine";

export const dynamic = "force-dynamic";
export const maxDuration = 120;
const NO_STORE = { "cache-control": "no-store" };

const RULE = (today: string, teams: string[]) => `TEHTÄVÄ: Käyttäjä kuvaa Liigan kauden 2026-27 skenaarion omin sanoin. Muunna kuvaus liiga_skenaario-työkalun skenaarioksi ja kutsu työkalua täsmälleen kerran.
- Tänään on ${today}. Joukkueiden tarkat nimet: ${teams.join(", ")}.
- Ottelut: {"team", "result": win|loss|reg_win|ot_win|ot_loss|reg_loss} ja joko "games": N (seuraavat N) tai jakso "from"/"until" (YYYY-MM-DD, until mukaan lukien), valinnainen "opponent".
- Poissaolo: {"injury": "<pelaajan nimi>", "games": N | "until": "YYYY-MM-DD"}. Tavoite: {"team", "goal": avoid_relegation|top6|top10|win}.
- Yleiset ilmaukset tulkitaan näin (ei tarkennusta): "joulun yli" = from 2026-12-20 until 2027-01-06; "loppukausi" / "kaikki loput" = kaikki jäljellä olevat ottelut (from tänään); "ensi viikolla" = seuraavat 7 päivää.
- Jos kuvaus on silti monitulkintainen (esim. kaksi samannimistä pelaajaa, epäselvä joukkue tai ajanjakso), ÄLÄ kutsu työkalua vaan kysy yksi lyhyt tarkentava kysymys.
- Työkalun jälkeen vastaa enintään kahdella lauseella työkalun luvuilla. Älä laske lukuja itse. Älä kirjoita JATKO-riviä.`;

export async function POST(req: Request) {
  const b = (await req.json().catch(() => ({}))) as { text?: unknown };
  const text = typeof b.text === "string" ? b.text.trim() : "";
  if (text.length < 3 || text.length > 300) return NextResponse.json({ error: "kuvaa skenaario 3–300 merkillä" }, { status: 400, headers: NO_STORE });
  const today = new Date().toLocaleDateString("sv-SE", { timeZone: "Europe/Helsinki" });
  try {
    const a = await askOnce(text, RULE(today, await loadTeams()));
    const call = [...a.inputs].reverse().find((i) => i.name === "liiga_skenaario");
    const raw = typeof call?.input?.scenario === "string" ? call.input.scenario : null;
    if (!raw) return NextResponse.json({ answer: a.text, items: [], tools: a.tools }, { headers: NO_STORE });
    let parsed: unknown;
    try { parsed = JSON.parse(raw); } catch { return NextResponse.json({ answer: a.text, items: [], error: "agentin skenaario ei ollut JSONia" }, { status: 422, headers: NO_STORE }); }
    // Vain lukitukset, poissaolot ja tavoitteet siruiksi; panospyyntöjä ei.
    const list = (Array.isArray(parsed) ? parsed : [parsed]).filter((x) => x && typeof x === "object" && !("stakes" in (x as object)));
    const res = await runEngine<{ scenario_canonical?: Record<string, unknown>[] }>("json", list);
    if (res.error) return NextResponse.json({ answer: a.text, items: [], error: res.error, tools: a.tools }, { status: 422, headers: NO_STORE });
    return NextResponse.json({ answer: a.text, items: res.scenario_canonical ?? [], tools: a.tools }, { headers: NO_STORE });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 502, headers: NO_STORE });
  }
}
