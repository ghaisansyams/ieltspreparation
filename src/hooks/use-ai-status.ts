"use client";

import { useEffect, useState } from "react";
import { fetchAiStatus, type AiStatus } from "@/lib/ai/client";

export function useAiStatus(): AiStatus | null {
  const [status, setStatus] = useState<AiStatus | null>(null);
  useEffect(() => {
    let alive = true;
    fetchAiStatus().then((s) => alive && setStatus(s));
    return () => {
      alive = false;
    };
  }, []);
  return status;
}
