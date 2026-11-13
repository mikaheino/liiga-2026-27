// Kysymys -> skenaariorivit koodilla ennen Qwenia (13.11.2026). Qwen 3B osui 6/8, vei ~7 s CPU:lla ja
// keksi joukkueita, vastustajia ja kenttiä, vaikka useimmat oikeat kysymykset noudattavat muutamaa
// kiinteää kaavaa. Tämä jäsentää ne tarkasti ja heti, samoin paikallisesti ja Snowflakessa.
// Tarkkuus ennen kattavuutta: jokainen sana pitää tunnistaa; yksikin tuntematon sana, kielto,
// pronomini tai kaksiselitteinen rakenne -> null, ja kysymys menee Qwenille / agentille kuten ennen.
// Rivit ovat samaa muotoa kuin Qwenin (lib/qwen.ts SYS). Puuttuvat kestot täyttää normalize()
// (lib/scenarioRules.ts), joten oletuksia ei toisteta täällä; 99 = loppukausi.
// Ei importteja: ajetaan myös pelkällä Nodella (tests/scenarioParse.test.ts).

export type Row = Record<string, unknown>;
export type PlayerLite = { name: string; team: string };

// Joukkueen nimen vartalot; taivutuspääte perään (Tapparalle, Ilveksen, Kärppien, HIFK:ta).
const STEMS: Record<string, string[]> = {
  HIFK: ["hifk"], HPK: ["hpk"], JYP: ["jyp"], TPS: ["tps"], "K-Espoo": ["k-espoo"],
  Ilves: ["ilves", "ilvekse"], Lukko: ["lukko", "luko"], Jokerit: ["jokerit", "jokere", "jokeri"],
  Jukurit: ["jukurit", "jukure", "jukuri"], "Kärpät": ["kärpät", "kärpp", "kärpi"], "Ässät": ["ässät", "ässi"],
  Pelicans: ["pelicans"], KalPa: ["kalpa"], SaiPa: ["saipa"], KooKoo: ["kookoo"], Sport: ["sport"], Tappara: ["tappara"],
};
const ABBR = new Set(["HIFK", "HPK", "JYP", "TPS"]);

const NUM: Record<string, number> = {};
([
  [1, "yksi yhden yhdestä yhdeksi"], [2, "kaksi kahden kahdesta kahdeksi kahta pari parin pariksi"],
  [3, "kolme kolmen kolmesta kolmeksi kolmea"], [4, "neljä neljän neljästä neljäksi neljää"],
  [5, "viisi viiden viidestä viideksi viittä"], [6, "kuusi kuuden kuudesta kuudeksi kuutta"],
  [7, "seitsemän seitsemästä seitsemäksi seitsemää"], [8, "kahdeksan kahdeksasta kahdeksaksi kahdeksaa"],
  [9, "yhdeksän yhdeksästä yhdeksäksi yhdeksää"], [10, "kymmenen kymmenestä kymmeneksi kymmentä"],
] as [number, string][]).forEach(([n, ws]) => ws.split(" ").forEach((w) => (NUM[w] = n)));

// Monisanaiset ilmaukset yhdeksi merkiksi ennen sanojen luokittelua (järjestys merkitsee). Rajat
// kirjaimista \p{L}:llä, koska JS:n \b ei tunne ä:tä ja ö:tä.
const P = (src: string): RegExp => new RegExp(`(?<![\\p{L}#§])(?:${src})(?![\\p{L}])`, "gu");
const PHRASES: [RegExp, string][] = [
  [P("ei pelaa (enää )?(tällä kaudella|loppukautta|loppukaudella)|ei pelaa enää"), "#inj #loppu"],
  [P("(mitä|entä|mitäs) (tapahtuu |käy )?jos"), ""],
  [P("mitä se (tarkoittaa|merkitsee)"), ""],
  [P("(ratkeaa|ratkeavat) varsinaisella (peli)?ajalla"), "#v_reg"],
  [P("varsinaisella (peli)?ajalla|ilman jatkoaikaa"), "#reg"],
  [P("(menee|menevät|menisi|päättyy|päättyvät|venyy|venyvät) jatkoajalle"), "#v_ot"],
  [P("jatkoajalla"), "#jatko"],
  [P("(saa|saavat|ottaa|ottavat) (vähintään )?pisteen"), "#v_point"],
  [P("kuuden joukko(on|ssa)"), "#top6"],
  [P("(voittaa|voittaako|voittavat) (runkosarjan|mestaruuden)|runkosarjan voit(to|toon)"), "#win_goal"],
  [P("(jää|jäävät) (sivuun|pois)|on (sivussa|poissa)"), "#inj"],
  [P("(koko )?loppukau(den|deksi|della|si)"), "#loppu"],
  [P("tällä kaudella"), ""],
];

