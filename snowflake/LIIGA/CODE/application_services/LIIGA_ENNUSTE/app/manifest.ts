// Kotinäyttökuvake ja koko ruudun tila puhelimessa (13.11.2026). BASE: Pagesin alipolku.
import type { MetadataRoute } from "next";
import { BASE } from "@/lib/target";

export const dynamic = "force-static";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Liiga Ennuste 2026–27", short_name: "Liiga Ennuste",
    description: "Liigan runkosarjan ennuste: ottelut, lopputaulukko ja voittaja.",
    start_url: `${BASE}/`, scope: `${BASE}/`, display: "standalone", lang: "fi",
    background_color: "#050403", theme_color: "#050403",
    icons: [
      { src: `${BASE}/icons/icon-192.png`, sizes: "192x192", type: "image/png", purpose: "any" },
      { src: `${BASE}/icons/icon-512.png`, sizes: "512x512", type: "image/png", purpose: "any" },
      { src: `${BASE}/icons/icon-512.png`, sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
