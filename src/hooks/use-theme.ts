"use client";

import { useCallback, useEffect, useState } from "react";

export type ThemePreference = "system" | "light" | "dark";
const KEY = "lexis-theme";

function apply(pref: ThemePreference) {
  const dark = pref === "dark" || (pref === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches);
  document.documentElement.dataset.theme = dark ? "dark" : "light";
}

export function useTheme() {
  const [preference, setPreference] = useState<ThemePreference>("system");

  useEffect(() => {
    try {
      setPreference((localStorage.getItem(KEY) as ThemePreference) || "system");
    } catch {
      // Storage blocked — stay on system.
    }
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => {
      let pref: ThemePreference = "system";
      try {
        pref = (localStorage.getItem(KEY) as ThemePreference) || "system";
      } catch {}
      if (pref === "system") apply("system");
    };
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  const setTheme = useCallback((pref: ThemePreference) => {
    setPreference(pref);
    try {
      localStorage.setItem(KEY, pref);
    } catch {}
    apply(pref);
  }, []);

  return { preference, setTheme };
}
