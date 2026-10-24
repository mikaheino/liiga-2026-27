// Mouhon salaisuus -- Esineet ja niiden kuvakkeet.
"use strict";
Object.assign(ITEMS, {
  kebab: { name: "kebab", look: () => say("Aito Istanbulin döner kebab. Näyte Mouhon tarjoilusta. Pizza on yliarvostettu.") },
  kortti: { name: "käyntikortti", look: () => say("Kultareunainen käyntikortti. Painettu nimi on vedetty yli, ja tilalle on juuri kirjoitettu kuulakärkikynällä: \"MOUHO GLOBAL PARTNERS. Istanbul - Lappeenranta.\"\nKuulostaa viralliselta.") },
  kirje: { name: "kirje", look: async () => {
    await say("\"Arvoisa herra Markkanen! Sijoittajamme ovat valmiita neuvottelemaan MOUHO-brändistä kanssanne.\nTervetuloa Istanbuliin: Suuri basaari, Mehmetin koju. -- Mouho Global Partners\"");
    await say("Neuvottelemaan Mouhosta! Kansainvälinen kumppanuus, ennen kuin olen edes saanut paikkaa. Proaktiivisempaa ei voi olla.");
    if (!has("lippu")) { await say("Kirjeen välissä on lentolippu Istanbuliin. Ilmainen! Se on aina hyvä merkki. Eikö olekin?"); give("lippu"); } },
    Avaa: () => ITEMS.kirje.look() },          // sokkotesti 2: "Avaa kirje" on luontevin verbi
  seteli: { name: "50 euron seteli", look: () => say(st.flags.pyramid ? "Viisikymppinen. Paperia sekin, kun oikein katsoo. Reunassa on hyvin tilaa kirjoittaa." : "Viisikymppinen. Se lensi herra Saarnin salkusta. Pidän sen tallessa.") },
  ilmoitus: { name: "Mouhon ilmoitus", look: () => say(st.flags.pyramid ? "Ilmoituksen takana on pyramidikaavioni. Huipulla: minä." : "\"Mouho hakee toiminnanjohtajaa.\" Luin sen jo kolme kertaa. Joka kerta se kuulostaa paremmalta.") },
  kaavio: { name: "pyramidikaavio", look: () => say(tasksText()) },
  lippu: { name: "lentolippu", look: () => say("Yksisuuntainen lippu Istanbuliin. Paluu järjestyy jotenkin. Aina järjestyy.") },
  nimikyltti: { name: "nimikyltti", look: () => say("Messinkinen nimikyltti: \"Jussi Markkanen, urheilujohtaja\". Kiiltävä. Ja nyt vähän menneen talven lumia.") },
  pussi: { name: "isoisän nahkapussi", look: () => say("Mehmetin isoisän nahkapussi. Juuri sopiva hiekalle. Isoisä yritti kuulemma samaa vaihtoa. Kuulemma.") },
  sakki: { name: "hiekkasäkki", look: () => say("Hiekkasäkki. Painaa suunnilleen yhtä paljon kuin kultainen idoli. Toivottavasti.") },
  puhelin: { name: "kännykkä", look: async () => { if (st.flags.adRead && !st.flags.pyramid) { await say("Jouko Myrrä, pikavalinta ykkönen. Soitetaan."); return callMyrra(); }
      return say("Kännykkä. Pikavalinnassa ykkösenä Jouko Myrrä. Hän tietää aina mitä tehdä."); },
    nudge: () => st.flags.adRead && !st.flags.pyramid,         // sykkii tavaroissa, kunnes Joukolle on soitettu
    Käytä: () => callMyrra(), Puhu: () => callMyrra() },
  lappu: { name: "Saarnin lappu", look: () => say("\"Kiitos kutsusta. Ja viisikymppisestä, juuri sitä etsinkin. Rehellistä. Ollaan mukana. -M.S.\"") },
  velkakirja: { name: "sopimus", look: () => say("Mouho Global Partnersin sopimus. Luin sen: \"Kebabtarjoilu Mouhoon, maksetaan jälkikäteen.\"\nEnsimmäinen sivu on liimautunut kiinni kanteen. Tuskin mitään tärkeää.") },
  leimasin: { name: "Liigan leimasin", look: () => say("Liigan toimiston kumileimasin: HYVÄKSYTTY. Sillä leimattiin kaikki, minkä Liiga hyväksyi.\nViimeksi se leimasi minun lähtöpaperini.") },
  idoli: { name: "kultainen idoli", look: () => say("Kultainen idoli. Pyramidin huippu. Se katsoo minua. Minä katson sitä. Me ymmärrämme toisiamme.") },
});

