// Tiny app-wide event bus: the store announces XP, level-ups and achievements;
// the UI layer decides how to show them (toasts). Keeps the store UI-free.

type EventMap = {
  xp: { amount: number; reason: string };
  levelUp: { level: number; title: string };
  achievement: { id: string; title: string; description: string };
  storage: { mode: "indexeddb" | "localstorage" | "memory" };
};

type Handler<K extends keyof EventMap> = (payload: EventMap[K]) => void;

const handlers = new Map<keyof EventMap, Set<(payload: never) => void>>();

export function on<K extends keyof EventMap>(event: K, handler: Handler<K>): () => void {
  const set = handlers.get(event) ?? new Set();
  handlers.set(event, set);
  set.add(handler as (payload: never) => void);
  return () => set.delete(handler as (payload: never) => void);
}

export function emit<K extends keyof EventMap>(event: K, payload: EventMap[K]) {
  handlers.get(event)?.forEach((h) => (h as Handler<K>)(payload));
}
