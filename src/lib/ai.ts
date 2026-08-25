import { z } from "zod";
import type { QueryPlan } from "@/types/bi";

const planSchema = z.object({
  intent: z.enum(["pipeline", "revenue", "operations", "sector", "leadership_update", "overview"]),
  sector: z.string().nullable(), owner: z.string().nullable(), status: z.string().nullable(),
  startDate: z.string().nullable(), endDate: z.string().nullable(),
  needsClarification: z.boolean(), clarificationQuestion: z.string().nullable(),
});

const genericPlanSchema = z.object({
  needsClarification: z.boolean(),
  clarificationQuestion: z.string().nullable(),
  relevantColumns: z.array(z.string()).max(20),
});

function quarterRange(now: Date) {
  const q = Math.floor(now.getUTCMonth() / 3);
  const start = new Date(Date.UTC(now.getUTCFullYear(), q * 3, 1));
  const end = new Date(Date.UTC(now.getUTCFullYear(), q * 3 + 3, 0));
  return [start.toISOString().slice(0, 10), end.toISOString().slice(0, 10)];
}

export function heuristicPlan(question: string, now = new Date()): QueryPlan {
  const q = question.toLowerCase();
  let intent: QueryPlan["intent"] = "overview";
  if (/leadership|board update|weekly update|executive update/.test(q)) intent = "leadership_update";
  else if (/pipeline|deal|sales|funnel|closure/.test(q)) intent = "pipeline";
  else if (/revenue|billing|billed|receivable|collection|cash/.test(q)) intent = "revenue";
  else if (/operation|execution|delivery|work order|project/.test(q)) intent = "operations";
  else if (/sector/.test(q)) intent = "sector";
  const sectors = ["energy", "powerline", "renewables", "mining", "railways", "construction", "tender", "others"];
  const sector = sectors.find((s) => q.includes(s)) ?? null;
  let startDate: string | null = null, endDate: string | null = null;
  if (/this quarter|current quarter/.test(q)) [startDate, endDate] = quarterRange(now);
  return { intent, sector, owner: q.match(/owner[_\s-]*(\d+)/)?.[0]?.toUpperCase() ?? null, status: null, startDate, endDate, needsClarification: false, clarificationQuestion: null };
}

async function hfCompletion(messages: { role: string; content: string }[], json = false) {
  const token = process.env.HF_TOKEN;
  if (!token) throw new Error("HF_TOKEN is not configured.");
  const response = await fetch("https://router.huggingface.co/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: process.env.HF_MODEL || "openai/gpt-oss-120b:cheapest",
      messages, temperature: 0.1, max_tokens: json ? 700 : 900,
      ...(json ? { response_format: { type: "json_object" } } : {}),
    }),
  });
  if (!response.ok) {
    const detail = (await response.text()).slice(0, 300);
    throw new Error(`Hugging Face inference failed (${response.status}): ${detail}`);
  }
  const data = await response.json() as { choices?: { message?: { content?: string } }[] };
  const content = data.choices?.[0]?.message?.content;
  if (!content) throw new Error("Hugging Face returned an empty response.");
  return content;
}

export async function understandQuery(question: string, now = new Date()): Promise<QueryPlan> {
  const fallback = heuristicPlan(question, now);
  try {
    const content = await hfCompletion([
      { role: "system", content: `You are a strict BI query planner. Today is ${now.toISOString().slice(0, 10)}. Return JSON only with intent, sector, owner, status, startDate, endDate, needsClarification, clarificationQuestion. Intents: pipeline, revenue, operations, sector, leadership_update, overview. Resolve 'this quarter' to exact ISO dates. Treat 'energy' as the combined Powerline + Renewables sector and do not ask for clarification. Ask one concise clarification only when the requested metric or period has multiple materially different interpretations.` },
      { role: "user", content: question },
    ], true);
    return planSchema.parse(JSON.parse(content.replace(/^```json\s*|\s*```$/g, "")));
  } catch {
    return fallback;
  }
}

export async function synthesizeAnswer(question: string, facts: object, fallback: string) {
  try {
    return await hfCompletion([
      { role: "system", content: "You are Skylark's founder-level BI analyst. Answer only from the supplied computed facts. Lead with the direct answer, then explain the business meaning, risks, and one practical next action. Never invent numbers. Mention important caveats naturally. Use concise Markdown, no tables, and at most 220 words." },
      { role: "user", content: `Question: ${question}\nComputed facts: ${JSON.stringify(facts)}` },
    ]);
  } catch {
    return fallback;
  }
}

export async function synthesizeGenericAnswer(question: string, facts: object, fallback: string) {
  try {
    return await hfCompletion([
      { role: "system", content: "You analyze arbitrary Monday.com board data. Answer only from supplied deterministic facts and provenance. Do not invent totals, rows, columns, or relationships. Clearly mention ambiguity, inferred column mappings, missing data, and truncation caveats. Use concise Markdown, no tables, and at most 220 words." },
      { role: "user", content: `Question: ${question}\nComputed generic board facts: ${JSON.stringify(facts)}` },
    ]);
  } catch {
    return fallback;
  }
}

export async function understandGenericQuestion(question: string, schemaSummary: object) {
  try {
    const content = await hfCompletion([
      { role: "system", content: "You interpret questions over arbitrary Monday.com boards. Return JSON only: needsClarification, clarificationQuestion, relevantColumns. Ask clarification only when the requested metric is ambiguous from the detected columns. Do not calculate anything." },
      { role: "user", content: `Question: ${question}\nDetected normalized schema: ${JSON.stringify(schemaSummary)}` },
    ], true);
    return genericPlanSchema.parse(JSON.parse(content.replace(/^```json\s*|\s*```$/g, "")));
  } catch {
    return { needsClarification: false, clarificationQuestion: null, relevantColumns: [] };
  }
}
