import { MAX_ROWS_PER_BOARD } from "@/lib/request-safety";
import { money, number, percent } from "@/lib/format";
import type { BIResult, GenericBoard, GenericBoardCell, GenericBoardColumn, GenericColumnRole, Metric, QueryPlan } from "@/types/bi";

type BoardWithRawColumns = Omit<GenericBoard, "columns"> & { rawColumns?: { id: string; title: string; type: string }[] };
type Parsed = string | number | boolean | null;

const statusWords = /status|stage|phase|state|progress/i;
const dateWords = /date|deadline|due|start|end|close|created|updated|timeline|eta|delivery/i;
const amountWords = /amount|value|price|cost|revenue|sales|budget|fee|total|billing|billed|receivable|collected|currency|rs|inr|usd|eur|₹|\$/i;
const percentWords = /percent|percentage|probability|chance|conversion|margin|rate|%/i;
const personWords = /owner|person|assignee|assigned|lead|manager|kam|bd|rep|contact/i;
const companyWords = /customer|client|company|account|vendor|supplier|partner/i;
const categoryWords = /category|sector|type|segment|region|department|team|group|market|service|product/i;
const quantityWords = /qty|quantity|count|units|volume|number of/i;
const durationWords = /duration|days|hours|weeks|months|age|elapsed/i;
const idWords = /\bid\b|identifier|serial|code|number|#|ref/i;

function compact(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

export function parseGenericValue(text: string, rawValue: string | null, type = ""): Parsed {
  const raw = compact(text || "");
  if (!raw || /^(-|n\/a|null|none|blank)$/i.test(raw)) return null;
  if (/^(yes|true|done|complete)$/i.test(raw)) return true;
  if (/^(no|false|not done|incomplete)$/i.test(raw)) return false;
  const parsedRaw = rawValue ? safeJson(rawValue) : null;
  if (parsedRaw && typeof parsedRaw === "object" && "date" in parsedRaw && typeof parsedRaw.date === "string") return parsedRaw.date;
  if (/date|timeline/i.test(type)) {
    const iso = parseDate(raw);
    if (iso) return iso;
  }
  const numeric = parseNumber(raw);
  if (numeric !== null) return /%/.test(raw) ? numeric / 100 : numeric;
  const iso = parseDate(raw);
  if (iso) return iso;
  return compact(raw).replace(/\b\w/g, (m) => m.toUpperCase());
}

function safeJson(value: string) {
  try { return JSON.parse(value) as unknown; } catch { return null; }
}

function parseNumber(value: string) {
  const cleaned = value.replace(/[,₹$€£\s]/g, "").match(/-?\d+(?:\.\d+)?/);
  if (!cleaned) return null;
  const parsed = Number(cleaned[0]);
  return Number.isFinite(parsed) ? parsed : null;
}

function parseDate(value: string) {
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  const named = value.match(/^([A-Za-z]+)\s+(\d{1,2}),?\s+(\d{4})$/);
  if (named) {
    const month = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"].indexOf(named[1].slice(0, 3).toLowerCase());
    if (month >= 0) return `${named[3]}-${String(month + 1).padStart(2, "0")}-${String(Number(named[2])).padStart(2, "0")}`;
  }
  const parsed = Date.parse(`${value}T00:00:00Z`);
  if (!Number.isFinite(parsed)) return null;
  return new Date(parsed).toISOString().slice(0, 10);
}

function inferRole(column: { id: string; title: string; type: string }, samples: GenericBoardCell[]): GenericBoardColumn {
  const title = column.title;
  const type = column.type.toLowerCase();
  const values = samples.map((cell) => cell.normalized).filter((value) => value !== null);
  const numericShare = values.length ? values.filter((value) => typeof value === "number").length / values.length : 0;
  const dateShare = values.length ? values.filter((value) => typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)).length / values.length : 0;
  const boolShare = values.length ? values.filter((value) => typeof value === "boolean").length / values.length : 0;
  const uniqueShare = values.length ? new Set(values.map(String)).size / values.length : 0;
  let role: GenericColumnRole = "free text";
  let confidence = 0.45;
  if (idWords.test(title) || values.length >= 10 && uniqueShare > 0.9 && /text|numbers/.test(type)) [role, confidence] = ["identifier", 0.72];
  if (/name/i.test(title)) [role, confidence] = ["title/name", 0.74];
  if (statusWords.test(title) || /status|dropdown/.test(type)) [role, confidence] = ["status", 0.84];
  if (dateWords.test(title) || dateShare > 0.7 || /date/.test(type)) [role, confidence] = ["date", Math.max(confidence, 0.86)];
  if (amountWords.test(title) || numericShare > 0.8 && /numbers|numeric/.test(type)) [role, confidence] = ["amount/currency", amountWords.test(title) ? 0.84 : 0.62];
  if (percentWords.test(title)) [role, confidence] = ["percentage/probability", 0.86];
  if (personWords.test(title) || /people|person/.test(type)) [role, confidence] = ["owner/person", 0.82];
  if (companyWords.test(title)) [role, confidence] = ["customer/company", 0.78];
  if (categoryWords.test(title)) [role, confidence] = ["category/sector", 0.76];
  if (quantityWords.test(title)) [role, confidence] = ["quantity", 0.78];
  if (durationWords.test(title)) [role, confidence] = ["duration", 0.78];
  if (boolShare > 0.7) [role, confidence] = ["boolean", 0.7];
  if (role === "amount/currency" && percentWords.test(title)) [role, confidence] = ["percentage/probability", 0.86];
  return {
    id: column.id,
    name: title,
    type: column.type,
    role,
    confidence,
    caveat: confidence < 0.7 ? "Semantic role inferred with low confidence." : undefined,
  };
}

