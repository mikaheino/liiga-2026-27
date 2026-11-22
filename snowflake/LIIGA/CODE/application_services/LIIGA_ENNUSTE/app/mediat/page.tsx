// Mediat: Liiga-otsikot ja -uutiset linkkeineen (21.11.2026; 22.11.2026 myös seurat, Yle ja Sport sekä
// tapahtumatyyppi, lib/media.ts). Lukulista ihmiselle; agentilla on oma hakunsa samasta datasta.
import Shell from "@/components/Shell";
import { EventBadge } from "@/components/EventList";
import { loadMedia } from "@/lib/media";

export const dynamic = "force-dynamic";
export const metadata = { title: "Mediat" };

const fmtDay = new Intl.DateTimeFormat("fi-FI", { weekday: "long", day: "numeric", month: "numeric", timeZone: "Europe/Helsinki" });
const fmtTime = new Intl.DateTimeFormat("fi-FI", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Helsinki" });

export default async function Page() {
  const rows = await loadMedia().catch(() => []);
  const days = new Map<string, typeof rows>();
  for (const r of rows) {
    const d = r.published ? fmtDay.format(new Date(r.published)) : "Ajankohta tuntematon";
    days.set(d, [...(days.get(d) ?? []), r]);
  }
  return (
    <Shell active="/mediat" title="Mediat">
      <p style={{ color: "var(--muted)", fontSize: 14, margin: "0 0 16px" }}>
        Ilta-Sanomien, Iltalehden ja MTV Uutisten Liiga-otsikot sekä seurojen, Ylen ja Sportin uutiset kolmelta viikolta.
        Linkki avaa jutun julkaisijan sivulla. Uutiset eivät muuta ennustetta.
      </p>
      {rows.length === 0 && <p style={{ color: "var(--muted)" }}>Ei otsikoita juuri nyt.</p>}
      {[...days].map(([day, items]) => (
        <section key={day} style={{ marginBottom: 20 }}>
          <h2 style={{ fontSize: 13, textTransform: "uppercase", letterSpacing: ".06em", color: "var(--gold)", margin: "0 0 8px" }}>{day}</h2>
          <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "grid", gap: 8 }}>
            {items.map((r) => (
              <li key={r.url}>
                <a href={r.url} target="_blank" rel="noopener noreferrer" style={{
                  display: "block", padding: "10px 12px", background: "var(--surface)", border: "1px solid var(--line)",
                  borderRadius: "var(--r)", color: "var(--ink)", textDecoration: "none",
                }}>
                  <span style={{ display: "block", fontWeight: 600, lineHeight: 1.35 }}>{r.title}</span>
                  <span style={{ display: "block", marginTop: 4, fontSize: 12, color: "var(--muted)" }}>
                    <EventBadge type={r.eventType} />{r.source}{r.published ? ` · ${fmtTime.format(new Date(r.published))}` : ""}{r.team ? ` · ${r.team}` : ""}
                  </span>
                </a>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </Shell>
  );
}
