// Mouhon salaisuus -- Kaivokatu 10 ja loppuanimaatio (17.10.: "paranna grafiikat Kaivokadulle"
// ja "Kaivokadun osio on tarinan kerronnan kannalta haparoiva").
//
// Kerronta etenee yhtenä ketjuna: ulkokuva (rautatieasemaa vastapäätä) -> neljäs kerros, hallitus
// aloittaa haastattelun -> Jussi esittelee tekemänsä: jäsenet saapuvat ryhmä kerrallaan -> "Mitä me
// saamme?" -> Jussi soittaa Joukolle -> "Anna ihmisten pelata" -> Jussi kääntää pyramidin
// turnauskaavioksi -> kebab, palkinto, tuomari -> hallitus: brändin myynti -> Mehmet -> palkkaus.
"use strict";

// ---------------------------------------------------------------- ulkokuva
// Toukokuun valoisa ilta Kaivokadulla: vasemmalla rautatieaseman graniittinen kellotorni,
// oikealla 60-luvun valkoinen nauhaikkunatalo, jonka 4. kerroksessa Mouho-ilta hehkuu.
function kaivokatuBg() {
  r(0, 0, W, H, "#2c2c3c");
  vgrad(0, 0, W, 80, ["#1c2454", "#2c3468", "#4c4c80", "#7c6488", "#b47c84", "#e0a07c"]);
  seed = 61; for (let i = 0; i < 26; i++) { const x = (rnd() * W) | 0, y = 6 + ((rnd() * 36) | 0), w = 8 + ((rnd() * 30) | 0); r(x, y, w, 1, y > 26 ? "#9c6c88" : "#3c3c70"); r(x + 2, y + 1, w - 4, 1, y > 26 ? "#f0b088" : "#7c6c9c"); }
  // kaukaiset kivitalot aseman ja Kaivokatu 10:n välissä (Keskuskatu)
  vgrad(0, 80, W, 32, ["#e0a07c", "#c4887c"]);
  for (const [x, h, c] of [[94, 40, "#8c7c88"], [108, 46, "#7c6c7c"], [122, 38, "#948490"]]) { r(x, 112 - h, 16, h, c); for (let y = 116 - h; y < 108; y += 6) for (let xx = x + 2; xx < x + 14; xx += 5) r(xx, y, 3, 3, (xx + y) % 3 ? "#3c3c54" : "#f0c87c"); }
  // rautatieasema: kellotorni ja pääty
  const G = "#7c7468", GD = "#5c5650", GL = "#9c9488";
  r(0, 60, 96, 52, G); for (let y = 62; y < 112; y += 4) r(0, y, 96, 1, GD); for (let x = 6; x < 92; x += 14) { r(x, 70, 8, 22, "#2c3040"); r(x + 1, 71, 6, 8, "#f0c87c"); }
  r(30, 6, 26, 106, G); r(30, 6, 2, 106, GL); r(54, 6, 2, 106, GD); for (let y = 10; y < 110; y += 5) r(30, y, 26, 1, GD);
  fillPoly([[28, 6], [58, 6], [54, 0], [32, 0]], "#4c8c7c"); r(42, -6, 2, 6, "#4c8c7c");
  disc(43, 22, 7, "#f4ecd0", "#3c3830"); lineC(43, 22, 43, 17, "#1c1c1c"); lineC(43, 22, 47, 23, "#1c1c1c"); glow(43, 22, 12, "255,230,170", .25);
  for (const x of [26, 58]) { r(x, 86, 4, 26, GD); disc(x + 2, 84, 3, "#5c5650"); r(x - 1, 92, 6, 3, "#f8e8a0"); glow(x + 2, 93, 8, "255,230,150", .4); }   // lyhdynkantajat
  // Kaivokatu 10: valkoinen nauhaikkunatalo
  const BX = 140; r(BX, 14, 180, 98, "#e4e2dc"); r(BX, 14, 180, 2, "#f8f6f0"); r(BX, 14, 3, 98, "#c4c2bc");
  for (let f = 0; f < 6; f++) { const y = 20 + f * 13, lit = f === 2;           // 4. kerros (alhaalta laskien) = f 2
    r(BX + 4, y, 172, 7, lit ? "#3c2c5c" : "#3c4c64"); r(BX + 4, y, 172, 1, lit ? "#9c7cdc" : "#8ca4bc");
    for (let x = BX + 6; x < BX + 174; x += 9) { if (lit) { r(x, y + 2, 7, 4, (x / 9) % 3 ? "#b48cfc" : "#7cfc9c"); } else if ((x * 7 + f * 13) % 11 < 3) r(x, y + 2, 7, 4, "#f0d08c"); r(x + 7, y, 2, 7, "#c4c2bc"); } }
  glow(BX + 90, 49, 70, "180,140,255", .18);
  // MOUHO-valomainos julkisivussa
  r(BX + 52, 4, 78, 9, "#14101c"); text3("MOUHO 2026 . 4. KRS", BX + 55, 6, "#fcfc54"); glow(BX + 91, 8, 30, "252,252,84", .2);
  // katutaso: liikkeet ja ovi
  r(BX, 92, 180, 20, "#2c2c34"); for (let x = BX + 4; x < BX + 176; x += 30) { r(x, 95, 24, 15, "#f0c87c"); r(x, 95, 24, 2, "#fce8b0"); r(x + 11, 95, 2, 15, "#8c6c3c"); }
  r(BX + 92, 96, 14, 16, "#14161c"); r(BX + 93, 97, 12, 15, "#4c5c70"); text3("10", BX + 95, 90, "#f4f4f4");
  // katu, raitiotie, jalkakäytävä
  vgrad(0, 112, W, 6, ["#a4a09c", "#8c8884"]); for (let x = 0; x < W; x += 10) r(x, 112, 1, 6, "#7c7874"); r(0, 112, W, 1, "#c4c0bc");
  vgrad(0, 118, W, 18, ["#5c5c64", "#44444c"]); for (const y of [124, 131]) { r(0, y, W, 1, "#a4a4ac"); r(0, y + 1, W, 1, "#24242c"); }
  lineC(0, 30, W, 26, "#2c2c34"); lineC(0, 35, W, 31, "#2c2c34"); r(120, 26, 2, 86, "#3c3c44");
}
function kaivokatuDraw(t, jx, idol) {
  g.drawImage(paintBg("kaivokatu", kaivokatuBg), 0, 0);
  tram(-140 + ((t / 1000 * 60) % 600));
  for (const [x0, c, v] of [[60, "#3c2c4c", 9], [210, "#2c4c3c", -7], [260, "#5c2c2c", 6]]) { const x = ((x0 + t / 1000 * v) % 340 + 340) % 340 - 10; figure(x, 116, c, false, t + x0 * 50, v); }
  shadow(jx, 117, 6); jussi(jx, 117, 1, Math.floor(t / 120) % 4, {}, .9);
  if (idol) { r(jx + 6, 99, 4, 6, "#e8c81c"); r(jx + 7, 97, 2, 2, "#e8c81c"); glow(jx + 8, 101, 8, "255,220,100", .3); }
}

