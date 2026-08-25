import type { Deal, MondayCell, MondayRecord, WorkOrder } from "@/types/bi";

const clean = (v: unknown) => String(v ?? "").replace(/\s+/g, " ").trim();
const key = (v: unknown) => clean(v).toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

const aliases: Record<string, string[]> = {
  owner: ["owner code", "bd kam personnel code", "owner"],
  client: ["client code", "customer name code", "customer code"],
  status: ["deal status", "execution status", "wo status billed"],
  stage: ["deal stage"], probability: ["closure probability"], value: ["masked deal value", "deal value"],
  tentativeClose: ["tentative close date"], actualClose: ["close date a", "close date"],
  sector: ["sector service", "sector"], product: ["product deal", "product"], created: ["created date"],
  serial: ["serial", "serial number"], nature: ["nature of work"], start: ["probable start date"], end: ["probable end date"],
  orderValue: ["total order value in rs incl of gst masked", "total order value", "order value"],
  billed: ["amount to be billed in rs incl of gst masked", "amount billed", "billed amount"],
  receivable: ["amount receivable masked", "amount receivable"],
  collected: ["collected amount in rupees incl of gst masked", "collected amount"], invoice: ["invoice status", "billing status"],
};

function score(title: string, candidate: string) {
  const a = key(title), b = key(candidate);
  if (a === b) return 100;
  if (a.includes(b) || b.includes(a)) return 60 + Math.min(a.length, b.length);
  const aw = new Set(a.split(" ")), bw = new Set(b.split(" "));
  return [...aw].filter((w) => bw.has(w)).length * 8;
}

function cell(record: MondayRecord, field: keyof typeof aliases): MondayCell | undefined {
  const candidates = aliases[field];
  return record.cells
    .map((c) => ({ c, s: Math.max(...candidates.map((x) => score(c.title, x))) }))
    .filter((x) => x.s >= 16)
    .sort((a, b) => b.s - a.s)[0]?.c;
}

function text(record: MondayRecord, field: keyof typeof aliases): string | null {
  const v = clean(cell(record, field)?.text);
  return v && !aliases[field].some((a) => key(v) === key(a)) ? v : null;
}

function numeric(record: MondayRecord, field: keyof typeof aliases): number | null {
  const raw = text(record, field);
  if (!raw) return null;
  const parsed = Number(raw.replace(/[^0-9.-]+/g, ""));
  return Number.isFinite(parsed) ? parsed : null;
}

function date(record: MondayRecord, field: keyof typeof aliases): string | null {
  const raw = text(record, field);
  if (!raw) return null;
  const iso = raw.match(/\d{4}-\d{2}-\d{2}/)?.[0];
  if (iso) return iso;
  const parsed = new Date(raw);
  return Number.isNaN(parsed.valueOf()) ? null : parsed.toISOString().slice(0, 10);
}

export function canonicalStatus(value: string | null, fallback = "Unknown") {
  const v = key(value);
  if (!v) return fallback;
  if (/won|work order received|project won/.test(v)) return "Won";
  if (/dead|lost/.test(v)) return "Lost";
  if (/hold|pause|struck|stuck/.test(v)) return "On Hold";
  if (/complete|closed/.test(v) && !/partial/.test(v)) return "Completed";
  if (/ongoing|executed|partial/.test(v)) return "Ongoing";
  if (/not started|open|lead|proposal|feasibility|qualified/.test(v)) return "Open";
  return clean(value) || fallback;
}

export function normalizeSector(value: string | null) {
  const v = key(value);
  if (!v) return "Unspecified";
  const map: [RegExp, string][] = [[/renewable|solar|wind/, "Renewables"], [/power ?line|energy/, "Powerline"], [/mine|mining/, "Mining"], [/rail/, "Railways"], [/construct/, "Construction"], [/tender/, "Tender"]];
  return map.find(([r]) => r.test(v))?.[1] ?? clean(value).replace(/\b\w/g, (m) => m.toUpperCase());
}

export function probabilityWeight(value: string | null) {
  const v = key(value);
  return v === "high" ? 0.75 : v === "medium" ? 0.5 : v === "low" ? 0.25 : 0.3;
}

export function normalizeDeal(record: MondayRecord): Deal {
  const issues: string[] = [];
  const value = numeric(record, "value");
  const probability = text(record, "probability");
  const tentativeCloseDate = date(record, "tentativeClose");
  const rawStatus = text(record, "status") ?? text(record, "stage");
  if (value === null) issues.push("missing deal value");
  if (!probability) issues.push("missing closure probability; 30% default used for weighted metrics");
  if (!tentativeCloseDate) issues.push("missing tentative close date");
  return {
    id: record.id, name: clean(record.name) || "Unnamed deal", owner: text(record, "owner"), client: text(record, "client"),
    status: canonicalStatus(rawStatus), stage: text(record, "stage") ?? "Unspecified", probability,
    probabilityWeight: probabilityWeight(probability), value, tentativeCloseDate, actualCloseDate: date(record, "actualClose"),
    sector: normalizeSector(text(record, "sector")), product: text(record, "product"), createdDate: date(record, "created"), issues,
  };
}

export function normalizeWorkOrder(record: MondayRecord): WorkOrder {
  const issues: string[] = [];
  const orderValue = numeric(record, "orderValue"), billed = numeric(record, "billed"), receivable = numeric(record, "receivable"), collected = numeric(record, "collected");
  if (orderValue === null) issues.push("missing order value");
  if (billed !== null && billed < 0) issues.push("negative billing value retained and flagged");
  if (receivable === null) issues.push("missing receivable value");
  return {
    id: record.id, name: clean(record.name) || "Unnamed work order", serial: text(record, "serial"), customer: text(record, "client"),
    owner: text(record, "owner"), sector: normalizeSector(text(record, "sector")), nature: text(record, "nature"),
    executionStatus: canonicalStatus(text(record, "status")), startDate: date(record, "start"), endDate: date(record, "end"),
    orderValue, billed, receivable, collected, invoiceStatus: text(record, "invoice"), issues,
  };
}

export function normalizeRecords(dealRecords: MondayRecord[], workOrderRecords: MondayRecord[]) {
  return { deals: dealRecords.map(normalizeDeal), workOrders: workOrderRecords.map(normalizeWorkOrder) };
}
