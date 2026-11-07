import { activeAbsences } from "@/lib/newsContext";
import { query } from "@/lib/snowflake";

// --- Hakuehdotukset uutisista (7.11.2026, käyttäjä: "olisi mukavaa jos uutiset näkyisivät
// googlemaiseen tyyliin ehdotuksia") --------------------------------------------------------
// Valmis kysymys muodostetaan pohjasta rakenteisista kentistä (pelaaja, joukkue, tyyppi), ei
// kielimallilla. Lähde ja päivä näytetään käyttäjälle; otsikkoa ei näytetä eikä anneta agentille.
// Mukana vain luotettavat yhdistelmät: pelaaja tunnistettu + loukkaantuminen / pelikielto / paluu /
// siirto, sekä voimassa olevat hyväksytyt poissaolot. Valmentajaliput ovat liian kohinaisia
// (avustajat, ensi kauden nimitykset), joten niistä ei tehdä ehdotuksia.
export type Suggestion = { q: string; meta: string; kind: "absence" | "injury" | "suspension" | "return" | "signing" | "data" };

const fiDay = (iso: string) => `${Number(iso.slice(8, 10))}.${Number(iso.slice(5, 7))}.`;
const surname = (p: string) => p.trim().split(/\s+/).slice(-1)[0];

// Joukkueelle auki oleva kysymys nykyennusteesta (7.11.2026: "pääseekö Lukko jatkoon" oli turha,
// kun jatkopaikka on 99,9 %): kärki -> runkosarjan voitto, keskikasti -> kärkikuusikko tai jatkoon,
// alapää -> putoamiselta välttyminen. dist = sijajakauma 1..17 (PositionRow.p).
export type Dist = Record<string, number[]>;
// Vaihtelu (7.11.2026, käyttäjä: "variaatiota kysymyksiin, aina ei pudota tai jatkoon"): joka
// vyöhykkeellä useampi muotoilu; v valitsee (kiertää listan läpi). Joukkueen nimi vain
// perusmuodossa, ettei taivutus mene väärin.
export function openQuestion(team: string, dist: Dist, v = 0): string {
  const p = dist[team];
  const sum = (a: number, b: number) => (p ? p.slice(a - 1, b).reduce((x, y) => x + y, 0) : 0);
  const pick = (xs: string[]) => xs[((v % xs.length) + xs.length) % xs.length];
  if (p && sum(15, 17) >= 0.15) return pick([`välttyykö ${team} putoamiselta?`, `onko ${team} putoamisvaarassa?`, `mihin sijaan ${team} päätyy?`,
    `kuinka monta pistettä ${team} tarvitsee pysyäkseen sarjassa?`, `nouseeko ${team} turvaan?`, `päätyykö ${team} viimeiseksi?`, `pääseekö ${team} vielä jatkoon?`]);
  if (p && sum(1, 6) >= 0.85) return pick([`voittaako ${team} runkosarjan?`, `pysyykö ${team} kärjessä?`, `muuttuuko mestaruuskisa?`,
    `kuka uhkaa kärkeä?`, `paljonko kärkipaikan todennäköisyys muuttuu?`, `riittääkö ${team} ykköseksi?`, `kuinka varma ${team} on kärkikolmikossa?`]);
  if (p && sum(1, 10) >= 0.9) return pick([`nouseeko ${team} kärkikuusikkoon?`, `mihin sijaan ${team} päätyy?`, `riittääkö se suoraan puolivälieriin?`,
    `putoaako ${team} säälipudotuksiin?`, `nouseeko ${team} mitalikamppailuun?`, `kuinka monta pistettä ${team} kerää?`]);
  return pick([`pääseekö ${team} jatkoon?`, `mihin sijaan ${team} päätyy?`, `nouseeko ${team} kärkikuusikkoon?`,
    `jääkö ${team} pudotuspelien ulkopuolelle?`, `kuinka monta pistettä ${team} kerää?`, `kenen kanssa ${team} taistelee jatkopaikasta?`,
    `riittääkö se säälipudotuksiin?`, `paljonko ${team} nousee taulukossa?`]);
}

// Suomen genetiivi sukunimelle: -nen -> -sen, vokaali -> +n, muuten +in (Hämäläisen, Wernblomin, Saarelan).
const gen = (name: string) => /nen$/i.test(name) ? name.replace(/nen$/i, "sen") : /[aeiouyäö]$/i.test(name) ? `${name}n` : `${name}in`;