// ---------------------------------------------------------------- sisätila, 4. kerros
function mouhoInBg() {
  vgrad(0, 0, W, 104, ["#181a2c", "#20223a", "#262844"]);
  for (let x = 0; x < W; x += 16) r(x, 0, 1, 104, "#1c1e32");
  // ikkunat: rautatieaseman kellotorni yössä
  for (const wx of [26, 236]) { r(wx - 2, 12, 64, 50, "#3c3e54"); vgrad(wx, 14, 60, 46, ["#2c3468", "#4c4c80", "#9c6c84"]);
    if (wx === 26) { r(wx + 22, 20, 10, 40, "#5c5650"); disc(wx + 27, 30, 3, "#f4ecd0"); fillPoly([[wx + 21, 20], [wx + 33, 20], [wx + 31, 16], [wx + 23, 16]], "#4c8c7c"); }
    for (let k = 0; k < 8; k++) r(wx + 2 + k * 7, 52 + (k % 3) * 2, 5, 8, "#2c2c3c"); for (let k = 0; k < 10; k++) px(wx + 4 + k * 6, 54 + (k % 3) * 2, "#f0d08c");
    r(wx + 29, 14, 2, 46, "#3c3e54"); r(wx, 36, 60, 2, "#3c3e54"); r(wx - 4, 62, 68, 3, "#4c4e64"); }
  // banderolli
  r(92, 4, 136, 14, "#c81c1c"); r(92, 4, 136, 1, "#fc5c5c"); r(92, 17, 136, 1, "#7c0c0c"); text3("MOUHO 2026 . 2V2 NHL", 160 - text3w("MOUHO 2026 . 2V2 NHL") / 2, 8, "#fcfc54");
  // TV ja teline
  r(96, 24, 128, 70, "#0c0c0c"); r(98, 26, 124, 64, "#1c1c1c"); r(156, 94, 8, 6, "#2c2c2c"); r(140, 100, 40, 2, "#2c2c2c");
  r(186, 100, 18, 3, "#ececec"); r(187, 99, 16, 1, "#fcfcfc"); px(200, 100, "#3c7cfc");                         // PS5
  // ovi vasemmalla
  r(2, 44, 20, 60, "#3c2c1c"); r(4, 46, 16, 58, "#6c4c2c"); r(16, 74, 2, 4, "#e8c81c"); r(0, 42, 24, 3, "#4c4e64");
  // lattia, matto, sohva
  r(0, 102, W, 34, "#3c3448"); for (let y = 104; y < 136; y += 6) r(0, y, W, 1, "#342c40");
  fillPoly([[70, 108], [250, 108], [270, 134], [50, 134]], "#4c2c3c"); fillPoly([[78, 110], [242, 110], [258, 132], [62, 132]], "#5c3448");
  r(60, 106, 200, 14, "#2c4c7c"); r(60, 104, 200, 4, "#3c5c8c"); r(56, 104, 8, 18, "#24406c"); r(256, 104, 8, 18, "#24406c");
  for (let x = 74; x < 250; x += 44) r(x, 108, 40, 2, "#3c5c8c");
  // ohjaimet sohvalla
  for (const x of [96, 150, 204]) { r(x, 105, 8, 3, "#ececec"); px(x + 1, 106, "#3c7cfc"); px(x + 6, 106, "#c81c1c"); }
}
// Mouhon hallitus: isäntien Mikon, Ilkan ja Mikan omat pikselimuotokuvat (käyttäjän asset
// tuomarit.png, pikselöity pixel_face.py:llä), pöydän takana oikealla.
function boardTable(t) {
  [["hallitus_mikko", 246], ["hallitus_ilkka", 276], ["hallitus_mika", 305]].forEach(([k, x], i) => {
    const img = faceCache[`bust|${k}`] ??= renderPix(PIXFACES[k].bust, {}), w = img.width / PXS * 1.45, h = img.height / PXS * 1.45;
    const bob = Math.round(Math.sin(t / 600 + i * 2) * .5);
    g.imageSmoothingEnabled = false; g.drawImage(img, x - w / 2, 114 - h + bob, w, h); });
  r(230, 112, 90, 12, "#5c4632"); r(230, 112, 90, 2, "#7c6448"); r(234, 124, 3, 10, "#3c2c20"); r(314, 124, 3, 10, "#3c2c20");
  r(256, 114, 38, 7, "#f4f0e4"); text3("HALLITUS", 258, 115, "#2c2c3c");
}

