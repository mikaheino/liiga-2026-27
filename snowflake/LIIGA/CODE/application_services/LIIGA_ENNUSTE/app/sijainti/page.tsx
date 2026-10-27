// Sijaintijakauma ja rajat omana sivunaan (27.10.): puhelimen etusivu näyttää
// vähemmän mutta selkeämmin, tämä on sen "lisätiedot".
import PositionBoard from "@/components/PositionBoard";
import Shell from "@/components/Shell";

export const dynamic = "force-dynamic";

export default async function Page() {
  return (
    <Shell active="/sijainti" title="Sijainnit ja rajat" rail={false}>
      <PositionBoard full />
    </Shell>
  );
}
