# Mouho – taideohje ja grafiikkaputki (18.10.2026)

Ohje grafiikkaputken agenteille (arvostelija, toteuttaja, valvoja). Lyhyt tarkoituksella:
lue tämä, älä alkuperäisiä oppaita (`mouho_concept/guidelines/`, tiivistetty tähän).

## Tavoite
Monkey Island 2 ja Indiana Jones and the Fate of Atlantis -henki (LucasArts, VGA, 1991–92),
mutta nykyaikaisesti viimeistelty pikseligrafiikka. Kisapuisto on nykyinen paras ruutu – sitäkin
saa parantaa. Tunnelma: maalauksellinen syvyys, rajattu paletti, vahva valo ja varjo, eläviä
yksityiskohtia (kyltit, tekstuurit, kasvit, valot), selkeä luettavuus pelaajalle.

## Tekniset säännöt (pakolliset)
- **Kaikki grafiikka koodina** (canvas-piirtokomennot). Ei kuvatiedostoja.
- Maailma 320 x 136, kangas 2x (PXS = 2). `paintBg(name, fn)` välimuistittaa taustan maailman
  resoluutiolla; dynaaminen piirto (`*Draw`, propsit) menee 2x-kankaalle, jolloin puolikkaat
  pikselit ovat mahdollisia tarkkoihin yksityiskohtiin (ks. `saipaSign()` rooms.js:ssä).
- Apufunktiot: `r(x,y,w,h,c)` (katkaisee kokonaisluvuiksi), `px`, `vgrad`, `dither`, `noise`,
  `disc`, `tri`, `glow`, `shadow`, `fillPoly`, `lineC`, `text3` (3x5-fontti), `bay` (Bayer).
- **Älä koske pelilogiikkaan.** Vain piirtofunktiot. `mouho_art_guard.py` hylkää muutokset
  moottoriin, game.js:ään (paitsi `ITEMS.x.icon`), puheisiin, ajoitukseen ja sijaintivakioihin.
- **Interaktiiviset kohteet pysyvät paikallaan**: ovi, postilaatikko, taksi, ilmoitustaulu,
  laatikko, matto, kuja, idoli, hiekka, jalusta, Mehmet jne. Niiden osuma-alueet ovat game.js:ssä,
  joten piirretty kohde on pidettävä samassa kohdassa ja suunnilleen samankokoisena.
- Päähenkilöiden valokuvapäät (pixfaces.js) eivät ole tämän putken asia. Sivuhahmojen tyyli on
  backlogissa erikseen (kohta 6) – älä piirrä sivuhahmoja uudelleen.

## Pikseligrafiikan periaatteet (oppaista)
1. **Ei pehmennystä**: ei läpikuultavia reunoja eikä väriliukumaa reunoissa. Liukumat tehdään
   ditheröinnillä (`dither`, `bay`) tai sävyportailla, ei alpha-sekoituksella pinnoissa.
2. **Rajattu paletti ja sävyrampit**: 3–5 sävyä per materiaali. Valoisat sävyt lämpimämpiä
   (kohti keltaista), tummat kylmempiä (kohti sinistä/violettia). Ei harmaata varjoa.
3. **Ääriviivat eivät ole mustia**: lähivärin hyvin tumma sävy; valon puolella vaaleampi viiva.
4. **Puhtaat viivat**: vinot 1:1, 1:2, 2:1 (ja 1:3). Ei sahalaitaa (jaggies): käyrissä
   segmenttien pituudet kasvavat ja pienenevät säännöllisesti.
5. **Ei irtopikseleitä eikä tuplaviivoja** (orphans, doubles), ellei tarkoituksella.
6. **Klusterit**: jokainen pikseli kuuluu muotoon, varjoon tai valoon. Tekstuuri (tiili, kivi,
   puu, kangas) klustereina, ei kohinana. Toistuva kuvio rikotaan käsin, ettei ruudukko näy.
7. **Valo**: yksi päävalonlähde per ruutu, johdonmukaiset varjot. Kontrasti ohjaa katsetta
   interaktiivisiin kohteisiin.
8. **Luettavuus**: siluetti ensin, yksityiskohdat sitten. Pieni koko vaatii abstrahointia.
9. **Pieni epäsymmetria** antaa eloa (vino kyltti, lohkeama, kulunut kohta).

## Putken työkalut
- Kuvat: `scripts/tools/mouho_shots.sh <kansio> [näkymä...]` → PNG per näkymä
  (`kisa liiga suomi kartta basaari temppeli kaivokatu loppu puhelu esineet hahmot otsikko`).
- Pelin kulku: `node scripts/tools/mouho_smoke.mjs` → `OK` tai `FAIL vaihe N`.
- Logiikkavahti: `.venv/bin/python scripts/tools/mouho_art_guard.py <git-viite>` → `OK`/`FAIL`.
- Syntaksi: `node --check <tiedosto>`.

## Näkymä → piirtokoodi
| näkymä | funktiot |
|---|---|
| kisa | rooms.js `kisaBg`, `kisaDraw`, `parkedCar`, `saipaSign`, `kisaPoster`, `kisaPostbox`, `kisaRack`, `kisaBox`, `kisaTaxi` |
| liiga | prologue.js `liigaOfficeBg`, `tram`, `boot` |
| suomi | prologue.js `seFinlandMapBg`, `kouvolaCloud` |
| kartta | prologue.js `europeMapBg`, `plane` |
| basaari | rooms.js `basaariBg`, `basaariDetail`, `basaariDraw`, `basaariCounter`, `basaariSpices`, `basaariBags`, `basaariAmphora` |
| temppeli | rooms.js `temppeliBg`, `temppeliDraw`, `temppeliSand`, `temppeliPillar`, `temppeliPedestal`, `temppeliBoulder`, `temppeliPost` |
| kaivokatu, loppu | kaivokatu.js `kaivokatuBg`, `kaivokatuDraw`, `mouhoInBg`, `boardTable`; art.js `rinkTV` |
| puhelu | call.js `kisaPanel`, `coachPanel`, `jussiPanelBg`, `phoneArm` |
| esineet | game.js `ITEMS.<x>.icon` (24 x 16) |
| otsikko | art.js `titleBg`, `drawTitle` |
