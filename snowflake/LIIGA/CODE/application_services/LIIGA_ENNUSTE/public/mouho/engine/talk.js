// Mouhon salaisuus -- Moottori: ääni, puhekuplat, skriptit, valinnat ja oivalluspisteet.
"use strict";
// ---------------------------------------------------------------- ääni
let actx = null;
function beep(freq, ms = 220, type = "square", vol = 0.06) { try { actx ??= new AudioContext(); const o = actx.createOscillator(), v = actx.createGain();
  o.type = type; o.frequency.value = freq; v.gain.value = vol; v.gain.setTargetAtTime(0, actx.currentTime + ms / 1000 * .6, .05); o.connect(v).connect(actx.destination); o.start(); o.stop(actx.currentTime + ms / 1000); } catch { /* ei ääntä */ } }

// ---------------------------------------------------------------- puhe ja skriptit
// Puhuja: GAME.playerId (pelaaja), ruudun hahmon id (esim. "kauppias") tai "muu" (kertoja).
// Puhekuplat (16.10.): hahmojen repliikit sarjakuvakuplina, häntä puhujan päähän;
// kertoja ("muu") tekstilaatikkona ruudun yläreunassa.
function say(text, who = GAME.playerId) {
  return new Promise((res) => {
    const npc = room()?.actors?.find((a) => a.id === who);
    const spk = callSpk?.[who] ?? (who === GAME.playerId ? { x: st.x + camOff(), y: st.y - 50 * depth(st.y), c: "#c8a460" } : npc ? { x: npc.x + camOff(), y: npc.y - (npc.h ?? 44) * depth(npc.y), c: npc.color } : null);
    const el = document.createElement("div");
    const outside = who === GAME.playerId && OUT.on;      // ulkona: kupla sivun koordinaatteihin pelaajan pään yläpuolelle
    if (outside) { const k = cv.getBoundingClientRect().width / W; el.className = "bubble";
      Object.assign(el.style, { position: "fixed", zIndex: 41, left: OUT.x + "px", bottom: (innerHeight - OUT.y + 52 * k * OUT.sc) + "px", maxWidth: "min(44vw, 420px)", fontSize: "clamp(14px, 2vw, 22px)" }); el.style.setProperty("--c", "#c8a460"); }
    else if (!spk) el.className = "caption";
    else {
      // Kupla mitataan ja pidetään kokonaan ruudussa; häntä osoittaa silti puhujaan.
      el.className = "bubble"; el.style.left = (100 * spk.x / W) + "%"; el.style.bottom = (100 - 100 * (spk.y - 4) / H) + "%"; el.style.setProperty("--c", spk.c);
      requestAnimationFrame(() => { const stageW = $say.getBoundingClientRect().width, half = el.offsetWidth / 2 / stageW * W;
        const cx = Math.min(Math.max(spk.x, half + 2), W - half - 2), maxTail = Math.max(0, el.offsetWidth / 2 - 16);
        el.style.left = (100 * cx / W) + "%"; el.style.setProperty("--tail", Math.max(-maxTail, Math.min(maxTail, (spk.x - cx) / W * stageW)) + "px"); });
    }
    el.textContent = text; if (outside) { $say.replaceChildren(); document.body.append(el);
      requestAnimationFrame(() => { const hw = el.offsetWidth / 2, cx = Math.min(Math.max(OUT.x, hw + 8), innerWidth - hw - 8); el.style.left = cx + "px"; el.style.setProperty("--tail", Math.max(-hw + 16, Math.min(hw - 16, OUT.x - cx)) + "px"); });
    } else $say.replaceChildren(el); speaking = who; logLine(`${who === "muu" ? "[kertoja]" : who}: ${text}`);
    const done = () => { clearTimeout(tm); skip = null; speaking = null; el.remove(); res(); };
    // Kesto pituuden mukaan (17.10. sokkotesti: ~3 s riitti vain lyhyille, tärkeitä rivejä jäi lukematta).
    const tm = setTimeout(done, TEST ? 700 + text.length * 22 : 2200 + text.length * 70); skip = done;
  });
}
// Klikkaus repliikkien välissä (busy, ei kuplaa) talletetaan ja toteutetaan heti skriptin
// päätyttyä, jos se on tuore (sokkotesti 2: "ensimmäinen klikkaus puheen jälkeen katoaa").
let pendingClick = null;
async function script(fn) { busy = true; $game.classList.add("cut"); for (const b of $verbs.children) b.classList.remove("def"); try { await fn(); } finally { busy = false; $game.classList.remove("cut"); setSentence();
  const p = pendingClick; pendingClick = null; if (p && performance.now() - p.t < 900 && !overlay) click(p.e, p.right); } }
// Keskustelu Fate of Atlantiksen tapaan: vaihtoehdot verbien paikalla, jo kysytyt
// himmeinä, valittu repliikki pelaajan suuhun.
const asked = new Set();
function choose(options) {
  return new Promise((res) => {
    logLine("? " + options.map((o, i) => `[${i + 1}] ${o}`).join("  ")); const shown = performance.now(); $game.classList.add("talking"); $dlg.replaceChildren(...options.map((o, i) => { const b = document.createElement("button"); b.textContent = o; if (asked.has(o)) b.className = "asked";
      // stopPropagation: muuten sama klikkaus kuplii dokumenttiin ja ohittaa heti pelaajan repliikin.
      b.onclick = (e) => { e.stopPropagation(); if (performance.now() - shown < 350) return; asked.add(o); $game.classList.remove("talking"); res(i); }; return b; }));   // 350 ms: repliikin ohitusklikkaus ei valitse (sokkotesti 3)
  });
}

// Oivalluspisteet (Fate of Atlantiksen "Indy Quotient"), kukin kerran; nimi ja maksimi GAME:ssa.
function iq(key, n) { st.iq ??= {}; if (st.iq[key]) return; st.iq[key] = n; renderIq(); }
const iqTotal = () => Object.values(st.iq ?? {}).reduce((a, b) => a + b, 0);
function renderIq() { const el = document.getElementById("iq"); if (el) el.textContent = `${GAME.iqLabel} ${iqTotal()} / ${GAME.iqMax}`; }
function go(scene, x, keep, y) { if (typeof OUT !== "undefined") OUT.on = false; if (stripOf(scene) !== stripOf(st.scene)) CAM.snap = true; if (st.scene !== scene) logLine(`== ${ROOMS[scene]?.title ?? scene}`); st.scene = scene; const r0 = ROOMS[scene]; place(x, y ?? r0?.start ?? 126); if (r0?.enter) r0.enter(); if (!keep) setSentence(); }
