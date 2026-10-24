// =============================================================================
// MOUHO-MOOTTORI -- pieni SCUMM-henkinen point-and-click-moottori selaimeen.
//
// Oma toteutus (SCUMM ja sen työkalut ovat LucasArtsin/Disneyn omaisuutta);
// periaatteet Video Game History Foundationin julkisesta Monkey Island -aineistosta:
//   * kävelyalueet (walk boxes) monikulmioina + A*-reitinhaku ruudukossa
//   * syvyystasot (z-planes): hahmot ja esineet piirretään jalkojen y:n mukaan
//   * hahmot (actors) puku- eli costume-funktiolla, kävely 4 suuntaan, puheanimaatio
//   * verbit, tavarakuvakkeet, oletustoiminto oikealla painikkeella
//   * skriptit async-funktioina: say / walkTo / choose / cutscene
//
// Sisältö (ruudut, esineet, tarina) on game.js:ssä, grafiikka art.js:ssä.
// =============================================================================
"use strict";
const W = 320, H = 136;
// Pelikohtaiset asetukset: sisältö (config.js) täyttää nämä ennen startEngineä.
// Moottori ei tunne yhtään hahmoa, ruutua eikä repliikkiä itse.
const GAME = {
  player: (x, y, dir, frame, st, sc) => { r(x - 4, y - 24 * sc, 8, 24 * sc, "#c8c8c8"); },   // pelattavan hahmon piirto
  playerId: "pelaaja", saveKey: "peli-save", endFormId: "",          // puhujatunnus, tallennusavain, loppulomakkeen id (testirajapinta)
  iqLabel: "IQ", iqMax: 0,
  text: { cannot: "Ei, se ei toimi noin.", generic: {}, unknown: "Hmm.", outside: { kaikki: ["..."] }, back: "" },
};
const cv = document.getElementById("c"), main = cv.getContext("2d");
// Tuplatarkkuus (17.10.): maailma on yhä 320 x 136 (kentät, pulmat, kävelyalueet), mutta kangas
// on 640 x 272. Taustat skaalautuvat terävinä 2x, hahmojen päät piirretään puoleen kokoon
// omalla tarkkuudellaan (faces.js) -- tarkat hahmot vanhan maailman päällä.
const PXS = cv.width / 320; main.setTransform(PXS, 0, 0, PXS, 0, 0); main.imageSmoothingEnabled = false;
let g = main;                         // piirtokohde: pääcanvas tai taustan välimuisti
const $say = document.getElementById("say"), $sent = document.getElementById("sentence");
const $verbs = document.getElementById("verbs"), $inv = document.getElementById("inv"), $dlg = document.getElementById("dialog");
const $game = document.getElementById("game");

// ---------------------------------------------------------------- tila
// st = pelaajahahmo + pelin muisti. Tallennetaan sellaisenaan.
const st = { scene: "koti", x: 60, y: 126, dir: 1, frame: 0, path: [], hat: false, whip: false, inv: [], flags: {} };
const ROOMS = {}, ITEMS = {};
// Sisällön rekisteröinti: huone tunnuksella (ruudun määrittely: title, scale, walk, actors, props, spots, draw ...).
const defineRoom = (id, def) => (ROOMS[id] = def);
const VERBS = ["Anna", "Poimi", "Käytä", "Avaa", "Katso", "Työnnä", "Sulje", "Puhu", "Vedä"];
let verb = "Kävele", first = null, busy = false, onArrive = null, overlay = null, speaking = null, skip = null;
let callSpk = null;   // puhelun aikana: puhujien kuplien kohdat paneeleissa (call.js)
// Testitila ?testi (17.10., sokkotestien sykli): puhe, tauot ja kävely nopeampia, ja jokainen
// repliikki, valinta, esine ja ruutu kirjautuu pelin alle tekstilokiin (#loki), josta testaaja
// lukee ne ilman kuvakaappausta jokaisesta kuplasta.
const TEST = new URLSearchParams(location.search).has("testi");
function logLine(s) { if (!TEST) return; let el = document.getElementById("loki");
  if (!el) { el = document.createElement("pre"); el.id = "loki"; el.style.cssText = "max-height:14em;overflow:auto;white-space:pre-wrap;font:13px/1.25 monospace;color:#c8c8d8;background:#0c0c14;padding:6px;margin:6px 0 0";
    $game.after(el); }
  el.textContent += s + "\n"; el.scrollTop = el.scrollHeight; }
