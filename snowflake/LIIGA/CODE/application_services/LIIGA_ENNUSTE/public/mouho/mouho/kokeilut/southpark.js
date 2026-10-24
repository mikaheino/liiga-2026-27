"use strict";
// Mouhon salaisuus -- South Park -tyyliset sivuhahmot (18.10.2026).
// Generaattori tuottaa ALKUPERÄISIÄ hahmoja sarjan aikuishahmojen tyylillä: mittasuhteet ja
// muodot on kalibroitu referenssikuviin (mouho_concept/npc_style/south_park, ei repossa), mutta
// sarjan omia hahmoja ei kopioida. Piirto: vektorimuodot 4x-ylinäytteistettynä ja alas
// moodiväreillä, jolloin tulos on terävää pikseligrafiikkaa ilman pehmennystä ja väriliukumia.
// Mitat yksikköinä: koko pituus 100 (jalkapohjasta päälakeen), origo jalkojen keskellä.

const SP_OUT = "#1c1a1e";
const SP_SKIN = ["#fcdcbc", "#f6d0aa", "#e2b088", "#b88252", "#8a5c36", "#55392a"];
const SP_HAIR = ["#16120f", "#3a2616", "#6c4022", "#8c5a2c", "#c89a4c", "#e8d27c", "#9c9c9c", "#d8d8d8", "#8c2c1c"];
const SP_CLOTH = ["#c8202c", "#2c9c9c", "#3a6cc8", "#5cc83c", "#e86c1c", "#8c3c9c", "#6c4a2e", "#e8c81c", "#4c4c58", "#2c3c6c", "#9c5a4a", "#e8e4d8", "#2c6c3c", "#b0306c"];
const SP_PANTS = ["#2c3c6c", "#3c4caa", "#3a3a44", "#4c4c54", "#2c5c3c", "#6c5c44", "#1c1c28", "#5c4636"];

// Siemenellinen satunnaisuus: sama siemen -> sama hahmo joka kerta.
function spRng(seed) { let s = (seed * 2654435761) >>> 0 || 1; return () => ((s = (s ^ (s << 13)) >>> 0, s = (s ^ (s >>> 17)) >>> 0, s = (s ^ (s << 5)) >>> 0) / 4294967296); }
const pick = (rnd, a) => a[Math.floor(rnd() * a.length)];

// Generaattori: siemen -> hahmon parametrit. opts kiinnittää halutut piirteet (esim. { hat: "fez" }).
function spGen(seed, opts = {}) {
  const rnd = spRng(seed + 17), female = opts.female ?? rnd() < .42, age = opts.age ?? pick(rnd, ["nuori", "keski", "keski", "vanha"]);
  const hairC = age === "vanha" ? pick(rnd, [SP_HAIR[6], SP_HAIR[7]]) : pick(rnd, SP_HAIR.slice(0, 6).concat(SP_HAIR[8]));
  const P = {
    seed, female, age,
    skin: opts.skin ?? pick(rnd, SP_SKIN), hairC,
    hair: female ? pick(rnd, ["bob", "pitkä", "nuttura", "lyhyt"]) : age === "vanha" ? pick(rnd, ["kalju", "kalju", "sivujako", "lyhyt"]) : pick(rnd, ["sotkuinen", "sivujako", "lyhyt", "kiharat", "siili"]),
    hat: rnd() < .22 ? pick(rnd, ["fetsi", "huivi", "lippis", "pipo"]) : null,
    stache: !female && rnd() < .38, beard: !female && rnd() < .2, stubble: !female && rnd() < .2,
    glasses: rnd() < .22 ? pick(rnd, ["pyöreät", "suorakulmaiset"]) : null,
    top: pick(rnd, ["paita", "kauluspaita", "takki", "huppari", "pikee", "neule"]),
    topC: pick(rnd, SP_CLOTH), innerC: pick(rnd, SP_CLOTH), pants: female && rnd() < .4 ? "hame" : "housut", pantsC: pick(rnd, SP_PANTS),
    build: pick(rnd, [0, 0, 1, 2]),           // 0 hoikka, 1 tukeva, 2 pyöreä (Randy / Clyde / Garrison -mittaiset)
    gaze: pick(rnd, [0, 0, .6, -.6]), mood: pick(rnd, ["neutraali", "neutraali", "huoli", "hymy"]), earrings: female && rnd() < .4,
  };
  if (P.hat === "huivi") { P.hair = "pitkä"; P.female = true; P.stache = P.beard = P.stubble = false; }
  return Object.assign(P, opts);
}

