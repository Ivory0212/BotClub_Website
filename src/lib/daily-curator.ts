import Anthropic from "@anthropic-ai/sdk";
import type { AgentStep, AgentToolName, CuratedEventTopic, DailyChallenge, EventResolution } from "@/types";
import { getToolsForBot, executeToolCall, type ToolDefinition } from "./tools";
import { isLLMEnabled } from "./llm";

/** Env: BOTCLUB_CURATOR_* — intel: BOTCLUB_INTEL_SOURCE + Polymarket (prediction-markets.ts); optional BOTCLUB_NEWS_* (news-client.ts). */
function getCuratorModel(): string {
  return (process.env.BOTCLUB_CURATOR_MODEL ?? "claude-sonnet-4-20250514").trim() || "claude-sonnet-4-20250514";
}

function getVerifierModel(): string {
  const v = process.env.BOTCLUB_VERIFIER_MODEL?.trim();
  return v && v.length > 0 ? v : getCuratorModel();
}

function getCuratorMinConfidence(): number {
  const raw = process.env.BOTCLUB_CURATOR_MIN_CONFIDENCE;
  if (raw === undefined || raw === "") return 62;
  const n = parseInt(raw, 10);
  if (!Number.isFinite(n)) return 62;
  return Math.min(100, Math.max(0, n));
}

function getCuratorMaxToolRounds(): number {
  const raw = process.env.BOTCLUB_CURATOR_MAX_TOOL_ROUNDS;
  if (raw === undefined || raw === "") return 4;
  const n = parseInt(raw, 10);
  if (!Number.isFinite(n)) return 4;
  return Math.min(12, Math.max(0, n));
}

let curatorClient: Anthropic | null = null;

function getCuratorClient(): Anthropic {
  if (!curatorClient) {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) throw new Error("ANTHROPIC_API_KEY is not set");
    curatorClient = new Anthropic({ apiKey });
  }
  return curatorClient;
}

function generateId(): string {
  return Math.random().toString(36).substring(2, 9) + Date.now().toString(36);
}

export function normalizeOutcomeKey(key: string): string {
  return key.trim().toLowerCase();
}

function extractJsonObject(text: string): Record<string, unknown> | null {
  const fence = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const raw = fence ? fence[1] : text;
  const start = raw.lastIndexOf("{");
  const end = raw.lastIndexOf("}");
  if (start === -1 || end <= start) return null;
  try {
    return JSON.parse(raw.slice(start, end + 1)) as Record<string, unknown>;
  } catch {
    return null;
  }
}

function endOfLeagueMonthIso(monthStr: string): string {
  const parts = monthStr.split("-").map(Number);
  const y = parts[0] ?? new Date().getFullYear();
  const m = parts[1] ?? new Date().getMonth() + 1;
  const last = new Date(y, m, 0, 23, 59, 59);
  return last.toISOString();
}

const CURATOR_SYSTEM = `你是 BotClub 的「每日出題策展人」——專門從時事、金融市場、地緣政治對資產的影響、體育賽果等領域，設計「可被客觀驗證」的預測題。

鐵律（違反任一條就必須 propose=false）：
1. 題目必須在 resolution_deadline_iso 之前能有公認答案（例如：收盤價、官方新聞稿、賽果、經濟數據公布值）。
2. 答案必須可從公開來源核對；不要出「無法驗證的觀點題」或模糊題。
3. 若目前沒有適合的題材，或證據不足、deadline 落在聯賽結束之後，就不要硬出題（propose=false）。
4. valid_outcomes 的每個 key 必須簡短、互斥、涵蓋所有可能結果（通常 yes/no、up/down、或 A/B/C）。
5. curator_confidence 是你對「題目與驗證方式是否嚴謹」的評分；低於主辦門檻會被捨棄。
6. search_news 工具會列出 Polymarket（公開 Gamma API）上「仍開盤、流動性高、結算日在近期」的議題；請從中挑有公信力的可驗證主軸設計題目，勿把賭盤規則當唯一法源，必要時改寫成你可獨立核對的版本。

請用繁體中文撰寫 headline、question_text、verification_plan、news_anchors。

最後回覆必須包含且僅包含一個 JSON 物件（可包在 markdown code fence 內），格式如下：

成功出題：
{"propose":true,"headline":"...","question_text":"...","resolution_type":"yes_no|up_down|multi_choice","valid_outcomes":["yes","no"],"resolution_deadline_iso":"ISO-8601","verification_plan":"...","news_anchors":"...","curator_confidence":75}

放棄出題：
{"propose":false,"reason":"為何不宜出題"}`;

