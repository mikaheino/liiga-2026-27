// Agentin vastauksen kevyt markdown -> HTML: lihavointi, linkit, listat ja
// taulukot. Teksti escapetaan ensin, joten agentin vastaus ei voi syöttää
// sivulle omaa HTML:ää. Sovelluksen omat osoitteet muuttuvat sisäisiksi
// linkeiksi, jotta "Lisää sovelluksessa" avautuu samaan ikkunaan.
const APP = /https:\/\/[a-z0-9]+-zueemdq-container-services\.snowflakecomputing\.app/g;

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

function inline(s: string) {
  let h = esc(s.replace(APP, ""));
  h = h.replace(/\*\*(.+?)\*\*/g, "<b>$1</b>");
  h = h.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (_m, t, u) => link(t, u));
  h = h.replace(/(^|[\s(])((?:https?:\/\/|\/)(?:joukkue|sarjataulukko|voittaja|ottelut|liike|linkedin)?[^\s<)]*)/g, (m, pre, u) =>
    u.startsWith("/") && !/^\/(joukkue|sarjataulukko|voittaja|ottelut|liike|linkedin)?(\/|\?|$)/.test(u) ? m : pre + link(u === "/" ? "Etusivu" : decodeURIComponent(u), u));
  return h;
}
function link(text: string, url: string) {
  const internal = url.startsWith("/");
  if (!internal && !/^https?:\/\//.test(url)) return text;
  return `<a href="${url}"${internal ? "" : ' target="_blank" rel="noopener"'}>${text}</a>`;
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
