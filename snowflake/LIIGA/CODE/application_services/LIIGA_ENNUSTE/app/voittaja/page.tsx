// Kuka voittaa runkosarjan: kerätty + simuloitu, ja suosikin vaihtuminen ajassa.
import Shell from "@/components/Shell";
import { TitleView } from "@/components/Views";
import { loadHistory, loadTeams, loadTitle } from "@/lib/data";

export const dynamic = "force-dynamic";

export default async function Page() {
  const [title, { history }, teams] = await Promise.all([loadTitle(), loadHistory(), loadTeams()]);
  return (
    <Shell active="/voittaja" title="Runkosarjan voittaja">
      <TitleView title={title} history={history} teams={teams} />
    </Shell>
  );
}