const sleep = (ms) => new Promise((res) => setTimeout(res, TEST ? ms * 0.35 : ms));
const has = (k) => st.inv.includes(k);
// Uusi esine välähtää tavaroissa ja soi (17.10.: "siirtyy inventaariin ilman että tajusin").
let newItem = null;
function give(k) { if (!has(k)) { st.inv.push(k); logLine(`+ tavaroihin: ${ITEMS[k].name}`); newItem = k; [659, 880].forEach((f, n) => setTimeout(() => beep(f, 120, "triangle", .05), n * 110)); setTimeout(() => { newItem = null; renderInv(); }, 2600); } renderInv(); }
function take(k) { st.inv = st.inv.filter((x) => x !== k); if (first === k) first = null; renderInv(); }
const room = () => ROOMS[st.scene];

// ---------------------------------------------------------------- tallennus
const SAVE = () => GAME.saveKey;
function saveGame() { if (busy || overlay || !room()) return say("Ei nyt, kesken kaiken.", "muu"); try { localStorage.setItem(SAVE(), JSON.stringify({ ...st, path: [] })); } catch { /* yksityinen ikkuna */ } return script(() => say("Peli tallennettu.", "muu")); }
function loadGame() { let d = null; try { d = JSON.parse(localStorage.getItem(SAVE()) ?? "null"); } catch { /* ei tallennusta */ } if (!d) return say("Tallennusta ei löydy.", "muu");
  Object.assign(st, d, { path: [] }); title = false; overlay = null; renderVerbs(); renderInv(); renderIq(); setSentence(); }

