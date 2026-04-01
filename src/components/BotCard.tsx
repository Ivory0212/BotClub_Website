"use client";

import Link from "next/link";
import { useI18n } from "@/components/i18n/I18nProvider";
import type { Bot } from "@/types";
import { formatWinRate, formatPrice } from "@/lib/utils";

export default function BotCard({ bot }: { bot: Bot }) {
  const { t } = useI18n();
  const rankBadge =
    bot.rank === 1
      ? "🥇"
      : bot.rank === 2
        ? "🥈"
        : bot.rank === 3
          ? "🥉"
          : `#${bot.rank}`;

  const cReturn = bot.cumulative_return ?? 0;

  return (
    <Link
      href={`/bot/${bot.id}`}
      className="group flex flex-col rounded-xl border border-zinc-800 bg-zinc-900/50 p-4 transition-all hover:border-emerald-500/50 hover:bg-zinc-900"
    >
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <span className="text-3xl">{bot.avatar_emoji}</span>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-white">{bot.name}</span>
              <span className="rounded bg-zinc-800 px-1.5 py-0.5 text-xs text-zinc-400">
                {bot.type_label}
              </span>
            </div>
            <div className="mt-0.5 text-sm text-zinc-500">
              {t("botCard.aliveDays", { n: bot.alive_days })}
            </div>
          </div>
        </div>
        <div className="text-right">
          <div className="text-lg font-bold text-zinc-300">{rankBadge}</div>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-4 gap-2">
        <div className="rounded-lg bg-zinc-800/50 px-2 py-2 text-center">
          <div className="text-xs text-zinc-500">{t("botCard.winRate")}</div>
          <div className="mt-0.5 font-mono text-sm font-bold text-emerald-400">
            {formatWinRate(bot.win_rate)}
          </div>
        </div>
        <div className="rounded-lg bg-zinc-800/50 px-2 py-2 text-center">
          <div className="text-xs text-zinc-500">{t("botCard.pl")}</div>
          <div
            className={`mt-0.5 font-mono text-sm font-bold ${cReturn >= 0 ? "text-emerald-400" : "text-rose-400"}`}
          >
            {cReturn >= 0 ? "+" : ""}
            {cReturn.toFixed(0)}
          </div>
        </div>
        <div className="rounded-lg bg-zinc-800/50 px-2 py-2 text-center">
          <div className="text-xs text-zinc-500">{t("botCard.accuracy")}</div>
          <div className="mt-0.5 font-mono text-sm font-bold text-blue-400">
            {((bot.accuracy ?? 0) * 100).toFixed(0)}%
          </div>
        </div>
        <div className="rounded-lg bg-zinc-800/50 px-2 py-2 text-center">
          <div className="text-xs text-zinc-500">{t("botCard.price")}</div>
          <div className="mt-0.5 font-mono text-sm font-bold text-amber-400">
            {formatPrice(bot.price)}
          </div>
        </div>
      </div>
    </Link>
  );
}
