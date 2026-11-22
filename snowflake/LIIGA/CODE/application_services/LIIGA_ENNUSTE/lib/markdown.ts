// Agentin vastauksen kevyt markdown -> HTML: lihavointi, linkit, listat ja
// taulukot. Kaikki teksti escapetaan, joten agentin vastaus ei voi syöttää
// sivulle omaa HTML:ää. Sovelluksen omat osoitteet muuttuvat sisäisiksi
// linkeiksi, jotta "Lisää sovelluksessa" avautuu samaan ikkunaan.
const APP = /https:\/\/[a-z0-9]+-[a-z0-9-]+\.snowflakecomputing\.app/g;  // tilin nimestä riippumaton (siirto Futuricelle 21.11.2026)

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

// 23.11.2026 (katselmointi, XSS): linkit käsitellään RAAKATEKSTISTÄ ennen escapetusta. Osoite tarkistetaan
// new URL():lla (vain http/https) tai sovelluksen omana polkuna, ja sekä teksti että href escapetaan
// dekoodauksen JÄLKEEN (%3C, %22 eivät pääse HTML:ksi). Muu kuin sallittu osoite näytetään tekstinä.
const INTERNAL = /^\/(joukkue|sarjataulukko|voittaja|ottelut|liike|linkedin)?(\/|\?|$)/;
const TOKEN = /\[([^\]]+)\]\(([^)\s]+)\)|(^|[\s(])((?:https?:\/\/|\/)[^\s<)]*)/g;

export function safeHref(raw: string): string | null {
  if (raw.startsWith("/")) return raw.startsWith("//") || !INTERNAL.test(raw) ? null : raw;
  try {
    const u = new URL(raw);
    return u.protocol === "http:" || u.protocol === "https:" ? u.href : null;
  } catch {
    return null;
  }
}

function decode(s: string) {
  try {
    return decodeURIComponent(s);
  } catch {
    return s;
  }
}

function text(s: string) {
  return esc(s).replace(/\*\*(.+?)\*\*/g, "<b>$1</b>");
}

function link(label: string, url: string) {
  const href = safeHref(url);
  if (!href) return text(label);
  const ext = !href.startsWith("/");
  return `<a href="${esc(href)}"${ext ? ' target="_blank" rel="noopener noreferrer"' : ""}>${esc(label)}</a>`;
}

function inline(s: string) {
  const src = s.replace(APP, "");
  let out = "";
  let last = 0;
  for (const m of src.matchAll(TOKEN)) {
    const at = m.index ?? 0;
    if (m[1] !== undefined) {                              // [teksti](osoite)
      out += text(src.slice(last, at)) + link(m[1], m[2]);
    } else {                                               // paljas osoite tai sovelluksen polku
      const pre = m[3], u = m[4];
      if (u.startsWith("/") && !INTERNAL.test(u)) continue;    // esim. "ja/tai": tekstiä
      out += text(src.slice(last, at) + pre) + link(u === "/" ? "Etusivu" : decode(u), u);
    }
    last = at + m[0].length;
  }
  return out + text(src.slice(last));
}

export function md(src: string): string {
  const lines = src.trim().split("\n");
  const out: string[] = [];
  for (let i = 0; i < lines.length; i++) {
    const l = lines[i];
    if (/^\s*\|.*\|\s*$/.test(l)) {                       // taulukko
      const rows: string[][] = [];
      while (i < lines.length && /^\s*\|.*\|\s*$/.test(lines[i])) {
        const cells = lines[i].trim().slice(1, -1).split("|").map((c) => c.trim());
        if (!cells.every((c) => /^:?-{2,}:?$/.test(c))) rows.push(cells);
        i++;
      }
      i--;
      const [head, ...body] = rows;
      out.push(`<table><thead><tr>${head.map((c) => `<th>${inline(c)}</th>`).join("")}</tr></thead><tbody>${body.map((r) => `<tr>${r.map((c) => `<td>${inline(c)}</td>`).join("")}</tr>`).join("")}</tbody></table>`);
    } else if (/^\s*[-*•]\s+/.test(l)) {
      const items: string[] = [];
      while (i < lines.length && /^\s*[-*•]\s+/.test(lines[i])) items.push(`<li>${inline(lines[i].replace(/^\s*[-*•]\s+/, ""))}</li>`), i++;
      i--; out.push(`<ul>${items.join("")}</ul>`);
    } else if (/^#{1,4}\s/.test(l)) out.push(`<h4>${inline(l.replace(/^#+\s/, ""))}</h4>`);
    else if (l.trim()) out.push(`<p>${inline(l)}</p>`);
  }
  return out.join("");
}