// --- piirto ylinäytteistettynä --------------------------------------------------------
const SP_SS = 4;                              // ylinäytteistys
const spCache = {};
// Palauttaa hahmon kuvan (2x-kangas, eli 1 kuvapikseli = 1/2 maailmanpikseliä) annetulla korkeudella.
function spSprite(P, { worldH = 50, blink = false, talk = false, step = 0 } = {}) {
  const key = `${JSON.stringify(P)}|${worldH}|${blink}|${talk}|${step}`;
  if (spCache[key]) return spCache[key];
  const unit = worldH * PXS / 100, pad = 30, wU = 70 + pad, hU = 112;        // yksikköinä
  const Wt = Math.ceil(wU * unit), Ht = Math.ceil(hU * unit);
  const big = document.createElement("canvas"); big.width = Wt * SP_SS; big.height = Ht * SP_SS;
  const c = big.getContext("2d"); c.scale(unit * SP_SS, unit * SP_SS); c.translate(wU / 2, 106);
  const lw = .78 / unit;                      // sisäviivan leveys: alle kuvapikselin, jää yhdeksi pikseliksi
  spBody(c, P, { blink, talk, step, lw });
  // alasnäytteistys moodivärillä: jokainen kohdepikseli saa yleisimmän värinsä, ei sekoitusta
  const src = c.getImageData(0, 0, big.width, big.height).data, out = document.createElement("canvas"); out.width = Wt; out.height = Ht;
  const o = out.getContext("2d"), od = o.createImageData(Wt, Ht);
  for (let y = 0; y < Ht; y++) for (let x = 0; x < Wt; x++) {
    const counts = new Map(); let solid = 0;
    for (let j = 0; j < SP_SS; j++) for (let i = 0; i < SP_SS; i++) { const k = ((y * SP_SS + j) * big.width + x * SP_SS + i) * 4; if (src[k + 3] < 128) continue; solid++;
      const col = (src[k] >> 2) << 16 | (src[k + 1] >> 2) << 8 | (src[k + 2] >> 2); counts.set(col, (counts.get(col) ?? 0) + 1 + (col < 0x101010 ? .45 : 0)); }   // viivat voittavat vain tasapelin
    if (solid < SP_SS * SP_SS / 2) continue;
    let best = 0, bc = 0; for (const [col, n] of counts) if (n > bc) { bc = n; best = col; }
    const k = (y * Wt + x) * 4; od.data[k] = (best >> 16 & 63) << 2; od.data[k + 1] = (best >> 8 & 63) << 2; od.data[k + 2] = (best & 63) << 2; od.data[k + 3] = 255;
  }
  // ulkoääriviiva yhden pikselin levyisenä siluetin ympärille
  const a = (x, y) => x >= 0 && y >= 0 && x < Wt && y < Ht && od.data[(y * Wt + x) * 4 + 3] === 255, edge = [];
  for (let y = 0; y < Ht; y++) for (let x = 0; x < Wt; x++) if (!a(x, y) && (a(x + 1, y) || a(x - 1, y) || a(x, y + 1) || a(x, y - 1))) edge.push((y * Wt + x) * 4);
  for (const k of edge) { od.data[k] = 0x1c; od.data[k + 1] = 0x1a; od.data[k + 2] = 0x1e; od.data[k + 3] = 255; }
  o.putImageData(od, 0, 0);
  out.footX = (wU / 2) * unit; out.footY = 106 * unit;
  return (spCache[key] = out);
}

