// Julkaisukohde (27.10.): Snowflaken App Runtime (palvelin, agentti, LinkedIn) tai
// GitHub Pages (staattinen vienti, data liiga.fi:stä GitHub Actionsissa, ei agenttia
// eikä LinkedIn-osiota). scripts/deploy/pages_build.sh asettaa muuttujat; NEXT_PUBLIC_
// leivotaan käännökseen, joten sama arvo näkyy palvelimella ja selaimessa.
export const STATIC = process.env.NEXT_PUBLIC_LIIGA_STATIC === "1";
export const BASE = process.env.NEXT_PUBLIC_BASE_PATH ?? "";
// Mouho-peli on Pagesissa omassa repossaan.
export const MOUHO_PAGES = "https://mikaheino.github.io/mouhon-salaisuus-peli/";
// Uutishaastajan kirjautuminen ja OK-nappi (vain Pages): välipalvelin
// workers/hyvaksynta (Cloudflare Worker). Tyhjä = ei vielä julkaistu, linkkiä ei näytetä.
export const APPROVE_URL = process.env.NEXT_PUBLIC_APPROVE_URL ?? "";
