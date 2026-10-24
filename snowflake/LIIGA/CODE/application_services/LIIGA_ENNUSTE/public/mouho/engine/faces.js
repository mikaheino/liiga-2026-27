// Mouhon salaisuus -- Moottori: valokuvapäiden ja karikatyyrien renderöijät sekä vartalot (data: mouho/characters.js).
"use strict";
// Mouhon salaisuus -- bobblehead-päät (17.10.: "henkilöhahmojen päät tarkempia, niistä
// pitää tunnistaa henkilö... bobble head -tyylillä mutta pikseligrafiikkaa").
//
// Jokainen kasvo on kuvaus muodoista 100 x 120 -koordinaatistossa (pää, tukka, parta,
// silmät, lasit, suu). Se piirretään 4x ylinäytteistettynä ja pikselöidään hahmon omaan
// palettiin: jokainen kohdepikseli saa lohkonsa painotetuimman värin, jolloin silmät, suu
// ja kulmat (paino > 1) säilyvät pienessäkin päässä. Lopuksi tumma ääriviiva. Samasta
// kuvauksesta syntyy pelihahmon pää (WORLD) ja puhelujen muotokuva (PORTRAIT).
// Vertailukuvat olivat vain mallina; mitään valokuvaa ei ole tässä tiedostossa.

const FACE_W = 100, FACE_H = 120, SS = 4;
const HEAD = { world: [40, 50], portrait: [64, 80] };   // world piirretään puoleen kokoon (2x kangas)

