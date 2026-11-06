// Kauden kysymykset etusivulla (6.11.2026, docs/claude/skenaario.md J2/V7): luku, viikon
// muutos ja kausikäyrä. Katkoviiva = Uutiskorjattu (haastaja), kun sille on dataa.
// Lukituskysymys näyttää vertailuksi luvun ilman ehtoa. Agentiton: toimii myös Pagesissa.
import Link from "next/link";
import { teamHref } from "@/lib/data";
import type { QPoint, QuestionView } from "@/lib/seasonQuestions";
import { fi } from "@/lib/table";

const W = 160, H = 36;

function line(pts: QPoint[], x0: number, x1: number) {
  const x = (d: string) => (x1 === x0 ? W : ((Date.parse(d) - x0) / (x1 - x0)) * W);
  return pts.map((p, i) => `${i ? "L" : "M"}${x(p.date).toFixed(1)},${(H - 2 - p.p * (H - 4)).toFixed(1)}`).join("");
}

function Spark({ q }: { q: QuestionView }) {
  if (q.series.length < 2) return null;
  const all = [...q.series, ...q.news].map((p) => Date.parse(p.date));
  const x0 = Math.min(...all), x1 = Math.max(...all);
  return (
    <svg className="sq-spark" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" aria-hidden>
      <line x1="0" x2={W} y1={H / 2} y2={H / 2} className="sq-mid" />
      {q.news.length > 1 && <path d={line(q.news, x0, x1)} className="sq-news" />}
      <path d={line(q.series, x0, x1)} className="sq-line" />
    </svg>
  );
}

function note(q: QuestionView) {
  if (q.dead) return "käytännössä ratkennut";
  if (!q.lock) return " ";
  if (q.state === "failed") return "ehto ei toteutunut";
  if (q.state === "held") return "ehto toteutui";
  return q.base != null ? `ilman ehtoa ${fi(100 * q.base, 0)} %` : " ";
}

export default function SeasonQuestions({ questions }: { questions: QuestionView[] }) {
  const shown = questions.filter((q) => q.p != null || q.state === "failed");
  if (!shown.length) return null;
  const anyNews = shown.some((q) => q.news.length > 1);
  return (
    <section className="sq" aria-label="Kauden kysymykset">
      <div className="label">Kauden kysymykset</div>
      <div className="sq-grid">
        {shown.map((q) => (
          <Link key={q.id} href={teamHref(q.team)} className={`sq-card ${q.dead ? "dead" : ""}`}>
            <span className="sq-q">{q.label}</span>
            <span className="sq-v">
              <b>{q.p == null ? "–" : `${fi(100 * q.p, 0)} %`}</b>
              {q.dWeek != null && Math.abs(q.dWeek) >= 0.5 && (
                <em className={q.dWeek > 0 ? "up" : "dn"}>{q.dWeek > 0 ? "+" : "−"}{fi(Math.abs(q.dWeek), 0)} viikossa</em>
              )}
            </span>
            <Spark q={q} />
            <span className="sq-s">{note(q)}</span>
          </Link>
        ))}
      </div>
      {anyNews && <div className="sq-legend"><i className="l" /> ennuste <i className="n" /> uutiskorjattu</div>}
    </section>
  );
}
