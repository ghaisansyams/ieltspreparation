"use client";

import { create } from "zustand";

interface UiState {
  quickViewId: string | null;
  commandOpen: boolean;
  mobileNavOpen: boolean;
  storageMode: "indexeddb" | "localstorage" | "memory";
  openQuickView: (id: string) => void;
  closeQuickView: () => void;
  setCommandOpen: (open: boolean) => void;
  setMobileNavOpen: (open: boolean) => void;
  setStorageMode: (mode: UiState["storageMode"]) => void;
}

export const useUiStore = create<UiState>((set) => ({
  quickViewId: null,
  commandOpen: false,
  mobileNavOpen: false,
  storageMode: "indexeddb",
  openQuickView: (id) => set({ quickViewId: id }),
  closeQuickView: () => set({ quickViewId: null }),
  setCommandOpen: (commandOpen) => set({ commandOpen }),
  setMobileNavOpen: (mobileNavOpen) => set({ mobileNavOpen }),
  setStorageMode: (storageMode) => set({ storageMode }),
}));
