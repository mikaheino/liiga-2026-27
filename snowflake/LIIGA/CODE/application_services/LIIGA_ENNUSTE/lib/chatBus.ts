// Vapaa keskustelu missä tahansa näkymässä (6.11.2026, käyttäjä: "olis mukava jos
// agentin saisi myös vapaata keskustelua varten halutessaan missä tahansa ruudussa").
// Ei kelluvaa nappia: keskustelu avataan navigaation "Kysy"-kohdasta tai kortin
// vastausriviltä ("Jatka keskustelua"). Väylä on selaimen tapahtuma, koska avaajat
// (Top, BottomNav, CardAgent) ja paneeli (Chat) ovat eri puissa.
export type SeedTurn = { role: "user" | "assistant"; text: string };
const OPEN = "liiga-chat-open", STATE = "liiga-chat-state";

// toggle: navigaation painike sulkee auki olevan paneelin; seed: kortin kysymys ja
// vastaus keskustelun jatkoksi.
export function openChat(o: { toggle?: boolean; seed?: SeedTurn[] } = {}) {
  window.dispatchEvent(new CustomEvent(OPEN, { detail: o }));
}
export function onOpenChat(fn: (o: { toggle?: boolean; seed?: SeedTurn[] }) => void) {
  const h = (e: Event) => fn((e as CustomEvent).detail ?? {});
  window.addEventListener(OPEN, h);
  return () => window.removeEventListener(OPEN, h);
}
export function chatState(open: boolean) { window.dispatchEvent(new CustomEvent(STATE, { detail: { open } })); }
export function onChatState(fn: (open: boolean) => void) {
  const h = (e: Event) => fn(Boolean((e as CustomEvent).detail?.open));
  window.addEventListener(STATE, h);
  return () => window.removeEventListener(STATE, h);
}