function spBody(c, P, { blink, talk, step, lw }) {
  const fill = (col, f) => { c.beginPath(); f(); c.fillStyle = col; c.fill(); };
  const line = (f, w = lw, col = SP_OUT) => { c.beginPath(); f(); c.lineWidth = w; c.strokeStyle = col; c.lineCap = "round"; c.stroke(); };
  const both = (col, f) => { fill(col, f); line(f); };
  const ell = (x, y, rx, ry) => () => c.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
  const wide = [0, 2.5, 5][P.build];          // vartalon leveys rakenteen mukaan
  const sh = 17 + wide * .6, hip = 15 + wide;  // olkapäät ja lantio (puolileveys)
  // kengät (tummat, litteät) ja housut / hame
  const s1 = step === 1 ? -2 : step === 3 ? 2 : 0;
  both("#26232a", ell(-7 + s1, -1.6, 8, 2.2)); both("#26232a", ell(7 - s1, -1.6, 8, 2.2));
  if (P.pants === "hame") {
    both(P.skin, () => c.rect(-9, -20, 6, 18)); both(P.skin, () => c.rect(3, -20, 6, 18));
    both(P.pantsC, () => { c.moveTo(-hip, -40); c.lineTo(hip, -40); c.lineTo(hip + 2, -18); c.lineTo(-hip - 2, -18); c.closePath(); });
  } else {
    both(P.pantsC, () => { c.moveTo(-hip + 2, -40); c.lineTo(hip - 2, -40); c.lineTo(hip - 3.2, -2.5); c.lineTo(-hip + 3.2, -2.5); c.closePath(); });   // housut kapeammat kuin vartalo, lapaset ulkopuolella
    line(() => { c.moveTo(0, -31); c.lineTo(0, -2.5); });          // lahjesauma
  }
  // vartalo: suorahko, pyöristetyt olkapäät; pyöreällä vatsa pullistuu
  const torso = () => { c.moveTo(-hip, -39); c.lineTo(hip, -39); c.lineTo(sh, -60); c.quadraticCurveTo(sh - .5, -70, sh - 8, -71.5); c.lineTo(-sh + 8, -71.5); c.quadraticCurveTo(-sh + .5, -70, -sh, -60); c.closePath(); };   // viettävät hartiat
  both(P.topC, torso);
  if (P.build === 2) line(() => { c.moveTo(-hip + 3, -46); c.quadraticCurveTo(0, -42, hip - 3, -46); });
  // yläosan malli
  if (P.top === "takki" || P.top === "huppari") {
    fill(P.innerC, () => { c.moveTo(-4.5, -39); c.lineTo(4.5, -39); c.lineTo(4, -70); c.lineTo(-4, -70); c.closePath(); });
    line(() => { c.moveTo(-4.5, -39); c.lineTo(-4, -70); c.moveTo(4.5, -39); c.lineTo(4, -70); });
    if (P.top === "huppari") line(() => { c.moveTo(-2, -66); c.lineTo(-2, -58); c.moveTo(2, -66); c.lineTo(2, -58); });
    else line(() => { c.moveTo(-4, -70); c.lineTo(-8, -64); c.lineTo(-5, -60); c.moveTo(4, -70); c.lineTo(8, -64); c.lineTo(5, -60); });
  } else if (P.top === "kauluspaita" || P.top === "pikee") {
    line(() => { c.moveTo(0, -66); c.lineTo(0, -39); });
    for (const yy of [-61, -54, -47]) fill(SP_OUT, ell(-.9, yy, .5, .5));
    both(P.topC, () => { c.moveTo(-6, -71); c.lineTo(0, -65); c.lineTo(-2, -70); c.closePath(); }); both(P.topC, () => { c.moveTo(6, -71); c.lineTo(0, -65); c.lineTo(2, -70); c.closePath(); });
    if (P.top === "kauluspaita") line(() => c.rect(5.5, -63, 6, 6));      // rintatasku
  } else if (P.top === "neule") { line(() => { c.moveTo(-sh + 1, -44); c.lineTo(sh - 1, -44); }); }
  else fill(P.skin, () => { c.moveTo(-4, -71); c.lineTo(4, -71); c.lineTo(0, -66.5); c.closePath(); });   // T-paidan pääntie
  // kädet: hihat kyljissä (sisäviiva), lapaset peukalo eteenpäin lantion korkeudella
  line(() => { c.moveTo(-sh + 3.5, -64); c.quadraticCurveTo(-hip + 1.5, -55, -hip + 2.5, -46); c.moveTo(sh - 3.5, -64); c.quadraticCurveTo(hip - 1.5, -55, hip - 2.5, -46); });
  for (const sx of [-1, 1]) { both(P.skin, ell(sx * (hip - .5), -43, 3.6, 3.8)); both(P.skin, ell(sx * (hip - 3.6), -44.4, 1.6, 1.9)); }
  // pää: iso (referensseissä hartioiden levyinen) ja matalalla, leuka peittää kauluksen
  const hy = -86, hr = 14.6, hv = 14.2, HS = 1.17;
  c.save(); c.translate(0, -83.5); c.scale(HS, HS); c.translate(0, -hy);
  if (P.hair === "pitkä" || (P.hair === "bob" && !P.hat)) both(P.hat === "huivi" ? P.innerC : P.hairC, () => c.roundRect(-hr - 2, hy - 13, hr * 2 + 4, P.hair === "bob" ? 25 : 32, 8));
  
  both(P.skin, ell(0, hy, hr, hv));
  if (P.stubble) fill(P.hairC === SP_HAIR[0] ? "#5c5048" : "#a08c74", () => { c.ellipse(0, hy + 2, hr - .4, hv - 1.2, 0, .12, Math.PI - .12); c.closePath(); });
  if (P.beard) both(P.hairC, () => { c.ellipse(0, hy + 1, hr, hv, 0, .05, Math.PI - .05); c.lineTo(-10, hy + 3); c.quadraticCurveTo(0, hy + 7, 10, hy + 3); c.closePath(); });
  // hiukset
  const top = (f) => both(P.hairC, f);
  const H = P.hat ? null : P.hair;
  if (H === "sotkuinen") top(() => { c.moveTo(-hr - 1, hy + 2); c.lineTo(-hr - 3, hy - 4); c.lineTo(-hr + 1, hy - 8); c.lineTo(-hr - 1, hy - 12); c.lineTo(-6, hy - 14); c.lineTo(-4, hy - 17); c.lineTo(2, hy - 14.5); c.lineTo(7, hy - 17); c.lineTo(9, hy - 13); c.lineTo(hr + 2, hy - 12); c.lineTo(hr, hy - 7); c.lineTo(hr + 3, hy - 3); c.lineTo(hr + 1, hy + 2); c.quadraticCurveTo(hr - 1, hy - 7, 4, hy - 9); c.quadraticCurveTo(-4, hy - 10, -hr + 1.5, hy - 5); c.closePath(); });
  if (H === "sivujako" || H === "lyhyt" || H === "bob" || H === "pitkä" || H === "nuttura") top(() => { c.ellipse(0, hy, hr + .6, hv + .6, 0, Math.PI * 1.03, Math.PI * 1.97); c.quadraticCurveTo(hr - 2, hy - 8, H === "sivujako" ? -4 : 0, hy - 9.5); c.quadraticCurveTo(-hr + 2, hy - 8.5, -hr - .2, hy - 1.5); c.closePath(); });
  if (H === "sivujako") line(() => { c.moveTo(-5, hy - 9.4); c.lineTo(-7, hy - 14); });
  if (H === "nuttura") top(ell(0, hy - 16, 5.5, 4.2));
  if (H === "kiharat") for (const [dx, dy, r] of [[-11, -7, 4.6], [-6, -11.5, 4.8], [0, -13, 4.8], [6, -11.5, 4.8], [11, -7, 4.6], [-13.5, -1, 3], [13.5, -1, 3]]) top(ell(dx, hy + dy, r, r));
  if (H === "siili") top(() => { c.moveTo(-hr, hy - 3); for (let k = 0; k <= 10; k++) { const a = Math.PI * (1.05 + k * .09); c.lineTo(Math.cos(a) * (hr + (k % 2 ? 3 : .5)), hy + Math.sin(a) * (hv + (k % 2 ? 3 : .5))); } c.quadraticCurveTo(0, hy - 8, -hr, hy - 3); c.closePath(); });
  if (H === "kalju") { for (const sx of [-1, 1]) top(() => { c.moveTo(sx * hr * .98, hy + 3); c.quadraticCurveTo(sx * (hr + 2.5), hy - 2, sx * hr * .8, hy - 8); c.quadraticCurveTo(sx * (hr - 2), hy - 1, sx * hr * .98, hy + 3); c.closePath(); }); line(() => { c.moveTo(-3, hy - 10); c.quadraticCurveTo(0, hy - 11, 3, hy - 10); }, lw * .8, "#c09878"); }
  // päähineet
  if (P.hat === "fetsi") { both("#b81c22", () => { c.moveTo(-8, hy - 11); c.lineTo(8, hy - 11); c.lineTo(6.5, hy - 22); c.lineTo(-6.5, hy - 22); c.closePath(); }); line(() => { c.moveTo(5, hy - 22); c.lineTo(8, hy - 15); }, lw * 1.4); }
  if (P.hat === "lippis") { both(P.innerC, () => { c.ellipse(0, hy - 4, hr, 11, 0, Math.PI, 0); c.closePath(); }); both(P.innerC, () => c.roundRect(-hr - 7, hy - 5.5, hr + 9, 3, 1.4)); }
  if (P.hat === "pipo") { both(P.innerC, () => { c.ellipse(0, hy - 3, hr + .5, 12.5, 0, Math.PI, 0); c.closePath(); }); both(P.topC, () => c.rect(-hr - .5, hy - 5, hr * 2 + 1, 4)); both(P.topC, ell(0, hy - 16, 3.6, 3.2)); }
  if (P.hat === "huivi") both(P.innerC, () => { c.ellipse(0, hy - 1.5, hr + 1.4, hv + 1, 0, Math.PI * 1.02, Math.PI * 1.98); c.quadraticCurveTo(0, hy - 10, -hr - 1.2, hy - 2); c.closePath(); });
  // silmät: pystysoikiot painautuvat toisiinsa; pupillit pieniä pisteitä sisäreunan puolella
  const ex = 5.3, ey = hy - 1.5, erx = 5.5, ery = 6.8;
  for (const sx of [-1, 1]) both("#ffffff", ell(sx * ex, ey, erx, ery));
  if (blink) { for (const sx of [-1, 1]) both(P.skin, () => { c.ellipse(sx * ex, ey, erx, ery, 0, Math.PI, 0); c.closePath(); }); }
  else for (const sx of [-1, 1]) fill(SP_OUT, ell(sx * 2.3 + P.gaze, ey + .3, .75, .85));
  if (P.mood === "huoli" && !blink) line(() => { c.moveTo(-9, ey - 6); c.lineTo(-3, ey - 7.6); c.moveTo(9, ey - 6); c.lineTo(3, ey - 7.6); });
  // lasit
  if (P.glasses === "pyöreät") { line(() => { for (const sx of [-1, 1]) c.ellipse(sx * ex, ey, erx + 1, ery + .6, 0, 0, Math.PI * 2); }, lw * 1.6); line(() => { c.moveTo(-ex - erx - 1, ey); c.lineTo(-hr, ey - 1); c.moveTo(ex + erx + 1, ey); c.lineTo(hr, ey - 1); }, lw * 1.2); }
  if (P.glasses === "suorakulmaiset") line(() => { for (const sx of [-1, 1]) c.rect(sx * ex - erx - .5, ey - 3.5, erx * 2 + 1, 7); c.moveTo(-ex - erx, ey - 1); c.lineTo(-hr, ey - 2); c.moveTo(ex + erx, ey - 1); c.lineTo(hr, ey - 2); }, lw * 1.1, "#5c5c64");
  // korvakorut
  if (P.earrings) for (const sx of [-1, 1]) line(ell(sx * (hr - .5), hy + 4, 1.2, 1.6), lw * 1.2, "#e8b81c");
  // viikset ja suu
  const my = hy + 9.4;
  if (P.stache) both(P.hairC, () => { c.moveTo(-6, my - .2); c.quadraticCurveTo(-5, my - 4.6, 0, my - 3.6); c.quadraticCurveTo(5, my - 4.6, 6, my - .2); c.quadraticCurveTo(3, my - 2.2, 0, my - 2); c.quadraticCurveTo(-3, my - 2.2, -6, my - .2); c.closePath(); });
  if (talk) both("#3c1418", ell(0, my + .8, 2.6, 2));
  else if (P.mood === "hymy") line(() => { c.moveTo(-3, my); c.quadraticCurveTo(0, my + 2.2, 3, my); });
  else if (P.mood === "huoli") line(() => { c.moveTo(-2.4, my + 1.2); c.quadraticCurveTo(0, my - .4, 2.4, my + 1.2); });
  else line(() => { c.moveTo(-2, my + .6); c.lineTo(2, my + .6); });
  if (P.female && !talk) fill("#c81c30", ell(0, my + 1, 1.3, .7));
  c.restore();
}

// Piirto peliin: x, y = jalkojen keskikohta maailman pikseleinä. Silmät räpsyvät omaan tahtiinsa,
// puhuessa suu aukeaa, kävellessä kengät vuorottelevat ja vartalo keinuu.
function spDraw(P, x, y, t, { talking = false, moving = false, dir = 1, worldH = 50 } = {}) {
  const blink = (t + P.seed * 977) % 4300 < 140, talk = talking && Math.floor(t / 120) % 2 === 1, step = moving ? Math.floor(t / 130) % 4 : 0;
  const img = spSprite(P, { worldH, blink, talk, step }), bob = moving && step % 2 ? -.5 : 0;
  shadow(x, y, worldH / 6);
  g.save(); g.imageSmoothingEnabled = false; g.translate(Math.round(x), Math.round(y) + bob); if (dir < 0) g.scale(-1, 1);
  g.drawImage(img, -img.footX / PXS, -img.footY / PXS, img.width / PXS, img.height / PXS); g.restore();
}
