// Miten ennuste on liikkunut: pieni paneeli per joukkue.
import History from "@/components/History";
import Shell from "@/components/Shell";
import { type Params, highlightOf, loadHistory, loadPosition, loadTeams } from "@/lib/data";

export const dynamic = "force-dynamic";

export default async function Page({ searchParams }: { searchParams: Promise<Params> }) {
  const sp = await searchParams;
  const [{ history, preseason }, pos, teams] = await Promise.all([loadHistory(), loadPosition(), loadTeams()]);
  return (
    <Shell active="/liike" title="Ennusteen liike">
      <History history={history} order={pos.map((r) => r.team)} highlight={highlightOf(sp, teams)} preseason={preseason} />
    </Shell>
  );
}
