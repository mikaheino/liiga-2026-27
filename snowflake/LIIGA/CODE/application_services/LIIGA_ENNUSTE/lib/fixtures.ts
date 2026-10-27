// Ottelut ja mallin osuvuus: suora käännös streamlit_app.py:n funktioista
// _model_said, _result_text, render_scoreboard ja render_misses, jotta
// sovellus, Streamlit ja välitilinpäätösdia näyttävät saman luvun.

export type Fixture = {
  start_ts: string; home: string; away: string; ended: boolean;
  hg: number | null; ag: number | null; category: string | null;
  pHome: number | null; pOt: number | null;
};

// Todennäköisyys jonka malli antoi lopulliselle voittajalle (0-100). Rehellinen
// mittari yksittäiselle ottelulle: 55/45:n "huti" ei ole epäonnistuminen,
// 20 % voittajalle on. null kunnes ottelu on pelattu tai jos ennustetta ei ole.
export function modelSaid(f: Fixture): number | null {
  if (!f.ended || f.pHome == null || f.hg == null || f.ag == null) return null;
  const p = f.pHome * 100;
  return f.hg > f.ag ? p : 100 - p;
}

export function resultText(f: Fixture): string {
  if (!f.ended || f.hg == null) return "";
  const suffix = f.category === "overtime" ? " ja" : f.category === "shootout" ? " vl" : "";
  return `${f.hg}–${f.ag}${suffix}`;
}

// Osumaprosentti vs. "aina kotijoukkue". Sama ehto (>= 50) kuin rivin ✓/✗:
// toinen sääntö antaisi otsikon ja sarakkeen olla eri mieltä.
export function scoreboard(fx: Fixture[]) {
  const scored = fx.filter((f) => modelSaid(f) != null);
  const hits = scored.filter((f) => modelSaid(f)! >= 50).length;
  const home = scored.filter((f) => f.hg! > f.ag!).length;
  return { n: scored.length, hits, home };
}

// Joukkueittain: odotetut voitot vs. toteutuneet. Voitot ovat riippumattomien
// Bernoulli-kokeiden summa mallin omilla todennäköisyyksillä, joten hajonta on
// sqrt(sum p(1-p)); yli kahden hajonnan ero tuskin on pelkkää sattumaa.
export function misses(fx: Fixture[]) {
  const d = fx.filter((f) => modelSaid(f) != null);
  const teams = [...new Set(d.flatMap((f) => [f.home, f.away]))];
  const byTeam = teams.map((team) => {
    let exp = 0, won = 0, v = 0, n = 0;
    for (const f of d) {
      if (f.home !== team && f.away !== team) continue;
      const p = f.home === team ? f.pHome! : 1 - f.pHome!;
      exp += p; v += p * (1 - p); n += 1;
      if ((f.home === team) === (f.hg! > f.ag!)) won += 1;
    }
    const sd = Math.sqrt(v);
    return { team, n, exp, won, diff: won - exp, z: sd ? (won - exp) / sd : 0 };
  }).sort((a, b) => b.diff - a.diff);

  const conf = [[0.5, 0.55, "50–55 %"], [0.55, 0.6, "55–60 %"], [0.6, 0.65, "60–65 %"], [0.65, 1.01, "yli 65 %"]] as const;
  const buckets = conf.map(([lo, hi, name]) => {
    const g = d.filter((f) => { const c = Math.max(f.pHome!, 1 - f.pHome!); return c >= lo && c < hi; });
    const hit = g.filter((f) => (f.pHome! >= 0.5) === (f.hg! > f.ag!)).length;
    const promised = g.reduce((s, f) => s + Math.max(f.pHome!, 1 - f.pHome!), 0);
    return { name, n: g.length, promised: g.length ? (100 * promised) / g.length : 0, hit: g.length ? (100 * hit) / g.length : 0 };
  }).filter((b) => b.n > 0);

  const worst = [...d].sort((a, b) => modelSaid(a)! - modelSaid(b)!).slice(0, 5);
  return { byTeam, buckets, worst, n: d.length };
}

export const MONTHS_FI = ["tammikuu", "helmikuu", "maaliskuu", "huhtikuu", "toukokuu", "kesäkuu",
  "heinäkuu", "elokuu", "syyskuu", "lokakuu", "marraskuu", "joulukuu"];

// Oletuskuukausi: kuluva jos siinä on jo pelattu, muuten viimeisin jossa on
// tuloksia (1.-2.10. kuluva kuukausi oli 90 pelaamatonta ja tulokset näyttivät
// kadonneen -- sama sääntö kuin Streamlitissä).
export function defaultMonth(fx: Fixture[], today: string): string {
  const months = [...new Set(fx.map((f) => f.start_ts.slice(0, 7)))].sort();
  const played = [...new Set(fx.filter((f) => f.ended).map((f) => f.start_ts.slice(0, 7)))].sort();
  const now = today.slice(0, 7);
  if (played.includes(now)) return now;
  if (played.length) return played[played.length - 1];
  return months.includes(now) ? now : months[0];
}

// Seuraava kierros (27.10., käyttäjä: "seuraavan pelikierroksen ennuste" etusivulle):
// pelaamattomat ottelut alkaen tästä päivästä, kunnes jokin joukkue tulisi toiseen
// kertaan. Kierros jakautuu usein kahdelle päivälle (27.10. yksi siirretty ottelu,
// 28.10. loput seitsemän), joten pelkkä seuraava pelipäivä näyttäisi vajaan kierroksen.
export function nextRound(fx: Fixture[], today: string): Fixture[] {
  const round: Fixture[] = [];
  const seen = new Set<string>();
  for (const f of fx.filter((g) => !g.ended && g.start_ts.slice(0, 10) >= today).sort((a, b) => a.start_ts.localeCompare(b.start_ts))) {
    if (seen.has(f.home) || seen.has(f.away)) break;
    seen.add(f.home); seen.add(f.away); round.push(f);
  }
  return round;
}
