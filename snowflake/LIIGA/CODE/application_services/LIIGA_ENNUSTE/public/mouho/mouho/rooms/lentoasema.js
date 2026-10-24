// Mouhon salaisuus -- Lappeenrannan lentoaseman lähtöaula: grafiikka, Valtonen, ruutu ja kohtaukset.
"use strict";
// ---- Lappeenrannan lentoaseman lähtöaula (23.10.) --------------------------------------
// Pieni aula: vasemmalla lähtötaulu ja kahvio, keskellä iso ikkuna kiitotielle ja portilla
// odottavaan koneeseen, oikealla Portti 1 (ainoa). Odottavat matkustajat katsovat ikkunasta.
// Ikkunan taivas ja pilvet erikseen (23.10.); etuala jättää ikkunan taivasosan läpinäkyväksi.
const AIR_CLOUDS = [[130, 24, 40], [200, 34, 30], [250, 22, 34], [20, 30, 36]];
function lentoasemaSky() { vgrad(118, 18, 166, 44, ["#1c2448", "#2c3460", "#4c4474", "#8c6480", "#c88470"]); }
function lentoasemaBg() {
  r(0, 0, W, 14, "#34343c"); for (let x = 8; x < W; x += 40) { r(x, 7, 26, 2, "#e8ecf0"); r(x, 9, 26, 1, "#9ca0a8"); }
  r(0, 14, W, 74, "#c8c4bc"); dither(0, 14, W, 6, "#b8b4ac", "#c8c4bc", .5);
  // ikkuna: hämärä taivas, metsänreuna, kiitotie ja kone
  g.clearRect(118, 18, 166, 38);
  r(118, 56, 166, 4, "#14181c"); for (let x = 118; x < 284; x += 3) r(x, 54 - (x * 7 % 3), 2, 3, "#14181c");
  r(118, 60, 166, 10, "#3c4044"); r(118, 64, 166, 1, "#5c6064");
  // kone: valkoinen runko, sininen raita, ikkunarivi, pyrstö
  r(150, 44, 96, 10, "#eceff2"); disc(150, 49, 5, "#eceff2"); r(150, 50, 96, 2, "#2c5cac"); for (let x = 156; x < 240; x += 5) r(x, 46, 2, 2, "#3c4c5c");
  fillPoly([[234, 44], [246, 30], [252, 30], [248, 44]], "#eceff2"); fillPoly([[240, 36], [250, 31], [252, 34], [244, 40]], "#2c5cac");
  r(176, 53, 40, 3, "#c8ccd0"); r(166, 56, 3, 5, "#2c2c34"); r(226, 56, 3, 5, "#2c2c34"); r(146, 48, 2, 2, "#1c2c3c");
  for (let x = 118; x < 284; x += 28) r(x, 18, 3, 52, "#5c5c64"); r(118, 18, 166, 2, "#5c5c64"); r(118, 68, 166, 2, "#5c5c64");
  // lähtötaulun kehys (teksti piirretään lentoasemaDraw:ssa tarkkana)
  r(14, 20, 92, 40, "#2c2c34"); r(16, 22, 88, 36, "#0c0c12");
  // kahvio vasemmalla
  r(20, 66, 64, 4, "#8c4c2c"); r(22, 70, 60, 22, "#a8643c"); r(22, 70, 60, 2, "#c8845c"); for (let x = 26; x < 80; x += 9) r(x, 74, 1, 16, "#8c4c2c");
  r(28, 56, 12, 10, "#3c3c44"); r(30, 58, 8, 3, "#c81c1c"); r(46, 60, 22, 6, "#ece4d4"); r(48, 62, 18, 1, "#8c7c6c");
  // Portti 1 oikealla, ulko-ovi vasemmalla
  r(284, 30, 36, 10, "#fcd41c"); r(286, 40, 32, 50, "#5c6c74"); r(288, 42, 28, 46, "#8cb4c8"); r(301, 42, 2, 46, "#5c6c74"); dither(288, 42, 13, 46, "#8cb4c8", "#a8cce0", .25);
  r(0, 44, 12, 46, "#5c6c74"); r(0, 46, 10, 42, "#8cb4c8"); r(0, 36, 14, 7, "#2c8c4c");
  r(0, 84, W, 4, "#9c968c");
  // lattia: kiiltävä kivi, ikkunan heijastus
  vgrad(0, 88, W, 48, ["#8c8c94", "#9c9ca4", "#a8a8b0", "#b4b4bc"]);
  for (let y = 92; y < H; y += 6 + ((y - 88) / 8 | 0)) r(0, y, W, 1, "#84848c");
  for (let j = 0; j < 20; j++) { const y = 90 + j, a = .35 - j / 60; for (let x = 122; x < 280; x += 2) if (bay(x, y) < a) px(x, y, "#c8ccd8"); }
}
function lentoasemaDraw(t) {
  g.drawImage(paintBg("air_sky", lentoasemaSky), 0, 0);
  drift("air_clouds", 5, () => puffBand(AIR_CLOUDS, "#5c4c78", "#a8748c"), t);
  g.drawImage(paintBg("lentoasema", lentoasemaBg), 0, 0);
  // lähtötaulu: keltaiset rivit, Istanbul vilkkuu
  g.font = "7px VT323, monospace"; g.fillStyle = "#fcd41c";
  g.fillText("LÄHTEVÄT  DEPARTURES", 19, 29);
  if (Math.floor(t / 700) % 2) g.fillText("21.40 ISTANBUL  PORTTI 1", 19, 38); else { g.fillText("21.40 ISTANBUL", 19, 38); }
  g.fillStyle = "#c8a41c"; g.fillText("--.-- BERGAMO   PERUTTU", 19, 46); g.fillText("--.-- HELSINKI  JUNALLA", 19, 54);
  // kiitotien valot ja koneen vilkku
  for (let x = 122; x < 284; x += 10) px(x, 63, Math.floor(t / 400 + x / 10) % 4 ? "#fce070" : "#8c7c3c");
  if (Math.floor(t / 600) % 2) { px(251, 29, "#fc3c3c"); glow(251, 29, 5, "255,60,60", .5); }
  g.font = "6px VT323, monospace"; g.fillStyle = "#1c1c1c"; g.fillText("PORTTI 1", 290, 37); g.fillStyle = "#f4f4f4"; g.fillText("ULOS", 1, 42);
  // loistelamppu välkkyy välillä
  if ((t % 5300) < 90) r(88, 7, 26, 3, "#5c5c64");
}
// Odottavat matkustajat penkeillä ikkunan edessä (penkki y-lajittelussa propina).
function lentoasemaSeats(t) {
  for (const [i, x, back] of [[1, 168, true], [4, 196, false], [2, 230, true]]) npc(i, x, 100, t + x * 30, { back, sc: .82 });
  for (let x = 156; x < 252; x += 12) { r(x, 98, 10, 5, "#2c5c9c"); r(x, 94, 10, 4, "#3c6cac"); r(x + 1, 103, 1, 4, "#3c3c44"); r(x + 8, 103, 1, 4, "#3c3c44"); }
}
// Tomek Valtonen (23.10.): lentoaseman lähtöaulassa harjoittelemassa pukukoppipuhetta.
// Karisman mestari; puhe tarvitsee joukkueen, eivätkä matkustajat ole joukkue. Jussilla on pyramidi.
const VALTONEN = { id: "valtonen", x: 120, y: 108, h: 46, color: "#f4c090", moving: false, dir: 1, hidden: () => !st.flags.valtonenHere,
  draw(t, talking) { person("valtonen", this.x, this.y, t, { moving: this.moving, dir: this.dir, talking }); } };
