// Mouhon salaisuus -- Lattiapianot ja visat (Ilves 1985, basaarin ja temppelin koodit).
"use strict";
// =============================================================== LATTIAPIANO (Kisapuisto)
// Tom Hanksin "Big" -elokuvan jättipiano heijastettuna maahan 3D-perspektiivissä
// (16.10.): kymmenen valokosketinta keskisyvyydellä, saumat seuraavat pakopistettä ja
// numerot litistyvät lattian kulmaan. Kisapuiston parkkipaikan perälle (24.10.). Koodi 1-9-8-5.
// Sama heijastettu numeropiano jokaisessa ruudussa: ruudun oma lattiakaista ja sen reunat.
const KEYS = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "0"];
const streetX = (y) => { const k = (y - 72) / 64; return [lerp(142, 20, k) + 4, Math.min(204, lerp(178, 300, k))]; };
const templeX = (y) => { const k = (y - 100) / 36; return [lerp(24, 2, k) + 8, lerp(296, 318, k) - 8]; };
const QUIZ_AREA = { parkki: { y0: 100, y1: 116, edges: (y) => parkX(y) }, basaari: { y0: 100, y1: 116, edges: streetX }, temppeli: { y0: 103, y1: 117, edges: templeX } };
const quizFlag = (scene = st.scene) => (scene === "parkki" ? "pianoT" : `quizT_${scene}`);
function keyAt(x, y) {
  const A = QUIZ_AREA[st.scene]; if (!A || y < A.y0 || y > A.y1) return null;
  const [a, b] = A.edges(y), i = Math.floor((x - a) / (b - a) * 10);
  return i >= 0 && i < 10 ? KEYS[i] : null;
}
function keyQuad(i) { const A = QUIZ_AREA[st.scene], [a0, b0] = A.edges(A.y0), [a1, b1] = A.edges(A.y1);
  return [[lerp(a0, b0, i / 10), A.y0], [lerp(a0, b0, (i + 1) / 10), A.y0], [lerp(a1, b1, (i + 1) / 10), A.y1], [lerp(a1, b1, i / 10), A.y1]]; }
let lastKey = { k: null, t: 0 };
// Numerot ilmestyvät valona vasta salkkumiehen haasteessa (st.flags.pianoT = hetki),
// kosketin kerrallaan vasemmalta oikealle.
function satamaPiano(t) {
  const A = QUIZ_AREA[st.scene]; if (!A || !st.flags[quizFlag()]) return;
  const since = Date.now() - st.flags[quizFlag()], flick = .9 + .1 * Math.sin(t / 70);
  g.globalCompositeOperation = "lighter";
  for (let i = 0; i < 10; i++) {
    if (since < i * 90) continue;
    const q = keyQuad(i), lit = lastKey.k === KEYS[i] && t - lastKey.t < 450, fresh = since < i * 90 + 260, a = (lit ? .55 : fresh ? .45 : .16) * flick;
    g.fillStyle = `rgba(255,236,140,${a})`; g.beginPath(); q.forEach(([x, y], k) => (k ? g.lineTo(x, y) : g.moveTo(x, y))); g.closePath(); g.fill();
    g.strokeStyle = `rgba(255,244,190,${lit ? .9 : .5})`; g.lineWidth = .6; g.stroke();
    // numero lattian kulmaan: leveys kuin koskettimen keskikohta, korkeus litistetty
    const cx = (q[0][0] + q[1][0] + q[2][0] + q[3][0]) / 4, cy = (A.y0 + A.y1) / 2 + 1, kw = (q[1][0] - q[0][0] + q[2][0] - q[3][0]) / 2;
    g.save(); g.translate(cx, cy); g.scale(1, .55); g.font = `${Math.round(kw * 1.05)}px VT323, monospace`; g.textAlign = "center"; g.textBaseline = "middle";
    g.fillStyle = `rgba(255,${lit ? 120 : 250},${lit ? 90 : 210},${lit ? 1 : .75})`; g.fillText(KEYS[i], 0, 0); g.restore();
    if (lit) glow(cx, cy, 16, "255,230,120", .3);
  }
  g.globalCompositeOperation = "source-over"; g.textAlign = "left"; g.textBaseline = "alphabetic";
}

