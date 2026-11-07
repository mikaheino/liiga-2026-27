import { activeAbsences } from "@/lib/newsContext";
import { query } from "@/lib/snowflake";

// --- Hakuehdotukset uutisista (7.11.2026, käyttäjä: "olisi mukavaa jos uutiset näkyisivät
// googlemaiseen tyyliin ehdotuksia") --------------------------------------------------------
// Valmis kysymys muodostetaan pohjasta rakenteisista kentistä (pelaaja, joukkue, tyyppi), ei
// kielimallilla. Lähde ja päivä näytetään käyttäjälle; otsikkoa ei näytetä eikä anneta agentille.
// Mukana vain luotettavat yhdistelmät: pelaaja tunnistettu + loukkaantuminen / pelikielto / paluu /
// siirto, sekä voimassa olevat hyväksytyt poissaolot. Valmentajaliput ovat liian kohinaisia
// (avustajat, ensi kauden nimitykset), joten niistä ei tehdä ehdotuksia.
export type Suggestion = { q: string; meta: string; kind: "absence" | "injury" | "suspension" | "return" | "signing" };

const fiDay = (iso: string) => `${Number(iso.slice(8, 10))}.${Number(iso.slice(5, 7))}.`;
const surname = (p: string) => p.trim().split(/\s+/).slice(-1)[0];

// Joukkueelle auki oleva kysymys nykyennusteesta (7.11.2026: "pääseekö Lukko jatkoon" oli turha,
// kun jatkopaikka on 99,9 %): kärki -> runkosarjan voitto, keskikasti -> kärkikuusikko tai jatkoon,
// alapää -> putoamiselta välttyminen. dist = sijajakauma 1..17 (PositionRow.p).
export type Dist = Record<string, number[]>;
export function openQuestion(team: string, dist: Dist): string {
  const p = dist[team];
  if (!p) return `pääseekö ${team} jatkoon?`;
  const sum = (a: number, b: number) => p.slice(a - 1, b).reduce((x, y) => x + y, 0);
  if (sum(15, 17) >= 0.15) return `välttyykö ${team} putoamiselta?`;
  if (sum(1, 6) >= 0.85) return `voittaako ${team} runkosarjan?`;
  if (sum(1, 10) >= 0.9) return `nouseeko ${team} kärkikuusikkoon?`;
  return `pääseekö ${team} jatkoon?`;
}

// Laajennus 7.11.2026 (käyttäjä: "uutisia enemmän"): pelaaja tunnistetaan myös otsikosta ja
// tiivistelmästä rosteria vasten (news_roster; teksti käsitellään vain tässä, sitä ei näytetä eikä
// anneta agentille), ikkuna 30 pv, enintään 12. Siirto-lippu on kohinainen (lounaslistat,
// konsertit), joten siirroksi kelpaa vain sopimukseen viittaava otsikko.
// Jatkosopimus ei muuta joukkuetta (pelaaja on jo mukana), joten se ei ole skenaario.
// Myös "Hyökkääjä X Y Kouvolaan" ja "X:n debyytti" (7.11.: Ruuttu ja Ohtamaa jäivät muuten pois).
const SIGNING = /sopimu|lainalle|lainaan|vahvista|siirty|kaudeksi|kauden loppuun|liittyy|tekee paluun|debyy|riveihin|^(hyökkääjä|puolustaja|maalivahti) /i;
const EXTENSION = /jatkosopimu|jatkaa/i;
const WINDOW_DAYS = 30, MAX = 12;