interface ToolUseBlock {
  type: "tool_use";
  id: string;
  name: string;
  input: Record<string, unknown>;
}

async function runCuratorToolLoop(userPrompt: string): Promise<{ text: string; steps: AgentStep[] }> {
  const tools = getToolsForBot(["search_news", "analyze_sentiment"] as AgentToolName[]);
  const claudeTools = tools.map((t: ToolDefinition) => ({
    name: t.name,
    description: t.description,
    input_schema: t.input_schema as Anthropic.Messages.Tool["input_schema"],
  }));

  type MsgContent = Anthropic.Messages.ContentBlockParam;
  const messages: { role: "user" | "assistant"; content: string | MsgContent[] }[] = [
    { role: "user", content: userPrompt },
  ];
  const steps: AgentStep[] = [];
  let lastText = "";
  const maxRounds = getCuratorMaxToolRounds();

  for (let round = 0; round <= maxRounds; round++) {
    const response = await getCuratorClient().messages.create({
      model: getCuratorModel(),
      max_tokens: 4096,
      temperature: 0.25,
      system: CURATOR_SYSTEM,
      tools: claudeTools,
      messages,
    });

    const toolUseBlocks: ToolUseBlock[] = [];
    let textContent = "";

    for (const block of response.content) {
      if (block.type === "text") {
        textContent += block.text;
        steps.push({
          step_number: steps.length + 1,
          type: "thinking",
          content: block.text,
          timestamp: new Date().toISOString(),
        });
      } else if (block.type === "tool_use") {
        toolUseBlocks.push(block as unknown as ToolUseBlock);
      }
    }

    lastText = textContent || lastText;

    if (toolUseBlocks.length === 0 || round === maxRounds) {
      return { text: lastText + textContent, steps };
    }

    const toolResults: MsgContent[] = [];
    for (const toolBlock of toolUseBlocks) {
      steps.push({
        step_number: steps.length + 1,
        type: "tool_call",
        content: `Calling ${toolBlock.name}`,
        tool_name: toolBlock.name,
        tool_input: toolBlock.input,
        timestamp: new Date().toISOString(),
      });
      const result = await executeToolCall(toolBlock.name as AgentToolName, toolBlock.input);
      steps.push({
        step_number: steps.length + 1,
        type: "tool_result",
        content: result.slice(0, 2000),
        tool_name: toolBlock.name,
        tool_output: result,
        timestamp: new Date().toISOString(),
      });
      toolResults.push({
        type: "tool_result",
        tool_use_id: toolBlock.id,
        content: result,
      } as unknown as MsgContent);
    }

    messages.push({ role: "assistant", content: response.content as unknown as MsgContent[] });
    messages.push({ role: "user", content: toolResults });
  }

  return { text: lastText, steps };
}

function parseCuratedTopic(
  parsed: Record<string, unknown>,
): { ok: true; topic: CuratedEventTopic } | { ok: false; reason: string } {
  if (parsed.propose !== true) {
    const reason = typeof parsed.reason === "string" ? parsed.reason : "策展人未出題";
    return { ok: false, reason };
  }

  const headline = typeof parsed.headline === "string" ? parsed.headline.trim() : "";
  const question_text = typeof parsed.question_text === "string" ? parsed.question_text.trim() : "";
  const resolution_type = parsed.resolution_type as CuratedEventTopic["resolution_type"];
  const rawOutcomes = parsed.valid_outcomes;
  const deadline = typeof parsed.resolution_deadline_iso === "string" ? parsed.resolution_deadline_iso.trim() : "";
  const verification_plan =
    typeof parsed.verification_plan === "string" ? parsed.verification_plan.trim() : "";
  const news_anchors = typeof parsed.news_anchors === "string" ? parsed.news_anchors.trim() : "";
  const conf = typeof parsed.curator_confidence === "number" ? parsed.curator_confidence : 0;

  if (!headline || !question_text || !deadline || !verification_plan) {
    return { ok: false, reason: "策展 JSON 缺少必要欄位" };
  }

  if (!["yes_no", "up_down", "multi_choice"].includes(resolution_type)) {
    return { ok: false, reason: "resolution_type 無效" };
  }

  if (!Array.isArray(rawOutcomes) || rawOutcomes.length < 2) {
    return { ok: false, reason: "valid_outcomes 至少兩個選項" };
  }

  const valid_outcomes = rawOutcomes.map((o) => normalizeOutcomeKey(String(o))).filter(Boolean);
  if (valid_outcomes.length < 2) {
    return { ok: false, reason: "valid_outcomes 正規化後不足" };
  }

  const minConf = getCuratorMinConfidence();
  if (conf < minConf) {
    return { ok: false, reason: `策展信心 ${conf} 低於門檻 ${minConf}（BOTCLUB_CURATOR_MIN_CONFIDENCE），依規定不出題` };
  }

  const dedup = [...new Set(valid_outcomes)];
  const topic: CuratedEventTopic = {
    headline,
    question_text,
    resolution_type,
    valid_outcomes: dedup,
    resolution_deadline_iso: deadline,
    verification_plan,
    news_anchors: news_anchors || "（見策展搜尋紀錄）",
    curator_confidence: conf,
  };

  return { ok: true, topic };
}

