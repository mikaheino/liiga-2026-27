// Tiivis uutislista (22.11.2026, G3): otsikko linkkinä, lähde, päivä ja tapahtumatyyppi (lib/media.ts newsFor).
// Palvelinkomponentti, ei tilaa. Tyhjä lista -> ei mitään (Pages-käännöksessä dataa ei ole).
import type { MediaLink } from "@/lib/media";

const TYPE_FI: Record<string, string> = {
  suspension: "pelikielto", injury: "loukkaantuminen", transfer: "siirto", coaching: "valmentaja",
  crisis: "kriisi", "off-ice": "kentän ulkopuolelta", "game result": "ottelu", other: "",
};
const BADGE: Record<string, string> = { suspension: "var(--down, #c0392b)", injury: "var(--down, #c0392b)", transfer: "var(--gold)", coaching: "var(--gold)" };
const fmtDay = new Intl.DateTimeFormat("fi-FI", { day: "numeric", month: "numeric", timeZone: "Europe/Helsinki" });

export function EventBadge({ type }: { type: string | null }) {
  const t = type ? TYPE_FI[type] : "";
  if (!t) return null;
  return (
    <span style={{ display: "inline-block", padding: "0 6px", marginRight: 6, borderRadius: 999, fontSize: 11,
      border: `1px solid ${BADGE[type!] ?? "var(--line)"}`, color: BADGE[type!] ?? "var(--muted)" }}>{t}</span>
  );
}

export default function EventList({ items, title = "Uusimmat uutiset" }: { items: MediaLink[]; title?: string }) {
  if (!items.length) return null;
  return (
    <section aria-label={title}>
      <div className="label">{title}</div>
      <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "grid", gap: 6 }}>
        {items.map((r) => (
          <li key={r.url} style={{ fontSize: 14, lineHeight: 1.35 }}>
            {/* 23.11.2026: linkki vain http(s)-osoitteelle (kolmannen osapuolen data), muuten pelkkä otsikko */}
            {/^https?:\/\//i.test(r.url)
              ? <a href={r.url} target="_blank" rel="noopener noreferrer" style={{ color: "var(--ink)" }}>{r.title}</a>
              : <span>{r.title}</span>}
            <span style={{ display: "block", marginTop: 2, fontSize: 12, color: "var(--muted)" }}>
              <EventBadge type={r.eventType} />{r.source}{r.published ? ` · ${fmtDay.format(new Date(r.published))}` : ""}
            </span>
          </li>
        ))}
      </ul>
      <p style={{ margin: "6px 0 0", fontSize: 12, color: "var(--muted)" }}>Uutiset eivät muuta ennustetta: malli laskee tuloksista ja kokoonpanoista.</p>
    </section>
  );
}
