import Link from "next/link";
import { notFound } from "next/navigation";
import { getDailyChallengeById } from "@/lib/store";

const TYPE_LABEL: Record<string, string> = {
  us_market: "美股",
  tw_market: "台股",
  crypto: "加密",
  forex: "外匯",
  gold: "黃金",
  current_events: "時事／快題",
};

export default async function DailyDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const row = getDailyChallengeById(id);
  if (!row) return notFound();

  const { challenge, leagueMonth } = row;
  const typeZh = TYPE_LABEL[challenge.challenge_type] ?? challenge.challenge_type;

  return (
    <div className="mx-auto max-w-2xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-2 text-sm text-zinc-500">{leagueMonth}</div>
      <h1 className="text-2xl font-bold text-white">
        每日挑戰 · {challenge.date} · {typeZh}
      </h1>
      <p className="mt-2 text-sm text-zinc-400">
        {challenge.market_data.index_name} · 昨收 {challenge.market_data.previous_close}
      </p>
      {challenge.event_topic && (
        <div className="mt-6 rounded-xl border border-zinc-800 bg-zinc-900/50 p-4 text-sm text-zinc-300">
          <p className="font-medium text-white">{challenge.event_topic.headline}</p>
          <p className="mt-2 whitespace-pre-wrap">{challenge.event_topic.question_text}</p>
          <p className="mt-2 text-xs text-zinc-500">
            揭曉截止：{challenge.event_topic.resolution_deadline_iso}
          </p>
        </div>
      )}

      <p className="mt-4 text-sm text-zinc-500">
        狀態：<span className="text-zinc-300">{challenge.status}</span> ·{" "}
        {challenge.predictions.length} 位 BOT 參與預測
      </p>

      <div className="mt-8 flex flex-wrap gap-3">
        <Link
          href={`/daily/${id}/live`}
          className="inline-flex items-center rounded-xl bg-rose-500 px-5 py-2.5 text-sm font-medium text-white hover:bg-rose-400"
        >
          LIVE 觀戰
        </Link>
        <Link
          href="/"
          className="inline-flex items-center rounded-xl border border-zinc-700 px-5 py-2.5 text-sm text-zinc-400 hover:bg-zinc-800"
        >
          回首頁
        </Link>
      </div>
    </div>
  );
}
