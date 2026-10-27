"use client";
// Uusi versio näkyviin ilman käsin päivittämistä (käyttäjä 27.10.: "en näe tätä
// versiota puhelimella"). Pages-sivu on selaimen välimuistissa 10 min, ja auki
// jäänyt välilehti käyttää vanhan käännöksen koodia. Kun sovellus tulee näkyviin,
// verrataan käännöksen tunnusta julkaistuun (version.json, ohi välimuistin): jos uusi
// on julkaistu, sivu ladataan uudelleen. Vain Pagesissa (tunnus asetetaan käännöksessä).
import { useEffect } from "react";
import { BASE } from "@/lib/target";

const BUILD = process.env.NEXT_PUBLIC_BUILD_ID ?? "";
const KEY = "liiga-versio-yritetty";

export default function VersionCheck() {
  useEffect(() => {
    if (!BUILD) return;
    const check = async () => {
      if (document.visibilityState !== "visible") return;
      try {
        const r = await fetch(`${BASE}/version.json?t=${Date.now()}`, { cache: "no-store" });
        const v = (await r.json()) as { build?: string };
        if (!v.build || v.build === BUILD) return;
        // Kerran per julkaistu versio (sessionStorage), ettei välimuistista tuleva vanha
        // sivu voi pyörittää latausta; uusi osoite (?v=) ohittaa selaimen välimuistin.
        if (sessionStorage.getItem(KEY) === v.build) return;
        sessionStorage.setItem(KEY, v.build);
        const q = new URLSearchParams(location.search);
        q.set("v", v.build);
        location.replace(`${location.pathname}?${q}${location.hash}`);
      } catch { /* verkkokatko: yritetään seuraavalla kerralla */ }
    };
    check();
    document.addEventListener("visibilitychange", check);
    window.addEventListener("pageshow", check);      // Safari palauttaa sivun välimuistista
    return () => { document.removeEventListener("visibilitychange", check); window.removeEventListener("pageshow", check); };
  }, []);
  return null;
}
