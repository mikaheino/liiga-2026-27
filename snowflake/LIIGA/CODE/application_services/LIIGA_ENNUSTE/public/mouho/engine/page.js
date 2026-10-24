// Mouhon salaisuus -- Moottori: koko sivu on kenttää -- pelaaja voi kävellä kuvan ulkopuolelle.
"use strict";
// ---------------------------------------------------------------- koko sivu on kenttää (23.10.)
// Käyttäjän idea: koko selainikkuna on ollut koko ajan pelattavaa kenttää. Pelin ympärillä olevaa
// mustaa aluetta klikatessa pelaaja kävelee kuvan reunalle ja siitä ulos sivulle, pysyy samankokoisena
// ja kommentoi, että nyt ollaan väärässä paikassa. Kankaan klikkaus tuo hänet takaisin samasta kohdasta.
const OUT = { on: false, x: 0, y: 0, tx: 0, ty: 0, sc: 1, exit: null, walk: null, n: 0 };
const $out = document.createElement("canvas"); $out.id = "ulko";
$out.style.cssText = "position:fixed;inset:0;width:100vw;height:100vh;pointer-events:none;z-index:40;image-rendering:pixelated";
document.body.append($out);
const pageOf = (x, y) => { const R = cv.getBoundingClientRect(); return [R.left + (x + camOff()) / W * R.width, R.top + y / H * R.height]; };
function outFrame(t, dt) {
  const dpr = devicePixelRatio || 1, w = Math.round(innerWidth * dpr), h = Math.round(innerHeight * dpr);
  if ($out.width !== w || $out.height !== h) { $out.width = w; $out.height = h; }
  const o = $out.getContext("2d"); o.clearRect(0, 0, w, h); if (!OUT.on) return;
  const k = cv.getBoundingClientRect().width / W, d = Math.hypot(OUT.tx - OUT.x, OUT.ty - OUT.y), sp = 62 * k * OUT.sc * (TEST ? 3 : 1) * dt;
  let moving = false;
  if (d > sp) { OUT.x += (OUT.tx - OUT.x) * sp / d; OUT.y += (OUT.ty - OUT.y) * sp / d; moving = true; if (Math.abs(OUT.tx - OUT.x) > 1) st.dir = Math.sign(OUT.tx - OUT.x); }
  else { OUT.x = OUT.tx; OUT.y = OUT.ty; if (OUT.walk) { const f = OUT.walk; OUT.walk = null; f(); } }
  const prev = g; g = o; g.imageSmoothingEnabled = false; g.setTransform(k * dpr, 0, 0, k * dpr, OUT.x * dpr, OUT.y * dpr);
  shadow(0, 0, 7 * OUT.sc); GAME.player(0, 0, st.dir, moving ? Math.floor(t / 120) : 0, st, OUT.sc); g.setTransform(1, 0, 0, 1, 0, 0); g = prev;
}
const outWalk = (x, y) => new Promise((res) => { OUT.tx = x; OUT.ty = y; OUT.walk = res; });
function outLine(px, py) {
  const R = cv.getBoundingClientRect(), side = px < R.left ? "vasen" : px > R.right ? "oikea" : py < R.top ? "ylla" : "alla";
  const O = GAME.text.outside, pool = [...(O[side] ?? []), ...(O.kaikki ?? [])];
  return pool[OUT.n++ % pool.length].replace("{ruutu}", room().title.split(",")[0]);
}
// Musta alue = sivun tausta ja pelin tyhjät laatikot, ei napit, tavarat eikä kangas.
const blackTarget = (el) => el === document.documentElement || el === document.body || ["game", "sentence", "ui", "verbs"].includes(el.id) || el.classList?.contains("hint");
document.addEventListener("click", (e) => {
  if (skip || busy || overlay || title || !room() || !blackTarget(e.target)) return;
  const px = e.clientX, py = e.clientY, R0 = cv.getBoundingClientRect();
  // Ruudun reunasiirtymä (24.10.): huoneen edges.vasen/oikea vie seuraavaan ruutuun ulkona kävelyn sijaan.
  const edge = room().edges?.[px < R0.left ? "vasen" : px > R0.right ? "oikea" : ""];
  if (edge) { if (OUT.on) { OUT.on = false; place(...OUT.exit); } return edge(); }     // myös ulkona seistessä
  script(async () => {
    if (!OUT.on) {                                  // ensin kuvan reunalle kohti klikkausta, sitten ulos
      const R = cv.getBoundingClientRect(), wx = Math.max(1, Math.min(W - 1, (px - R.left) / R.width * W - camOff())), wy = Math.max(1, Math.min(H - 1, (py - R.top) / R.height * H));
      await walkTo(wx, wy); OUT.exit = [st.x, st.y]; OUT.sc = depth(st.y); [OUT.x, OUT.y] = pageOf(st.x, st.y); [OUT.tx, OUT.ty] = [OUT.x, OUT.y]; OUT.on = true;
      if (!st.flags.outFirst) { st.flags.outFirst = true; iq("ulkona", 2); }
    }
    await outWalk(px, py); await say(outLine(px, py));
  });
});
async function comeBack(e, right) {
  await script(async () => { const [ex, ey] = pageOf(...OUT.exit); await outWalk(ex, ey); OUT.on = false; place(...OUT.exit);
    if (GAME.text.back) await say(GAME.text.back); });
  click(e, right);
}
