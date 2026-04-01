"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useI18n } from "@/components/i18n/I18nProvider";

async function parseResponseBody(res: Response): Promise<unknown> {
  const text = await res.text();
  if (!text.trim()) return null;
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return { raw: text };
  }
}

export default function RunRoundButton({ seasonId }: { seasonId: string }) {
  const { t } = useI18n();
  const [loading, setLoading] = useState(false);
  const [elapsedSec, setElapsedSec] = useState(0);
  const [message, setMessage] = useState<{ type: "ok" | "err"; text: string } | null>(null);
  const router = useRouter();
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!loading) {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
      return;
    }
    setElapsedSec(0);
    timerRef.current = setInterval(() => {
      setElapsedSec((s) => s + 1);
    }, 1000);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [loading]);

  async function handleRunRound() {
    setMessage(null);
    setLoading(true);
    try {
      const res = await fetch("/api/season/next-round", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ seasonId }),
      });

      const body = await parseResponseBody(res);

      if (res.ok) {
        const data = body as { roundId?: string; gameName?: string } | null;
        if (data && typeof data === "object" && data.roundId) {
          setMessage({
            type: "ok",
            text: t("runRound.doneOpen", { game: data.gameName ?? "—" }),
          });
          router.push(`/round/${data.roundId}`);
        } else {
          setMessage({ type: "ok", text: t("runRound.updated") });
          router.refresh();
        }
      } else {
        let errText = t("runRound.fail");
        if (body && typeof body === "object" && "error" in body && typeof (body as { error: unknown }).error === "string") {
          errText = (body as { error: string }).error;
        } else if (
          body &&
          typeof body === "object" &&
          "raw" in body &&
          typeof (body as { raw: unknown }).raw === "string"
        ) {
          const raw = (body as { raw: string }).raw;
          errText = raw.length > 200 ? `${raw.slice(0, 200)}…` : raw;
        } else {
          errText = t("runRound.errorHttp", { status: res.status });
        }
        setMessage({ type: "err", text: errText });
      }
    } catch (e) {
      setMessage({ type: "err", text: e instanceof Error ? e.message : t("runRound.network") });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col items-center gap-3">
      <button
        type="button"
        onClick={handleRunRound}
        disabled={loading}
        className="inline-flex h-14 items-center gap-3 rounded-xl bg-rose-500 px-8 text-lg font-bold text-white transition-all hover:bg-rose-400 hover:shadow-lg hover:shadow-rose-500/25 disabled:opacity-50 animate-pulse-glow"
      >
        {loading ? (
          <>
            ⏳{" "}
            {elapsedSec > 0 ? t("runRound.runningSec", { n: elapsedSec }) : t("runRound.running")}
          </>
        ) : (
          <>⚔️ {t("runRound.runNext")}</>
        )}
      </button>
      {loading && <p className="max-w-md text-center text-sm text-zinc-400">{t("runRound.loadingHint")}</p>}
      {message && (
        <p
          role="alert"
          className={`max-w-lg text-center text-sm ${message.type === "err" ? "text-rose-400" : "text-emerald-400"}`}
        >
          {message.text}
        </p>
      )}
    </div>
  );
}
