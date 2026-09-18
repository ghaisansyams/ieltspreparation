"use client";

import { useCallback, useEffect, useState } from "react";
import { useAppStore } from "@/lib/store/app-store";

/** Text-to-speech via the Web Speech API, using the learner's preferred accent. */
export function useSpeech() {
  const lang = useAppStore((s) => s.profile.settings.voice);
  const [supported, setSupported] = useState(false);
  const [speaking, setSpeaking] = useState(false);

  useEffect(() => {
    setSupported(typeof window !== "undefined" && "speechSynthesis" in window);
  }, []);

  const speak = useCallback(
    (text: string, rate = 0.92) => {
      if (typeof window === "undefined" || !("speechSynthesis" in window) || !text) return;
      const synth = window.speechSynthesis;
      synth.cancel();
      const u = new SpeechSynthesisUtterance(text);
      u.lang = lang;
      u.rate = rate;
      const voice = synth.getVoices().find((v) => v.lang === lang) ?? synth.getVoices().find((v) => v.lang.startsWith("en"));
      if (voice) u.voice = voice;
      u.onstart = () => setSpeaking(true);
      u.onend = u.onerror = () => setSpeaking(false);
      synth.speak(u);
    },
    [lang],
  );

  return { speak, speaking, supported };
}