// Lappeenrannan lentoaseman lähtöaula (23.10.): Kisapuiston ja Istanbulin välissä. Valtonen
// harjoittelee puhetta; Portti 1 vie Istanbuliin, ulko-ovesta taksilla takaisin Kisapuistoon.
defineRoom("lentoasema", {
  title: "Lappeenrannan lentoasema, lähtöaula", scale: [86, 136, 0.6, 1.06], start: 122,
  walk: [[[14, 92], [300, 92], [318, 136], [2, 136]]],
  actors: [VALTONEN],
  draw: lentoasemaDraw,
  props: [{ y: 104, draw: lentoasemaSeats }],
  spots: [
    { id: "valtonen", name: "Tomek Valtonen", actor: true, get x() { return VALTONEN.x - 7; }, get y() { return VALTONEN.y - 30; }, w: 14, h: 30, at: 100, aty: 114,
      hidden: () => !st.flags.valtonenHere || VALTONEN.moving,
      Katso: () => say(st.flags.valtonenIn ? "Tomek Valtonen. Hän hymyilee kuin olisi juuri voittanut jotain. Ehkä hän voittikin." : "Tomek Valtonen. Hän puhuu hiljaa odottaville matkustajille ja elehtii käsillään. Matkustajat odottavat lentoa."),
      Puhu: () => valtonenTalk(),
      "Käytä:kaavio": () => valtonenSpeech(), Anna: (it) => it === "kaavio" ? valtonenSpeech() : say("Pidä se. Tarvitsen vain joukkueen.", "valtonen") },
    { id: "taulu", name: "lähtötaulu", x: 14, y: 20, w: 92, h: 40, at: 60, aty: 112,
      Katso: () => say("Lähtevät: Istanbul 21.40, portti 1. Bergamo peruttu. Helsinki: junalla.\nRehellinen taulu. Arvostan.") },
    { id: "ikkuna", name: "ikkuna", x: 118, y: 18, w: 166, h: 52, at: 200, aty: 110,
      Katso: () => say("Kiitotiellä odottaa kone. Valkoinen, sininen raita. Ainoa kone, ainoa portti, ainoa matkustaja Istanbuliin: minä."),
      Avaa: () => say("Ikkuna ei aukea. Lentoasemilla ne eivät koskaan aukea. Turvallisuus.") },
    { id: "kahvio", name: "kahvio", x: 20, y: 56, w: 64, h: 36, at: 56, aty: 112,
      Katso: () => say("Kahvio. Munkkikahvit 4,50. Lentokenttähinnat ovat kansainvälisiä, vaikka lennot eivät aina olisi."),
      Poimi: () => say("Munkki maksaa. Mouho on ilmainen, kahvio ei.") },
    { id: "matkustajat", name: "matkustajat", x: 160, y: 72, w: 80, h: 30, at: 200, aty: 112,
      Katso: () => say("Odottavia matkustajia. Yksi lukee, kaksi katsoo ikkunasta. Kukaan ei katso Valtosta, vaikka hän puhuu heille."),
      Puhu: () => say("Hyvää iltaa! Mouho hakee jäseniä!\n...Kukaan ei käänny. He odottavat eri lentoja.") },
    { id: "portti", name: "portti 1", x: 284, y: 30, w: 36, h: 60, at: 290, aty: 104, exit: true,
      Katso: () => say("Portti 1. Ainoa portti. Sen takana Istanbul."),
      Käytä: () => boardPlane(), Avaa: () => boardPlane(), Kävele: () => boardPlane(), "Käytä:lippu": () => boardPlane(), "Anna:lippu": () => boardPlane() },
    { id: "ulos", name: "ulko-ovi", x: 0, y: 36, w: 14, h: 54, at: 16, aty: 118, exit: true,
      Katso: () => say("Ulko-ovi. Taksi odottaa yhä. Kuljettaja lukee jo toista otteluohjelmaa."),
      Käytä: () => backToKisa(), Kävele: () => backToKisa(), Avaa: () => backToKisa() },
  ],
});
async function backToKisa() {
  await script(async () => { await say("Takaisin Kisapuistoon. Taksi tuntee jo tien."); go("koti", 232, true, 128); });
}
// Portti 1: lentolippu kädessä Istanbuliin (23.10.: lähtöaula Kisapuiston ja Istanbulin välissä).
async function boardPlane() {
  await script(async () => {
    if (!has("lippu")) return say("Portti 1. Ilman lippua tästä ei mennä. Tarkistin ilmeestä.", "muu");
    await say("Istanbul, täältä tullaan! Mouho Global Partners odottaa.");
    take("lippu"); await travel("lpr", "ist"); go("portti", 110, true, 87); await walkTo(60, 122);       // aukion perältä kohti katsojaa (backlog 8, syvyys 25.10.)
    await say("Istanbul! Basaarit, moskeijat ja simitin tuoksu. Täällä jokainen on potentiaalinen jäsen.");
    await say("Kirjeen mukaan Mehmetin koju on Suuressa basaarissa. Portti on tuossa.");
  });
}