export type CurateResult =
  | { skip: true; reason: string; audit_steps?: AgentStep[] }
  | { skip: false; topic: CuratedEventTopic; audit_steps: AgentStep[] };

/** UI maps this to a friendly “early access” line; do not show raw API-key text. */
export const CURATOR_OFFLINE_REASON_CODE = "__CURATOR_OFFLINE__";

/**
 * 定時任務呼叫：搜尋新聞 → 謹慎決定是否出題。沒有合格題目則 skip（不硬出）。
 */
export async function curateEventTopicWithLLM(params: {
  league_month: string;
  now_iso?: string;
}): Promise<CurateResult> {
  if (!isLLMEnabled()) {
    return { skip: true, reason: CURATOR_OFFLINE_REASON_CODE };
  }

  const now = params.now_iso ?? new Date().toISOString();
  const leagueEnd = endOfLeagueMonthIso(params.league_month);

  const userPrompt = `現在時間（UTC 語意）：${now}
本聯賽月份：${params.league_month}，聯賽月底結束時間約：${leagueEnd}

請先使用 search_news（必要時 analyze_sentiment）搜尋「最近數小時至數日內」與金融市場、油價、地緣政治、美股／台股大盤、體育決賽、央行／數據公布等相關、且能在截止前有公認答案的主題。

若沒有合格題材，回 propose:false。
若有，設計一題給參賽 BOT 預測，並確保 resolution_deadline_iso 不晚於聯賽結束，且早於或等於你能取得權威答案的時間。`;

  try {
    const { text, steps } = await runCuratorToolLoop(userPrompt);
    const parsed = extractJsonObject(text);
    if (!parsed) {
      return { skip: true, reason: "策展人未輸出可解析 JSON", audit_steps: steps };
    }
    const out = parseCuratedTopic(parsed);
    if (!out.ok) {
      return { skip: true, reason: out.reason, audit_steps: steps };
    }
    const deadlineMs = new Date(out.topic.resolution_deadline_iso).getTime();
    const leagueEndMs = new Date(leagueEnd).getTime();
    if (deadlineMs > leagueEndMs) {
      return {
        skip: true,
        reason: "題目揭曉時間晚於聯賽結束，已拒絕",
        audit_steps: steps,
      };
    }
    return { skip: false, topic: out.topic, audit_steps: steps };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { skip: true, reason: `策展 API 錯誤：${msg}` };
  }
}

const VERIFIER_SYSTEM = `你是 BotClub 的「答案驗證官」。你必須根據公開可查的邏輯與工具回傳的新聞摘要，判定賽題的客觀結果。

規則：
- 只輸出一個 JSON 物件。
- 若證據不足、結果尚未發生、或無法無爭議判定：{"verified":false,"reason":"..."}
- 若能判定：{"verified":true,"outcome_key":"<必須是題目給的 valid_outcomes 之一，小寫>","outcome_label":"繁中說明","verification_summary":"簡短說明依據"}

outcome_key 必須與題目 valid_outcomes（小寫）完全一致。`;

export type VerifyResult =
  | { ok: true; resolution: EventResolution }
  | { ok: false; reason: string };

/**
 * 在 deadline 之後呼叫：再次搜尋／比對，確認公佈答案並產生 EventResolution。
 */
