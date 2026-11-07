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
import { loadFixtures, loadTeams } from "@/lib/data";
import { runEngine } from "@/lib/scenarioEngine";
import { MAX_ITEMS } from "@/lib/scenarioItems";

// chart = agentin valitsema kuvaaja (7.11.2026: "agentti valitsee itse"); null = ei kuvaajaa.
export type Chart = { type: "pisteet" | "jakauma" | "ottelut"; team?: string } | null;
export type Described = { answer: string; items: Record<string, unknown>[]; tools: string[]; sql: string[]; error?: string; status?: number; chart?: Chart };

// Agentin viimeinen rivi "KUVAAJA: <tyyppi> [joukkue]" luetaan ja poistetaan näkyvästä tekstistä.
const CHART_LINE = /\n?\s*KUVAAJA:\s*(pisteet|jakauma|ottelut|ei)\b\s*([^\n]*)\s*$/i;
// Paikallisen Clauden yleisohje lisää loppuun sovelluslinkin; hakusivulla se on turha.
const APP_LINK = /\n?\s*Lisää sovelluksessa:[^\n]*/gi;
export function splitChart(raw: string): { text: string; chart: Chart } {
  const text = raw.replace(APP_LINK, "");
  const m = CHART_LINE.exec(text);
  if (!m) return { text: text.replace(/\n?\s*KUVAAJA:[^\n]*$/i, "").trimEnd(), chart: undefined as unknown as Chart };
  const type = m[1].toLowerCase();
  return { text: text.slice(0, m.index).trimEnd(), chart: type === "ei" ? null : { type: type as "pisteet", ...(m[2].trim() ? { team: m[2].trim() } : {}) } };
}

const RULE = (today: string, teams: string[]) => `TEHTÄVÄ: Käyttäjä kuvaa Liigan kauden 2026-27 skenaarion omin sanoin. Rakenna siitä liiga_skenaario-työkalun skenaario ja kutsu työkalua täsmälleen kerran.
- Tänään on ${today}. Joukkueiden tarkat nimet: ${teams.join(", ")}.
- Nojaa dataan: jos kuvaus riippuu otteluohjelmasta, vastustajista, sarjatilanteesta tai pelaajista, hae ne ensin datatyökaluilla (esim. jäljellä olevat ottelut tai joukkueen nykyinen sija), älä arvaa.
- Ottelut: {"team", "result": win|loss|reg_win|ot_win|ot_loss|reg_loss} ja joko "games": N (seuraavat N) tai jakso "from"/"until" (YYYY-MM-DD, until mukaan lukien), valinnainen "opponent".
- Yksittäinen ottelu: {"team", "result", "from": "<pvm>", "until": "<sama pvm>"}. Näin saa myös epäsäännölliset kuviot, esim. "joka toinen ottelu" = lukitse joka toinen alla listatuista OTTELUOHJELMA-riveistä (koko loppukausi listattu; enintään 64 riviä). Ellei käyttäjä rajaa jaksoa, kuvio koskee koko loppukautta.
- Poissaolo: {"injury": "<pelaajan nimi>", "games": N | "until": "YYYY-MM-DD"}. Tavoite: {"team", "goal": avoid_relegation|top6|top10|win}.
- Yleiset ilmaukset tulkitaan näin (ei tarkennusta): "joulun yli" = from 2026-12-20 until 2027-01-06; "loppukausi" / "kaikki loput" = kaikki jäljellä olevat ottelut (from tänään); "ensi viikolla" = seuraavat 7 päivää.
- Jos kuvaus on silti monitulkintainen (esim. kaksi samannimistä pelaajaa, epäselvä joukkue tai ajanjakso), ÄLÄ kutsu työkalua vaan kysy yksi lyhyt tarkentava kysymys.
- Työkalun jälkeen kirjoita 2–3 lauseen yhteenveto: miten tulkitsit kuvauksen, mihin dataan nojasit ja mitä työkalun luvut kertovat. Älä laske lukuja itse. Kirjoita pelkkää tekstiä: ei taulukoita, ei listoja, ei otsikoita (sovellus näyttää luvut itse). Älä kirjoita JATKO-riviä.
- Sovellus piirtää vastauksen alle yhden kuvaajan. Valitse se viimeisellä rivillä täsmälleen muodossa "KUVAAJA: <tyyppi> <joukkue>":
  pisteet = kun skenaario on otteluputki, jakso tai poissaolo, joka muuttaa pistekertymää kauden mittaan (odotettu pistekäyrä nyt vs. skenaario);
  jakauma = kun kysymys koskee lopullista sijaa tai tavoitetta (top 6, pudotuspelit, putoaminen, mestaruus) (sijajakauma 1.–17. nyt vs. skenaario);
  ottelut = kun lukittuja otteluita on vain muutama ja olennaista on, kuinka todennäköisiä juuri ne tulokset ovat (mallin todennäköisyys kullekin);
  ei = jos et kutsunut työkalua (esim. kysyit tarkennusta). Joukkue = se, jota kuvaus pääasiassa koskee.`;

