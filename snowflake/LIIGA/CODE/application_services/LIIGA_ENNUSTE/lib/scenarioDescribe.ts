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
import { query } from "@/lib/snowflake";
import { activeAbsences, injuryHints, type NewsAbsence, type NewsHint } from "@/lib/newsContext";
import { MAX_ITEMS } from "@/lib/scenarioItems";

// chart = agentin valitsema kuvaaja (7.11.2026: "agentti valitsee itse"); null = ei kuvaajaa.
export type Chart = { type: "pisteet" | "jakauma" | "ottelut"; team?: string } | null;
// news = skenaariossa mukana olevat uutisista hyväksytyt poissaolot (rivien labelit).
export type Described = { answer: string; items: Record<string, unknown>[]; tools: string[]; sql: string[]; error?: string; status?: number; chart?: Chart;
  news?: string[] };

// Agentin viimeinen rivi "KUVAAJA: <tyyppi> [joukkue]" luetaan ja poistetaan näkyvästä tekstistä.
const CHART_LINE = /\n?\s*KUVAAJA:\s*(pisteet|jakauma|ottelut|ei)\b\s*([^\n]*)\s*$/i;
// Paikallisen Clauden yleisohje lisää loppuun sovelluslinkin; hakusivulla se on turha.
const APP_LINK = /\n?\s*Lisää sovelluksessa:[^\n]*/gi;
export function splitChart(raw: string): { text: string; chart: Chart } {
  // Markdown-taulukot pois (ohje kieltää, mutta agentti tekee joskus): sovellus näyttää luvut itse.
  const text = raw.replace(APP_LINK, "").split("\n").filter((l) => !/^\s*\|.*\|\s*$/.test(l)).join("\n").replace(/\n{3,}/g, "\n\n");
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
- Joukkueen muutos (valmentajanvaihto, iso hankinta, muotonotkahdus, kaikki mikä muuttaa joukkueen tasoa eikä yksittäistä tulosta): {"team", "xg_share": d, "from"?: "YYYY-MM-DD", "until"?, "games"?}, d = joukkueen maaliodottamien osuuden muutos (−0,15…+0,15; +0,05 = osuus nousee 5 prosenttiyksikköä). Valitse d datasta (esim. alla oleva VALMENTAJANVAIHDOT-näyttö) ja kerro oletus yhdellä lauseella.
- Yleiset ilmaukset tulkitaan näin (ei tarkennusta): "joulun yli" = from 2026-12-20 until 2027-01-06; "loppukausi" / "kaikki loput" = kaikki jäljellä olevat ottelut (from tänään); "ensi viikolla" = seuraavat 7 päivää.
- Sovelluksen pitää toimia kenelle tahansa (käyttäjä 7.11.: "Haluan siis että tätä voi käyttää idiottikin"): ÄLÄ kysy tarkennusta, kun järkevä oletus on olemassa. Tee oletus, kerro se yhdellä lauseella ja vastaa. Oletukset: kesto puuttuu -> loukkaantuminen 10 ottelua, muu muutos loppukausi; alkupäivä puuttuu -> heti seuraavasta ottelusta; "voittaa/häviää" ilman määrää -> seuraavat 5 ottelua; pelkkä kysymys ilman muutosta ("pääseekö Kärpät jatkoon?") -> kutsu työkalua tavoitteella (goal) ja vastaa nykyennusteella. Kysy vain, jos kuvauksesta ei saa mitään järkevää skenaariota (esim. tuntematon nimi, jota ei löydy).
- Skenaarion takana on lähes aina piilokysymys: mitä tämä tarkoittaa joukkueen kaudelle? (7.11.2026, käyttäjä: "mieti konteksti että tässä kysytään myös että pääseekö Pelicans jatkoon".) Vastaa siihen ENSIMMÄISENÄ lauseena työkalun luvuilla, nyt -> skenaario: pääseekö pääjoukkue jatkoon eli pudotuspeleihin (sijat 1–10, työkalun top 10), ja sen mukaan mikä on joukkueen kannalta olennainen raja: suoraan puolivälieriin (top 6), putoamisuhka (15.–17.) tai runkosarjan voitto. Esim. "Pelicans putoaa skenaariossa pois pudotuspeleistä: jatkoon 2 % (nyt 41 %), putoamisuhka 96 %."
- Sen jälkeen 1–2 lausetta: miten tulkitsit kuvauksen, mihin dataan nojasit ja ketkä muut hyötyvät tai kärsivät eniten. Älä laske lukuja itse. Kirjoita pelkkää tekstiä: ei taulukoita, ei listoja, ei otsikoita (sovellus näyttää luvut itse). Älä kirjoita JATKO-riviä.
- Sovellus piirtää vastauksen alle yhden kuvaajan. Valitse se viimeisellä rivillä täsmälleen muodossa "KUVAAJA: <tyyppi> <joukkue>":
  pisteet = kun skenaario on otteluputki, jakso tai poissaolo, joka muuttaa pistekertymää kauden mittaan (odotettu pistekäyrä nyt vs. skenaario);
  jakauma = kun kysymys koskee lopullista sijaa tai tavoitetta (top 6, pudotuspelit, putoaminen, mestaruus) (sijajakauma 1.–17. nyt vs. skenaario);
  ottelut = kun lukittuja otteluita on vain muutama ja olennaista on, kuinka todennäköisiä juuri ne tulokset ovat (mallin todennäköisyys kullekin);
  ei = jos et kutsunut työkalua (esim. kysyit tarkennusta). Joukkue = se, jota kuvaus pääasiassa koskee.`;

// Valmentajanvaihtojen näyttö (7.11.2026, käyttäjä kysyi "Kärpät vaihtavat valmentajaa"): tämän
// kauden vaihdot ja joukkueen pisteet/ottelu sekä xG-osuus ennen ja jälkeen, haun hetkellä
// datasta. Agentti valitsee tästä joukkueen muutoksen (xg_share) ja kertoo oletuksen.
const COACH_WORDS = /valmentaj|valmentaa|coach|päävalm|potku/i;
async function coachingEvidence(): Promise<string> {
  const M = "LIIGA.MODEL";
  const rows = await query(`
    WITH tg AS (
      SELECT SUBSTR(start_ts, 1, 10) AS d, home_team AS team, home_points AS pts, home_xg AS xf, away_xg AS xa
      FROM ${M}.STG_GAMES WHERE ended AND season = (SELECT MAX(season) FROM ${M}.STG_GAMES)
      UNION ALL
      SELECT SUBSTR(start_ts, 1, 10), away_team, away_points, away_xg, home_xg
      FROM ${M}.STG_GAMES WHERE ended AND season = (SELECT MAX(season) FROM ${M}.STG_GAMES))
    SELECT c.team, CAST(c.change_date AS VARCHAR) AS change_date, c.coach_out, c.coach_in,
           SUM(CASE WHEN tg.d < CAST(c.change_date AS VARCHAR) THEN 1 ELSE 0 END) AS n_before,
           SUM(CASE WHEN tg.d >= CAST(c.change_date AS VARCHAR) THEN 1 ELSE 0 END) AS n_after,
           AVG(CASE WHEN tg.d < CAST(c.change_date AS VARCHAR) THEN tg.pts END) AS ppg_before,
           AVG(CASE WHEN tg.d >= CAST(c.change_date AS VARCHAR) THEN tg.pts END) AS ppg_after,
           SUM(CASE WHEN tg.d < CAST(c.change_date AS VARCHAR) THEN tg.xf END) / NULLIF(SUM(CASE WHEN tg.d < CAST(c.change_date AS VARCHAR) THEN tg.xf + tg.xa END), 0) AS xg_before,
           SUM(CASE WHEN tg.d >= CAST(c.change_date AS VARCHAR) THEN tg.xf END) / NULLIF(SUM(CASE WHEN tg.d >= CAST(c.change_date AS VARCHAR) THEN tg.xf + tg.xa END), 0) AS xg_after
    FROM ${M}.COACHING_CHANGES c JOIN tg ON tg.team = c.team
    WHERE c.season = (SELECT MAX(season) FROM ${M}.STG_GAMES)
    GROUP BY c.team, c.change_date, c.coach_out, c.coach_in ORDER BY change_date`).catch(() => []);
  if (!rows.length) return "";
  const f = (x: unknown, d = 2) => (x == null ? "?" : Number(x).toFixed(d).replace(".", ","));
  const deltas = rows.filter((r) => r.XG_BEFORE != null && r.XG_AFTER != null).map((r) => Number(r.XG_AFTER) - Number(r.XG_BEFORE));
  const avg = deltas.length ? deltas.reduce((a, b) => a + b, 0) / deltas.length : null;
  return [`VALMENTAJANVAIHDOT TÄLLÄ KAUDELLA (data; p/ott ja xG-osuus ennen -> jälkeen):`,
    ...rows.map((r) => `- ${r.TEAM} ${r.CHANGE_DATE}: ${r.COACH_OUT} -> ${r.COACH_IN}; p/ott ${f(r.PPG_BEFORE)} -> ${f(r.PPG_AFTER)}, xG-osuus ${f(100 * Number(r.XG_BEFORE), 1)} % -> ${f(100 * Number(r.XG_AFTER), 1)} % (${r.N_BEFORE} / ${r.N_AFTER} ottelua)`),
    avg != null ? `Keskimääräinen xG-osuuden muutos ${deltas.length} vaihdossa: ${avg >= 0 ? "+" : ""}${f(100 * avg, 1)} %-yks. Otokset ovat pieniä ja heikon alun jälkeen paluu keskitasolle on tavallista, joten käytä tätä ylärajana ja kerro se.` : "",
  ].filter(Boolean).join("\n");
}

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
function namedTeams(text: string, teams: string[]): string[] {
  const low = text.toLowerCase();
  const hit = (w: string) => new RegExp(`(^|[^a-zåäö])${w.replace(/[.*+?^${}()|[\]\\-]/g, "\\$&")}`).test(low);
  return teams.filter((t) => hit(t.toLowerCase()) || (ALIAS[t] ?? []).some(hit));
}
async function schedule(text: string, teams: string[]): Promise<string> {
  const named = namedTeams(text, teams);
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

// Uutiset (lib/newsContext.ts): hyväksytyt poissaolot ovat lähtötilanne kysytyille joukkueille,
// hyväksymättömät uutiset vain mainitaan. Agentti ei näe uutistekstiä, vain nämä kentät.
const NEWS_RULE = (abs: NewsAbsence[], hints: NewsHint[]) => [
  abs.length ? `UUTISISTA HYVÄKSYTYT POISSAOLOT (tosiasioita, lähtötilanne):\n${abs.map((a) => `- ${a.player} (${a.team}) poissa ${a.until} asti`).join("\n")}
Ota nämä AINA mukaan liiga_skenaario-kutsuun muodossa {"injury": "<nimi>", "until": "<pvm>"}, ellei käyttäjä pyydä jättämään jotakin pois (esim. "ilman Wernblomia" / "ilman uutisia"). Jos ne vaikuttavat kysyttyyn joukkueeseen, sano yhteenvedossa lyhyesti, että ne on huomioitu.` : "",
  hints.length ? `UUTISVIHJEET (EI hyväksytty, älä lisää skenaarioon ilman pyyntöä):\n${hints.map((h) => `- ${h.player} (${h.team}): ${h.kind}uutinen`).join("\n")}
Mainitse kysytyn joukkueen vihjeet yhdellä lauseella lopussa: "Uutisten mukaan X saattaa olla sivussa; sitä ei ole huomioitu – kirjoita 'X poissa', niin lasken sen mukaan."` : "",
].filter(Boolean).join("\n\n");

export async function describe(text: string, progress?: Parameters<typeof askOnce>[2],
  pohja: { items: Record<string, unknown>[]; labels: string[] } | null = null): Promise<Described> {
  const today = new Date().toLocaleDateString("sv-SE", { timeZone: "Europe/Helsinki" });
  const teams = await loadTeams();
  const sched = await schedule(`${text} ${pohja?.labels.join(" ") ?? ""}`, teams);
  const coach = COACH_WORDS.test(text) ? await coachingEvidence() : "";
  const scope = namedTeams(`${text} ${pohja?.labels.join(" ") ?? ""}`, teams);
  const [absAll, hints] = await Promise.all([activeAbsences(today), injuryHints(scope, today)]);
  const abs = absAll.filter((a) => scope.includes(a.team));
  const news = NEWS_RULE(abs, hints);
  const ctx = RULE(today, teams) + (pohja?.items.length ? `\n\n${BASE_RULE(pohja.items, pohja.labels)}` : "") + (sched ? `\n\n${sched}` : "") + (coach ? `\n\n${coach}` : "") + (news ? `\n\n${news}` : "");
  // "Moottori ei hyydy koskaan" (käyttäjä 7.11.2026): agentin kaatuminen yritetään uudelleen,
  // moottorin hylkäämä skenaario palautetaan agentille korjattavaksi kerran, ja jos kumpikaan ei
  // auta, vastataan kysyttyjen joukkueiden nykyennusteella (moottori laskee, syy kerrotaan).
  const ask = async (extra = ""): Promise<Answer> => {
    try { return await askOnce(text, ctx + extra, progress); } catch (e) {
      progress?.({ status: "Yhteys katkesi, yritetään uudelleen" });
      console.log(`[skenaario] agentti, uusi yritys: ${(e as Error).message}`);
      return askOnce(text, ctx + extra, progress);
    }
  };
  const attempt = async (a: Answer): Promise<Described> => {
    const sc = splitChart(a.text);
    const base = { answer: sc.text, tools: a.tools, sql: a.sql, chart: sc.chart };
    const call = [...a.inputs].reverse().find((i) => i.name === "liiga_skenaario");
    const raw = typeof call?.input?.scenario === "string" ? call.input.scenario : null;
    if (!raw) return { ...base, items: [] };
    let parsed: unknown;
    try { parsed = JSON.parse(raw); } catch { return { ...base, items: [], error: "agentin skenaario ei ollut JSONia", status: 422 }; }
    // Vain lukitukset, poissaolot, tavoitteet ja joukkueen muutokset siruiksi; panospyyntöjä ei.
    const list = (Array.isArray(parsed) ? parsed : [parsed]).filter((x) => x && typeof x === "object" && !("stakes" in (x as object)));
    progress?.({ status: "Moottori ratkaisee skenaarion otteluiksi" });
    const res = await runEngine<{ scenario_canonical?: Record<string, unknown>[] }>("json", list).catch((e) => ({ error: (e as Error).message } as { error: string; scenario_canonical?: undefined }));
    if (res.error) return { ...base, items: [], error: res.error, status: 422 };
    const items = res.scenario_canonical ?? [];
    // Sama raja kuin omassa skenaariossa (lib/scenarioItems.ts MAX_ITEMS): ei katkaista hiljaa.
    if (items.length > MAX_ITEMS) {
      return { ...base, items: [], status: 422,
        error: `Skenaariossa on ${items.length} riviä (esim. lukittua ottelua); enintään ${MAX_ITEMS}. Rajaa jaksoa tai otteluiden määrää.` };
    }
    const newsUsed = items.filter((i) => "injury" in i && abs.some((x) => String(i.label ?? "").includes(x.player))).map((i) => String(i.label));
    return { ...base, items, news: newsUsed };
  };
  // Varavastaus: nykyennuste kysytyille joukkueille tavoiterivillä (goal ei muuta ennustetta).
  const fallback = async (why: string): Promise<Described> => {
    const goals = scope.slice(0, 3).map((t) => ({ team: t, goal: "top10" }));
    if (!goals.length) return { answer: "", items: [], tools: [], sql: [], error: why, status: 422 };
    progress?.({ status: "Lasketaan nykyennuste" });
    const res = await runEngine<{ scenario_canonical?: Record<string, unknown>[]; teams?: Record<string, number | string>[] }>("json", goals)
      .catch((e) => ({ error: (e as Error).message } as { error: string }));
    if ("error" in res && res.error) return { answer: "", items: [], tools: [], sql: [], error: `${why} (${res.error})`, status: 422 };
    const r = res as { scenario_canonical?: Record<string, unknown>[]; teams?: Record<string, number | string>[] };
    const pc = (x: unknown) => `${(100 * Number(x)).toFixed(1).replace(".", ",")} %`;
    const lines = scope.slice(0, 3).map((t) => r.teams?.find((x) => x.team === t)).filter(Boolean)
      .map((x) => `${x!.team}: jatkoon ${pc(x!.p_top10_now)}, kärkikuusikkoon ${pc(x!.p_top6_now)}, putoamisuhka ${pc(x!.p_relegation_now)}.`);
    return { answer: `En pystynyt mallintamaan kuvausta sellaisenaan (${why}), joten tässä nykyennuste. ${lines.join(" ")} Voit tarkentaa kuvausta, niin lasken skenaarion.`,
      items: r.scenario_canonical ?? [], tools: ["liiga_skenaario"], sql: [], chart: { type: "jakauma", team: scope[0] } };
  };

  let first: Described;
  try { first = await attempt(await ask()); } catch (e) { return fallback(`agentti ei vastannut: ${(e as Error).message.split("\n")[0].slice(0, 120)}`); }
  if (!first.error) return first;
  // Korjauskierros: moottorin virhe takaisin agentille.
  progress?.({ status: "Korjataan skenaariota" });
  let second: Described;
  try {
    second = await attempt(await ask(`\n\nEDELLINEN YRITYS EPÄONNISTUI. Moottori sanoi: "${first.error}". Korjaa skenaario (tarkista nimet, kesto, raja ±0,15 ja enintään ${MAX_ITEMS} riviä; tarvittaessa yksinkertaista) ja kutsu liiga_skenaario-työkalua uudelleen.`));
  } catch { return fallback(first.error ?? "tuntematon virhe"); }
  return second.error ? fallback(second.error) : second;
}
