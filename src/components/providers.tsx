"use client";

import { useEffect } from "react";
import { Toaster, toast } from "sonner";
import { on } from "@/lib/events";
import { useAppStore } from "@/lib/store/app-store";
import { useUiStore } from "@/lib/store/ui-store";
import { startSync } from "@/lib/sync/sync-engine";
import { CommandSearch } from "@/components/layout/command-search";
import { WordQuickView } from "@/components/vocab/word-quick-view";

export function Providers({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    void useAppStore.persist.rehydrate();
    const stopSync = startSync();

    let xpBuffer = 0;
    let xpTimer: ReturnType<typeof setTimeout> | null = null;
    const offXp = on("xp", ({ amount }) => {
      // Coalesce rapid XP events (e.g. fast game answers) into one quiet toast.
      xpBuffer += amount;
      if (xpTimer) clearTimeout(xpTimer);
      xpTimer = setTimeout(() => {
        if (xpBuffer >= 15) toast(`+${xpBuffer} XP`, { id: "xp", duration: 1400 });
        xpBuffer = 0;
      }, 700);
    });
    const offLevel = on("levelUp", ({ level, title }) => toast.success(`Level ${level}`, { description: title }));
    const offStorage = on("storage", ({ mode }) => useUiStore.getState().setStorageMode(mode));
    const offAch = on("achievement", ({ title, description }) => toast.success(`Achievement unlocked · ${title}`, { description, duration: 5000 }));

    return () => {
      stopSync();
      offXp();
      offLevel();
      offAch();
      offStorage();
    };
  }, []);

  return (
    <>
      {children}
      <CommandSearch />
      <WordQuickView />
      <Toaster
        position="bottom-right"
        // Sticky "Save" bars sit bottom-right too — lift toasts clear of them
        // so a toast can never swallow the click that saves your work.
        offset={{ bottom: "96px", right: "16px" }}
        mobileOffset={{ bottom: "96px", right: "12px", left: "12px" }}
        toastOptions={{
          classNames: {
            toast: "!bg-surface !text-ink !border-line-strong !rounded-lg !shadow-pop !font-sans",
            description: "!text-ink-3",
          },
        }}
      />
    </>
  );
}
