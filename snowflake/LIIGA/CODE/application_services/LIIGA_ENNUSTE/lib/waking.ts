// Palvelun herääminen säästötilasta (23.11.2026). WakeBanner asettaa tilan service workerin
// viestistä ja nollaa sen, kun palvelu vastaa. /api-kutsut eivät kulje välimuistin kautta, joten
// hakukenttä ja chat ovat pois käytöstä heräämisen ajan ja kertovat syyn.
import { useSyncExternalStore } from "react";

let waking = false;
const subs = new Set<() => void>();

export function setWaking(v: boolean) {
  if (v === waking) return;
  waking = v;
  subs.forEach((f) => f());
}

const subscribe = (f: () => void) => { subs.add(f); return () => { subs.delete(f); }; };

export const useWaking = () => useSyncExternalStore(subscribe, () => waking, () => false);

export const WAKING_HINT = "Palvelu käynnistyy säästötilasta, odota hetki…";