// ---------------------------------------------------------------- loppu
async function ending() {
  st.scene = "loppu"; $game.classList.add("cut"); $sent.textContent = "";
  await travel("ist", "hki");
  const f = st.flags;
  // 1. ulkokuva
  let jx = -10; const T0 = performance.now();
  overlay = (t) => { jx = Math.min(232, -10 + (performance.now() - T0) / 1000 * 34); kaivokatuDraw(t, jx, true); };
  await say("Helsinki, toukokuu. Kaivokatu 10, rautatieasemaa vastapäätä.", "muu");
  await say("Neljäs kerros. Mouho-ilta ja toiminnanjohtajan haastattelut. Jäsenet, tarjoilu, turnaus: kaikki hoidettu.");
  await say("Ja kutsuin kaikki jäseneni paikalle. Hallitus näkee omin silmin, mitä proaktiivisuus saa aikaan.");
  while (jx < 232) await sleep(100);
  // 2. sisätila
  const crowd = [];
  const arrive = (list) => list.forEach((c) => { const i = crowd.length, row = i < 7 ? 0 : 1; crowd.push(Object.assign(c, { x: 12, y: 112 + row * 12, tx: 30 + (i % 7) * 15 + row * 7, ty: 112 + row * 12 })); });
  let flipT = null, kebabOn = false, trophyOn = false, whistleT = null;
  overlay = (t) => {
    g.drawImage(paintBg("mouhoIn", mouhoInBg), 0, 0); rinkTV(t); boardTable(t);
    if (kebabOn) { r(184, 92, 36, 10, "#8c5c2c"); r(184, 92, 36, 2, "#c81c1c"); r(192, 76, 4, 16, "#c8a46c"); disc(194, 80, 5, "#9c5c2c", "#6c3c1c"); text3("KEBAB", 188, 95, "#fcf0d8"); }
    if (trophyOn) { r(205, 88, 12, 4, "#5c3c24"); r(207, 75, 8, 13, "#e8c81c"); r(208, 73, 6, 3, "#e8c81c"); r(207, 75, 2, 13, "#fcf06c"); px(209, 79, "#3c2c0c"); px(212, 79, "#3c2c0c"); glow(211, 81, 14, "255,220,100", .35); }
    const ordered = [...crowd].sort((a, b) => a.ty - b.ty);
    for (const c of ordered) { c.x += (c.tx - c.x) * .04; const mv = Math.abs(c.tx - c.x) > 1;
      if (c.who === "saarni" || c.who === "maskotti") person(c.who, c.x, c.ty, t, { moving: mv, sc: .85 });
      else if (c.who === "mehmet") merchant(c.x, c.ty, t, speaking === "kauppias");
      else if (c.who === "salkkumies") salesman(c.x, c.ty, t);
      else if (c.who === "tuomari") ghostRef(c.x, c.ty, t, speaking === "tuomari");
      else figure(c.x, c.ty, c.c, c.fez, t, mv ? 4 : Math.sin(t / 300 + c.tx)); }
    shadow(176, 128, 7); jussi(176, 128, -1, 0, {});
    // jäsenhankintakaavio telineessä; Jussi kääntää sen turnauskaavioksi (17.10.: "kaavio rumalta")
    const k2 = flipT ? Math.min(1, (performance.now() - flipT) / 1400) : 0, sy = Math.cos(k2 * Math.PI);
    lineC(112, 128, 120, 92, "#5c4c3c", 2); lineC(140, 128, 132, 92, "#5c4c3c", 2); lineC(126, 128, 126, 96, "#4c3c2c", 2);   // maalarin teline
    g.save(); g.translate(126, 82); g.scale(1, Math.abs(sy) < .02 ? .02 : sy);
    r(-27, -17, 54, 34, "#3c3c44"); r(-26, -16, 52, 32, "#f8f6ee"); r(-26, -16, 52, 1, "#ffffff");
    if (k2 < .5) {                                 // pyramidi: Jussi huipulla, rivit tihenevät
      r(-3, -13, 6, 4, "#c81c1c"); for (let j = 1; j < 5; j++) { const n = 2 ** j > 16 ? 16 : 2 ** j, w = Math.min(46, n * 3); for (let i = 0; i < n; i++) r(-w / 2 + i * (w / n) + .5, -11 + j * 5, Math.max(1, w / n - 1), 3, j === 1 ? "#2c4c9c" : j === 2 ? "#4c6cbc" : "#7c9cdc"); }
      for (let j = 0; j < 4; j++) { lineC(0, -9 + j * 5, -4 - j * 5, -6 + j * 5, "#9c9cac"); lineC(0, -9 + j * 5, 4 + j * 5, -6 + j * 5, "#9c9cac"); }
    } else {                                       // turnauskaavio: 8 -> 4 -> 2 -> finaali, pokaali keskellä
      g.scale(1, -1);                              // käännetty takaisin oikein päin
      const C = ["#c81c1c", "#2c4c9c", "#e8c81c", "#2c8c4c", "#7c2c8c", "#e8742c", "#3c3c3c", "#2cacac"];
      for (const side of [-1, 1]) {
        for (let i = 0; i < 4; i++) { const y = -12 + i * 7, x0 = side * 24; r(Math.min(x0, x0 - side * 6), y, 6, 2, C[i + (side > 0 ? 4 : 0)]); lineC(x0 - side * 6, y + 1, x0 - side * 9, y + 1, "#1c1c24"); }
        for (let i = 0; i < 2; i++) { const yA = -11 + i * 14, yB = yA + 7, x = side * 15; lineC(x, yA, x, yB, "#1c1c24"); lineC(x, yA + 3.5, side * 10, yA + 3.5, "#1c1c24"); }
        lineC(side * 10, -7.5, side * 10, 6.5, "#1c1c24"); lineC(side * 10, -.5, side * 5, -.5, "#1c1c24");
      }
      r(-3, -4, 6, 6, "#e8c81c"); r(-2, -7, 4, 3, "#e8c81c"); r(-4, 2, 8, 2, "#8c6c1c"); px(-1, -2, "#3c2c0c"); px(1, -2, "#3c2c0c");
      g.font = "6px VT323, monospace"; g.fillStyle = "#1c1c24"; g.textAlign = "center"; g.fillText("MOUHO 2026", 0, 14); g.textAlign = "left";
    }
    g.restore();
    if (whistleT && performance.now() - whistleT < 900) { g.font = "bold 10px VT323, monospace"; g.fillStyle = "#fcfcfc"; g.fillText("PRIIIT!", 60, 70); }
  };
  await say("Neljäs kerros. Mouhon hallitus istuu pöydän takana.", "muu");
  await say("Hallitus: \"Toiminnanjohtajan haastattelu. Hakija Markkanen, olkaa hyvä.\"", "muu");
  await say("Ennen kuin aloitetaan: haluan esitellä, mitä olen jo tehnyt Mouhon hyväksi.");
  // 3. jäsenet saapuvat ryhmä kerrallaan, kukin oman syynsä kanssa
  beep(140, 120, "square", .05); arrive([{ who: "maskotti" }, { who: "saarni" }]); await sleep(1600);
  await say("Lappusi sanoi, että Mouho hakee jäseniä. Täällä ollaan. Maskotti otti pelaajakorttinsa mukaan.", "muu");
  beep(140, 120, "square", .05); arrive([{ who: "mehmet" }, { who: "salkkumies" }]);
  if (f.bazaar) arrive(Array.from({ length: 6 }, (_, i) => ({ who: "basaari", c: ["#3c1c24", "#2c1c34", "#4c2c1c"][i % 3], fez: i % 2 === 0 })));
  await sleep(1800);
  await say("Mouho Global Partners saapuu! Ja koko basaari. Kebabit lämpiminä, ystäväni!", "muu");
  if (f.refRecruited) { beep(2200, 160, "square", .04); arrive([{ who: "tuomari" }]); await sleep(1500); await say("Haamutuomari leijuu sisään. \"Pilli on mukana.\"", "muu"); }
  await say(`Huoneessa on nyt ${f.recruits ?? 0} jäsentä. Ja kaikki katsovat Jussia.`, "muu");
  // 4. pyramidin lupaus lunastetaan
  await say("\"No, toiminnanjohtaja? Jokainen meistä toi kaksi uutta. Mitä me saamme?\"", "muu");
  await say("Te saatte... tuota... saatte...");
  await say("Hetkinen. Soitan Joukolle.");
  f.myrra3 = true; await phoneCall(MYRRA_CALLS[3]);
  await say("Anna ihmisten pelata... Ja jos pyramidin kääntää ylösalaisin...");
  flipT = performance.now(); beep(330, 200, "triangle", .06); setTimeout(() => beep(523, 300, "triangle", .06), 260); await sleep(1600);
  await say("Ylösalaisin käännetty pyramidi on TURNAUSKAAVIO.", "muu");
  await say("Te saatte PELATA! 2v2, NHL, PS5. Jokainen jäsen on pelaaja. Kaikki mukaan!");
  if (f.refRecruited) { whistleT = performance.now(); beep(2200, 300, "square", .05); await say("Ensimmäinen erä alkaa!", "tuomari"); }
  kebabOn = true; beep(523, 150, "triangle", .05);
  await say("Tarjoilu: Mouho Global Partnersin kebabit.");
  trophyOn = true; beep(784, 200, "triangle", .05);
  await say("Ja voittaja saa kiertopalkinnoksi kultaisen idolin. Suoraan Kappadokiasta.");
  await say("Ottelut alkavat. Kukaan ei enää kysy, mitä saa. Kaikki pelaavat.", "muu");
  // 5. haastattelu ja brändi
  await say("Hallitus: \"Markkanen. Jäsenten hankinta, tarjoilu, turnaus. Kaikki ennen haastattelua.\"", "muu");
  await say("Hallitus: \"Mutta tässä sopimuksessa lukee, että myit Mouho-brändin turkkilaisille.\"", "muu");
  await say("...Ensimmäinen sivu oli liimautunut kiinni.");
  await say("Hallitus: \"Brändiä ei voi myydä, jos se ei ole sinun. Et ole vielä edes toiminnanjohtaja.\"", "muu");
  await say("Myit brändin, jota et omistanut? ...Ystäväni, sinä olet oikea basaarin mies!", "kauppias");
  await say("Pidä brändi. Mouho Global saa tämän illan. Ja kebabien jälkikäteen maksu? Mouho on ilmainen. Sinähän sen minulle kerroit.", "kauppias");
  await say("Hallitus: \"Ennätysmäärä jäseniä, tarjoilu, kiertopalkinto ja kansainvälinen kumppani, joka ei peri mitään. Olet palkattu, toiminnanjohtaja.\"", "muu");
  await say("Juuri kuten suunnittelin. Tai melkein.");
  [880, 1040, 880, 1040].forEach((fq, n) => setTimeout(() => beep(fq, 70, "square", .04), n * 75)); await sleep(600);
  await say("Puhelin soi. Liigan toimisto.", "muu");
  await say("Liiga: \"Markkanen? Miten sait turkkilaiset sijoittajat kiinnostumaan jääkiekosta?\"", "muu");
  await say("Pidin sen yksinkertaisena.");
  await say(`Mouho-IQ: ${iqTotal()} / ${IQ_MAX}. ${iqTotal() >= IQ_MAX ? "Täydet pisteet. Mouhoness saavutettu." : "Löytyikö kaikki? Kokeile uudestaan."}`, "muu");
  $say.innerHTML = '<div class="line" style="left:50%;bottom:76%;color:#fcfc54">MOUHO 2026 · 22.5. klo 17<br>Kaivokatu 10, 4. krs, Helsinki</div>';
  $game.classList.remove("cut");
  $dlg.replaceChildren(Object.assign(document.createElement("button"), { textContent: "Pelaa uudestaan", onclick: () => location.reload() }));
  $game.classList.add("talking");
}
