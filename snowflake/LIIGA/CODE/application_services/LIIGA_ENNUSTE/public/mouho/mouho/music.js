// Mouhon salaisuus -- taustamusiikki: omat sävellykset moottorin sekvensserille (engine/music.js).
"use strict";
// Backlog 9 (24.10.): ruutukohtaiset teemat. Kahdeksasosa-askeleet, raidat kiertävät omaa pituuttaan.
GAME.musicVolume = .5;
GAME.roomMusic = { koti: "kisa", parkki: "kisa", lentoasema: "lento", portti: "istanbul", basaari: "istanbul", kallio: "kappadokia", temppeli: "temppeli" };

// Prologi: reipas seikkailumarssi c-mollissa (Jussi lentää Liigan toimistosta).
defineTheme("seikkailu", { bpm: 132, tracks: [
  { wave: "square", vol: .07, notes: `G4 - - C5 - - Eb5 D5 | C5 - G4 - - - . . | Ab4 - - C5 - - F5 Eb5 | D5 - - - - - . .
                                     G4 - - C5 - - Eb5 G5 | F5 - Eb5 D5 Eb5 - C5 - | D5 - - G4 - - B4 D5 | C5 - - - - - . .` },
  { wave: "triangle", vol: .12, notes: `C3 . G2 . C3 . G2 . | C3 . G2 . C3 . G2 . | Ab2 . Eb3 . Ab2 . Eb3 . | G2 . D3 . G2 . D3 .
                                       C3 . G2 . C3 . G2 . | Ab2 . . . F2 . . . | G2 . D3 . G2 . B2 . | C3 . G2 . C3 . . .` },
  { drums: true, vol: .3, notes: "k . h . s . h . | k k h . s . h h" },
] });
// Kisapuisto: haikea syysilta a-mollissa, hidas.
defineTheme("kisa", { bpm: 84, tracks: [
  { wave: "triangle", vol: .1, notes: `A4 - - C5 E5 - D5 C5 | B4 - - G4 A4 - - - | F4 - - A4 C5 - B4 A4 | G#4 - - B4 E5 - - -
                                       A4 - - C5 E5 - D5 C5 | B4 - - G4 A4 - - - | F4 - A4 C5 D5 - C5 B4 | A4 - - - . . . .` },
  { wave: "square", vol: .035, notes: `A3 C4 E4 C4 A3 C4 E4 C4 | G3 B3 D4 B3 G3 B3 D4 B3 | F3 A3 C4 A3 F3 A3 C4 A3 | E3 G#3 B3 G#3 E3 G#3 B3 G#3` },
  { wave: "triangle", vol: .12, notes: `A2 - - - E3 - - - | G2 - - - D3 - - - | F2 - - - C3 - - - | E2 - - - B2 - - -` },
  { drums: true, vol: .12, notes: "k . h . . . h . | k . h . . . h h" },
] });
// Lähtöaula: kevyt aulajazz F-duurissa.
defineTheme("lento", { bpm: 96, tracks: [
  { wave: "triangle", vol: .1, notes: `A4 - - C5 - - A4 G4 | F4 - - - . . . . | D5 - - C5 - - A4 F4 | G4 - - - . . . .` },
  { wave: "square", vol: .03, notes: `F3 A3 C4 E4 C4 A3 F3 A3 | Bb2 D3 F3 A3 F3 D3 Bb2 D3 | G2 Bb2 D3 F3 D3 Bb2 G2 Bb2 | C3 E3 G3 Bb3 G3 E3 C3 E3` },
  { wave: "triangle", vol: .12, notes: `F2 . . F2 . . C3 . | Bb1 . . Bb1 . . F2 . | G2 . . G2 . . D3 . | C2 . . C2 . . G2 .` },
  { drums: true, vol: .1, notes: "k . h h . h h . | k . h h s h h h" },
] });
// Istanbul: hijaz-asteikko D:stä (D Eb F# G A Bb C), darbuka-rytmi (doum tek tek ka).
defineTheme("istanbul", { bpm: 108, tracks: [
  { wave: "square", vol: .055, notes: `D5 - Eb5 F#5 G5 - F#5 Eb5 | D5 - - - A4 - - - | Bb4 - A4 G4 F#4 - G4 A4 | D4 - - - . . . .
                                      G4 - A4 Bb4 C5 - Bb4 A4 | G4 - F#4 - Eb4 - D4 - | F#4 G4 A4 Bb4 A4 G4 F#4 Eb4 | D4 - - - . . . .` },
  { wave: "triangle", vol: .13, notes: `D2 . . D2 A2 . D2 . | D2 . . D2 A2 . D2 . | G2 . . G2 D3 . G2 . | D2 . . D2 A2 . D2 .` },
  { drums: true, vol: .28, notes: "k . h h s . h . | k . h h s h h ." },
] });
// Kappadokia: laakson iltaruskoa, avara d-molli ja harvat soinnut.
defineTheme("kappadokia", { bpm: 72, tracks: [
  { wave: "triangle", vol: .1, notes: `A4 - - - . . D5 - | C5 - A4 - G4 - - - | F4 - - - . . A4 - | E4 - - - - - . .` },
  { wave: "triangle", vol: .1, notes: `D2 - - - - - - - | C2 - - - - - - - | Bb1 - - - - - - - | A1 - - - - - - -` },
  { wave: "square", vol: .025, notes: `D4 . F4 . A4 . F4 . | C4 . E4 . G4 . E4 . | Bb3 . D4 . F4 . D4 . | A3 . C#4 . E4 . C#4 .` },
] });
// Temppeli: matala humina ja yksittäiset kaikuvat sävelet.
defineTheme("temppeli", { bpm: 60, tracks: [
  { wave: "triangle", vol: .12, notes: `D2 - - - - - - - - - - - - - - - | Eb2 - - - - - - - D2 - - - - - - -` },
  { wave: "sine", vol: .07, notes: `. . . . A4 - - - . . . . . . . . | . . Bb4 - - - . . . . . . F4 - - - | . . . . . . . . D5 - - - . . . . | . . . . C#5 - - - . . . . . . . .` },
  { drums: true, vol: .12, notes: "k . . . . . . . | . . . . . . . . | k . . . . . k . | . . . . . . . ." },
] });
// Loppu: Mouho-illan juhla C-duurissa.
defineTheme("loppu", { bpm: 120, tracks: [
  { wave: "square", vol: .06, notes: `C5 - E5 G5 - E5 C5 - | D5 - F5 A5 - G5 F5 - | E5 - G5 C6 - B5 A5 G5 | F5 - E5 D5 C5 - - -` },
  { wave: "triangle", vol: .13, notes: `C3 . G2 . C3 . G2 . | D3 . A2 . D3 . A2 . | E3 . C3 . A2 . E3 . | F2 . G2 . C3 . . .` },
  { drums: true, vol: .3, notes: "k . h . s . h . | k . h . s . h h" },
] });
