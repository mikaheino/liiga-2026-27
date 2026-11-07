// "Kuvaile skenaario omin sanoin" -> moottorin kanoniset rivit (6.11.2026, docs/claude/skenaario.md
// J1/V5). Yhteinen kertakutsulle (app/api/skenaario/kuvaile) ja live-striimille
// (app/api/skenaario/rakenna, 7.11.2026: "AI rakentaa livenä skenaarion, mutta hyödyntää SQL
// dataa ja koneoppimismalleja").
// Agentti (Snowflakessa Cortex LIIGA_ENNUSTAJA, paikallisesti Claude MCP:llä) hoitaa kielen ja
// hakee tarvittaessa dataa (liiga_kausi / liiga_ennuste = Cortex Analyst -> SQL; paikallisesti
// DuckDB-tilannekuva). Se kutsuu liiga_skenaario-työkalua (sama moottori ja malli kuin
// ennusteessa); sovellus lukee kutsun syötteen ja ratkaisee sen moottorilla kanonisiksi
// riveiksi (sirut). Luvut tulevat aina moottorista, eivät agentilta.
import { askOnce, type Answer } from "@/lib/agent";
import { loadTeams } from "@/lib/data";
import { runEngine } from "@/lib/scenarioEngine";

export type Described = { answer: string; items: Record<string, unknown>[]; tools: string[]; sql: string[]; error?: string; status?: number };

const RULE = (today: string, teams: string[]) => `TEHTÄVÄ: Käyttäjä kuvaa Liigan kauden 2026-27 skenaarion omin sanoin. Rakenna siitä liiga_skenaario-työkalun skenaario ja kutsu työkalua täsmälleen kerran.
- Tänään on ${today}. Joukkueiden tarkat nimet: ${teams.join(", ")}.
- Nojaa dataan: jos kuvaus riippuu otteluohjelmasta, vastustajista, sarjatilanteesta tai pelaajista, hae ne ensin datatyökaluilla (esim. jäljellä olevat ottelut tai joukkueen nykyinen sija), älä arvaa.
- Ottelut: {"team", "result": win|loss|reg_win|ot_win|ot_loss|reg_loss} ja joko "games": N (seuraavat N) tai jakso "from"/"until" (YYYY-MM-DD, until mukaan lukien), valinnainen "opponent".
- Poissaolo: {"injury": "<pelaajan nimi>", "games": N | "until": "YYYY-MM-DD"}. Tavoite: {"team", "goal": avoid_relegation|top6|top10|win}.
- Yleiset ilmaukset tulkitaan näin (ei tarkennusta): "joulun yli" = from 2026-12-20 until 2027-01-06; "loppukausi" / "kaikki loput" = kaikki jäljellä olevat ottelut (from tänään); "ensi viikolla" = seuraavat 7 päivää.
- Jos kuvaus on silti monitulkintainen (esim. kaksi samannimistä pelaajaa, epäselvä joukkue tai ajanjakso), ÄLÄ kutsu työkalua vaan kysy yksi lyhyt tarkentava kysymys.
- Työkalun jälkeen kirjoita 2–3 lauseen yhteenveto: miten tulkitsit kuvauksen, mihin dataan nojasit ja mitä työkalun luvut kertovat. Älä laske lukuja itse. Älä kirjoita JATKO-riviä.`;

export async function describe(text: string, progress?: Parameters<typeof askOnce>[2]): Promise<Described> {
  const today = new Date().toLocaleDateString("sv-SE", { timeZone: "Europe/Helsinki" });
  const a: Answer = await askOnce(text, RULE(today, await loadTeams()), progress);
  const base = { answer: a.text, tools: a.tools, sql: a.sql };
  const call = [...a.inputs].reverse().find((i) => i.name === "liiga_skenaario");
  const raw = typeof call?.input?.scenario === "string" ? call.input.scenario : null;
  if (!raw) return { ...base, items: [] };
  let parsed: unknown;
  try { parsed = JSON.parse(raw); } catch { return { ...base, items: [], error: "agentin skenaario ei ollut JSONia", status: 422 }; }
  // Vain lukitukset, poissaolot ja tavoitteet siruiksi; panospyyntöjä ei.
  const list = (Array.isArray(parsed) ? parsed : [parsed]).filter((x) => x && typeof x === "object" && !("stakes" in (x as object)));
  progress?.({ status: "Moottori ratkaisee skenaarion otteluiksi" });
  const res = await runEngine<{ scenario_canonical?: Record<string, unknown>[] }>("json", list);
  if (res.error) return { ...base, items: [], error: res.error, status: 422 };
  const items = res.scenario_canonical ?? [];
  // Sama raja kuin omassa skenaariossa (lib/lockBus.ts MAX_LOCKS): ei katkaista hiljaa.
  if (items.length > 10) {
    return { ...base, items: [], status: 422,
      error: `Skenaariossa on ${items.length} riviä (esim. lukittua ottelua); enintään 10. Rajaa jaksoa tai otteluiden määrää.` };
  }
  return { ...base, items };
}
