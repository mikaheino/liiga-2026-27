// Mouhon salaisuus -- point-and-click-seikkailu Mouho 2026 -turnaukseen (16.10.).
// Peli on omavarainen (public/mouho/: oma SCUMM-henkinen moottori, ei
// riippuvuuksia), joten se näytetään iframessa sovelluksen yläpalkin alla.
import Top from "@/components/Top";
import { loadMeta } from "@/lib/data";

export const dynamic = "force-dynamic";

export default async function Page() {
  const { meta } = await loadMeta();
  return (
    <div className="shell">
      <Top updatedAt={meta?.UPDATED_AT} active="/mouho" />
      <main className="mouho-frame">
        <iframe src="/mouho/index.html" title="Mouhon salaisuus" allow="fullscreen" />
      </main>
    </div>
  );
}