// --- piirto ja pikselöinti -------------------------------------------------------
function hex(c) { const n = parseInt(c.slice(1), 16); return [n >> 16, (n >> 8) & 255, n & 255]; }
function shown(s, v) { if (!s.on) return true; if (s.on === "talk") return v.talk; if (s.on === "still") return !v.talk; if (s.on === "blink") return v.blink; if (s.on === "open") return !v.blink; return true; }
function renderFace(name, [w, h], v) {
  const F = FACES[name], hw = w * SS, hh = h * SS;
  const hi = document.createElement("canvas"); hi.width = hw; hi.height = hh;
  const x = hi.getContext("2d"); x.scale(hw / FACE_W, hh / FACE_H);
  // reunus: koordinaatisto 100 x 120, mutta muodot saavat ylittää sen hieman (hatut)
  const [fx, fy, fw, fh] = F.fit ?? [.06, .13, .88, .84]; x.translate(FACE_W * fx, FACE_H * fy); x.scale(fw, fh);
  x.lineCap = "round"; x.lineJoin = "round";
  for (const s of (v.back && F.back) || F.shapes) {
    if (!shown(s, v)) continue; const col = F.pal[s.c];
    x.fillStyle = col; x.strokeStyle = col; x.lineWidth = s.w ?? 2; x.beginPath();
    if (s.d) {        // ditheröity täyttö: shakkiruutu c/d kohderesoluution pikseleissä
      const pc = document.createElement("canvas"); pc.width = pc.height = 2 * SS; const pg = pc.getContext("2d");
      pg.fillStyle = col; pg.fillRect(0, 0, 2 * SS, 2 * SS); pg.fillStyle = F.pal[s.d]; pg.fillRect(0, 0, SS, SS); if (!s.sparse) pg.fillRect(SS, SS, SS, SS);
      const pat = x.createPattern(pc, "repeat"); pat.setTransform(x.getTransform().inverse()); x.fillStyle = pat;
    }
    if (s.e) { x.ellipse(s.e[0], s.e[1], s.e[2], s.e[3], 0, 0, 7); x.fill(); }
    else if (s.p) { s.p.forEach(([a, b], k) => (k ? x.lineTo(a, b) : x.moveTo(a, b))); x.closePath(); x.fill(); }
    else if (s.l) { s.l.forEach(([a, b], k) => (k ? x.lineTo(a, b) : x.moveTo(a, b))); x.stroke(); }
    else if (s.s) { x.ellipse(s.s[0], s.s[1], s.s[2], s.s[3], 0, 0, 7); x.stroke(); }
  }
  // pikselöinti: lohkon painotetuin palettiväri, peitto < 50 % = läpinäkyvä
  const src = x.getImageData(0, 0, hw, hh).data, keys = Object.keys(F.pal), cols = keys.map((k) => hex(F.pal[k]));
  const out = document.createElement("canvas"); out.width = w + 2; out.height = h + 2;
  const o = out.getContext("2d"), img = o.createImageData(w + 2, h + 2), d = img.data, solid = new Uint8Array((w + 2) * (h + 2));
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
    const votes = new Float32Array(keys.length); let cover = 0;
    for (let b = 0; b < SS; b++) for (let a = 0; a < SS; a++) {
      const p = ((j * SS + b) * hw + i * SS + a) * 4; if (src[p + 3] < 128) continue; cover++;
      let best = 0, bd = 1e9; for (let k = 0; k < cols.length; k++) { const [r0, g0, b0] = cols[k], dd = (src[p] - r0) ** 2 + (src[p + 1] - g0) ** 2 + (src[p + 2] - b0) ** 2; if (dd < bd) { bd = dd; best = k; } }
      votes[best] += F.weight?.[keys[best]] ?? 1;
    }
    if (cover * 2 < SS * SS) continue;
    let k = 0; for (let n = 1; n < votes.length; n++) if (votes[n] > votes[k]) k = n;
    const q = ((j + 1) * (w + 2) + i + 1); solid[q] = 1; const [r0, g0, b0] = cols[k]; d.set([r0, g0, b0, 255], q * 4);
  }
  // ääriviiva: läpinäkyvä pikseli kiinteän vieressä
  const [orr, og, ob] = hex(F.outline);
  for (let j = 0; j < h + 2; j++) for (let i = 0; i < w + 2; i++) {
    const q = j * (w + 2) + i; if (solid[q]) continue;
    if ((i > 0 && solid[q - 1]) || (i < w + 1 && solid[q + 1]) || (j > 0 && solid[q - w - 2]) || (j < h + 1 && solid[q + w + 2])) d.set([orr, og, ob, 255], q * 4);
  }
  o.putImageData(img, 0, 0); return out;
}
// Valokuvasta pikselöity pää (pixfaces.js, scripts/tools/pixel_face.py) ohittaa muotokuvauksen.
function renderPix(P, v) {
  const { w, h, pal, rows } = P, out = document.createElement("canvas"); out.width = w + 2; out.height = h + 2;
  const o = out.getContext("2d"), img = o.createImageData(w + 2, h + 2), d = img.data, solid = new Uint8Array((w + 2) * (h + 2));
  const keys = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ";
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
    const ch = rows[j][i]; if (ch === ".") continue; const q = (j + 1) * (w + 2) + i + 1; solid[q] = 1; d.set([...hex(pal[keys.indexOf(ch)]), 255], q * 4);
  }
  // puhe ja räpsäys: suu (P.mouth) ja silmät (P.eyes) kohdistetaan pikseliruudukkoon
  const put = (x, y, c) => { const q = (y + 1) * (w + 2) + x + 1; if (solid[q]) d.set([...hex(c), 255], q * 4); };
  if (P.iris && !v.blink) for (const [ix, iy] of P.iris) { const c = P.irisC ?? "#4c84c8"; put(ix, iy, c); put(ix - 1, iy, c); if (w >= 80) { put(ix, iy - 1, c); put(ix - 1, iy - 1, "#1c2c3c"); } }
  if (v.talk && P.mouth) { const [mx, my, mw] = P.mouth; for (let k = 0; k < mw; k++) { put(mx + k, my, "#4c1410"); if (k > 0 && k < mw - 1) put(mx + k, my + 1, "#4c1410"); } }
  if (v.blink && P.eyes) for (const [ex, ey, ew] of P.eyes) for (let k = 0; k < ew; k++) { put(ex + k, ey, P.lid ?? "#c88c70"); put(ex + k, ey - 1, P.lid ?? "#c88c70"); }
  const [orr, og, ob] = hex(P.outline ?? "#3c2414");
  for (let j = 0; j < h + 2; j++) for (let i = 0; i < w + 2; i++) {
    const q = j * (w + 2) + i; if (solid[q] || v.over) continue;    // over: pää rintakuvan päällä, ei ääriviivaa
    if ((i > 0 && solid[q - 1]) || (i < w + 1 && solid[q + 1]) || (j > 0 && solid[q - w - 2]) || (j < h + 1 && solid[q + w + 2])) d.set([orr, og, ob, 255], q * 4);
  }
  o.putImageData(img, 0, 0); return out;
}
const faceCache = {};
function faceImg(name, size = "world", v = {}) {
  const P = typeof PIXFACES !== "undefined" && PIXFACES[name]?.[size];
  if (P && !v.back) { const k = `pix|${name}|${size}|${v.talk ? 1 : 0}${v.blink ? 1 : 0}${v.over ? 1 : 0}`; return (faceCache[k] ??= renderPix(P, v)); }
  const k = `${name}|${size}|${v.talk ? 1 : 0}${v.blink ? 1 : 0}${v.back ? 1 : 0}`;
  return (faceCache[k] ??= renderFace(name, HEAD[size], v));
}
// Pää kaulan kohtaan (x, y = leuan alareuna). Bobblehead: pää keinuu kävellessä ja
// puhuessa, silmät räpsyvät omaan tahtiinsa. dir < 0 peilaa.
function head(name, x, y, t, { talking = false, moving = false, dir = 1, size = "world", seedv = 0, back = false } = {}) {
  const blink = (t + seedv * 977) % 3900 < 130;
  const talk = talking && Math.floor(t / 110) % 2 === 1;
  const img = faceImg(name, size, back ? { back: true } : { talk, blink });
  const bob = moving ? Math.round(Math.sin(t / 95) * 1) : talking ? Math.round(Math.sin(t / 140) * .6) : 0;
  const sway = moving ? Math.round(Math.sin(t / 190)) : 0;
  g.save(); g.imageSmoothingEnabled = false; g.translate(Math.round(x) + sway, Math.round(y) + bob); if (dir < 0) g.scale(-1, 1);
  const k = size === "world" ? 1 / PXS : 1;   // tuplatarkka pää maailman pikseleissä
  g.drawImage(img, -img.width * k / 2, -img.height * k + 2, img.width * k, img.height * k); g.restore();
}
function person(name, x, y, t, { moving = false, dir = 1, talking = false, sc = 1 } = {}) {
  const O = OUTFITS[name], f = moving ? Math.floor(t / 120) % 4 : 0, l1 = f === 1 ? 2 : f === 3 ? -1 : 0, l2 = -l1;
  g.save(); g.translate(Math.round(x), Math.round(y)); g.scale(dir < 0 ? -sc : sc, sc);
  shadow(0, 0, 7);
  r(-4 + l1, -10, 3, 9, O.legs); r(1 + l2, -10, 3, 9, O.legs); r(-5 + l1, -2, 4, 2, O.shoe); r(1 + l2, -2, 4, 2, O.shoe);
  if (O.shorts) { r(-5, -12, 10, 4, O.shorts); r(-5, -12, 10, 1, "#e84c4c"); }
  r(-6, -22, 12, 11, O.shirt); r(-6, -22, 4, 11, O.coat); r(2, -22, 4, 11, O.coat); r(-6, -22, 1, 11, O.coatL);   // takki tai liivi auki edestä
  if (name === "myrra") { r(-2, -22, 4, 3, "#f4f4f4"); r(-1, -19, 2, 8, "#1c1c24"); }
  if (name === "jalonen") { r(-3, -22, 6, 2, "#f4f4f4"); r(0, -20, 1, 9, "#0c1c3c"); }
  if (name === "jokinen") { r(-1, -21, 2, 7, "#c81c1c"); r(-2, -22, 4, 1, "#f4f4f4"); }      // puku ja punainen solmio, lenkilläkin       // valmennustakki: valkoinen kaulus, vetoketju
  if (O.collar) { for (const [dx, c] of [[-6, "#d8242c"], [-3, "#f8cc24"], [0, "#d8242c"], [3, "#f8cc24"]]) { r(dx, -22, 3, 2, c); px(dx + 1, -20, c); } }
  const arm = name === "saarni" ? O.shirt : O.coat, sw = moving ? (f % 2 ? 1 : -1) : 0;
  r(-8, -21 + sw, 2, 9, arm); r(6, -21 - sw, 2, 9, arm); r(-8, -12 + sw, 2, 2, O.hand); r(6, -12 - sw, 2, 2, O.hand);
  if (O.bag) { r(5, -11 - sw, 7, 6, O.bag); r(5, -11 - sw, 7, 1, "#7c5c34"); r(7, -12 - sw, 3, 1, "#3c2414"); }
  g.restore();
  // Bobblehead: pää pienenee etäisyyden mukana hitaammin kuin vartalo, jotta kaukanakin tunnistaa.
  const hs = (O.headScale ?? 1) * Math.pow(sc, .6);
  g.save(); g.translate(Math.round(x), Math.round(y - 21 * sc)); g.scale(hs, hs);
  head(name, 0, 0, t, { talking, moving, dir, seedv: name.length }); g.restore();
}
function npcHead(v, { talk = false, blink = false, back = false } = {}) {
  const N = NPCS[v % NPCS.length], k = `npc|${v % NPCS.length}|${talk ? 1 : 0}${blink ? 1 : 0}${back ? 1 : 0}`;
  if (faceCache[k]) return faceCache[k];
  const c = document.createElement("canvas"); c.width = 40; c.height = 50; const prev = g; g = c.getContext("2d");
  const ell = (x, y, rx, ry, col) => { g.fillStyle = col; g.beginPath(); g.ellipse(x, y, rx, ry, 0, 0, 7); g.fill(); };
  const dark = "#1c140c", shade = "rgba(80,30,10,.22)";
  ell(20, 30, 14, 18, "#1c140c");                                        // ääriviiva
  if (back) {
    ell(20, 30, 13, 17, N.hat === "bald" ? N.skin : N.hat === "scarf" ? N.scarf : N.hair);
    if (N.hat === "bald") { ell(20, 34, 13, 10, N.hair); ell(24, 26, 5, 6, "rgba(255,255,255,.15)"); }
  } else {
    ell(7, 31, 3, 4, N.skin); ell(33, 31, 3, 4, N.skin);                 // korvat
    ell(20, 30, 13, 17, N.skin); ell(26, 33, 7, 14, shade);              // kasvot, varjo oikealla
    ell(15, 37, 3, 2, "rgba(220,90,70,.25)"); ell(26, 37, 3, 2, "rgba(220,90,70,.25)");   // posket
    if (N.beard) { ell(20, 41, 12, 8, N.hair); ell(20, 39, 7, 4, N.skin); }
    // kulmat ja silmät
    g.fillStyle = N.brow ?? (N.hair === "#9c9c9c" ? "#6c6c6c" : N.hair); g.fillRect(11, 22, 7, 2); g.fillRect(23, 22, 7, 2);
    if (blink) { g.fillStyle = dark; g.fillRect(12, 27, 6, 1); g.fillRect(23, 27, 6, 1); }
    else { g.fillStyle = "#fcfcf4"; g.fillRect(12, 25, 6, 4); g.fillRect(23, 25, 6, 4); g.fillStyle = dark; g.fillRect(15, 25, 2, 4); g.fillRect(25, 25, 2, 4); g.fillStyle = "#fff"; g.fillRect(15, 25, 1, 1); g.fillRect(25, 25, 1, 1); }
    g.fillStyle = "rgba(90,40,20,.55)"; g.fillRect(19, 28, 3, 7); g.fillRect(18, 34, 5, 2);              // nenä
    if (N.shades) { g.fillStyle = "#0c0c14"; g.fillRect(10, 24, 9, 6); g.fillRect(22, 24, 9, 6); g.fillRect(18, 25, 5, 2); g.fillStyle = "#7ca0fc"; g.fillRect(12, 25, 2, 1); g.fillRect(24, 25, 2, 1); }
    if (N.stache) { g.fillStyle = N.stacheC ?? (N.hair === "#9c9c9c" ? "#d8d8d8" : N.hair); g.fillRect(13, 37, 15, 3); g.fillRect(12, 38, 2, 2); g.fillRect(27, 38, 2, 2); }
    g.fillStyle = "#7c1c1c"; if (talk) g.fillRect(16, 40, 9, 4); else { g.fillRect(16, 41, 9, 2); g.fillRect(15, 40, 1, 1); g.fillRect(25, 40, 1, 1); }
  }
  // hiukset ja päähineet
  if (N.hat === "fez") { g.fillStyle = "#b01c1c"; g.fillRect(11, 4, 18, 13); g.fillStyle = "#d83030"; g.fillRect(11, 4, 5, 13); g.fillStyle = dark; g.fillRect(11, 16, 18, 1); g.fillRect(27, 4, 2, 10); g.fillStyle = "#1c1c1c"; g.fillRect(19, 2, 2, 3); }
  else if (N.hat === "cap") { ell(20, 16, 14, 7, "#4c5c3c"); g.fillStyle = "#3c4c2c"; g.fillRect(4, 16, 32, 3); }
  else if (N.hat === "scarf") { if (!back) { g.fillStyle = N.scarf; g.beginPath(); g.ellipse(20, 26, 15, 22, 0, Math.PI, 0); g.fill(); g.fillRect(5, 26, 4, 18); g.fillRect(31, 26, 4, 18); g.fillStyle = "rgba(255,255,255,.18)"; g.fillRect(8, 10, 3, 14); } }
  else if (N.hat === "curly") { for (const [x, y] of [[10, 16], [15, 12], [21, 11], [27, 13], [31, 18], [8, 22], [32, 24]]) ell(x, y, 5, 5, N.hair); }
  else if (N.hat === "slick") { ell(20, 16, 14, 8, N.hair); g.fillStyle = N.hair; g.fillRect(6, 16, 3, 10); g.fillRect(31, 16, 3, 10); g.fillStyle = "rgba(255,255,255,.3)"; g.fillRect(14, 11, 10, 1); g.fillRect(12, 13, 5, 1); }
  else if (N.hat === "bald") { if (!back) { g.fillStyle = N.hair; g.fillRect(7, 24, 4, 10); g.fillRect(29, 24, 4, 10); g.fillStyle = "rgba(255,255,255,.25)"; g.fillRect(14, 15, 6, 3); } }
  else { ell(20, 17, 14, 8, N.hair); g.fillStyle = N.hair; g.fillRect(6, 17, 4, 9); g.fillRect(30, 17, 4, 9); }
  g = prev; return (faceCache[k] = c);
}
function npc(v, x, y, t, { moving = false, dir = 1, talking = false, sc = 1, back = false, hsc = null } = {}) {
  const N = NPCS[v % NPCS.length], f = moving ? Math.floor(t / 120) % 4 : 0, l1 = f === 1 ? 2 : f === 3 ? -1 : 0, l2 = -l1;
  g.save(); g.translate(Math.round(x), Math.round(y)); g.scale(dir < 0 ? -sc : sc, sc);
  shadow(0, 0, 7);
  if (N.robe) { fillPoly([[-7, -22], [7, -22], [8, -1], [-8, -1]], N.shirt); r(-7, -22, 3, 21, "rgba(255,255,255,.12)"); r(-7, -13, 14, 3, N.sash); r(-6, -1, 4, 1, "#3c1010"); r(2, -1, 4, 1, "#3c1010"); }
  else if (N.dress) { fillPoly([[-6, -14], [6, -14], [8, -1], [-8, -1]], N.legs); r(-4, -1, 3, 1, "#1c1410"); r(1, -1, 3, 1, "#1c1410"); }
  else { r(-4 + l1, -10, 3, 9, N.legs); r(1 + l2, -10, 3, 9, N.legs); r(-5 + l1, -2, 4, 2, "#1c1410"); r(1 + l2, -2, 4, 2, "#1c1410"); }
  if (!N.robe) r(-6, -22, 12, 11, N.shirt); if (N.stripe) for (let k = -21; k < -11; k += 3) r(-6, k, 12, 1, N.stripe);
  if (N.vstripe) for (let k = -5; k < 6; k += 2) r(k, -22, 1, 11, N.vstripe);          // pystyraidat (erotuomari)
  if (N.vest) { r(-6, -22, 4, 11, N.vest); r(2, -22, 4, 11, N.vest); if (N.pin) { r(-6, -22, 12, 1, N.vest); r(-2, -22, 4, 2, N.vest); for (const xx of [-5, -3, 3, 5]) r(xx, -21, 1, 10, "#3a3c52"); for (const xx of [-3, 2]) r(xx, -10, 1, 8, "#2c2e44"); } }
  if (N.tie) { r(-1, -21, 2, 7, N.tie); r(-2, -22, 4, 1, N.shirt); }
  const sw = moving ? (f % 2 ? 1 : -1) : 0, arm = N.pin ? N.vest : N.shirt;
  r(-8, -21 + sw, 2, 9, arm); r(6, -21 - sw, 2, 9, arm); r(-8, -12 + sw, 2, 2, N.skin); r(6, -12 - sw, 2, 2, N.skin);
  if (N.bag) { r(6, -11 - sw, 8, 6, "#6c4420"); r(6, -11 - sw, 8, 1, "#8c5c2c"); r(8, -12 - sw, 4, 1, "#c8a030"); }
  g.restore();
  const hs = hsc ?? Math.pow(sc, .6), blink = !back && (t + v * 977) % 4100 < 130, talk = talking && Math.floor(t / 110) % 2 === 1;
  const img = NPC_STYLE === 2 ? faceImg(`npc2_${v % NPCS.length}`, "world", back ? { back: true } : { talk, blink }) : npcHead(v, { talk, blink, back }), bob = moving ? Math.round(Math.sin(t / 95)) : Math.round(Math.sin(t / 700 + v) * .5);
  g.save(); g.imageSmoothingEnabled = false; g.translate(Math.round(x), Math.round(y - 21 * sc) + bob); g.scale(hs * (dir < 0 ? -1 : 1), hs);
  g.drawImage(img, -img.width / PXS / 2, -img.height / PXS + 2, img.width / PXS, img.height / PXS); g.restore();
}

