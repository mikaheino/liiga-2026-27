"use client";
// Pyyhkäisy takaisin (käyttäjä 27.10.: "swipe-tyylinen paluu, sama kuin Tinderissä").
// Alasivun kortti seuraa sormea ja kallistuu; tarpeeksi pitkä veto oikealle heittää
// kortin pois ja palaa edelliselle sivulle (tai etusivulle, jos tultiin suoraan).
// Ei käynnisty sivuttain vieritettävistä riveistä eikä lomakkeista, eikä
// pystysuuntaisesta vierityksestä: suunta lukitaan ensimmäisen 10 px:n perusteella.
import { useRouter } from "next/navigation";
import { useRef } from "react";

const SKIP = ".tabs, .nw-cats, .months, .heat, .strip, .seg, .nw-step, input, select, textarea, [data-noswipe]";
const THRESHOLD = 0.28;                       // osuus ruudun leveydestä
const FLICK = 0.6;                            // px/ms: nopea heilautus riittää lyhyemmälläkin

// onBack: korvaa sivuhistorian (esim. ottelukortin sulkeminen samalla sivulla).
export default function SwipeBack({ children, onBack, className = "" }: { children: React.ReactNode; onBack?: () => void; className?: string }) {
  const router = useRouter();
  const ref = useRef<HTMLDivElement>(null);
  const s = useRef<{ x: number; y: number; t: number; lock: "" | "x" | "y"; dx: number } | null>(null);

  const set = (dx: number, animate: boolean) => {
    const el = ref.current;
    if (!el) return;
    el.style.transition = animate ? "transform .22s ease-out, opacity .22s ease-out" : "none";
    el.style.transform = dx ? `translateX(${dx}px) rotate(${dx / 40}deg)` : "";
    el.style.opacity = dx ? String(Math.max(0.35, 1 - dx / window.innerWidth)) : "";
  };
  const back = () => {
    if (onBack) { onBack(); return; }
    const same = document.referrer.startsWith(location.origin);
    if (same && history.length > 1) router.back(); else router.push("/");
  };

  return (
    <div
      ref={ref}
      className={`swipe ${className}`}
      onTouchStart={(e) => {
        const t = e.touches[0];
        // Vasen reuna jää selaimen omalle takaisin-eleelle (iOS), muuten molemmat laukeaisivat.
        if (e.touches.length !== 1 || t.clientX < 24 || (e.target as HTMLElement).closest(SKIP)) { s.current = null; return; }
        s.current = { x: t.clientX, y: t.clientY, t: e.timeStamp, lock: "", dx: 0 };
      }}
      onTouchMove={(e) => {
        const st = s.current;
        if (!st) return;
        const t = e.touches[0], dx = t.clientX - st.x, dy = t.clientY - st.y;
        if (!st.lock && Math.hypot(dx, dy) > 10) st.lock = Math.abs(dx) > Math.abs(dy) * 1.4 && dx > 0 ? "x" : "y";
        if (st.lock !== "x") return;
        st.dx = Math.max(0, dx);
        set(st.dx, false);
      }}
      onTouchEnd={(e) => {
        const st = s.current;
        s.current = null;
        if (!st || st.lock !== "x") return;
        const v = st.dx / Math.max(1, e.timeStamp - st.t);
        if (st.dx > window.innerWidth * THRESHOLD || (v > FLICK && st.dx > 40)) {
          set(window.innerWidth * 1.2, true);
          setTimeout(back, 180);
        } else set(0, true);
      }}
    >
      {children}
    </div>
  );
}
