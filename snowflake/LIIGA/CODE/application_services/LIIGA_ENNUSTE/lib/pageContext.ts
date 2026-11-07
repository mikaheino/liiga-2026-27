// Mitä käyttäjä katsoo juuri nyt (5.11.2026, käyttäjä: "agentilla olisi ymmärrys
// siitä millä sivulla sitä käytetään"). Aiemmin agentille meni pelkkä kysymys,
// joten "miksi tämä on romahtanut?" joukkuesivulla oli sille arvoitus ja se
// linkitti takaisin sivulle, jolla käyttäjä jo oli.
//
// Tämä rakentaa lyhyen suomenkielisen lohkon: sivun nimi, URL-valinnat ja ne
// luvut, jotka sivulla todella näkyvät -- samasta datasta ja samoilla
// funktioilla kuin sivu itse (lib/data.ts:n välimuisti, ei lisäkyselyitä).
// Luvut mukaan, jotta agentin ei tarvitse hakea työkalulla sitä, mikä on jo
// ruudulla; raskaammat kysymykset (skenaariot, kokoonpanot) se hakee itse.
//
// Rajat: enintään ~40 riviä per sivu. Lohko liitetään vain viimeiseen
// käyttäjäviestiin (lib/agent.ts), joten se ei kerry keskusteluhistoriaan.
import {
  loadChallengerSeason, loadFixtures, loadHistory, loadLine, loadLog, loadMeta, loadNews, loadPlayers, loadPosition, loadTeams,
} from "@/lib/data";
import { MONTHS_FI, type Fixture, defaultMonth, modelSaid, nextRound, resultText, scoreboard } from "@/lib/fixtures";
import { PLAYOFF_CUT, QUALI_CUT, RELEGATION_CUT, seasonTable, teamPoints } from "@/lib/table";

export type PageRef = { path: string; query?: string };

const f1 = (x: number) => x.toFixed(1).replace(".", ",");
const sign = (x: number) => `${x >= 0 ? "+" : "−"}${f1(Math.abs(x))}`;
const day = (ts: string) => `${Number(ts.slice(8, 10))}.${Number(ts.slice(5, 7))}.`;
const today = () => new Date().toLocaleDateString("sv-SE", { timeZone: "Europe/Helsinki" });   // YYYY-MM-DD

