// Julkaisukohde (27.10.): Snowflaken App Runtime (palvelin, agentti, LinkedIn) tai
// GitHub Pages (staattinen vienti, data liiga.fi:stä GitHub Actionsissa, ei agenttia
// eikä LinkedIn-osiota). scripts/deploy/pages_build.sh asettaa muuttujat; NEXT_PUBLIC_
// leivotaan käännökseen, joten sama arvo näkyy palvelimella ja selaimessa.
export const STATIC = process.env.NEXT_PUBLIC_LIIGA_STATIC === "1";
export const BASE = process.env.NEXT_PUBLIC_BASE_PATH ?? "";
// Mouho-peli on Pagesissa omassa repossaan.
export const MOUHO_PAGES = "https://mikaheino.github.io/mouhon-salaisuus-peli/";
// Uutishaastajan OK-nappi käynnistää tämän repon absence.yml-ajon (vain Pages).
export const GH_REPO = "mikaheino/liiga-2026-27";
