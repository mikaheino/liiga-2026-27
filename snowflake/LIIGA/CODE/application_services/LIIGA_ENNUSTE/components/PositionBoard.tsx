// Sijaintijakauma ja 14 parhaan raja: etusivulla tietokoneella, omana sivunaan
// (/sijainti) kaikkialla. Puhelimessa sivulla näkyvät samat tiedot kuin webissä
// (käyttäjä 27.10.): sijojen väriraita sekä todennäköinen ja varma raja
// puuttuvine pisteineen ja tarvittavine pistetahteineen per ottelu.
import Heatmap, { DEFAULT_LINE, type Line, type Need } from "@/components/Heatmap";
import { loadLine, loadLog, loadMeta, loadPosition, loadTeams, teamHref } from "@/lib/data";
import { TEAMS, seasonTable } from "@/lib/table";

export default async function PositionBoard({ full = false }: { full?: boolean }) {
  const [{ meta }, pos, log, teams, sim] = await Promise.all([loadMeta(), loadPosition(), loadLog(), loadTeams(), loadLine()]);
  const table = seasonTable(log, teams);
  // Joukkueen runkosarjan ottelut = kaikki ottelut x 2 / joukkueet (544 -> 64).
  const perTeam = meta ? Math.round((Number(meta.GAMES_TOTAL) * 2) / TEAMS) : 0;
  const need = new Map<string, Need>(table.map((r) => [r.team, { pts: r.pts, left: Math.max(perTeam - r.gp, 0) }]));
  // 14 parhaan raja: todennäköinen ja varma simulaatiosta, toteuma = 14. sijan pisteet nyt.
  const lineRank = sim?.rank ?? 14;
  const line: Line | null = sim ? { ...sim, now: table[lineRank - 1]?.pts ?? null } : null;
  return (
    <section className={full ? "pos-full" : ""}>
      <div className="pick-row">
        <div className="label pick"><span className="blink">▶</span> Valitse joukkue</div>
        <div className="line-note" title="Todennäköinen: riittää 14 parhaan joukkoon puolessa simulaatioista. Varma: 95 %:ssa. Nyt: 14. sijan pisteet sarjataulukossa.">
          {lineRank} parhaan raja:
          <span>todennäköinen <b>{line?.likely ?? DEFAULT_LINE} p</b></span>
          {line && <span>varma <b>{line.safe} p</b></span>}
          {line?.now != null && <span>nyt {lineRank}. sijalla <b>{line.now} p</b></span>}
        </div>
      </div>
      <Heatmap rows={pos} highlight={new Set()} link={teamHref} need={perTeam ? need : undefined} line={line} />
      {full && <p className="note">Sarakkeet: puuttuvat pisteet rajaan ja tarvittava pistetahti per jäljellä oleva ottelu. Oranssi = tahtiin on yltänyt noin neljännes joukkueista, punainen = enintään puolet (kaudet 2022–26).</p>}
    </section>
  );
}
