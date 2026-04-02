"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

type RunStatusRefreshProps = {
  active: boolean;
  inlineResumeEnabled?: boolean;
  runId?: string;
};

export function RunStatusRefresh({ active, inlineResumeEnabled = false, runId }: RunStatusRefreshProps) {
  const router = useRouter();

  useEffect(() => {
    if (!active) {
      return;
    }

    const intervalId = window.setInterval(() => {
      if (inlineResumeEnabled && runId) {
        void fetch(`/api/runs/${runId}`, {
          method: "POST"
        }).catch(() => {
          // Ignore resume polling errors; the refresh keeps the UI moving.
        });
      }

      router.refresh();
    }, 3000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [active, inlineResumeEnabled, router, runId]);

  return null;
}