type Tok =
  | { k: "team"; team: string; suf: string } | { k: "player"; name: string } | { k: "and" } | { k: "num"; n: number }
  | { k: "next"; one: boolean | null } | { k: "all"; kaikki: boolean } | { k: "noun"; venue?: string; unit: boolean }
  | { k: "venue"; venue: string } | { k: "verb"; res: string } | { k: "mod"; mod: "reg" | "ot" } | { k: "vs" }
  | { k: "inj" } | { k: "dur"; per: number } | { k: "goal"; goal: string } | { k: "q" } | { k: "stakes" } | { k: "stop" };

const WIN = new Set(["voittaa", "voittavat", "voittaisi", "voittaisivat"]);
const LOSS = new Set(["häviää", "häviävät", "häviäisi", "häviäisivät", "hävii"]);
const STOP = new Set(["jos", "entä", "että", "kumpikin", "molemmat", "myös", "lisäksi", "vielä", "keskinäisessä",
  "keskinäisen", "keskinäinen", "ajaksi", "mitkä", "mikä", "ovat", "mitä"]);
const QUESTION = new Set(["pääseekö", "pääsee", "pääsevät", "pääsylle", "pääsyyn", "pääsy", "välttääkö", "välttää",
  "pysyykö", "pysyy", "voittaako", "vaaditaan", "vaatii", "tarvitaan", "tarvitsee", "tarvitseeko", "putoaako"]);
const SINGLE_NEXT = new Set(["seuraava", "seuraavan", "seuraavassa", "seuraavalla"]);

function teamTok(w: string, teams: string[]): Tok | null {
  for (const t of teams) {
    for (const s of STEMS[t] ?? [t.toLowerCase()]) {
      if (!w.startsWith(s)) continue;
      const rest = w.slice(s.length);
      if (ABBR.has(t) ? /^(:[a-zåäö]{1,4})?$/.test(rest) : /^:?[a-zåäö]{0,5}$/.test(rest)) return { k: "team", team: t, suf: rest };
    }
  }
  return null;
}

