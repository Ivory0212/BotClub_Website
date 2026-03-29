"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function RunRoundButton({ seasonId }: { seasonId: string }) {
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function handleRunRound() {
    setLoading(true);
    try {
      const res = await fetch("/api/season/next-round", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ seasonId }),
      });

      if (res.ok) {
        const data = await res.json();
        if (data.roundId) {
          router.push(`/round/${data.roundId}`);
        } else {
          router.refresh();
        }
      } else {
        const data = await res.json();
        alert(data.error || "Failed to run round");
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <button
      onClick={handleRunRound}
      disabled={loading}
      className="inline-flex h-14 items-center gap-3 rounded-xl bg-rose-500 px-8 text-lg font-bold text-white transition-all hover:bg-rose-400 hover:shadow-lg hover:shadow-rose-500/25 disabled:opacity-50 animate-pulse-glow"
    >
      {loading ? (
        "⏳ Running Round..."
      ) : (
        <>⚔️ Run Next Round</>
      )}
    </button>
  );
}
