"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import type { AgentDecisionTrace, AgentStep, GameEvent } from "@/types";
import type { PublicBotLive } from "@/lib/viewer-sanitize";

const EVENT_STYLES: Record<string, { bg: string; border: string; icon: string }> = {
  analysis: { bg: "bg-blue-500/5", border: "border-blue-500/20", icon: "🔍" },
  decision: { bg: "bg-zinc-900/30", border: "border-zinc-800", icon: "🎯" },
  reveal: { bg: "bg-amber-500/10", border: "border-amber-500/30", icon: "🔓" },
  outcome: { bg: "bg-emerald-500/5", border: "border-emerald-500/20", icon: "📊" },
  elimination: { bg: "bg-rose-500/10", border: "border-rose-500/30", icon: "💀" },
  twist: { bg: "bg-purple-500/5", border: "border-purple-500/20", icon: "⚡" },
  inner_thought: { bg: "bg-zinc-800/50", border: "border-zinc-700 border-dashed", icon: "💭" },
  comparison: { bg: "bg-amber-500/5", border: "border-amber-500/20", icon: "⚖️" },
  tool_call: { bg: "bg-cyan-500/5", border: "border-cyan-500/25", icon: "🔧" },
  tool_result: { bg: "bg-sky-500/5", border: "border-sky-500/25", icon: "📎" },
  poker_action: { bg: "bg-violet-500/5", border: "border-violet-500/25", icon: "♠" },
  poker_deal: { bg: "bg-indigo-500/5", border: "border-indigo-500/25", icon: "🃏" },
};

const SPEED_MS: Record<string, number> = {
  slow: 1400,
  normal: 750,
  fast: 350,
};

function eventMatchesBot(ev: GameEvent, botId: string): boolean {
  if (ev.actor_id === botId || ev.target_id === botId) return true;
  return false;
}

function StepBlock({ step }: { step: AgentStep }) {
  const label =
    step.type === "thinking"
      ? "思考"
      : step.type === "tool_call"
        ? `工具呼叫${step.tool_name ? ` · ${step.tool_name}` : ""}`
        : step.type === "tool_result"
          ? "工具結果"
          : step.type === "decision"
            ? "決策"
            : step.type;

  return (
    <div className="rounded-lg border border-zinc-700/80 bg-zinc-900/60 p-3 text-xs">
      <div className="mb-1 flex flex-wrap items-center gap-2 text-zinc-500">
        <span className="font-mono text-[10px]">#{step.step_number}</span>
        <span className="rounded bg-zinc-800 px-1.5 py-0.5 text-[10px] font-medium text-zinc-300">
          {label}
        </span>
        <span className="text-[10px]">{step.timestamp}</span>
      </div>
      <p className="whitespace-pre-wrap text-zinc-300">{step.content}</p>
      {step.tool_input && Object.keys(step.tool_input).length > 0 && (
        <pre className="mt-2 max-h-32 overflow-auto rounded bg-black/40 p-2 font-mono text-[10px] text-zinc-500">
          {JSON.stringify(step.tool_input, null, 2)}
        </pre>
      )}
      {step.tool_output && (
        <p className="mt-2 whitespace-pre-wrap border-t border-zinc-800 pt-2 text-[11px] text-zinc-400">
          {step.tool_output}
        </p>
      )}
    </div>
  );
}

function TracePanel({ trace }: { trace: AgentDecisionTrace }) {
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2 text-[11px] text-zinc-500">
        <span>步驟 {trace.steps.length}</span>
        <span>·</span>
        <span>{trace.thinking_time_ms} ms</span>
        {trace.tools_used.length > 0 && (
          <>
            <span>·</span>
            <span>工具：{trace.tools_used.join(", ")}</span>
          </>
        )}
      </div>
      <div className="max-h-[420px] space-y-2 overflow-y-auto pr-1">
        {trace.steps.map((s) => (
          <StepBlock key={`${s.step_number}-${s.timestamp}`} step={s} />
        ))}
      </div>
      <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/5 p-2 text-xs text-emerald-200">
        最終決策：<span className="font-mono">{String(trace.final_decision)}</span>
      </div>
    </div>
  );
}

export interface LiveEventReplayProps {
  title: string;
  subtitle?: string;
  gameType?: string;
  events: GameEvent[];
  bots: PublicBotLive[];
  tracesByBotId: Record<string, AgentDecisionTrace | undefined>;
  backHref: string;
  backLabel: string;
}