function classify(w: string, teams: string[]): Tok | null {
  if (w === "," || w === "ja" || w === "sekä") return { k: "and" };
  if (w === "§p") return null;                                   // pelaaja käsitellään erikseen
  const team = teamTok(w, teams);
  if (team) return team;
  if (/^\d{1,2}$/.test(w)) return Number(w) >= 1 && Number(w) <= 60 ? { k: "num", n: Number(w) } : null;
  if (NUM[w]) return { k: "num", n: NUM[w] };
  if (/^seuraav/.test(w)) return { k: "next", one: SINGLE_NEXT.has(w) ? true : /^seuraav(at|aa|asta|ista|issa)$/.test(w) ? false : null };
  if (w === "kaikki" || w === "kaikissa" || w === "jokaisen") return { k: "all", kaikki: true };
  if (w === "loput" || w === "#loppu") return { k: "all", kaikki: false };
  const noun = /^(koti|vieras)?(ottelu|peli|pele|matsi|matse)([a-zåäö]{0,6})$/.exec(w);
  if (noun) return { k: "noun", venue: noun[1] === "koti" ? "home" : noun[1] ? "away" : undefined, unit: /ksi$/.test(w) || /^(ottelua|peliä|ottelun)$/.test(w) };
  if (/^(kotona|kotikentällä|kotihallissa)$/.test(w)) return { k: "venue", venue: "home" };
  if (/^(vieraissa|vieraskentällä|vieraalla)$/.test(w)) return { k: "venue", venue: "away" };
  if (WIN.has(w)) return { k: "verb", res: "win" };
  if (LOSS.has(w)) return { k: "verb", res: "loss" };
  if (w === "#v_ot") return { k: "verb", res: "ot" };
  if (w === "#v_point") return { k: "verb", res: "point" };
  if (w === "#v_reg") return { k: "verb", res: "regulation" };
  if (w === "#reg") return { k: "mod", mod: "reg" };
  if (w === "#jatko") return { k: "mod", mod: "ot" };
  if (w === "vastaan") return { k: "vs" };
  if (w === "#inj" || /^(loukkaantuu|loukkaantuisi|loukkaantuvat|sairastuu|sairastuisi)$/.test(w)) return { k: "inj" };
  if (/^viiko(ksi|n)$/.test(w)) return { k: "dur", per: 3 };          // viikko ≈ 3 ottelua (qwen.ts: kaksi viikkoa = 6)
  if (/^kuukau(deksi|den)$/.test(w)) return { k: "dur", per: 12 };    // kuukausi ≈ 12 ottelua
  if (/^kärkikuusiko|^kärkikuusikko|^#top6$/.test(w)) return { k: "goal", goal: "top6" };
  if (/^(jatkoon|jatkopaik|pudotuspel|playoff)/.test(w)) return { k: "goal", goal: "top10" };
  if (/^(putoami|sarjapaik|sarjassa$)/.test(w)) return { k: "goal", goal: "avoid_relegation" };
  if (/^mestaruu|^#win_goal$|^runkosarjan$/.test(w)) return { k: "goal", goal: "win" };
  if (QUESTION.has(w)) return { k: "q" };
  if (/^(ratkaise|tärkeimm|tärkein$)/.test(w)) return { k: "stakes" };
  if (STOP.has(w)) return { k: "stop" };
  return null;
}

/** Pelaajat alkuperäisestä tekstistä (iso alkukirjain, sukunimen vartalo kuten playersIn): sana -> "§p".
 *  Useampi eri pelaaja samalla sanalla (monta Lehtosta) -> null. */
function markPlayers(text: string, teams: string[], players: PlayerLite[]): { text: string; names: string[] } | null {
  const words = [...text.matchAll(/[\p{L}][\p{L}\-:]*/gu)];
  const names: string[] = [];
  const at = new Set<number>(), first = new Set<number>();
  for (let i = 0; i < words.length; i++) {
    const w = words[i][0];
    if (!/^\p{Lu}/u.test(w) || classify(w.toLowerCase(), teams)) continue;
    let cand = players.filter((p) => {
      const last = p.name.split(" ").slice(-1)[0];
      const stem = last.slice(0, Math.max(4, last.length - 2));
      return last.length >= 4 && w.startsWith(stem) && w.length <= last.length + 4;
    });
    const prev = i > 0 ? words[i - 1][0].toLowerCase() : "";
    const withFirst = cand.filter((p) => p.name.split(" ")[0].toLowerCase() === prev);
    if (withFirst.length) cand = withFirst;
    const distinct = [...new Set(cand.map((p) => p.name))];
    if (distinct.length > 1) return null;
    if (distinct.length === 1) { names.push(distinct[0]); at.add(i); if (withFirst.length) first.add(i - 1); }
  }
  let out = text;
  for (const i of [...at, ...first].sort((a, b) => b - a)) {
    const m = words[i];
    out = out.slice(0, m.index) + (first.has(i) ? "" : "§P") + out.slice(m.index! + m[0].length);
  }
  return { text: out, names: [...new Set(names)] };
}

type Clause = { teams: string[]; res: string; toks: Tok[]; opp?: string };

/** Yhden lauseen (joukkueet + verbi + tarkenteet) tulosrivit; null jos jokin on epäselvää. */
function clauseRows(c: Clause, inherit?: Row): Row[] | null {
  const nums = c.toks.filter((t) => t.k === "num") as { n: number }[];
  const all = c.toks.filter((t) => t.k === "all") as { kaikki: boolean }[];
  const next = c.toks.filter((t) => t.k === "next") as { one: boolean | null }[];
  const venues = [...new Set(c.toks.map((t) => (t.k === "venue" || t.k === "noun" ? t.venue : undefined)).filter(Boolean))];
  const mods = c.toks.filter((t) => t.k === "mod") as { mod: "reg" | "ot" }[];
  const nouns = c.toks.filter((t) => t.k === "noun");
  if (nums.length > 1 || venues.length > 1 || mods.length > 1 || next.length > 1) return null;
  let res = c.res;
  if (mods.length) {
    if (res !== "win" && res !== "loss") return null;
    res = `${mods[0].mod}_${res}`;                                     // reg_win, ot_loss … (moottorin tulokset)
  }
  let games: number | undefined;
  if (all.length && nums.length) {
    // "kaikki pelit … seuraavat 4" = seuraavat 4; muu yhdistelmä on ristiriitainen.
    if (!(next.length && all.every((a) => a.kaikki))) return null;
    games = nums[0].n;
  } else if (all.length) games = 99;
  else if (nums.length) games = nums[0].n;
  else if (next.length) { if (next[0].one !== true) return null; games = 1; }
  const bare = games == null && !venues.length && !nouns.length && !mods.length && !c.opp;
  if (bare && inherit) return c.teams.map((team) => ({ team, result: res, ...inherit }));
  // Vastustaja, kenttä tai "ottelunsa" ilman määrää on epäselvä (kaikki? seuraava?) -> Qwen.
  if (games == null && !bare) return null;
  return c.teams.map((team) => ({ team, result: res, ...(games != null ? { games } : {}),
    ...(c.opp ? { opponent: c.opp } : {}), ...(venues.length ? { venue: venues[0] } : {}) }));
}

/** Kysymys -> skenaariorivit, tai null jos kysymys ei osu tuettuun kaavaan täydellä varmuudella. */
export function parseScenario(question: string, teams: string[], players: PlayerLite[]): Row[] | null {
  const q = question.trim();
  if (q.length < 3 || q.length > 200 || !/^[\p{L}\d\s,.!?:\-–]+$/u.test(q)) return null;
  const mp = markPlayers(q, teams, players);
  if (!mp || mp.names.length > 1) return null;
  let low = mp.text.toLowerCase().replace(/[.!?–]/g, " ").replace(/,/g, " , ").replace(/\s+/g, " ").trim();
  for (const [re, to] of PHRASES) low = low.replace(re, to);
  const toks: Tok[] = [];
  for (const w of low.split(" ").filter(Boolean)) {
    if (w === "§p") { toks.push({ k: "player", name: mp.names[0] }); continue; }
    const t = classify(w, teams);
    if (!t) return null;                                               // tuntematon sana -> ei arvata
    if (t.k !== "stop") toks.push(t);
  }
  const has = (k: Tok["k"]) => toks.some((t) => t.k === k);
  const teamsAll = [...new Set(toks.flatMap((t) => (t.k === "team" ? [t.team] : [])))];

  // Ratkaisevat ottelut: "Mitkä pelit ratkaisevat Pelicansin jatkopaikan?"
  if (has("stakes")) {
    const ok = toks.every((t) => ["team", "stakes", "noun", "goal", "q"].includes(t.k)) && teamsAll.length === 1;
    return ok ? [{ stakes_team: teamsAll[0] }] : null;
  }

  // Poissaolo: "Pesonen loukkaantuu kahdeksi viikoksi", "Korhonen ei pelaa enää tällä kaudella".
  if (has("player") || has("inj")) {
    if (!has("player") || !has("inj") || !toks.every((t) => ["player", "inj", "num", "dur", "all", "next", "noun"].includes(t.k))) return null;
    if (toks.filter((t) => t.k === "player" || t.k === "inj").length !== 2) return null;
    const nums = toks.filter((t) => t.k === "num") as { n: number }[];
    const durs = toks.filter((t) => t.k === "dur") as { per: number }[];
    const units = toks.filter((t) => t.k === "noun") as { unit: boolean; venue?: string }[];
    const all = has("all");
    if (nums.length > 1 || durs.length + units.length > 1 || units.some((u) => !u.unit || u.venue)) return null;
    let games: number | undefined;
    if (all) { if (nums.length || durs.length || units.length) return null; games = 99; }
    else if (durs.length) games = (nums[0]?.n ?? 1) * durs[0].per;
    else if (units.length) { if (!nums.length) return null; games = nums[0].n; }
    else if (nums.length || has("next")) return null;
    return [{ injury: mp.names[0], ...(games != null ? { games } : {}) }];
  }

  // Tulokset ja tavoitteet. Ensin vastustajat: "Ilvestä vastaan", "voittaa Lukon", "häviää Lukolle".
  const seq: (Tok | { k: "opp"; team: string })[] = [];
  let verb: string | null = null;                                      // saman lauseen verbi
  for (let i = 0; i < toks.length; i++) {
    const t = toks[i], prev = seq[seq.length - 1];
    if (t.k === "and") verb = null;
    if (t.k === "verb") verb = t.res;
    if (t.k === "vs") {
      if (prev?.k !== "team") return null;
      seq[seq.length - 1] = { k: "opp", team: prev.team };
    } else if (t.k === "team" && verb && toks[i + 1]?.k !== "vs"
      && ((verb === "win" && /n$/.test(t.suf)) || (verb === "loss" && /lle$/.test(t.suf)))) {
      seq.push({ k: "opp", team: t.team });
    } else seq.push(t);
  }
  // Lauseet: "Tappara ja Ilves häviävät …" = yksi lause; "Ässät voittaa ja HIFK häviää …" = kaksi.
  const clauses: Clause[] = [];
  let buf: typeof seq = [];
  const goalParts: (typeof seq)[] = [];
  const flush = () => {
    const vi = buf.findIndex((t) => t.k === "verb");
    const verbs = buf.filter((t) => t.k === "verb");
    const subj = buf.slice(0, vi).flatMap((t) => (t.k === "team" ? [t.team] : []));
    if (verbs.length !== 1 || !subj.length || buf.slice(vi).some((t) => t.k === "team" || t.k === "goal" || t.k === "q")) return false;
    const opps = buf.flatMap((t) => (t.k === "opp" ? [t.team] : []));
    if (opps.length > 1 || subj.some((s) => opps.includes(s))) return false;
    if (buf.slice(0, vi).some((t) => !["team", "and", "all", "noun", "next", "num"].includes(t.k))) return false;
    clauses.push({ teams: subj, res: (verbs[0] as { res: string }).res, opp: opps[0],
      toks: buf.filter((t) => !["team", "and", "verb", "opp"].includes(t.k)) as Tok[] });
    buf = [];
    return true;
  };
  // Lause päättyy "ja"/pilkkuun vasta verbin jälkeen; verbitön loppu ("…, mitä se tarkoittaa kuuden
  // joukkoon pääsylle?", "Pääseekö Ässät kärkikuusikkoon?") on tavoiteosa.
  for (const t of seq) {
    buf.push(t);
    if (t.k === "and" && buf.some((x) => x.k === "verb")) { buf.pop(); if (!flush()) return null; }
  }
  if (buf.some((x) => x.k === "verb")) { if (!flush()) return null; }
  else if (buf.length) goalParts.push(buf);
  const last = clauses[clauses.length - 1];

  // Tulosrivit; aiempi paljas lause ("Ässät voittaa ja HIFK häviää seuraavan") saa viimeisen määrän.
  const rows: Row[] = [];
  const lastRows = last ? clauseRows(last) : [];
  if (!lastRows) return null;
  // Periytys vain, jos kaikki aiemmat lauseet ovat paljaita (muuten epäselvää, mihin määrä kuuluu).
  const allBare = clauses.slice(0, -1).every((c) => !c.toks.length && !c.opp);
  const inherit = allBare && lastRows.length ? Object.fromEntries(Object.entries(lastRows[0]).filter(([k]) => k === "games" || k === "venue")) : {};
  for (const c of clauses.slice(0, -1)) {
    if (!allBare && !c.toks.length && !c.opp) return null;
    const r = clauseRows(c, Object.keys(inherit).length ? inherit : undefined);
    if (!r) return null;
    rows.push(...r);
  }
  rows.push(...lastRows);
  if (new Set(rows.map((r) => r.team)).size !== rows.length) return null;

  if (goalParts.length) {
    const g = goalParts[0].filter((t) => t.k !== "and");
    if (!g.every((t) => ["team", "goal", "q"].includes(t.k))) return null;
    const goals = [...new Set(g.flatMap((t) => (t.k === "goal" ? [t.goal] : [])))];
    const gt = [...new Set(g.flatMap((t) => (t.k === "team" ? [t.team] : [])))];
    const subj = [...new Set(rows.map((r) => String(r.team)))];
    const team = gt.length === 1 ? gt[0] : !gt.length && subj.length === 1 ? subj[0] : null;
    if (goals.length !== 1 || !team) return null;
    rows.push({ team, goal: goals[0] });
  }
  return rows.length ? rows : null;
}