// ---------------------------------------------------------------- tavarakuvakkeet (48 x 32)
// Pelaajan palaute 24.10. ("kökköjä"): tuplatarkkuus, kolmisävyinen varjostus ja kiiltopisteet.
// Moottori lisää jokaiselle paksun tumman ääriviivan (GAME.iconOutline), sarjakuvan tapaan.
ITEMS.kebab.icon = () => {
  for (let j = 0; j <= 14; j++) { const w = Math.round(Math.sqrt(1 - (j / 14) ** 2) * 19); r(24 - w, 13 + j, w * 2, 1, j < 3 ? "#f4d088" : j < 9 ? "#dca458" : "#b47c34"); }   // pita
  for (let i = 0; i < 9; i++) disc(8 + i * 4, 12, 3, i % 2 ? "#7c3c1c" : "#9c542c");                                                        // liha
  for (const x of [9, 17, 27, 35]) { disc(x, 9, 3, "#3c9c34"); px(x - 1, 7, "#8ce07c"); px(x, 8, "#6cc85c"); }                             // salaatti
  for (const x of [13, 23, 31, 39]) { disc(x, 10, 2, "#d02c28"); px(x - 1, 9, "#fc8c7c"); }                                                 // tomaatti
  for (let x = 8; x < 40; x += 2) px(x, 13 + (x % 4 ? 0 : 1), "#fcf4e0");                                                                   // valkosipulikastike
  for (let x = 10; x < 38; x += 5) px(x, 16 + (x % 3), "#a87030");                                                                          // grillin raidat
  fillPoly([[13, 24], [35, 24], [32, 31], [16, 31]], "#f4f0e4"); r(13, 24, 22, 1, "#fcfcf8"); r(16, 30, 16, 1, "#c8c0b0");                // kääre
  for (let x = 17; x < 32; x += 5) r(x, 26, 2, 4, "#d83c34");
};
ITEMS.kortti.icon = () => {
  r(8, 9, 36, 20, "#4a3a5a");                                                                                    // varjo
  r(5, 5, 36, 20, "#d8a830"); r(5, 5, 36, 1, "#f8d860"); r(6, 6, 34, 18, "#fff4d8"); r(6, 6, 34, 2, "#fffcf0"); r(6, 23, 34, 1, "#e8dcb8");
  r(9, 9, 20, 3, "#7c7c8c"); r(8, 10, 23, 1, "#c81c1c");                                                          // painettu nimi yliviivattuna
  r(9, 14, 14, 1, "#a8a8b4");
  for (let x = 9; x < 36; x++) px(x, 19 + Math.round(Math.sin(x * 1.3)), "#2c4cbc");                              // käsin kirjoitettu MOUHO GLOBAL
  disc(35, 11, 3, "#d8a020"); disc(34, 10, 2, "#f8d048"); px(33, 9, "#fffcc0");                                  // kultainen leima
};
ITEMS.kirje.icon = () => {
  r(4, 5, 40, 24, "#d8a830"); r(4, 5, 40, 1, "#f8d860"); r(5, 6, 38, 22, "#f4ecd8"); vgrad(5, 18, 38, 10, ["#f4ecd8", "#e4d8bc", "#d8ccb0"]);
  lineC(5, 27, 19, 17, "#c8bca0"); lineC(42, 27, 29, 17, "#c8bca0");                                             // kuoren saumat
  lineC(5, 6, 24, 18, "#a89878"); lineC(42, 6, 24, 18, "#a89878"); lineC(5, 7, 24, 19, "#fcf8ec");               // läppä
  disc(24, 18, 5, "#a01818"); disc(23, 17, 4, "#c82c24"); disc(22, 16, 2, "#e85c4c"); px(21, 15, "#fcb4a8");     // sinetti
  fillPoly([[22, 22], [24, 22], [22, 27]], "#a01818"); fillPoly([[25, 22], [27, 22], [28, 26]], "#a01818");      // sinettinauhat
};
ITEMS.seteli.icon = () => {
  r(4, 7, 40, 20, "#c88a4a"); r(4, 7, 40, 2, "#f0c088"); r(4, 25, 40, 2, "#9c6234");
  r(6, 10, 36, 14, "#e8b070"); dither(6, 18, 36, 6, "#e8b070", "#d89a5a", .35);
  for (let x = 6; x < 42; x += 2) px(x, 10, "#c88a4a");
  disc(17, 18, 6, "#a86a34"); disc(17, 18, 4, "#e8b070"); r(11, 18, 13, 6, "#e8b070");                         // holvikaari
  r(11, 18, 2, 6, "#a86a34"); r(22, 18, 2, 6, "#a86a34"); r(10, 23, 15, 1, "#a86a34");
  text3("50", 30, 11, "#6c3410", 1); text3("50", 29, 10, "#fcecc8", 1);
  disc(36, 21, 2, "#c8d8f0"); px(35, 20, "#fcfcfc");                                                              // hologrammi
};
ITEMS.ilmoitus.icon = () => {
  r(14, 4, 24, 27, "#7c7064"); r(12, 2, 24, 27, "#fff4d0"); vgrad(12, 20, 24, 9, ["#fff4d0", "#efe0b8"]);
  r(12, 2, 24, 9, "#c81c1c"); r(12, 2, 24, 1, "#fc5c4c"); text3("MOUHO", 14, 4, "#fcf0d8");
  for (let k = 0; k < 5; k++) r(15, 14 + k * 3, 18 - (k % 2) * 6, 1, "#5a5a7a");
  disc(24, 2, 2, "#2c7cd8"); px(23, 1, "#bce0fc");                                                                // nasta
};
ITEMS.kaavio.icon = () => {
  r(10, 4, 32, 27, "#7c7064"); r(8, 2, 32, 27, "#f4f0e4"); vgrad(8, 20, 32, 9, ["#f4f0e4", "#e4dcc8"]);
  const P = (j, i) => [Math.round(22 - j * 3.5 + i * 7), 7 + j * 6];
  for (let j = 0; j < 3; j++) for (let i = 0; i <= j; i++) { const [x, y] = P(j, i); for (const d of [0, 1]) { const [x2, y2] = P(j + 1, i + d); lineC(x, y, x2, y2, "#8c8ca8"); } }
  for (let j = 0; j < 4; j++) for (let i = 0; i <= j; i++) { const [x, y] = P(j, i); disc(x, y, 2, j ? "#2c4c9c" : "#c81c1c"); px(x - 1, y - 1, j ? "#8cacec" : "#fc9c8c"); }
  lineC(33, 29, 44, 16, "#e8b83c", 3); lineC(33, 28, 43, 16, "#fcd85c"); fillPoly([[31, 31], [34, 27], [35, 30]], "#f4d8b0"); px(31, 31, "#2c2c2c");   // kynä
};
ITEMS.lippu.icon = () => {
  r(4, 8, 40, 18, "#2c64c8"); r(4, 8, 40, 2, "#6ca0f0"); r(4, 24, 40, 2, "#1c449c");
  for (let y = 9; y < 25; y += 2) px(31, y, "#e8f0fc");                                                           // repäisyviiva
  r(9, 16, 16, 2, "#fcfcfc"); fillPoly([[15, 16], [19, 16], [15, 10], [13, 10]], "#fcfcfc"); fillPoly([[15, 18], [19, 18], [15, 23], [13, 23]], "#e0e8f8");
  r(8, 13, 2, 4, "#fcfcfc"); px(25, 17, "#fcfcfc");                                                               // lentokone
  text3("IST", 33, 12, "#fcd41c"); r(33, 19, 9, 1, "#bcd4fc"); r(33, 21, 6, 1, "#bcd4fc");
};
ITEMS.nimikyltti.icon = () => {
  r(4, 9, 40, 16, "#8c6418"); r(5, 10, 38, 14, "#d8a830"); vgrad(5, 10, 38, 6, ["#fcec90", "#e8c048", "#d8a830"]); r(5, 23, 38, 1, "#a87c20");
  for (const x of [8, 40]) { disc(x, 17, 1, "#6c4c14"); px(x - 1, 16, "#fcec90"); }
  text3("JUSSI M", 11, 12, "#5c4010"); r(11, 19, 26, 1, "#a87c20");
  lineC(31, 10, 35, 23, "#fff4b0"); lineC(33, 10, 37, 23, "#f4dc78");                                            // kiilto
};
ITEMS.pussi.icon = () => {
  for (let j = 0; j < 17; j++) { const w = Math.round(Math.sin((j + 3) / 21 * Math.PI) * 14); r(24 - w, 13 + j, w * 2, 1, j < 4 ? "#b4743c" : j < 11 ? "#8a5230" : "#6c3c20"); }
  fillPoly([[19, 14], [29, 14], [27, 7], [21, 7]], "#8a5230"); r(20, 5, 8, 3, "#b4743c");                       // kaula
  r(18, 11, 13, 2, "#3c2414"); lineC(30, 12, 37, 8, "#3c2414", 2); lineC(37, 8, 35, 16, "#3c2414", 2);          // nyöri
  disc(18, 19, 3, "#c4844c"); px(17, 18, "#e8a868");                                                              // kiilto
  for (let x = 14; x < 35; x += 3) px(x, 27, "#4a2a14");                                                          // tikkaus
};
ITEMS.sakki.icon = () => {
  for (let j = 0; j < 18; j++) { const w = Math.round(Math.sin((j + 3) / 22 * Math.PI) * 15); r(24 - w, 11 + j, w * 2, 1, j < 5 ? "#dcc8a0" : j < 12 ? "#c8b48c" : "#a8946c"); }
  dither(12, 14, 24, 13, "#c8b48c", "#b4a07c", .3);                                                               // juuttikangas
  r(20, 4, 8, 8, "#c8b48c"); r(20, 4, 8, 2, "#dcc8a0"); r(19, 9, 10, 2, "#6c4c2c");                              // suu ja naru
  r(35, 27, 7, 2, "#e8d49c"); r(37, 26, 3, 1, "#e8d49c"); px(42, 28, "#e8d49c");                                  // valunut hiekka
};
ITEMS.puhelin.icon = () => {
  r(15, 1, 18, 30, "#1c1c34"); r(16, 2, 16, 28, "#2e2e50"); r(16, 2, 1, 28, "#5a5a8a");
  vgrad(18, 5, 12, 19, ["#bfe8ff", "#7cc0f0", "#3c88d8"]);
  disc(24, 10, 3, "#f0c8a0"); r(21, 7, 6, 2, "#6c4c34"); r(21, 14, 7, 3, "#1c1c22");                             // Myrrä soittajan kuvana
  r(19, 19, 10, 4, "#3cb84c"); r(19, 19, 10, 1, "#8ce87c"); r(22, 20, 4, 2, "#fcfcfc");                          // soita-nappi
  r(21, 3, 6, 1, "#5a5a8a"); r(21, 26, 6, 2, "#4a4a70");
};
ITEMS.lappu.icon = () => {
  r(14, 7, 24, 22, "#7c7064"); fillPoly([[12, 5], [30, 5], [36, 11], [36, 27], [12, 27]], "#fff4d0"); fillPoly([[30, 5], [30, 11], [36, 11]], "#e0d0a0");
  for (let k = 0; k < 3; k++) for (let x = 15; x < 31 - k * 4; x++) px(x, 10 + k * 4 + Math.round(Math.sin(x * 1.1 + k) * .6), "#2c3c8c");
  text3("M.S.", 21, 21, "#2c3c8c");
};
ITEMS.velkakirja.icon = () => {
  r(14, 4, 26, 27, "#7c7064"); r(12, 2, 26, 27, "#fff4d0"); r(12, 2, 26, 5, "#e8dcb0"); r(12, 2, 26, 1, "#fcfcf0");
  for (let k = 0; k < 5; k++) r(15, 9 + k * 3, 20 - (k % 2) * 5, 1, "#5a5a7a");
  for (let x = 15; x < 27; x++) px(x, 25 + Math.round(Math.sin(x * .9) * 1.2), "#1c2c8c");                       // allekirjoitus
  disc(32, 25, 4, "#a01818"); disc(31, 24, 3, "#c82c24"); px(30, 23, "#fc9c8c"); fillPoly([[30, 28], [32, 28], [31, 31]], "#a01818"); fillPoly([[33, 28], [35, 28], [35, 31]], "#a01818");
};
ITEMS.leimasin.icon = () => {
  r(8, 25, 32, 5, "#2c2c34"); r(9, 25, 30, 2, "#c81c1c"); r(9, 25, 30, 1, "#fc5c4c");                           // mustetyyny
  r(16, 18, 16, 5, "#3c3c48"); r(16, 18, 16, 1, "#6c6c80"); r(15, 22, 18, 3, "#1c1c22");                         // leimasimen jalka
  r(22, 9, 5, 9, "#8c5c2c"); r(22, 9, 1, 9, "#b07c44"); disc(24, 7, 4, "#8c5c2c"); disc(23, 6, 2, "#c08c50"); px(22, 5, "#e8b878");   // kahva
  r(17, 20, 14, 1, "#d8a830");
};
ITEMS.idoli.icon = () => {
  r(15, 27, 18, 4, "#6c4c1c"); r(15, 27, 18, 1, "#a07c34");                                                       // jalusta
  fillPoly([[18, 27], [30, 27], [28, 15], [20, 15]], "#d8a020"); fillPoly([[25, 27], [30, 27], [28, 15], [26, 15]], "#b07c18");
  disc(24, 10, 7, "#d8a020"); disc(23, 9, 6, "#f0c030"); disc(22, 8, 3, "#f8dc58"); px(21, 6, "#fffcc8"); px(22, 6, "#fffcc8");
  r(20, 9, 3, 2, "#6c3c08"); r(26, 9, 3, 2, "#6c3c08"); r(22, 13, 5, 1, "#6c3c08"); px(24, 11, "#a87010");      // kasvot
  r(19, 19, 10, 1, "#a87010"); r(20, 23, 8, 1, "#a87010");
};

