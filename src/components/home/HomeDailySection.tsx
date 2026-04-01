"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useI18n } from "@/components/i18n/I18nProvider";
import { CURATOR_OFFLINE_REASON_CODE } from "@/lib/daily-curator";
import type { DailyChallenge, DailyChallengeType, GameType } from "@/types";

type SyncItem =
  | { type: DailyChallengeType; status: "created"; challengeId: string }
  | { type: DailyChallengeType; status: "exists"; challengeId: string }
  | { type: DailyChallengeType; status: "skipped"; reason: string };

type Payload = {
  ok: boolean;
  reason?: string;
  today: string;
  weekday: number;
  scheduledTypes: DailyChallengeType[];
  items: SyncItem[];
  specialToday: {
    game_type: GameType;
    scheduled_date: string;
    scheduleStatus: "upcoming" | "completed";
    gameName: string;
    roundId?: string;
  } | null;
  challengesToday: DailyChallenge[];
  recentChallenges: DailyChallenge[];
};

const SYNC_GATE_KEY = "botclub_daily_sync_gate";

export default function HomeDailySection() {
  const { t } = useI18n();
  const [data, setData] = useState<Payload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function run() {
      setLoading(true);
      setError(null);
      try {
        let json: Payload;

        const gate =
          typeof sessionStorage !== "undefined" ? sessionStorage.getItem(SYNC_GATE_KEY) : null;

        if (gate) {
          const resGet = await fetch("/api/daily/today", { cache: "no-store" });
          if (!resGet.ok) {
            const j = (await resGet.json().catch(() => ({}))) as { reason?: string };
            throw new Error(j.reason || `HTTP ${resGet.status}`);
          }
          const snap = (await resGet.json()) as Payload;
          if (snap.ok && snap.today === gate) {
            json = snap;
          } else {
            const resPost = await fetch("/api/daily/sync-today", { method: "POST", cache: "no-store" });
            if (!resPost.ok) {
              const j = (await resPost.json().catch(() => ({}))) as { reason?: string };
              throw new Error(j.reason || `HTTP ${resPost.status}`);
            }
            json = (await resPost.json()) as Payload;
          }
        } else {
          const resPost = await fetch("/api/daily/sync-today", { method: "POST", cache: "no-store" });
          if (!resPost.ok) {
            const j = (await resPost.json().catch(() => ({}))) as { reason?: string };
            throw new Error(j.reason || `HTTP ${resPost.status}`);
          }
          json = (await resPost.json()) as Payload;
        }

        if (cancelled) return;
        setData(json);
        if (json.ok && json.today && typeof sessionStorage !== "undefined") {
          sessionStorage.setItem(SYNC_GATE_KEY, json.today);
        }
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "fetch failed");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void run();
    return () => {
      cancelled = true;
    };
  }, []);

  if (loading) {
    return (
      <section className="mb-12">
        <h2 className="mb-6 text-2xl font-bold text-white">{t("home.dailyTitle")}</h2>
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-6 text-sm text-zinc-500">
          {t("home.dailyLoading")}
        </div>
      </section>
    );
  }

  if (error) {
    return (
      <section className="mb-12">
        <h2 className="mb-6 text-2xl font-bold text-white">{t("home.dailyTitle")}</h2>
        <div className="rounded-xl border border-rose-500/30 bg-rose-500/5 p-4 text-sm text-rose-300">
          {t("home.dailyFetchError")}: {error}
        </div>
      </section>
    );
  }

  if (!data || !data.ok) {
    return (
      <section className="mb-12">
        <h2 className="mb-6 text-2xl font-bold text-white">{t("home.dailyTitle")}</h2>
        <p className="text-sm text-zinc-500">{data?.reason ?? t("home.dailyNoLeague")}</p>
      </section>
    );
  }

  const skipped = data.items.filter((i): i is Extract<SyncItem, { status: "skipped" }> => i.status === "skipped");
  const visibleSkipped = skipped.filter(
    (s) => !(s.type === "current_events" && s.reason === CURATOR_OFFLINE_REASON_CODE),
  );

  function mapSkipReason(reason: string): string {
    if (reason === CURATOR_OFFLINE_REASON_CODE) return t("home.dailyCuratorBuilding");
    return reason;
  }

  function rowForChallenge(c: DailyChallenge) {
    const typeLabel = t(`dailyType.${c.challenge_type}`);
    return (
      <div
        key={c.id}
        className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-zinc-800 bg-zinc-900/50 p-4"
      >
        <div>
          <div className="text-sm font-medium text-white">
            {c.date} · {typeLabel}
          </div>
          <div className="mt-0.5 text-xs text-zinc-500">
            {c.challenge_type === "current_events" && c.event_topic
              ? `${c.event_topic.headline} · ${c.status}`
              : `${c.market_data.index_name} · ${c.status}`}
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            href={`/daily/${c.id}`}
            className="rounded-lg border border-zinc-600 px-3 py-1.5 text-xs text-zinc-300 hover:bg-zinc-800"
          >
            {t("home.summary")}
          </Link>
          <Link
            href={`/daily/${c.id}/live`}
            className="rounded-lg border border-rose-500/40 bg-rose-500/10 px-3 py-1.5 text-xs font-medium text-rose-200 hover:bg-rose-500/20"
          >
            LIVE
          </Link>
        </div>
      </div>
    );
  }

  return (
    <section className="mb-12">
      <div className="mb-4 flex flex-wrap items-end justify-between gap-2">
        <div>
          <h2 className="text-2xl font-bold text-white">{t("home.dailyTitle")}</h2>
          <p className="mt-1 max-w-2xl text-xs leading-relaxed text-zinc-500">{t("home.dailyBetaDisclaimer")}</p>
        </div>
        <span className="text-xs text-zinc-600">
          {t("home.dailyServerDate")}: {data.today}
        </span>
      </div>

      {data.specialToday && (
        <div className="mb-4 rounded-xl border border-amber-500/25 bg-amber-500/5 p-4">
          <div className="text-xs font-medium uppercase tracking-wide text-amber-400/90">
            {t("home.dailySpecialTitle")}
          </div>
          <div className="mt-1 text-lg font-semibold text-white">{data.specialToday.gameName}</div>
          <div className="mt-1 text-sm text-zinc-400">
            {data.specialToday.scheduleStatus === "upcoming"
              ? t("home.dailySpecialUpcoming")
              : t("home.dailySpecialDone")}
          </div>
          {data.specialToday.roundId && (
            <Link
              href={`/round/${data.specialToday.roundId}`}
              className="mt-3 inline-flex rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-1.5 text-xs font-medium text-amber-200 hover:bg-amber-500/20"
            >
              {t("home.dailyWatchSpecial")}
            </Link>
          )}
        </div>
      )}

      <div className="space-y-2">
        {data.challengesToday.length === 0 ? (
          <p className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-4 text-sm text-zinc-500">
            {t("home.dailyNoneToday")}
          </p>
        ) : (
          data.challengesToday.map(rowForChallenge)
        )}
      </div>

      {visibleSkipped.length > 0 && (
        <div className="mt-4 rounded-lg border border-zinc-800 bg-zinc-950/50 p-3 text-xs text-zinc-500">
          <div className="font-medium text-zinc-400">{t("home.dailySkipped")}</div>
          <ul className="mt-2 list-inside list-disc space-y-1">
            {visibleSkipped.map((s) => (
              <li key={s.type}>
                {t(`dailyType.${s.type}`)}: {mapSkipReason(s.reason)}
              </li>
            ))}
          </ul>
        </div>
      )}

      {data.recentChallenges.filter((c) => c.date !== data.today).length > 0 && (
        <div className="mt-8">
          <h3 className="mb-3 text-sm font-medium text-zinc-400">{t("home.dailyRecent")}</h3>
          <div className="space-y-2">
            {data.recentChallenges
              .filter((c) => c.date !== data.today)
              .slice(0, 8)
              .map(rowForChallenge)}
          </div>
        </div>
      )}
    </section>
  );
}
