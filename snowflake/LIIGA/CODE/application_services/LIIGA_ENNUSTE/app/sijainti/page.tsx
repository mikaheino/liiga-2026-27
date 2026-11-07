// Heatmap omana sivunaan (7.11.2026, käyttäjä: "siirretään heatmap omalle sivulleen").
// Etusivun kausiosio sellaisenaan: kelattava kausipalkki (TimeTravel + Season) ja
// sijaintijakauma rajoineen (PositionBoard full, ennen 27.10. alkaen tämän sivun sisältö).
import PositionBoard from "@/components/PositionBoard";
import Season from "@/components/Season";
import Shell from "@/components/Shell";
import TimeTravel from "@/components/TimeTravel";
import { loadMeta, loadPositionHistory } from "@/lib/data";

export const dynamic = "force-dynamic";

export default async function Page() {
  const [{ meta, next }, snapsAll] = await Promise.all([
    loadMeta(),
    loadPositionHistory().catch((e) => { console.log(`[data] jakaumahistoria: ${(e as Error).message}`); return []; }),
  ]);
  // Kelattavat tilannekuvat: kaikki ennen nykyistä ennustetta (nykyhetki tulee suoraan).
  const nowDate = String(meta?.UPDATED_AT ?? "").slice(0, 10);
  const snaps = snapsAll.filter((s) => s.date < nowDate);
  return (
    <Shell active="/sijainti" title="Sijainnit" rail={false}>
      <TimeTravel snaps={snaps}>
        {meta && <Season compact played={meta.GAMES_PLAYED} total={meta.GAMES_TOTAL} nextDate={next?.D ?? null} nextGames={Number(next?.N ?? 0)} />}
        <PositionBoard full />
      </TimeTravel>
    </Shell>
  );
}
