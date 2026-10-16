// Neljä nostokorttia sarjataulukon yläpuolella. Luvut lasketaan samasta
// datasta kuin taulukko (lib/table.ts), joten ne eivät voi olla eri mieltä.
import { Game, highlights, logo } from "@/lib/table";

const f1 = (x: number) => x.toFixed(2).replace(".", ",");

function Card({ k, team, big, sub, tone = "" }: { k: string; team?: string; big: string; sub: string; tone?: string }) {
  return (
    <div className={`kpi ${tone}`}>
      <div className="kpi-k">{k}</div>
      <div className="kpi-main">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        {team && <img src={logo(team)} alt="" width={30} height={30} />}
        <div>
          <div className="kpi-big">{big}</div>
          <div className="kpi-sub">{sub}</div>
        </div>
      </div>
    </div>
  );
}

export default function Kpis({ log, teams, window }: { log: Game[]; teams: string[]; window: number }) {
  const h = highlights(log, teams, window);
  if (!h.leader) return null;
  const gap = h.second ? h.leader.pts - h.second.pts : 0;
  const line = h.safe && h.firstDown ? h.safe.pts - h.firstDown.pts : 0;
  return (
    <section className="kpis">
      <Card k="Sarjakärki" team={h.leader.team} big={h.leader.team}
        sub={`${h.leader.pts} p ${h.leader.gp} ottelusta · ${gap === 0 ? "tasoissa toisen kanssa" : `+${gap} toiseen`}`} tone="gold" />
      {h.hottest && <Card k={`Kuumin vire (${window})`} team={h.hottest.team} big={h.hottest.team}
        sub={`${f1(h.hottest.ppg)} p/ottelu viim. ${h.hottest.games} ottelussa`} />}
      {h.coldest && <Card k={`Kylmin vire (${window})`} team={h.coldest.team} big={h.coldest.team}
        sub={`${f1(h.coldest.ppg)} p/ottelu viim. ${h.coldest.games} ottelussa`} tone="cold" />}
      {h.safe && h.firstDown && <Card k="Putoamisraja" big={`${line} p`}
        sub={`${h.safe.team} (14.) ${h.safe.pts} p · ${h.firstDown.team} (15.) ${h.firstDown.pts} p`} tone="danger" />}
    </section>
  );
}