// ---------------------------------------------------------------- Tomek Valtonen, karisman mestari
// 23.10.: Monkey Island -sävy. Valtosen karisma on aitoa taitoa: hän pitää oikean pukukoppipuheen,
// absurdia on vain se, että yleisönä on Jussin paperinen pyramidikaavio. Valinnainen jäsen;
// "Ilman pohjaa huippu on pelkkä piste" (f.pohja) on myöhemmin kaksintaistelun vastaus.
async function valtonenArrives() {
  if (st.flags.valtonenHere || st.flags.valtonenIn) return;
  st.flags.valtonenHere = true;
  await say("Aulan keskellä seisoo Tomek Valtonen, Jokerien takavuosien kulttipelaaja.", "muu");
  await say("Hän oikaisee jakkunsa, katsoo odottavia matkustajia ja puhuu hiljaa itsekseen. Kädet liikkuvat.", "muu");
}
async function valtonenTalk() {
  await script(async () => {
    const f = st.flags;
    if (f.valtonenIn) return say("Pää pystyyn, Markkanen. Pohja kantaa.", "valtonen");
    if (!f.metValtonen) { f.metValtonen = true;
      await say("Tomek Valtonen! Näin teidän pelaavan, kun olin pieni. No, pienempi.");
      await say("Kaikki näkivät. Se oli koko pointti.", "valtonen");
      await say("Mitä te täällä teette?");
      await say("Odotan lentoa. Ja harjoittelen puhetta.", "valtonen"); }
    while (true) {
      const opts = [];
      if (!f.needTeam) opts.push("Millaista puhetta?");
      if (!f.pause) opts.push("Mikä on hyvän puheen salaisuus?");
      if (f.needTeam && has("kaavio")) opts.push("Minulla olisi joukkue. Vähän paperinen.");
      opts.push("Näkemiin.");
      const pick = opts[await choose(opts)]; await say(pick);
      if (pick.startsWith("Millaista")) { f.needTeam = true;
        await say("Pukukoppipuhetta. Sellaista, jonka jälkeen kaikki juoksevat seinän läpi.", "valtonen");
        await say("Saisinko kuulla sen?");
        await say("Puhe ilman joukkuetta on pelkkää ääntä. Tarvitsen joukkueen.", "valtonen");
        await say("Täällähän on ihmisiä!");
        await say("Matkustajat eivät ole joukkue. He odottavat eri lentoja.", "valtonen");
        await say(has("kaavio") ? "Joukkueen. Minulla on... no, pyramidi." : "Joukkueen. Minulla ei ole edes kahta jäsentä. Vielä."); }
      else if (pick.startsWith("Mikä on hyvän")) { f.pause = true;
        await say("Tauko. Kaikki luulevat, että puheessa tärkeintä ovat sanat. Tärkeintä on tauko ennen niitä.", "valtonen");
        await say("Tauko. Kokeillaan.");
        await sleep(TEST ? 200 : 2600);
        await say("...........Mouho!");
        await say("Liian pitkä. Mutta suunta oli oikea.", "valtonen"); }
      else if (pick.startsWith("Minulla olisi")) return valtonenSpeech(true);
      else { await say("Pää pystyyn, Markkanen.", "valtonen"); return; }
    }
  });
}
async function valtonenSpeech(inScript = false) {
  const run = async () => {
    const f = st.flags;
    if (f.valtonenIn) return say("Puhe on jo pidetty. Hyvät puheet pidetään kerran.", "valtonen");
    if (!f.needTeam) return say("Pyramidikaavio? Kiitos, mutta mitä minä sillä teen?", "valtonen");
    await say("Tässä on joukkueeni. Huipulla minä, alla herra Saarni ja maskotti" + (f.jalonenIn ? ", ja Kari Jalonen. Isolla." : "."));
    await say("Valtonen ottaa kaavion. Hän katsoo sitä pitkään. Sitten hän nostaa katseensa.", "muu");
    await say("Pojat.", "valtonen");
    await sleep(TEST ? 200 : 1400);
    await say("...Ja maskotti.", "valtonen");
    await say("Tämä paperi piirrettiin yhdessä illassa. Mutta jokainen viiva on tässä syystä.", "valtonen");
    await say("Huipulla on yksi mies. Mutta ilman pohjaa huippu on pelkkä piste.", "valtonen");
    await say("Joten mennään ulos ja pelataan niin, että pohja tuntuu!", "valtonen");
    beep(392, 140, "triangle", .06); setTimeout(() => beep(523, 220, "triangle", .06), 160);
    await say("Odottavat matkustajat nousevat seisomaan. Joku taputtaa. Kuulutus keskeytyy kesken sanan. Jussi pyyhkii silmäkulmaansa.", "muu");
    await say("Minä olen se piste. Ja minä tunsin juuri pohjan.");
    f.valtonenIn = true; f.pohja = true; f.recruits = (f.recruits ?? 0) + 1; iq("valtonen", 5);
    await say("Hyvä joukkue. Mukana.", "valtonen");
    await say("Tomek Valtonen, Mouhon jäsen! Ja kaavion alle kirjoitan: ilman pohjaa huippu on pelkkä piste.");
  };
  return inScript ? run() : script(run);
}