export function normalizeGenericBoards(boards: BoardWithRawColumns[]): GenericBoard[] {
  return boards.map((board) => {
    const rows = board.rows.map((row) => ({
      ...row,
      cells: row.cells.map((cell) => ({ ...cell, normalized: parseGenericValue(cell.rawText, cell.rawValue, cell.columnType) })),
    }));
    const columns = (board.rawColumns ?? []).map((column) => inferRole(column, rows.flatMap((row) => row.cells).filter((cell) => cell.columnId === column.id).slice(0, 50)));
    return { ...board, rows, columns };
  });
}

function queryRoleHints(question: string): GenericColumnRole[] {
  const q = question.toLowerCase();
  const roles = new Set<GenericColumnRole>();
  if (/status|stage|distribution|breakdown/.test(q)) ["status", "category/sector"].forEach((role) => roles.add(role as GenericColumnRole));
  if (/total|sum|average|avg|mean|value|amount|revenue|cost|budget/.test(q)) ["amount/currency", "quantity", "duration", "percentage/probability"].forEach((role) => roles.add(role as GenericColumnRole));
  if (/date|trend|overdue|upcoming|due|timeline/.test(q)) roles.add("date");
  if (/missing|complete|quality|blank/.test(q)) ["free text", "status", "date", "amount/currency", "category/sector"].forEach((role) => roles.add(role as GenericColumnRole));
  if (/customer|client|company/.test(q)) roles.add("customer/company");
  if (/owner|person|assignee/.test(q)) roles.add("owner/person");
  if (/sector|category|type|region/.test(q)) roles.add("category/sector");
  return [...roles];
}

function topColumns(board: GenericBoard, roles: GenericColumnRole[]) {
  const filtered = roles.length ? board.columns.filter((column) => roles.includes(column.role)) : board.columns.filter((column) => column.confidence >= 0.7);
  return filtered.sort((a, b) => b.confidence - a.confidence).slice(0, 6);
}

function cellFor(row: GenericBoard["rows"][number], columnId: string) {
  return row.cells.find((cell) => cell.columnId === columnId);
}

function distribution(values: string[]) {
  const counts = new Map<string, number>();
  for (const value of values) counts.set(value, (counts.get(value) ?? 0) + 1);
  return [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5);
}