// Kuvauksessa mainittujen joukkueiden seuraavat ottelut (7.11.2026): ilman niitä agentti ei
// voinut rakentaa kuviota kuten "joka toinen peli" (tilannekuvassa vain liigan 16 seuraavaa).
const DAY = (ts: string) => new Date(ts).toLocaleDateString("sv-SE", { timeZone: "Europe/Helsinki" });
// Lempinimet ja kotikaupungit (7.11.: "Pelsut" ei osunut Pelicansiin, jolloin agentti näki vain
// liigan 16 seuraavaa ottelua). Osuma sanan alusta, joten taivutusmuodot (Pelsuille, Lahdessa) käyvät.
const ALIAS: Record<string, string[]> = {
  HIFK: ["ifk", "stadi", "helsinki"], HPK: ["hämeenlinna", "hämeenlinn"], Ilves: ["ilve", "tampereen ilves"], JYP: ["jyväskylä", "jyväskyl"],
  Jokerit: ["jokke", "jokere"], Jukurit: ["jukure", "mikkeli"], "K-Espoo": ["espoo", "kiekko-espoo", "k-espoo"], KalPa: ["kuopio"],
  KooKoo: ["kouvola", "kookoo"], "Kärpät": ["kärpi", "oulu"], Lukko: ["raum", "lukko"], Pelicans: ["pelsu", "pelikaan", "lahti", "lahde", "lahte"],
  SaiPa: ["lappeenran", "saipa"], Sport: ["vaasa", "vaasan"], TPS: ["turku", "turu"], Tappara: ["tapsa", "tappara"], "Ässät": ["pori", "ässi", "ässä"],
};
async function schedule(text: string, teams: string[]): Promise<string> {
  const low = text.toLowerCase();
  const hit = (w: string) => new RegExp(`(^|[^a-zåäö])${w.replace(/[.*+?^${}()|[\]\\-]/g, "\\$&")}`).test(low);
  const named = teams.filter((t) => hit(t.toLowerCase()) || (ALIAS[t] ?? []).some(hit));
  if (!named.length) return "";
  const coming = (await loadFixtures()).filter((f) => !f.ended);
  return named.map((t) => `OTTELUOHJELMA ${t} (koko loppukausi):\n` + coming.filter((f) => f.home === t || f.away === t)
    .map((f, i) => `${i + 1}. ${DAY(f.start_ts)} ${f.home}–${f.away} (${f.home === t ? "koti" : "vieras"})`).join("\n")).join("\n\n");
}

// Skenaario skenaarion päälle (7.11.2026, käyttäjä: "skenaario skenaarion päälle tarvitaan"):
// pohja = selaimen nykyinen skenaario moottorin kanonisina riveinä (palvelin on tarkistanut ne).
// Agentti ottaa ne mukaan sellaisinaan, jolloin sen tekstin luvut koskevat koko yhdistelmää.
// Ei nappeja (käyttäjä 7.11.: "Ei mitään nappeja, vaan tietoisuus"): agentti päättää itse, jatkaako
// se nykyistä skenaariota vai aloittaako uuden, ja sanoo valintansa yhteenvedon alussa.
const BASE_RULE = (base: Record<string, unknown>[], labels: string[]) => `NYKYINEN SKENAARIO (käyttäjällä auki juuri nyt):
${labels.map((l) => `- ${l}`).join("\n")}
Samat rivit moottorin muodossa: ${JSON.stringify(base)}
Päätä itse, jatkaako käyttäjä tätä skenaariota vai kysyykö uutta:
- JATKA, jos kuvaus viittaa nykyiseen ("tähän", "päälle", "myös", "lisäksi", "vielä", "entä jos sen lisäksi") tai täydentää sitä luontevasti (esim. pelkkä uusi loukkaantuminen tai tulos samoihin joukkueisiin). Ota silloin nämä rivit liiga_skenaario-kutsuun SELLAISINAAN ja lisää uudet; muuta tai poista nykyinen rivi, jos käyttäjä niin pyytää.
- ALOITA UUSI, jos kuvaus on itsenäinen kokonaisuus, joka ei liity nykyiseen (esim. "Mitä jos Kärpät voittaa loppukauden"). Älä silloin ota nykyisiä rivejä mukaan.
- Aloita yhteenveto sanomalla valintasi lyhyesti: "Lisäsin nykyiseen skenaarioon …" tai "Aloitin uuden skenaarion: …". Luvut koskevat aina sitä skenaariota, jonka työkalu laski.`;

export async function describe(text: string, progress?: Parameters<typeof askOnce>[2],
  pohja: { items: Record<string, unknown>[]; labels: string[] } | null = null): Promise<Described> {
  const today = new Date().toLocaleDateString("sv-SE", { timeZone: "Europe/Helsinki" });
  const teams = await loadTeams();
  const sched = await schedule(`${text} ${pohja?.labels.join(" ") ?? ""}`, teams);
  const ctx = RULE(today, teams) + (pohja?.items.length ? `\n\n${BASE_RULE(pohja.items, pohja.labels)}` : "") + (sched ? `\n\n${sched}` : "");
  const a: Answer = await askOnce(text, ctx, progress);
  const sc = splitChart(a.text);
  const base = { answer: sc.text, tools: a.tools, sql: a.sql, chart: sc.chart };
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
  // Sama raja kuin omassa skenaariossa (lib/scenarioItems.ts MAX_ITEMS): ei katkaista hiljaa.
  if (items.length > MAX_ITEMS) {
    return { ...base, items: [], status: 422,
      error: `Skenaariossa on ${items.length} riviä (esim. lukittua ottelua); enintään ${MAX_ITEMS}. Rajaa jaksoa tai otteluiden määrää.` };
  }
  return { ...base, items };
}