// --- sivuhahmojen tyyliehdotus 2 (backlog 2, 23.10.) -----------------------------------
// Sama muotorenderöijä kuin Myrrän ja Jalosen karikatyyreissä: iho kolmella sävyllä ja varjopuoli,
// korvat, luomet, nenän varjo, kiiltävät hiukset ja päähineet. Parametrit NPCS-taulukosta, joten
// jokainen nimetön hahmo saa oman päänsä. Oletus 23.10. (käyttäjä valitsi), vanha tasavärityyli ?npc=1.
const NPC_STYLE = new URLSearchParams(location.search).get("npc") === "1" ? 1 : 2;
function shadeHex(h, f) { const n = parseInt(h.slice(1), 16), c = [n >> 16, (n >> 8) & 255, n & 255].map((v) => Math.max(0, Math.min(255, Math.round(f > 1 ? v + (255 - v) * (f - 1) : v * f))));
  return "#" + c.map((v) => v.toString(16).padStart(2, "0")).join(""); }
function npcFace(N) {
  const hair = N.hair, pal = { ...SKIN, skin: N.skin, skinL: shadeHex(N.skin, 1.18), skinD: shadeHex(N.skin, .78), skinDD: shadeHex(N.skin, .58), blush: shadeHex(N.skin, .9),
    hair, hairL: shadeHex(hair, 1.45), hairD: shadeHex(hair, .7), brow: N.brow ?? shadeHex(hair === "#ececec" ? "#9c9c9c" : hair, .9), white: "#f4f4f0", iris: "#3c2c24", pupil: "#140c0a",
    fez: "#b01c1c", fezL: "#d83030", fezD: "#7c1010", cap: "#4c5c3c", capD: "#34402a", scarf: N.scarf ?? "#3c8c5c", scarfD: shadeHex(N.scarf ?? "#3c8c5c", .7), shade: "#0c0c14", shadeL: "#5c7cbc",
    stache: N.stacheC ?? (hair === "#9c9c9c" ? "#d8d8d8" : hair) };
  const S = [
    { e: [10, 64, 6, 10], c: "skin" }, { e: [90, 64, 6, 10], c: "skinD" },
    { e: [50, 58, 38, 44], c: "skin" }, { p: [[14, 60], [86, 60], [84, 88], [70, 106], [50, 112], [30, 106], [16, 88]], c: "skin" },
    { p: [[66, 30], [88, 58], [84, 88], [70, 106], [64, 100], [76, 80], [76, 52]], c: "skin", d: "skinD", sparse: true },
    { e: [30, 80, 8, 5], c: "skin", d: "blush", sparse: true }, { e: [70, 80, 8, 5], c: "skinD", d: "blush", sparse: true },
    { l: [[26, 48], [42, 46]], c: "brow", w: 3.4 }, { l: [[58, 46], [74, 48]], c: "brow", w: 3.4 },
    { e: [34, 57, 6, 3.4], c: "white", on: "open" }, { e: [66, 57, 6, 3.4], c: "white", on: "open" },
    { e: [36, 57, 3, 3], c: "iris", on: "open" }, { e: [64, 57, 3, 3], c: "iris", on: "open" }, { e: [36, 57, 1.4, 1.6], c: "pupil", on: "open" }, { e: [64, 57, 1.4, 1.6], c: "pupil", on: "open" },
    { l: [[28, 54], [40, 53]], c: "skinD", w: 2, on: "open" }, { l: [[60, 53], [72, 54]], c: "skinD", w: 2, on: "open" },
    { l: [[28, 57], [40, 57]], c: "skinDD", w: 2.6, on: "blink" }, { l: [[60, 57], [72, 57]], c: "skinDD", w: 2.6, on: "blink" },
    { p: [[51, 58], [58, 80], [50, 84]], c: "skinD" }, { l: [[48, 60], [47, 78]], c: "skinL", w: 2.2 }, { e: [45, 83, 2.6, 1.6], c: "skinDD" }, { e: [55, 83, 2.6, 1.6], c: "skinDD" },
    { l: [[36, 96], [50, 98], [64, 96]], c: "lip", w: 3, on: "still" }, { p: [[36, 94], [64, 94], [60, 103], [50, 106], [40, 103]], c: "mouth", on: "talk" }, { p: [[38, 94], [62, 94], [60, 97], [40, 97]], c: "teeth", on: "talk" },
  ];
  const H = [];   // hiukset ja päähine (myös takaa)
  const cut = [[16, 44], [14, 26], [24, 10], [40, 2], [60, 2], [76, 10], [86, 26], [84, 44], [78, 30], [64, 22], [50, 20], [36, 22], [22, 30]];
  if (N.hat === "fez") H.push({ p: [[30, 18], [70, 18], [66, -14], [34, -14]], c: "fez" }, { p: [[30, 18], [44, 18], [42, -14], [34, -14]], c: "fezL" }, { p: [[60, 18], [70, 18], [66, -14], [62, -14]], c: "fezD" },
    { l: [[50, -14], [62, -6], [64, 8]], c: "hairD", w: 2 }, { e: [64, 10, 3, 4], c: "hairD" }, { p: [[14, 40], [22, 22], [30, 18], [30, 32], [20, 44]], c: "hair" }, { p: [[86, 40], [78, 22], [70, 18], [70, 32], [80, 44]], c: "hairD" });
  else if (N.hat === "cap") H.push({ e: [50, 22, 40, 18], c: "cap" }, { p: [[10, 24], [90, 24], [92, 32], [8, 32]], c: "capD" }, { l: [[24, 14], [60, 8]], c: "hairL", w: 2 });
  else if (N.hat === "scarf") H.push({ p: [[6, 110], [4, 50], [16, 14], [50, 0], [84, 14], [96, 50], [94, 110], [80, 100], [84, 56], [74, 30], [50, 22], [26, 30], [16, 56], [20, 100]], c: "scarf" },
    { p: [[84, 56], [94, 110], [80, 100]], c: "scarfD" }, { l: [[20, 28], [50, 12], [80, 28]], c: "scarfD", w: 2 });
  else if (N.hat === "bald") H.push({ p: [[12, 44], [16, 64], [22, 62], [20, 44]], c: "hair" }, { p: [[88, 44], [84, 64], [78, 62], [80, 44]], c: "hairD" }, { e: [38, 22, 9, 4], c: "skinL" });
  else if (N.hat === "curly") for (const [x, y] of [[18, 30], [26, 16], [40, 8], [56, 6], [70, 12], [82, 24], [86, 40], [14, 44], [48, 18], [64, 20], [32, 22]]) H.push({ e: [x, y, 10, 9], c: "hair", d: "hairD", sparse: true });
  else if (N.hat === "slick") H.push({ p: cut, c: "hair" }, { l: [[30, 14], [50, 6], [70, 12]], c: "hairL", w: 3 }, { l: [[26, 24], [46, 16]], c: "hairL", w: 2 });
  else H.push({ p: cut, c: "hair" }, { p: cut.slice(4, 10), c: "hairD" }, { l: [[30, 12], [52, 6]], c: "hairL", w: 2.4 });
  const F = [];   // parta, viikset, aurinkolasit
  if (N.beard) F.push({ p: [[16, 70], [26, 74], [34, 90], [50, 96], [66, 90], [74, 74], [84, 70], [82, 94], [66, 110], [50, 116], [34, 110], [18, 94]], c: "hair", d: "hairD", sparse: true });   // parta hiusten värinen (Mehmet valkoinen)
  if (N.stache) F.push({ p: [[32, 90], [50, 86], [68, 90], [72, 96], [62, 93], [50, 92], [38, 93], [28, 96]], c: "stache" });
  if (N.shades) F.push({ p: [[20, 50], [46, 50], [44, 62], [24, 62]], c: "shade" }, { p: [[54, 50], [80, 50], [76, 62], [56, 62]], c: "shade" }, { l: [[46, 53], [54, 53]], c: "shade", w: 2 }, { l: [[26, 53], [32, 52]], c: "shadeL", w: 1.6 }, { l: [[60, 53], [66, 52]], c: "shadeL", w: 1.6 });
  const backHead = N.hat === "scarf" ? [{ e: [50, 56, 46, 56], c: "scarf" }] : N.hat === "bald" ? [{ e: [50, 58, 38, 44], c: "skin" }, { p: [[12, 50], [88, 50], [86, 80], [50, 92], [14, 80]], c: "hair" }] : [{ e: [50, 56, 40, 46], c: N.hat === "cap" ? "cap" : "hair" }];
  return { outline: shadeHex(N.skin, .32), pal, weight: { iris: 5, pupil: 5, white: 3, brow: 3, lip: 3, mouth: 4, teeth: 3, shade: 4, skinDD: 2.4 },
    shapes: [...S, ...H, ...F], back: [...backHead, ...(N.hat === "fez" ? H.slice(0, 3) : [])] };
}