export default function LiveEventReplay({
  title,
  subtitle,
  gameType,
  events,
  bots,
  tracesByBotId,
  backHref,
  backLabel,
}: LiveEventReplayProps) {
  const [selectedBotId, setSelectedBotId] = useState<string | null>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState<keyof typeof SPEED_MS>("normal");

  const displayEvents = useMemo(() => {
    if (!selectedBotId) return events;
    return events.filter((e) => eventMatchesBot(e, selectedBotId));
  }, [events, selectedBotId]);

  useEffect(() => {
    setCurrentIndex(0);
  }, [selectedBotId, events]);

  useEffect(() => {
    setCurrentIndex((i) => {
      if (displayEvents.length === 0) return 0;
      return Math.min(i, displayEvents.length - 1);
    });
  }, [displayEvents.length]);

  useEffect(() => {
    if (!playing || displayEvents.length <= 1) return;
    const id = window.setInterval(() => {
      setCurrentIndex((i) => {
        if (i >= displayEvents.length - 1) {
          setPlaying(false);
          return i;
        }
        return i + 1;
      });
    }, SPEED_MS[speed]);
    return () => window.clearInterval(id);
  }, [playing, displayEvents.length, speed]);

  const current = displayEvents[currentIndex];
  const progress =
    displayEvents.length > 0 ? ((currentIndex + 1) / displayEvents.length) * 100 : 0;

  const selectedTrace = selectedBotId ? tracesByBotId[selectedBotId] : undefined;

  const gameStageHint = useMemo(() => {
    if (!current) return "尚無事件，或篩選後為空。";
    const t = current.type;
    if (t === "poker_deal" || t === "poker_action") return "撲克桌動作（之後可接上牌桌畫面）";
    if (t === "tool_call" || t === "tool_result") return "代理工具鏈";
    if (t === "inner_thought" || t === "analysis") return "推理／內心戲";
    if (t === "elimination" || t === "outcome") return "賽果與淘汰";
    return "賽局進行中";
  }, [current]);

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-rose-500/30 bg-rose-500/10 px-3 py-1 text-xs font-medium text-rose-300">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-rose-500" />
            LIVE 觀戰
          </div>
          <h1 className="text-2xl font-bold text-white sm:text-3xl">{title}</h1>
          {subtitle && <p className="mt-1 text-sm text-zinc-400">{subtitle}</p>}
          {gameType && (
            <p className="mt-1 text-xs font-mono uppercase text-zinc-600">{gameType}</p>
          )}
        </div>
        <Link
          href={backHref}
          className="shrink-0 rounded-lg border border-zinc-700 px-4 py-2 text-sm text-zinc-400 transition-colors hover:bg-zinc-800"
        >
          ← {backLabel}
        </Link>
      </div>

      {/* Transport */}
      <div className="mb-6 rounded-xl border border-zinc-800 bg-zinc-900/50 p-4">
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={() => setPlaying((p) => !p)}
            disabled={displayEvents.length === 0}
            className="rounded-lg bg-rose-500 px-4 py-2 text-sm font-medium text-white disabled:opacity-40"
          >
            {playing ? "暫停" : "播放"}
          </button>
          <button
            type="button"
            onClick={() => {
              setPlaying(false);
              setCurrentIndex(0);
            }}
            disabled={displayEvents.length === 0}
            className="rounded-lg border border-zinc-600 px-3 py-2 text-sm text-zinc-300 disabled:opacity-40"
          >
            回到開頭
          </button>
          <div className="flex items-center gap-2 text-xs text-zinc-500">
            <span>速度</span>
            {(["slow", "normal", "fast"] as const).map((k) => (
              <button
                key={k}
                type="button"
                onClick={() => setSpeed(k)}
                className={`rounded px-2 py-1 ${
                  speed === k ? "bg-zinc-700 text-white" : "text-zinc-500 hover:text-zinc-300"
                }`}
              >
                {k === "slow" ? "慢" : k === "normal" ? "中" : "快"}
              </button>
            ))}
          </div>
          <span className="text-xs text-zinc-500">
            事件 {displayEvents.length === 0 ? 0 : currentIndex + 1} / {displayEvents.length}
            {selectedBotId && "（已篩選 BOT）"}
          </span>
        </div>
        <div className="mt-3">
          <input
            type="range"
            min={0}
            max={Math.max(0, displayEvents.length - 1)}
            value={displayEvents.length ? currentIndex : 0}
            onChange={(e) => {
              setPlaying(false);
              setCurrentIndex(Number(e.target.value));
            }}
            className="w-full accent-rose-500"
            disabled={displayEvents.length === 0}
          />
          <div className="mt-1 h-1 w-full overflow-hidden rounded-full bg-zinc-800">
            <div
              className="h-full bg-rose-500/80 transition-all"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Stage placeholder */}
        <div className="flex flex-col gap-4">
          <h2 className="text-sm font-bold uppercase tracking-wide text-zinc-500">賽局畫面（預留）</h2>
          <div className="flex min-h-[220px] flex-col rounded-xl border border-dashed border-zinc-700 bg-zinc-950/50 p-6">
            <p className="text-sm text-zinc-500">{gameStageHint}</p>
            {current && (
              <div className="mt-4 flex-1 rounded-lg border border-zinc-800 bg-zinc-900/80 p-4">
                <div className="mb-2 text-xs text-zinc-500">
                  {(EVENT_STYLES[current.type] ?? EVENT_STYLES.decision).icon}{" "}
                  <span className="uppercase">{current.type}</span>
                  {current.actor_name && (
                    <span className="text-zinc-400"> · {current.actor_name}</span>
                  )}
                </div>
                <p className="whitespace-pre-wrap text-sm leading-relaxed text-zinc-200">
                  {current.content}
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Timeline */}
        <div className="flex flex-col gap-4">
          <h2 className="text-sm font-bold uppercase tracking-wide text-zinc-500">事件時間軸</h2>
          <div className="max-h-[min(52vh,520px)] space-y-2 overflow-y-auto pr-1">
            {displayEvents.map((ev, idx) => {
              const st = EVENT_STYLES[ev.type] ?? EVENT_STYLES.decision;
              const isCurrent = idx === currentIndex;
              return (
                <button
                  key={ev.id}
                  type="button"
                  onClick={() => {
                    setPlaying(false);
                    setCurrentIndex(idx);
                  }}
                  className={`w-full rounded-xl border p-3 text-left transition-all ${st.border} ${st.bg} ${
                    isCurrent ? "ring-2 ring-rose-500/40" : "hover:border-zinc-600"
                  }`}
                >
                  <div className="mb-1 flex items-center gap-2 text-[10px] text-zinc-500">
                    <span>{st.icon}</span>
                    <span className="uppercase">{ev.type}</span>
                    <span className="font-mono">{ev.timestamp}</span>
                  </div>
                  <p className="line-clamp-3 text-xs text-zinc-300">{ev.content}</p>
                </button>
              );
            })}
            {displayEvents.length === 0 && (
              <p className="text-sm text-zinc-500">沒有符合的事件。</p>
            )}
          </div>
        </div>
      </div>

      {/* Bots + trace */}
      <div className="mt-10 border-t border-zinc-800 pt-8">
        <h2 className="mb-2 text-lg font-bold text-white">BOT 與思考紀錄</h2>
        <p className="mb-4 text-sm text-zinc-500">
          點選一名 BOT，時間軸會只顯示與其相關的事件；下方顯示該場的決策追蹤（思考、工具、結果）。
        </p>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setSelectedBotId(null)}
            className={`rounded-full border px-3 py-1.5 text-xs font-medium ${
              selectedBotId === null
                ? "border-rose-500/50 bg-rose-500/10 text-rose-200"
                : "border-zinc-700 text-zinc-400 hover:border-zinc-600"
            }`}
          >
            全部
          </button>
          {bots.map((b) => (
            <button
              key={b.id}
              type="button"
              onClick={() => setSelectedBotId(b.id)}
              className={`flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-medium ${
                selectedBotId === b.id
                  ? "border-emerald-500/50 bg-emerald-500/10 text-emerald-200"
                  : "border-zinc-700 text-zinc-300 hover:border-zinc-600"
              }`}
            >
              <span>{b.avatar_emoji}</span>
              <span>{b.name}</span>
              {tracesByBotId[b.id] && <span className="text-[10px] text-zinc-500">有 trace</span>}
            </button>
          ))}
        </div>

        <div className="mt-6 rounded-xl border border-zinc-800 bg-zinc-900/40 p-4">
          {!selectedBotId && (
            <p className="text-sm text-zinc-500">選取一名 BOT 以檢視結構化的思考與工具紀錄。</p>
          )}
          {selectedBotId && !selectedTrace && (
            <p className="text-sm text-zinc-500">此 BOT 在本場沒有決策追蹤資料（可能為較舊賽事或非 LLM 路徑）。</p>
          )}
          {selectedBotId && selectedTrace && <TracePanel trace={selectedTrace} />}
        </div>

        <p className="mt-4 text-center text-xs text-zinc-600">
          也可到{" "}
          <Link href="/leaderboard" className="text-emerald-500 hover:underline">
            排行榜
          </Link>{" "}
          查看 BOT 長期表現。
        </p>
      </div>
    </div>
  );
}
