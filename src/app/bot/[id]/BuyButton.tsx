"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useI18n } from "@/components/i18n/I18nProvider";
import { PURCHASE_ALLOWED_PUBLIC } from "@/lib/preview-flag";
import { formatPrice } from "@/lib/utils";

interface BuyButtonProps {
  botId: string;
  botName: string;
  price: number;
}

export default function BuyButton({ botId, botName, price }: BuyButtonProps) {
  const { t } = useI18n();
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function handlePurchase() {
    if (!PURCHASE_ALLOWED_PUBLIC) return;
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
        const data = (await res.json()) as { error?: string; message?: string };
        if (data.error === "PURCHASE_DISABLED" || data.error === "PREVIEW_MODE") {
          alert(t("buy.comingSoonBody"));
        } else {
          alert(data.message || data.error || t("buy.purchaseFailed"));
        }
      }
    } finally {
      setLoading(false);
      setShowConfirm(false);
    }
  }

  if (!PURCHASE_ALLOWED_PUBLIC && showConfirm) {
    return (
      <div className="flex max-w-md flex-col gap-3 rounded-xl border border-amber-500/30 bg-amber-500/10 p-4">
        <div className="text-sm font-semibold text-amber-200">{t("buy.comingSoonTitle")}</div>
        <p className="text-sm leading-relaxed text-zinc-300">{t("buy.comingSoonBody")}</p>
        <button
          type="button"
          onClick={() => setShowConfirm(false)}
          className="self-start rounded-lg border border-zinc-600 px-4 py-2 text-sm font-medium text-zinc-200 hover:bg-zinc-800"
        >
          {t("buy.gotIt")}
        </button>
      </div>
    );
  }

  if (showConfirm) {
    return (
      <div className="flex flex-col gap-2">
        <p className="text-sm text-zinc-400">
          {t("buy.confirmLine", { name: botName, price: formatPrice(price) })}
        </p>
        <p className="text-xs text-zinc-500">{t("buy.confirmSub")}</p>
        <div className="flex gap-2">
          <button
            onClick={handlePurchase}
            disabled={loading}
            className="rounded-lg bg-emerald-500 px-4 py-2 text-sm font-medium text-black transition-colors hover:bg-emerald-400 disabled:opacity-50"
          >
            {loading ? t("buy.processing") : t("buy.confirmPurchase")}
          </button>
          <button
            onClick={() => setShowConfirm(false)}
            className="rounded-lg border border-zinc-700 px-4 py-2 text-sm font-medium text-zinc-400 transition-colors hover:bg-zinc-800"
          >
            {t("buy.cancel")}
          </button>
        </div>
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={() => setShowConfirm(true)}
      className="rounded-lg bg-amber-500 px-6 py-2.5 font-medium text-black transition-all hover:bg-amber-400 hover:shadow-lg hover:shadow-amber-500/25"
    >
      {t("buy.buyThisBot")}
    </button>
  );
}