export async function suggestions(teams: string[], today: string, dist: Dist = {}): Promise<Suggestion[]> {
  const canon = (raw: string) => teams.find((t) => raw.split(",").some((x) => x.trim() === t || x.trim().endsWith(` ${t}`))) ?? null;
  const since = new Date(Date.parse(today) - WINDOW_DAYS * 86_400_000).toISOString().slice(0, 10);
  // Pelaajat, joista on jo kirjaus (voimassa tai päättynyt, esim. Harpurin yhden ottelun pelikielto):
  // uutinen on käsitelty, joten siitä ei enää ehdoteta.
  const [abs, items, cands, roster, done] = await Promise.all([
    activeAbsences(today),
    query(`SELECT SUBSTR(CAST(published AS VARCHAR), 1, 10) AS d, source, team, flags, title, summary, url
           FROM news_items WHERE SUBSTR(CAST(published AS VARCHAR), 1, 10) >= '${since}' AND flags IS NOT NULL
           ORDER BY published DESC`).catch(() => []),
    query("SELECT url, player, team FROM news_candidates").catch(() => []),
    query("SELECT player, team FROM news_roster").catch(() => []),
    query("SELECT DISTINCT player FROM news_absences WHERE player IS NOT NULL").catch(() => []),
  ]);
  const handled = new Set(done.map((r) => String(r.PLAYER)));
  const byUrl = new Map<string, { player: string; team: string }[]>();
  for (const c of cands) byUrl.set(String(c.URL), [...(byUrl.get(String(c.URL)) ?? []), { player: String(c.PLAYER), team: String(c.TEAM) }]);
  const people = roster.map((r) => ({ player: String(r.PLAYER), team: String(r.TEAM) })).filter((r) => r.player.includes(" "));
  const out: Suggestion[] = [];
  const seen = new Set<string>();
  // Saman joukkueen poissaolot yhdeksi ehdotukseksi.
  const byTeam = new Map<string, typeof abs>();
  for (const a of abs) { seen.add(a.player); byTeam.set(a.team, [...(byTeam.get(a.team) ?? []), a]); }
  for (const [team, list] of byTeam) {
    const names = list.map((a) => surname(a.player));
    const who = names.length === 1 ? `pelaajaa ${list[0].player}` : `pelaajia ${names.slice(0, -1).join(", ")} ja ${names[names.length - 1]}`;
    out.push({ kind: "absence", q: `${team} ilman ${who} – ${openQuestion(team, dist)}`,
      meta: `Hyväksytty poissaolo · ${list.map((a) => `${surname(a.player)} ${fiDay(a.until)} asti`).join(", ")}` });
  }
  for (const r of items) {
    const flags = String(r.FLAGS), title = String(r.TITLE ?? ""), text = `${title} ${String(r.SUMMARY ?? "")}`;
    const kind = flags.includes("pelikielto") ? "suspension" : flags.includes("loukkaantuminen") ? "injury"
      : flags.includes("paluu") ? "return" : flags.includes("siirto") && SIGNING.test(title) && !EXTENSION.test(title) ? "signing" : null;
    if (!kind) continue;
    const newsTeam = canon(String(r.TEAM ?? ""));
    const found = [...(byUrl.get(String(r.URL)) ?? []),
      // Siirroissa vain otsikko (tiivistelmässä mainitaan usein muita pelaajia sivulauseessa).
      ...people.filter((x) => (kind === "signing" ? title : text).includes(x.player) && (!newsTeam || x.team === newsTeam))];
    const meta = `${String(r.SOURCE ?? "uutinen")} · ${fiDay(String(r.D))}`;
    for (const f of found) {
      const team = canon(f.team) ?? newsTeam;
      if (!team || seen.has(f.player) || handled.has(f.player)) continue;
      const q = kind === "suspension" ? `${f.player} pelikiellossa – ${openQuestion(team, dist)}`
        : kind === "injury" ? `${f.player} loukkaantunut – ${openQuestion(team, dist)}`
        : kind === "return" ? `${surname(f.player)} palaa kokoonpanoon – ${openQuestion(team, dist)}`
        : `Uusi pelaaja ${f.player} – ${openQuestion(team, dist)}`;
      seen.add(f.player);
      out.push({ kind, q, meta });
      if (out.length >= MAX) return out;
    }
  }
  return out;
}