// Sivun nimi ja se, mitä sivulla on. Sama sanasto kuin käyttöliittymässä, jotta
// agentti puhuu samoista asioista samoilla nimillä kuin ruutu.
const PAGES: [RegExp, string, string][] = [
  [/^\/$/, "Etusivu", "oma skenaario hakukenttänä (Entä jos?, tekoäly rakentaa sen livenä) ja linkit osioihin"],
  [/^\/joukkue\//, "Joukkuesivu", "yhden joukkueen sijajakauma, ennuste, viimeiset ja seuraavat ottelut"],
  [/^\/sarjataulukko/, "Sarjataulukko", "sarjatilanne nyt, välilehdet koti/vieras, maalit ja erikoistilanteet"],
  [/^\/voittaja/, "Runkosarjan voittaja", "voittotodennäköisyydet ja kerätyt pisteet"],
  [/^\/ottelut/, "Ottelut", "päivän ratkaisupeli ja seuraava kierros, kuukauden ottelut tuloksineen ja mallin ennusteineen"],
  [/^\/liike/, "Ennusteen liike", "miten ennuste on muuttunut esikaudesta"],
  [/^\/sijainti/, "Sijainnit", "sijaintijakauma (heatmap) kelattavana kauden yli, rajat ja vyöhykkeet"],
  [/^\/uutiset/, "Uutiset", "uutishaastajan poissaolot ja niiden vaikutus"],
  [/^\/pelaajat/, "Pelaajat", "pistepörssi ja maalivahdit, ero esikauden odotukseen"],
  [/^\/linkedin/, "LinkedIn-osasto", "diojen ja postausten vienti"],
  [/^\/mouho/, "Mouho-peli", "point-and-click-peli"],
];

const NAKYMA: Record<string, string> = {
  koti: "koti ja vieras erikseen", maalit: "maalit ja xG", erikois: "erikoistilanteet (ylivoima, alivoima)",
};

function zones(p: number[]) {
  const s = (a: number, b: number) => 100 * p.slice(a - 1, b).reduce((x, y) => x + y, 0);
  return { top: s(1, PLAYOFF_CUT), quali: s(PLAYOFF_CUT + 1, QUALI_CUT), rel: s(RELEGATION_CUT + 1, 17) };
}

// --- Sivukohtaiset luvut -----------------------------------------------------

async function front(): Promise<string[]> {
  const [{ meta }, pos, log, teams, fx, line] = await Promise.all([loadMeta(), loadPosition(), loadLog(), loadTeams(), loadFixtures(), loadLine()]);
  const table = seasonTable(log, teams);
  const fav = [...pos].sort((a, b) => b.pTitle - a.pTitle)[0];
  const sb = scoreboard(fx);
  const round = nextRound(fx, today());
  return [
    `Kärjessä nyt: ${table[0]?.team} ${table[0]?.pts} p (${table[0]?.gp} ottelua). Ennusteen suosikki: ${fav?.team} ${f1(fav?.pTitle ?? 0)} % runkosarjan voitto.`,
    line ? `14. sijan pisteraja: todennäköinen ${line.likely} p, varma ${line.safe} p.` : "",
    `Mallin osuvuus: ${sb.hits}/${sb.n}; aina kotijoukkue olisi osunut ${sb.home}/${sb.n}.`,
    round.length ? `Seuraava kierros (${day(round[0].start_ts)}): ${round.map((f) => `${f.home}–${f.away} koti ${f.pHome == null ? "?" : Math.round(f.pHome * 100)} %`).join("; ")}` : "",
    `Ennuste päivitetty ${meta?.UPDATED_AT ?? "?"}, pelattu ${meta?.GAMES_PLAYED}/${meta?.GAMES_TOTAL} ottelua.`,
  ];
}

// Myös joukkuesivun agentin tilannekuva (lib/kortti.ts teamContext).
export async function team(name: string): Promise<string[]> {
  const [pos, log, teams, fx, { preseason }, season] = await Promise.all([
    loadPosition(), loadLog(), loadTeams(), loadFixtures(), loadHistory(), loadChallengerSeason()]);
  const r = pos.find((x) => x.team === name);
  if (!r) return [];
  const table = seasonTable(log, teams);
  const i = table.findIndex((t) => t.team === name);
  const t = table[i];
  const z = zones(r.p);
  const own = fx.filter((f) => f.home === name || f.away === name);
  const played = own.filter((f) => f.ended).slice(-4);
  const coming = own.filter((f) => !f.ended).slice(0, 4);
  const base = preseason.get(name);
  const ch = season.teams.find((x) => x.team === name && Math.abs(x.points - x.pointsNow) >= 0.3);
  return [
    `Sarjataulukossa nyt: ${i + 1}. sija, ${t?.pts} p, ${t?.gp} ottelua, ${t?.w}-${t?.otw}-${t?.otl}-${t?.l}, maalit ${t?.gf}–${t?.ga}. Vire (5 viimeistä pisteinä): ${teamPoints(log, name).slice(-5).join(" ")}.`,
    `Ennuste: ${r.projRank}. sija, ${Math.round(r.points)} p (5–95 %: ${Math.round(r.p05)}–${Math.round(r.p95)}), runkosarjan voitto ${f1(r.pTitle)} %, sijat 1–6 ${f1(z.top)} %, 7–10 ${f1(z.quali)} %, putoaminen ${f1(z.rel)} %.`,
    base != null ? `Muutos esikaudesta: ${sign(r.points - base)} pistettä (esikausi ${Math.round(base)} p).` : "",
    ch ? `Uutishaastaja (voimassa olevat poissaolot): ${f1(ch.points)} p vs. perusmallin ${f1(ch.pointsNow)} p.` : "",
    played.length ? `Viimeiset ottelut: ${played.map((f) => `${day(f.start_ts)} ${f.home}–${f.away} ${resultText(f)}${modelSaid(f) != null ? ` (malli antoi voittajalle ${Math.round(modelSaid(f)!)} %)` : ""}`).join("; ")}` : "",
    coming.length ? `Seuraavat ottelut: ${coming.map((f) => `${day(f.start_ts)} ${f.home}–${f.away} koti ${f.pHome == null ? "?" : Math.round(f.pHome * 100)} %`).join("; ")}` : "",
  ];
}

async function standings(view: string): Promise<string[]> {
  const [log, teams] = await Promise.all([loadLog(), loadTeams()]);
  const table = seasonTable(log, teams);
  return [
    `Valittu välilehti: ${NAKYMA[view] ?? "pisteet ja maalit (oletus)"}.`,
    "Sarjataulukko nyt (sija, joukkue, O, V-JV-JH-H, maalit, pisteet):",
    ...table.map((r, i) => `${i + 1}. ${r.team}: O ${r.gp}, ${r.w}-${r.otw}-${r.otl}-${r.l}, ${r.gf}–${r.ga}, ${r.pts} p`),
  ];
}

async function winner(): Promise<string[]> {
  const [pos, log] = await Promise.all([loadPosition(), loadLog()]);
  const banked = new Map<string, number>();
  for (const g of log) banked.set(g.team, (banked.get(g.team) ?? 0) + g.points);
  const rows = [...pos].sort((a, b) => b.pTitle - a.pTitle).slice(0, 8);
  return [
    "Runkosarjan voiton todennäköisyys (joukkue, %, kerätyt pisteet, ennustetut loppupisteet):",
    ...rows.map((r) => `${r.team}: ${f1(r.pTitle)} %, kerätty ${banked.get(r.team) ?? 0} p, ennuste ${Math.round(r.points)} p`),
  ];
}

async function games(month: string): Promise<string[]> {
  const fx = await loadFixtures();
  const m = /^\d{4}-\d{2}$/.test(month) ? month : defaultMonth(fx, today());
  const inMonth = fx.filter((f) => f.start_ts.slice(0, 7) === m);
  const played = inMonth.filter((f) => f.ended), coming = inMonth.filter((f) => !f.ended);
  const sb = scoreboard(inMonth);
  const name = `${MONTHS_FI[Number(m.slice(5, 7)) - 1]} ${m.slice(0, 4)}`;
  return [
    `Valittu kuukausi: ${name} (${inMonth.length} ottelua, pelattu ${played.length}). Kuukauden osuvuus ${sb.hits}/${sb.n}.`,
    played.length ? `Kuukauden viimeiset tulokset: ${played.slice(-10).map((f) => `${day(f.start_ts)} ${f.home}–${f.away} ${resultText(f)}${modelSaid(f) != null ? ` (voittajalle ${Math.round(modelSaid(f)!)} %)` : ""}`).join("; ")}` : "",
    coming.length ? `Kuukauden seuraavat ottelut: ${coming.slice(0, 10).map((f: Fixture) => `${day(f.start_ts)} ${f.home}–${f.away} koti ${f.pHome == null ? "?" : Math.round(f.pHome * 100)} %`).join("; ")}` : "",
  ];
}

async function movement(window: string): Promise<string[]> {
  const [pos, { history, preseason }] = await Promise.all([loadPosition(), loadHistory()]);
  const moves = pos.filter((r) => preseason.has(r.team))
    .map((r) => ({ team: r.team, d: r.points - preseason.get(r.team)!, now: r.points }))
    .sort((a, b) => Math.abs(b.d) - Math.abs(a.d));
  const dates = [...new Set(history.map((h) => h.date))];
  return [
    `Valittu ikkuna: ${window || "oletus"} ottelua. Historiaa ${dates.length} ajopäivää (${dates[0]}–${dates[dates.length - 1]}).`,
    "Suurimmat muutokset esikaudesta (joukkue, muutos pisteinä, ennuste nyt):",
    ...moves.slice(0, 8).map((r) => `${r.team}: ${sign(r.d)} p, nyt ${Math.round(r.now)} p`),
  ];
}

async function positions(): Promise<string[]> {
  const pos = await loadPosition();
  return [
    "Ennustettu lopputaulukko (sija, joukkue, pisteet 5–95 %, voitto %, 1–6 %, 7–10 %, putoaa %):",
    ...pos.map((r) => { const z = zones(r.p);
      return `${r.projRank}. ${r.team}: ${Math.round(r.points)} p (${Math.round(r.p05)}–${Math.round(r.p95)}), voitto ${f1(r.pTitle)} %, 1–6 ${f1(z.top)} %, 7–10 ${f1(z.quali)} %, putoaa ${f1(z.rel)} %`; }),
  ];
}

// Uutissivu agentille (6.11.): VAIN rakenteiset, ihmisen hyväksymät poissaolot ja
// otsikoiden määrä -- ei otsikoita eikä muuta uutistekstiä (vieras teksti ei kulje
// agentille, docs/claude/skenaario.md). Nimi ja joukkue ovat rosterista hyväksyttyjä.
async function news(): Promise<string[]> {
  const n = await loadNews();
  if (!n.items.length && !n.absences.length) return ["Uutisdataa ei ole tässä ajoympäristössä."];
  return [
    n.absences.length ? `Voimassa olevat hyväksytyt poissaolot: ${n.absences.slice(-8).map((a) => `${a.player} (${a.team}, ${a.kind}${a.until ? `, ${a.until} asti` : ""})`).join("; ")}` : "",
    n.items.length ? `Sivulla ${n.items.length} uutisotsikkoa (otsikoita ei välitetä agentille).` : "",
  ];
}

async function players(): Promise<string[]> {
  const { skaters, goalies } = await loadPlayers();
  const s = (x: number | null) => (x == null ? "–" : sign(x));
  return [
    `Pistepörssin kärki (joukkue, ottelut, pisteet, ero esikauden odotukseen): ${skaters.slice(0, 10).map((p) => `${p.name} (${p.team}) ${p.gp} ott ${p.points} p, ${s(p.vsPre)}`).join("; ")}.`,
    `Maalivahdit, paras torjuntaero keskivertoon: ${goalies.filter((g) => g.savedAvg != null).slice(0, 5).map((g) => `${g.name} (${g.team}) ${s(g.savedAvg)}`).join("; ")}.`,
  ];
}

// --- Koko lohko ----------------------------------------------------------------

export async function pageContext(page: PageRef): Promise<string> {
  const path = page.path.startsWith("/") ? page.path : "/";
  const sp = new URLSearchParams(page.query ?? "");
  const [, name, what] = PAGES.find(([re]) => re.test(path)) ?? [, "Sovellus", ""];
  const lines: string[] = [`Sivu: ${name} (${path}${sp.size ? `?${sp}` : ""})${what ? ` – ${what}` : ""}`];

  // Valinnat, jotka kulkevat sivulta toiselle (lib/params.ts CARRY).
  const hi = (sp.get("joukkue") ?? "").split(",").map((s) => s.trim()).filter(Boolean);
  if (hi.length) lines.push(`Käyttäjä on korostanut joukkueet: ${hi.join(", ")}.`);
  if (sp.get("xg") === "1") lines.push("xG-sarakkeet ovat näkyvissä.");
  if (sp.get("kayra") === "1") lines.push("Käyrät ovat näkyvissä.");

  try {
    const teamName = path.startsWith("/joukkue/") ? decodeURIComponent(path.split("/")[2] ?? "") : "";
    let rows: string[] = [];
    if (teamName) {
      const teams = await loadTeams();
      if (teams.includes(teamName)) { lines[0] = `Sivu: Joukkuesivu /joukkue/${teamName} – käyttäjä katsoo juuri nyt joukkuetta ${teamName}.`; rows = await team(teamName); }
    } else if (path === "/") rows = await front();
    else if (path.startsWith("/sarjataulukko")) rows = await standings(sp.get("nakyma") ?? "");
    else if (path.startsWith("/voittaja")) rows = await winner();
    else if (path.startsWith("/ottelut")) rows = await games(sp.get("kk") ?? "");
    else if (path.startsWith("/liike")) rows = await movement(sp.get("ikkuna") ?? "");
    else if (path.startsWith("/sijainti")) rows = await positions();
    else if (path.startsWith("/uutiset")) rows = await news();
    else if (path.startsWith("/pelaajat")) rows = await players();
    lines.push(...rows.filter(Boolean));
  } catch (e) {
    // Konteksti on lisätieto: jos data ei aukea, kysymys menee silti perille.
    console.log(`[agent] sivun konteksti epäonnistui: ${(e as Error).message}`);
  }
  return lines.join("\n");
}

// Ohje agentille sen ympärille. Erillään, koska paikallinen Claude saa saman
// säännön järjestelmäkehotteessaan (lib/localClaude.ts).
export const CONTEXT_RULE =
  "Käyttäjä katsoo sovelluksen sivua, jonka sisältö on alla. Tulkitse kysymys tätä näkymää vasten: " +
  "\"tämä joukkue\", \"tuo luku\" ja \"miksi se on muuttunut\" tarkoittavat sitä, mitä sivulla näkyy. " +
  "Luvut alla ovat samasta mallista kuin sivu, joten älä hae niitä uudestaan työkalulla; hae vain se, mitä alla ei ole. " +
  "Älä toista näkymää sellaisenaan äläkä selosta sitä, ja jätä \"Lisää sovelluksessa\" -linkki pois, jos se osoittaisi sivulle, jolla käyttäjä jo on.";
