// Miten ennuste on liikkunut: pieni paneeli per joukkue.
import Shell from "@/components/Shell";
import { MotionView } from "@/components/Views";
import { loadHistory, loadPosition, loadTeams } from "@/lib/data";

export const dynamic = "force-dynamic";

export default async function Page() {
  const [{ history, preseason }, pos, teams] = await Promise.all([loadHistory(), loadPosition(), loadTeams()]);
  return (
    <Shell active="/liike" title="Ennusteen liike">
      <MotionView history={history} order={pos.map((r) => r.team)} teams={teams} preseason={preseason} />
    </Shell>
  );
}
