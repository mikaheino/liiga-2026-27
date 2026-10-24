// Mouhon salaisuus -- Moottori: taustamusiikki koodina (WebAudio-sekvensseri).
"use strict";
// Backlog 9 (24.10.): ei äänitiedostoja, kuten ei kuviakaan. Teema = tempo ja raidat; raita on
// välilyönnein erotettu askeljono (kahdeksasosia): sävel "A4", "F#3", "Bb2", "-" jatkaa edellistä,
// "." tauko, "|" pelkkä erotin luettavuuteen. Rumpuraidassa k = basso, s = virveli, h = hi-hat.
// Raidat kiertävät omaa pituuttaan. GAME.roomMusic: huone -> teema; go() vaihtaa teeman.
const THEMES = {};
const defineTheme = (id, def) => (THEMES[id] = { ...def, tracks: def.tracks.map((tr) => ({ ...tr, steps: tr.notes.trim().split(/\s+/).filter((x) => x !== "|") })) });
const MUS = { id: null, step: 0, next: 0, out: null, timer: null, muted: false };
try { MUS.muted = localStorage.getItem("musiikki") === "pois"; } catch { /* yksityinen ikkuna */ }
const SEMI = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
const hz = (n) => { const m = /^([A-G])([#b]?)(\d)$/.exec(n); return m ? 440 * 2 ** ((SEMI[m[1]] + (m[2] === "#" ? 1 : m[2] === "b" ? -1 : 0) - 9) / 12 + (+m[3] - 4)) : 0; };
let noiseBuf = null;
const musVol = () => (MUS.muted ? 0 : GAME.musicVolume ?? .5);
function musOut() { if (MUS.out) return MUS.out; actx ??= new AudioContext(); MUS.out = actx.createGain(); MUS.out.gain.value = musVol(); MUS.out.connect(actx.destination); return MUS.out; }
function tone(f, t, dur, wave, vol) {
  const o = actx.createOscillator(), v = actx.createGain(); o.type = wave; o.frequency.value = f;
  v.gain.setValueAtTime(0, t); v.gain.linearRampToValueAtTime(vol, t + .01); v.gain.setTargetAtTime(vol * .6, t + .02, .08); v.gain.setTargetAtTime(0, t + Math.max(.03, dur - .03), .03);
  o.connect(v).connect(MUS.out); o.start(t); o.stop(t + dur + .2);
}
function drum(kind, t, vol) {
  if (kind === "k") { const o = actx.createOscillator(), v = actx.createGain(); o.frequency.setValueAtTime(130, t); o.frequency.exponentialRampToValueAtTime(40, t + .12);
    v.gain.setValueAtTime(vol, t); v.gain.exponentialRampToValueAtTime(.001, t + .18); o.connect(v).connect(MUS.out); o.start(t); o.stop(t + .2); return; }
  if (!noiseBuf) { noiseBuf = actx.createBuffer(1, actx.sampleRate * .3, actx.sampleRate); const d = noiseBuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1; }
  const s = actx.createBufferSource(), f = actx.createBiquadFilter(), v = actx.createGain(), snare = kind === "s", len = snare ? .14 : .04;
  s.buffer = noiseBuf; f.type = snare ? "bandpass" : "highpass"; f.frequency.value = snare ? 1800 : 7000;
  v.gain.setValueAtTime(vol * (snare ? .8 : .35), t); v.gain.exponentialRampToValueAtTime(.001, t + len); s.connect(f).connect(v).connect(MUS.out); s.start(t); s.stop(t + len + .02);
}
function musTick() {
  const T = THEMES[MUS.id]; if (!T || !actx) return; const sd = 30 / T.bpm;
  if (MUS.next < actx.currentTime - .5) MUS.next = actx.currentTime + .05;          // välilehti oli taustalla: ei kasattuja nuotteja
  while (MUS.next < actx.currentTime + .2) {
    for (const tr of T.tracks) { const n = tr.steps[MUS.step % tr.steps.length]; if (n === "-" || n === ".") continue;
      if (tr.drums) { for (const ch of n) drum(ch, MUS.next, tr.vol); continue; }
      let len = 1; while (len < tr.steps.length && tr.steps[(MUS.step + len) % tr.steps.length] === "-") len++;
      tone(hz(n), MUS.next, len * sd, tr.wave ?? "square", tr.vol); }
    MUS.next += sd; MUS.step++;
  }
}
// Teeman vaihto (undefined = pidä nykyinen, null = hiljaisuus). Testitilassa (?testi) aina hiljaa.
function music(id) {
  if (TEST || id === undefined || id === MUS.id) return;
  try { musOut(); } catch { return; }
  MUS.id = id; MUS.step = 0; MUS.next = actx.currentTime + .1; clearInterval(MUS.timer);
  if (id) MUS.timer = setInterval(musTick, 50);
}
function toggleMusic() {
  MUS.muted = !MUS.muted; try { localStorage.setItem("musiikki", MUS.muted ? "pois" : "päällä"); } catch { /* */ }
  if (MUS.out) MUS.out.gain.setTargetAtTime(musVol(), actx.currentTime, .1);
  return MUS.muted;
}
{ const b = document.getElementById("musiikki");
  const label = () => { if (b) b.textContent = MUS.muted ? "Musiikki: pois" : "Musiikki"; };
  b?.addEventListener("click", (e) => { e.stopPropagation(); toggleMusic(); label(); }); label(); }
