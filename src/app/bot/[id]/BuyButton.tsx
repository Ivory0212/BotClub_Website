"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { formatPrice } from "@/lib/utils";

interface BuyButtonProps {
  botId: string;
  botName: string;
  price: number;
}

export default function BuyButton({ botId, botName, price }: BuyButtonProps) {
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function handlePurchase() {
    setLoading(true);
    try {
      const res = await fetch("/api/bots/purchase", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ botId }),
      });

      if (res.ok) {
        router.refresh();
      } else {
        const data = await res.json();
        alert(data.error || "Purchase failed");
      }
    } finally {
      setLoading(false);
      setShowConfirm(false);
    }
  }

  if (showConfirm) {
    return (
      <div className="flex flex-col gap-2">
        <p className="text-sm text-zinc-400">
          Buy <strong className="text-white">{botName}</strong> for{" "}
          <strong className="text-amber-400">{formatPrice(price)}</strong>?
        </p>
        <p className="text-xs text-zinc-500">
          This will reveal the bot&apos;s hidden strategy and remove it from the leaderboard.
        </p>
        <div className="flex gap-2">
          <button
            onClick={handlePurchase}
            disabled={loading}
            className="rounded-lg bg-emerald-500 px-4 py-2 text-sm font-medium text-black transition-colors hover:bg-emerald-400 disabled:opacity-50"
          >
            {loading ? "Processing..." : "Confirm Purchase"}
          </button>
          <button
            onClick={() => setShowConfirm(false)}
            className="rounded-lg border border-zinc-700 px-4 py-2 text-sm font-medium text-zinc-400 transition-colors hover:bg-zinc-800"
          >
            Cancel
          </button>
        </div>
      </div>
    );
  }

  return (
    <button
      onClick={() => setShowConfirm(true)}
      className="rounded-lg bg-amber-500 px-6 py-2.5 font-medium text-black transition-all hover:bg-amber-400 hover:shadow-lg hover:shadow-amber-500/25"
    >
      Buy This Bot
    </button>
  );
}
