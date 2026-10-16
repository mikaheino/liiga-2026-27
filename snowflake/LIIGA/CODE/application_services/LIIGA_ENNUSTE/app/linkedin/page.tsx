// LinkedIn-osasto: jaettavat PDF:t omana sivunaan, koska renderöinti vie
// puoli minuuttia eikä sen kuulu hidastaa ennustesivua.
import LinkedinPanel from "@/components/LinkedinPanel";
import Top from "@/components/Top";
import { query } from "@/lib/snowflake";

export const dynamic = "force-dynamic";

export default async function Page() {
  const meta = await query<{ UPDATED_AT: string }>("SELECT updated_at FROM LIIGA.MODEL.PREDICTION_META");
  return (
    <div className="shell">
      <Top updatedAt={meta[0]?.UPDATED_AT} active="/linkedin" />
      <main className="main narrow"><LinkedinPanel /></main>
    </div>
  );
}
