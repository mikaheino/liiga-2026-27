"use client";
// "Kysy" navigaatiossa (6.11.): avaa vapaan keskustelun (components/Chat.tsx)
// tai sulkee sen. Näkyy aktiivisena, kun paneeli on auki -- keskustelu on osio
// muiden joukossa, ei sivun päällä kelluva nappi.
import { useEffect, useState } from "react";
import { onChatState, openChat } from "@/lib/chatBus";

export default function AskButton({ className = "", children }: { className?: string; children: React.ReactNode }) {
  const [on, setOn] = useState(false);
  // Alkutila sivulta: sivun yläpalkki kytkeytyy vasta sisällön latauduttua, jolloin
  // paneeli on voinut jo avautua (#agentti) eikä tapahtumaa enää tule.
  useEffect(() => { setOn(document.body.classList.contains("chat-open")); return onChatState(setOn); }, []);
  return (
    <button type="button" className={`${className} ${on ? "on" : ""}`} aria-pressed={on} aria-controls="chat"
      onClick={() => openChat({ toggle: true })}>{children}</button>
  );
}
