// Osiosivun runko: yläpalkki, sivupalkin valinnat ja paluu etusivulle.
import Link from "next/link";
import { Suspense } from "react";
import Controls from "@/components/Controls";
import SwipeBack from "@/components/SwipeBack";
import Top from "@/components/Top";
import { loadMeta, loadTeams } from "@/lib/data";
import { STATIC } from "@/lib/target";

export default async function Shell({ active, title, children, rail = true }: {
  active: string; title: string; children: React.ReactNode; rail?: boolean;
}) {
  const [{ meta }, teams] = await Promise.all([loadMeta(), loadTeams()]);
  return (
    <div className="shell">
      <Top updatedAt={meta?.UPDATED_AT} active={active} />
      <div className={rail ? "layout" : "layout no-rail"}>
        {rail && (
          <aside className="rail">
            <Suspense><Controls teams={teams} /></Suspense>
            <div className="rail-foot">Lähde: Liiga.fi · {STATIC ? "päivitys GitHub Actions" : "Snowflake LIIGA.MODEL"}<br />Malli: pelaajat 40 % · Elo 60 %</div>
          </aside>
        )}
        <main className="main">
          <SwipeBack>
            <div className="crumb"><Link href="/">◀ Etusivu</Link><span>{title}</span></div>
            {children}
          </SwipeBack>
        </main>
      </div>
    </div>
  );
}