// ---------------------------------------------------------------- silmukka
let last = performance.now(), title = true, drawTitleFn = null;
function frame(t) {
  const dt = Math.min(t - last, 50) / 1000; last = t;
  if (title) { drawTitleFn?.(t); return requestAnimationFrame(frame); }
  if (overlay) { overlay(t); return requestAnimationFrame(frame); }
  camStep(dt);
  const s = room(), co = Math.round(camOff()), strip = stripOf(st.scene);
  if (strip) strip.forEach((id, i) => { const ox = i * W - CAM.x; if (id !== st.scene && ox > -W && ox < W) roomAt(id, ox, t); });
  g.save(); g.translate(co, 0);
  if (co) { g.save(); g.beginPath(); g.rect(0, 0, W, H); g.clip(); s.draw(t); g.restore(); } else s.draw(t);   // vain tausta rajataan: hahmot saavat ylittää sauman
  // liike reittiä pitkin
  let moving = false, dx = 0, dy = 0;
  if (st.path.length) { const [tx, ty] = st.path[0]; dx = tx - st.x; dy = ty - st.y; const d = Math.hypot(dx, dy * 1.5), sp = (st.flags.boulder != null ? 110 : 62) * (TEST ? 2 : 1) * depth(st.y) * dt;
    if (d <= sp) { st.x = tx; st.y = ty; st.path.shift(); } else { st.x += dx * sp / d; st.y += dy * sp / d; }
    moving = true; if (Math.abs(dx) > 0.5) st.dir = Math.sign(dx); st.frame = Math.floor(t / 120); }
  else { if (st.frame !== 0 && !busy) s.onStop?.(st.x, st.y);     // pysähtyi juuri (lattiapiano)
    st.frame = 0; if (onArrive) { const f = onArrive; onArrive = null; f(); } }
  const away = moving && dy < 0 && Math.abs(dy) * 1.5 > Math.abs(dx);
  // Syvyysjärjestys: esineet, ruudun hahmot ja pelaaja jalkojen y:n mukaan.
  const items = [...(s.props ?? []).map((p) => ({ y: p.y, draw: () => p.draw(t) })), ...(s.actors ?? []).filter((a) => !a.hidden?.()).map((a) => ({ y: a.y, draw: () => { const sc = depth(a.y); g.save(); g.translate(a.x, a.y); g.scale(sc, sc); g.translate(-a.x, -a.y); a.draw(t, speaking === a.id); g.restore(); } })),
    { y: st.y, draw: () => { if (OUT.on) return; const sc = depth(st.y); const hop = st.hop && t - st.hop < 260 ? Math.sin((t - st.hop) / 260 * Math.PI) * 4 * sc : 0; shadow(st.x, st.y, 7 * sc); GAME.player(st.x, st.y - hop, st.dir, st.frame, st, sc, away); } }];
  items.sort((a, b) => a.y - b.y).forEach((i) => i.draw());
  if (s.post) s.post(t);
  g.restore();
  outFrame(t, dt);
  g.fillStyle = "rgba(0,0,0,.55)"; g.fillRect(0, 0, g.measureText(s.title).width + 8, 11); g.fillStyle = "#a8a8a8"; g.font = "10px VT323, monospace"; g.fillText(s.title, 4, 8);
  requestAnimationFrame(frame);
}
// ---------------------------------------------------------------- vierivät ruuturivit (24.10.)
// Käyttäjä: "kun Jussi on reunalla, taksi olisi poistunut oikealta ja vasen parkkipaikka jo
// osittain näkyvissä". defineStrip(["parkki", "koti"]) asettaa ruudut vierekkäin samaan
// koordinaatistoon; kamera seuraa pelaajaa ja naapuriruutu hahmoineen piirtyy näkyviin.
const STRIPS = [], CAM = { x: 0, snap: true }, CAM_M = 150;      // pelaaja pysyy vähintään CAM_M px kuvan reunasta
const defineStrip = (ids) => STRIPS.push(ids);
const stripOf = (id) => STRIPS.find((s) => s.includes(id));
const camOff = () => { const s = stripOf(st.scene); return s ? s.indexOf(st.scene) * W - CAM.x : 0; };     // ruudun x -> kuvan x
function camStep(dt) {
  const s = stripOf(st.scene); if (!s) { CAM.snap = true; return; }
  const jx = s.indexOf(st.scene) * W + st.x, max = (s.length - 1) * W;
  const want = Math.max(0, Math.min(max, Math.max(jx - (W - CAM_M), Math.min(CAM.x, jx - CAM_M))));
  CAM.x = CAM.snap ? want : CAM.x + (want - CAM.x) * Math.min(1, dt * 5); CAM.snap = false;
}
function roomAt(id, ox, t) {            // naapuriruutu ilman pelaajaa kohtaan ox (huoneiden piirto lukee st:tä)
  const s = ROOMS[id], keep = [st.scene, st.x, st.y]; st.scene = id; st.x = -999; st.y = s.start ?? 126;
  g.save(); g.beginPath(); g.rect(Math.round(ox), 0, W, H); g.clip(); g.translate(Math.round(ox), 0); s.draw(t);
  [...(s.props ?? []).map((p) => ({ y: p.y, draw: () => p.draw(t) })), ...(s.actors ?? []).filter((a) => !a.hidden?.()).map((a) => ({ y: a.y, draw: () => {
    const sc = depth(a.y); g.save(); g.translate(a.x, a.y); g.scale(sc, sc); g.translate(-a.x, -a.y); a.draw(t, false); g.restore(); } }))].sort((a, b) => a.y - b.y).forEach((i) => i.draw());
  g.restore(); [st.scene, st.x, st.y] = keep;
}
// Rivin naapuriruutuun: kävely reunaan, ruudun vaihto samassa kohdassa (kamera ei hyppää) ja eteenpäin.
function crossTo(id, x, y) {
  return script(async () => {
    const s = stripOf(st.scene), dir = s.indexOf(id) < s.indexOf(st.scene) ? -1 : 1;
    await walkTo(dir < 0 ? 1 : W - 1, st.y); go(id, dir < 0 ? W - 1 : 1, true, st.y); await walkTo(x, y);
  });
}
function startEngine({ titleScreen, intro, startRoom, startX, hint }) {
  drawTitleFn = titleScreen;
  cv.addEventListener("click", async function start(e) {
    if (!title) return; title = false; cv.removeEventListener("click", start, { capture: true });
    e.stopImmediatePropagation();          // muuten sama klikkaus ohittaa ensimmäisen repliikin
    go(startRoom, startX, true); renderVerbs(); renderInv(); renderIq(); setSentence();
    await script(intro);
  }, { capture: true });
  // stopPropagation: muuten sama klikkaus ohittaa heti "Peli tallennettu" -ilmoituksen (sokkotesti).
  document.getElementById("save")?.addEventListener("click", (e) => { e.stopPropagation(); saveGame(); });
  document.getElementById("hint")?.addEventListener("click", (e) => { e.stopPropagation(); idleAt = performance.now(); hint?.(); });   // ei kupli: muuten sama klikkaus ohittaisi vihjeen
  // Toimettomuus: minuutin hiljaisuuden jälkeen pelaaja miettii ääneen seuraavaa askelta.
  let idleAt = performance.now();
  for (const ev of ["click", "contextmenu", "keydown"]) document.addEventListener(ev, () => { idleAt = performance.now(); }, true);
  setInterval(() => { if (!TEST && !title && !busy && !overlay && room() && performance.now() - idleAt > 60000) { idleAt = performance.now(); hint?.(); } }, 5000);
  document.getElementById("load")?.addEventListener("click", (e) => { e.stopPropagation(); loadGame(); });
  requestAnimationFrame(frame);
}
