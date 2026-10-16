// Kuka voittaa runkosarjan: kerätty + simuloitu, ja suosikin vaihtuminen ajassa.
import Shell from "@/components/Shell";
import { TitleHistory, TitleRace } from "@/components/TitleRace";
import { type Params, highlightOf, loadHistory, loadTeams, loadTitle } from "@/lib/data";

export const dynamic = "force-dynamic";

export default async function Page({ searchParams }: { searchParams: Promise<Params> }) {
  const sp = await searchParams;
  const [title, { history }, teams] = await Promise.all([loadTitle(), loadHistory(), loadTeams()]);
  const highlight = highlightOf(sp, teams);
  const top6 = [...title].sort((a, b) => b.pTitle - a.pTitle).slice(0, 6).map((r) => r.team);
  return (
    <Shell active="/voittaja" title="Runkosarjan voittaja">
      <TitleRace rows={title} highlight={highlight} />
      <div className="legend"><span><i className="sw-got" />Kerätty</span><span><i className="sw-sim" />Simuloitu loppukausi</span></div>
      <TitleHistory history={history} top={top6} highlight={highlight} />
    </Shell>
  );
}