export function computeGenericAnalysis(question: string, boards: GenericBoard[], now = new Date()): BIResult | { clarification: string } {
  const q = question.toLowerCase();
  const roles = queryRoleHints(question);
  const allColumns = boards.flatMap((board) => board.columns.map((column) => ({ board, column })));
  const usefulColumns = allColumns.filter(({ column }) => column.confidence >= 0.62);
  if (/how is performance\??$|performance\??$/.test(q)) {
    const candidates = usefulColumns.filter(({ column }) => ["amount/currency", "percentage/probability", "status", "date"].includes(column.role)).slice(0, 6);
    return { clarification: candidates.length ? `Which detected metric should I use for performance: ${candidates.map(({ board, column }) => `${board.name} ${column.name}`).join(", ")}?` : "Which metric or column should I use to evaluate performance?" };
  }
  const metrics: Metric[] = [{ label: "Connected boards", value: number(boards.length), detail: `${number(boards.reduce((sum, board) => sum + board.fetchedItemCount, 0))} rows analyzed` }];
  const insights: string[] = [];
  const caveats: string[] = [];
  const facts: Record<string, unknown>[] = [];
  for (const board of boards) {
    if (board.truncated) caveats.push(`${board.name}: analyzed ${board.fetchedItemCount} of ${board.itemCount} available rows due to row limits.`);
    for (const column of board.columns.filter((c) => c.caveat).slice(0, 3)) caveats.push(`${board.name} ${column.name}: ${column.caveat}`);
    const selected = topColumns(board, roles);
    for (const column of selected) {
      const cells = board.rows.map((row) => cellFor(row, column.id)).filter((cell): cell is GenericBoardCell => Boolean(cell));
      const present = cells.filter((cell) => cell.normalized !== null);
      const provenance = `${board.name}.${column.name}`;
      if (/missing|complete|quality|blank/.test(q)) {
        const missingRate = cells.length ? 1 - present.length / cells.length : 0;
        metrics.push({ label: `${column.name} missing`, value: percent(missingRate), detail: board.name });
        facts.push({ provenance, role: column.role, missingRate, rows: cells.length });
      } else if (["amount/currency", "quantity", "duration", "percentage/probability"].includes(column.role)) {
        const nums = present.map((cell) => cell.normalized).filter((value): value is number => typeof value === "number");
        if (nums.length) {
          const total = nums.reduce((sum, value) => sum + value, 0);
          metrics.push({ label: column.name, value: column.role === "amount/currency" ? money(total) : number(total), detail: `${board.name}, avg ${number(total / nums.length)}` });
          facts.push({ provenance, role: column.role, total, average: total / nums.length, rows: nums.length });
        }
      } else if (["status", "category/sector", "owner/person", "customer/company", "boolean"].includes(column.role)) {
        const values = present.map((cell) => String(cell.normalized));
        if (values.length) {
          const top = distribution(values);
          metrics.push({ label: column.name, value: top[0]?.[0] ?? "None", detail: `${top[0]?.[1] ?? 0}/${values.length} in ${board.name}` });
          insights.push(`${provenance} top values: ${top.map(([label, count]) => `${label} (${count})`).join(", ")}.`);
          facts.push({ provenance, role: column.role, distribution: top, rows: values.length });
        }
      } else if (column.role === "date") {
        const dates = present.map((cell) => cell.normalized).filter((value): value is string => typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)).sort();
        if (dates.length) {
          const today = now.toISOString().slice(0, 10);
          const overdue = dates.filter((date) => date < today).length;
          const upcoming = dates.filter((date) => date >= today).length;
          metrics.push({ label: column.name, value: `${dates[0]} to ${dates[dates.length - 1]}`, detail: `${board.name}, ${upcoming} upcoming` });
          facts.push({ provenance, role: column.role, min: dates[0], max: dates[dates.length - 1], overdue, upcoming, rows: dates.length });
        }
      }
    }
  }
  const compatibleNames = new Map<string, Set<string>>();
  for (const { board, column } of usefulColumns) {
    const key = column.name.toLowerCase();
    compatibleNames.set(key, (compatibleNames.get(key) ?? new Set()).add(board.name));
  }
  const relationships = [...compatibleNames.entries()].filter(([, names]) => names.size > 1).slice(0, 5);
  if (relationships.length) insights.push(`Potential cross-board relationships: ${relationships.map(([name, boardNames]) => `${name} in ${[...boardNames].join(" + ")}`).join("; ")}.`);
  if (!metrics.length || metrics.length === 1 && !insights.length) {
    return { clarification: "I found the boards, but not a suitable numeric, date, status, or categorical column for that question. Ask for a row summary, missing-data check, or name a detected column." };
  }
  const fallback = `I analyzed ${boards.length} board${boards.length === 1 ? "" : "s"} and ${boards.reduce((sum, board) => sum + board.fetchedItemCount, 0)} rows. ${metrics.slice(1, 4).map((metric) => `${metric.label}: ${metric.value}${metric.detail ? ` (${metric.detail})` : ""}`).join("; ")}.`;
  const answer = fallback;
  const plan: QueryPlan = { intent: "overview", sector: null, owner: null, status: null, startDate: null, endDate: null, needsClarification: false, clarificationQuestion: null };
  return {
    answer,
    metrics: metrics.slice(0, 8),
    insights: insights.length ? insights.slice(0, 6) : [`Detected ${usefulColumns.length} analyzable columns across the connected boards.`],
    caveats,
    sources: boards.map((board) => ({ board: board.name, rowsUsed: Math.min(board.fetchedItemCount, MAX_ROWS_PER_BOARD), rowsAvailable: board.itemCount })),
    plan,
    generatedAt: new Date().toISOString(),
  };
}

export function genericFactsForAi(result: BIResult) {
  return {
    metrics: result.metrics,
    insights: result.insights,
    caveats: result.caveats,
    sources: result.sources,
  };
}
