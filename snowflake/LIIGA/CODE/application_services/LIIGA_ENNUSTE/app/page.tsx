// Etusivu: kauden tilanne, sijaintijakauma ja valikko. Kaikki muu on drilldownia:
// heatmapin rivi avaa joukkueen (/joukkue/Tappara), valikko osiot. Käyttäjä 16.10.:
// muut osiot eivät näy oletuksena, mutta demossa niihin hypätään täältä.
import Link from "next/link";
import Heatmap from "@/components/Heatmap";
import Season from "@/components/Season";
import Top from "@/components/Top";
import { loadFixtures, loadHistory, loadLog, loadMeta, loadPosition, loadTeams, teamHref } from "@/lib/data";
import { scoreboard } from "@/lib/fixtures";
import { fi, seasonTable } from "@/lib/table";

export const dynamic = "force-dynamic";

export default async function Page() {
  const [{ meta, next }, pos, log, teams, fixtures, { history, preseason }] = await Promise.all([
    loadMeta(), loadPosition(), loadLog(), loadTeams(), loadFixtures(), loadHistory(),
  ]);
  // Jokaisessa ovessa elävä nosto -- ovi kertoo jo mitä sen takana on.
  const leader = seasonTable(log, teams)[0];
  const fav = [...pos].sort((a, b) => b.pTitle - a.pTitle)[0];
  const s = scoreboard(fixtures);
  const latest = history.length ? history[history.length - 1].date : "";
  const mover = history.filter((h) => h.date === latest && preseason.has(h.team))
    .map((h) => ({ team: h.team, d: h.points - preseason.get(h.team)! }))
    .sort((a, b) => Math.abs(b.d) - Math.abs(a.d))[0];
  const doors = [
    { href: "/sarjataulukko", k: "Sarjataulukko", v: leader ? leader.team : "–", s: leader ? `${leader.pts} p kärjessä` : "" },
    { href: "/voittaja", k: "Runkosarjan voittaja", v: fav ? `${fav.team} ${fi(fav.pTitle, 0)} %` : "–", s: "suosikki nyt" },
    { href: "/ottelut", k: "Ottelut", v: s.n ? `${Math.round((100 * s.hits) / s.n)} % oikein` : "–", s: s.n ? `${s.hits}/${s.n} voittajaa` : "" },
    { href: "/liike", k: "Ennusteen liike", v: mover ? `${mover.team} ${mover.d > 0 ? "+" : ""}${fi(mover.d)}` : "–", s: "suurin muutos esikaudesta" },
    { href: "/linkedin", k: "LinkedIn", v: "7 postausta", s: "PDF:t jakoon" },
  ];
  return (
    <div className="shell">
      <Top updatedAt={meta?.UPDATED_AT} active="/" />
      <main className="main front">
        {meta && <Season played={meta.GAMES_PLAYED} total={meta.GAMES_TOTAL} nextDate={next?.D ?? null} nextGames={Number(next?.N ?? 0)} />}
        <div className="label pick"><span className="blink">▶</span> Valitse joukkue</div>
        <Heatmap rows={pos} highlight={new Set()} link={teamHref} />
        <nav className="doors" aria-label="Osiot">
          {doors.map((d, i) => (
            <Link key={d.href} href={d.href} className="door" style={{ animationDelay: `${600 + i * 90}ms` }}>
              <span className="door-k">{d.k}</span>
              <span className="door-v">{d.v}</span>
              <span className="door-s">{d.s}</span>
              <span className="door-go" aria-hidden>▶</span>
            </Link>
          ))}
        </nav>
      </main>
    </div>
  );
}