// Kysymyspohjat uutistyypeittäin; k kiertää, jolloin peräkkäiset ehdotukset eroavat.
type Kind = Exclude<Suggestion["kind"], "data">;
type T = (x: { player: string; s: string; team: string; q: string }) => string;
const TEMPLATES: Record<Kind, T[]> = {
  absence: [
    (x) => `${x.team} ilman ${x.player} – ${x.q}`,
    (x) => (x.player.startsWith("pelaajia") ? `Montako pistettä poissaolot vievät (${x.team})?` : `Montako pistettä ${gen(x.s)} poissaolo vie (${x.team})?`),
    (x) => `Entä jos ${x.s} palaa jo ensi viikolla?`,
    (x) => `Entä jos poissaolo venyy loppukauteen (${x.team})?`,
    (x) => `Paljonko poissaolot muuttavat ${x.team}-ennustetta?`,
  ],
  injury: [
    (x) => `${x.player} loukkaantunut – ${x.q}`,
    (x) => `Montako pistettä ${gen(x.s)} poissaolo vie (${x.team})?`,
    (x) => `Entä jos ${x.player} (${x.team}) on sivussa kuukauden?`,
    (x) => `Kestääkö ${x.team}, jos ${x.player} on sivussa?`,
    (x) => `Entä jos ${x.s} on poissa joulun yli (${x.team})?`,
    (x) => `Entä jos ${x.player} palaa jo kahden viikon päästä?`,
    (x) => `Mitä ${gen(x.s)} loukkaantuminen tekee ${x.team}-ennusteelle?`,
    (x) => `Entä jos ${x.player} (${x.team}) on sivussa loppukauden?`,
    (x) => `${x.player} sivussa 5 ottelua – ${x.q}`,
  ],
  suspension: [
    (x) => `${x.player} pelikiellossa – ${x.q}`,
    (x) => `Montako pistettä ${gen(x.s)} pelikielto vie (${x.team})?`,
    (x) => `Entä jos ${gen(x.s)} pelikielto olisi kaksinkertainen?`,
    (x) => `Mitä jos ${x.team} voittaa kaikki ottelut ilman pelaajaa ${x.player}?`,
    (x) => `Kestääkö ${x.team} pelikiellon ajan – ${x.q}`,
  ],
  return: [
    (x) => `${x.s} palaa kokoonpanoon – ${x.q}`,
    (x) => `Mitä ${gen(x.s)} paluu tarkoittaa (${x.team})?`,
    (x) => `Montako pistettä ${gen(x.s)} paluu tuo (${x.team})?`,
    (x) => `Entä jos ${x.s} olisi palannut jo kuukausi sitten?`,
    (x) => `Nouseeko ${x.team}, kun ${x.player} on taas mukana?`,
  ],
  signing: [
    (x) => `Uusi pelaaja ${x.player} – ${x.q}`,
    (x) => `Mitä ${x.player} (${x.team}) muuttaa kauden ennusteessa?`,
    (x) => `Montako lisäpistettä ${x.player} (${x.team}) tuo?`,
    (x) => `Entä jos ${x.player} (${x.team}) tekee pisteen per ottelu loppukauden?`,
    (x) => `Entä jos ${x.player} ei sopeudu (${x.team})?`,
    (x) => `Entä jos ${x.player} loukkaantuu heti (${x.team})?`,
    (x) => `Onko ${x.player} (${x.team}) kauden tärkein hankinta?`,
    (x) => `${x.team} hankki pelaajan ${x.player} – ${x.q}`,
  ],
};
// seed sekoittaa pohjat ja tavoitekysymykset joka latauksella (reitti antaa satunnaisen).
const make = (kind: Kind, k: number, player: string, team: string, dist: Dist, seed = 0) =>
  TEMPLATES[kind][(k + seed) % TEMPLATES[kind].length]({ player, s: surname(player), team, q: openQuestion(team, dist, Math.floor((k + seed) / 2) + seed) });

// Laajennus 7.11.2026 (käyttäjä: "uutisia enemmän"): pelaaja tunnistetaan myös otsikosta ja
// tiivistelmästä rosteria vasten (news_roster; teksti käsitellään vain tässä, sitä ei näytetä eikä
// anneta agentille), ikkuna 30 pv, enintään 12. Siirto-lippu on kohinainen (lounaslistat,
// konsertit), joten siirroksi kelpaa vain sopimukseen viittaava otsikko.
// Jatkosopimus ei muuta joukkuetta (pelaaja on jo mukana), joten se ei ole skenaario.
// Myös "Hyökkääjä X Y Kouvolaan" ja "X:n debyytti" (7.11.: Ruuttu ja Ohtamaa jäivät muuten pois).
const SIGNING = /sopimu|lainalle|lainaan|vahvista|siirty|kaudeksi|kauden loppuun|liittyy|tekee paluun|debyy|riveihin|^(hyökkääjä|puolustaja|maalivahti) /i;
const EXTENSION = /jatkosopimu|jatkaa/i;
const WINDOW_DAYS = 30, MAX = 12;

export async function suggestions(teams: string[], today: string, dist: Dist = {}, seed = 0): Promise<Suggestion[]> {
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
    // Monikossa "Entä jos X palaa" ei sovi, joten silloin kahden pohjan kierto.
    // Monikossa vain pohjat, jotka eivät puhu yhdestä pelaajasta (indeksi 2 = "Entä jos X palaa").
    const pool = names.length === 1 ? TEMPLATES.absence.map((_, i) => i) : TEMPLATES.absence.map((_, i) => i).filter((i) => i !== 2);
    const k = pool[(out.length + seed) % pool.length];
    out.push({ kind: "absence", q: TEMPLATES.absence[k]({ player: who, s: names[0], team, q: openQuestion(team, dist, out.length + seed) }),
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
      const q = make(kind, out.length, f.player, team, dist, seed);
      seen.add(f.player);
      out.push({ kind, q, meta });
      if (out.length >= MAX) return out;
    }
  }
  return out;
}
