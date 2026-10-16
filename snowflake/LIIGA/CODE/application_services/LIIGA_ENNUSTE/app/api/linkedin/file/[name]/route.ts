// Yksi renderöity tiedosto (esikatselu-PNG tai PDF). Kansio annetaan
// parametrina (?v=<kansio>), ettei jokainen kuva käynnistä Pythonia
// aikaleiman takia. Molemmat nimet tarkistetaan tiukasti: polku ei saa karata
// hakemistosta.
import fs from "node:fs";
import path from "node:path";
import { OUT, type Manifest } from "@/lib/linkedin";

export const dynamic = "force-dynamic";

export async function GET(req: Request, { params }: { params: Promise<{ name: string }> }) {
  const { name } = await params;
  const v = new URL(req.url).searchParams.get("v") ?? "";
  if (!/^[a-z0-9_-]+\.(png|pdf)$/.test(name) || !/^[A-Za-z0-9-]+$/.test(v)) return new Response("virheellinen nimi", { status: 400 });
  const dir = path.join(OUT, v), file = path.join(dir, name);
  if (!fs.existsSync(file)) return new Response("ei löydy", { status: 404 });
  const pdf = name.endsWith(".pdf");
  const m = pdf ? (JSON.parse(fs.readFileSync(path.join(dir, "manifest.json"), "utf8")) as Manifest) : null;
  const download = m?.assets.find((a) => a.pdf === name)?.file ?? name;
  return new Response(new Uint8Array(fs.readFileSync(file)), {
    headers: {
      "Content-Type": pdf ? "application/pdf" : "image/png",
      "Cache-Control": "private, max-age=86400",           // kansio = yksi ennuste, sisältö ei muutu
      ...(pdf ? { "Content-Disposition": `attachment; filename="${download}"` } : {}),
    },
  });
}