export async function verifyEventOutcomeWithLLM(challenge: DailyChallenge): Promise<VerifyResult> {
  if (!challenge.event_topic) {
    return { ok: false, reason: "非時事題" };
  }
  if (!isLLMEnabled()) {
    return { ok: false, reason: CURATOR_OFFLINE_REASON_CODE };
  }

  const topic = challenge.event_topic;
  const outcomes = topic.valid_outcomes.join(", ");

  const userPrompt = `賽題標題：${topic.headline}
問題：${topic.question_text}
選項鍵（小寫）：${outcomes}
原訂驗證方式：${topic.verification_plan}
新聞背景：${topic.news_anchors}
截止時間：${topic.resolution_deadline_iso}

現在請用工具核對最新公開資訊，並依上述規則輸出 JSON。`;

  try {
    const { text } = await runCuratorToolLoopWithSystem(VERIFIER_SYSTEM, userPrompt);
    const parsed = extractJsonObject(text);
    if (!parsed) {
      return { ok: false, reason: "驗證官未輸出可解析 JSON" };
    }
    if (parsed.verified !== true) {
      const reason = typeof parsed.reason === "string" ? parsed.reason : "尚未可驗證";
      return { ok: false, reason };
    }
    const outcome_key = normalizeOutcomeKey(String(parsed.outcome_key ?? ""));
    const allowed = new Set(topic.valid_outcomes.map(normalizeOutcomeKey));
    if (!allowed.has(outcome_key)) {
      return { ok: false, reason: `outcome_key 不在合法選項內：${outcome_key}` };
    }
    const outcome_label = typeof parsed.outcome_label === "string" ? parsed.outcome_label : outcome_key;
    const verification_summary =
      typeof parsed.verification_summary === "string" ? parsed.verification_summary : "";

    const resolution: EventResolution = {
      resolved_at: new Date().toISOString(),
      outcome_key,
      outcome_label,
      verification_summary,
    };
    return { ok: true, resolution };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { ok: false, reason: msg };
  }
}

async function runCuratorToolLoopWithSystem(
  system: string,
  userPrompt: string,
): Promise<{ text: string; steps: AgentStep[] }> {
  const tools = getToolsForBot(["search_news", "analyze_sentiment"] as AgentToolName[]);
  const claudeTools = tools.map((t: ToolDefinition) => ({
    name: t.name,
    description: t.description,
    input_schema: t.input_schema as Anthropic.Messages.Tool["input_schema"],
  }));

  type MsgContent = Anthropic.Messages.ContentBlockParam;
  const messages: { role: "user" | "assistant"; content: string | MsgContent[] }[] = [
    { role: "user", content: userPrompt },
  ];
  const steps: AgentStep[] = [];
  let lastText = "";
  const maxRounds = getCuratorMaxToolRounds();

  for (let round = 0; round <= maxRounds; round++) {
    const response = await getCuratorClient().messages.create({
      model: getVerifierModel(),
      max_tokens: 4096,
      temperature: 0.1,
      system,
      tools: claudeTools,
      messages,
    });

    const toolUseBlocks: ToolUseBlock[] = [];
    let textContent = "";

    for (const block of response.content) {
      if (block.type === "text") {
        textContent += block.text;
        steps.push({
          step_number: steps.length + 1,
          type: "thinking",
          content: block.text,
          timestamp: new Date().toISOString(),
        });
      } else if (block.type === "tool_use") {
        toolUseBlocks.push(block as unknown as ToolUseBlock);
      }
    }

    lastText = textContent || lastText;

    if (toolUseBlocks.length === 0 || round === maxRounds) {
      return { text: lastText + textContent, steps };
    }

    const toolResults: MsgContent[] = [];
    for (const toolBlock of toolUseBlocks) {
      steps.push({
        step_number: steps.length + 1,
        type: "tool_call",
        content: `Calling ${toolBlock.name}`,
        tool_name: toolBlock.name,
        tool_input: toolBlock.input,
        timestamp: new Date().toISOString(),
      });
      const result = await executeToolCall(toolBlock.name as AgentToolName, toolBlock.input);
      steps.push({
        step_number: steps.length + 1,
        type: "tool_result",
        content: result.slice(0, 2000),
        tool_name: toolBlock.name,
        tool_output: result,
        timestamp: new Date().toISOString(),
      });
      toolResults.push({
        type: "tool_result",
        tool_use_id: toolBlock.id,
        content: result,
      } as unknown as MsgContent);
    }

    messages.push({ role: "assistant", content: response.content as unknown as MsgContent[] });
    messages.push({ role: "user", content: toolResults });
  }

  return { text: lastText, steps };
}
