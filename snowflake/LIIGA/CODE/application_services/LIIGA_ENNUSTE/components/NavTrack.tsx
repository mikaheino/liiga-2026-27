"use client";
// Sovelluksen oma sivuhistoria pyyhkäisylle (käyttäjä 27.10.: "sarjataulukosta
// Pelicansiin, swipe -> oletan pääseväni sarjataulukkoon, en alkuun").
// document.referrer ei muutu sovelluksen sisäisissä siirtymissä, joten se ei kerro
// edellistä sivua. Pino sessionStoragessa: uusi sivu lisätään, paluu edelliseen poistaa.
import { usePathname } from "next/navigation";
import { useEffect } from "react";

const KEY = "liiga-sivut";

export function readStack(): string[] {
  try { return JSON.parse(sessionStorage.getItem(KEY) ?? "[]") as string[]; } catch { return []; }
}

export default function NavTrack() {
  const path = usePathname();
  useEffect(() => {
    const s = readStack();
    if (s[s.length - 1] === path) return;                       // uudelleenlataus
    if (s[s.length - 2] === path) s.pop(); else s.push(path);   // takaisin vs. uusi sivu
    try { sessionStorage.setItem(KEY, JSON.stringify(s.slice(-30))); } catch { /* yksityinen ikkuna */ }
  }, [path]);
  return null;
}