// ---------------------------------------------------------------- lattiapiano (Kisapuisto)
// Ilves voitti viimeksi Suomen mestaruuden 1985. Koodi kirjautuu pysähtymisistä.
const NOTE = { 1: 262, 2: 294, 3: 330, 4: 349, 5: 392, 6: 440, 7: 494, 8: 523, 9: 587, 0: 659 };
// Lattiavisat: sama mekaniikka kolmessa ruudussa, koodi ja palkinto ruutukohtaisia.
const QUIZZES = {
  parkki: { code: "1985", done: () => st.flags.unlocked, taunt: "salkkumies",
    lines: ["Hah! Väärin. Sijoittajat merkitsevät tämän muistiin.", "Ei se mennyt noin. Olitko oikeasti urheilujohtaja?", "Väärä vuosi. Ilveksen kannattajat itkevät."],
    solve() { st.flags.unlocked = true; iq("piano", 10); script(async () => { await sleep(700); await say("1985. Pätevyys todistettu. Sijoittajat pyysivät antamaan teille tämän: kutsu Istanbuliin. Ja lentolippu, tietysti.", "salkkumies"); st.flags.letterTaken = true; give("kirje"); give("lippu");
      await say("Kultareunainen kirje ja lentolippu Istanbuliin! Ilmainen! Se on aina hyvä merkki. Eikö olekin?"); await say("Ilves, 1985. Viimeinen mestaruus. Jotkut asiat eivät unohdu. Toiset eivät toistu.");
      st.flags.ghostT = Date.now(); [196, 247, 294, 392].forEach((f, n) => setTimeout(() => beep(f, 600, "sine", .05), n * 220)); await sleep(3300); await raimoCameo(); }); } },
  basaari: { code: "2006", done: () => st.flags.cupDone, taunt: "kauppias",
    lines: ["Ei, ei, ystäväni. Maalivahti muistaisi.", "Väärä vuosi! Tuollaisella muistilla et pääse edes Galatan sillalle.", "Hmm. Ehkä sinä olit vain katsomossa."],
    solve() { st.flags.cupDone = true; iq("stanley", 10); script(async () => {
      await sleep(700); await say("Çok güzel! 2006! Stanley Cupin finaali! Sinä todella olit maalivahti!", "kauppias");
      st.flags.cupT = Date.now(); [262, 330, 392, 523].forEach((f, n) => setTimeout(() => beep(f, 500, "sine", .05), n * 200)); await sleep(1600);
      await say("MARK-KA-NEN! MARK-KA-NEN!", "muu"); await sleep(1500);
      await say("Kesä 2006. Jotkut asiat eivät unohdu. Edes Istanbulissa.");

      if (!has("kebab")) { await say("Tästä hyvästä kebab on ilmainen, ystäväni. Maalivahdit tarvitsevat proteiinia.", "kauppias"); give("kebab"); } }); } },
};
const entered = {};
function quizStep(k) {
  const Q = QUIZZES[st.scene];
  if (!k || !Q || !st.flags[quizFlag()]) return;
  lastKey = { k, t: performance.now() }; beep(NOTE[k], 260);
  if (Q.done()) return;
  const e = (entered[st.scene] ??= []); e.push(k);
  if (e.join("") === Q.code) { entered[st.scene] = []; [523, 659, 784, 1047].forEach((f, n) => setTimeout(() => beep(f, 180, "triangle", .08), 200 + n * 140)); Q.solve(); }
  else if (!e.every((c, n) => c === Q.code[n])) {               // väärä: summeri, ja alusta (ensimmäinen numero aloittaa uuden)
    setTimeout(() => beep(110, 300, "sawtooth", .05), 280); entered[st.scene] = k === Q.code[0] ? [k] : [];
    if (!busy) script(() => say(Q.lines[Math.floor(Math.random() * Q.lines.length)], Q.taunt));
  }
}
