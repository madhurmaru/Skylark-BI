import { money, number, percent } from "@/lib/format";
import type { BIResult, Deal, Metric, QueryPlan, WorkOrder } from "@/types/bi";

const sum = (values: (number | null)[]) => values.reduce<number>((a, b) => a + (b ?? 0), 0);
const avg = (values: number[]) => values.length ? sum(values) / values.length : 0;

function sectorMatch(actual: string, requested: string | null) {
  if (!requested) return true;
  const r = requested.toLowerCase();
  if (r === "energy") return ["powerline", "renewables"].includes(actual.toLowerCase());
  return actual.toLowerCase().includes(r);
}

function dateMatch(value: string | null, plan: QueryPlan) {
  if (!plan.startDate && !plan.endDate) return true;
  if (!value) return false;
  return (!plan.startDate || value >= plan.startDate) && (!plan.endDate || value <= plan.endDate);
}

function countIssues(rows: { issues: string[] }[]) {
  const counts = new Map<string, number>();
  rows.flatMap((r) => r.issues).forEach((x) => counts.set(x, (counts.get(x) ?? 0) + 1));
  return [...counts.entries()].sort((a, b) => b[1] - a[1]);
}

function qualityCaveats(deals: Deal[], workOrders: WorkOrder[]) {
  const caveats: string[] = [];
  for (const [issue, count] of countIssues(deals).slice(0, 2)) caveats.push(`${count} deal${count === 1 ? "" : "s"}: ${issue}.`);
  for (const [issue, count] of countIssues(workOrders).slice(0, 2)) caveats.push(`${count} work order${count === 1 ? "" : "s"}: ${issue}.`);
  return caveats;
}

function pipeline(deals: Deal[], plan: QueryPlan, now: Date) {
  const sectorRows = deals.filter((d) => sectorMatch(d.sector, plan.sector));
  const rows = sectorRows.filter((d) => dateMatch(d.tentativeCloseDate, plan));
  const active = rows.filter((d) => ["Open", "On Hold"].includes(d.status));
  const valued = active.filter((d) => d.value !== null);
  const total = sum(valued.map((d) => d.value));
  const weighted = sum(valued.map((d) => (d.value ?? 0) * d.probabilityWeight));
  const overdue = active.filter((d) => d.tentativeCloseDate && d.tentativeCloseDate < now.toISOString().slice(0, 10));
  const high = active.filter((d) => d.probability?.toLowerCase() === "high");
  const metrics: Metric[] = [
    { label: "Active pipeline", value: money(total), detail: `${active.length} deals` },
    { label: "Weighted pipeline", value: money(weighted), detail: `${valued.length}/${active.length} deals valued` },
    { label: "High probability", value: `${high.length}`, detail: money(sum(high.map((d) => d.value))) },
    { label: "Overdue close dates", value: `${overdue.length}`, detail: "Still open or on hold" },
  ];
  const insights = [
    `${percent(active.length ? valued.length / active.length : 0)} of active deals have usable values.`,
    `${percent(active.length ? overdue.length / active.length : 0)} of the active pipeline has a tentative close date before today.`,
    active.length ? `Average active deal size is ${money(avg(valued.map((d) => d.value ?? 0)))}.` : "No active deals match the selected filters.",
  ];
  return { rows, active, metrics, insights, facts: { activeDeals: active.length, totalPipeline: total, weightedPipeline: weighted, highProbabilityDeals: high.length, overdueDeals: overdue.length, valueCoverage: active.length ? valued.length / active.length : 0 } };
}

function operations(workOrders: WorkOrder[], plan: QueryPlan, now: Date) {
  const sectorRows = workOrders.filter((w) => sectorMatch(w.sector, plan.sector));
  const rows = sectorRows.filter((w) => dateMatch(w.endDate ?? w.startDate, plan));
  const completed = rows.filter((w) => w.executionStatus === "Completed");
  const ongoing = rows.filter((w) => w.executionStatus === "Ongoing");
  const notStarted = rows.filter((w) => w.executionStatus === "Open");
  const overdue = rows.filter((w) => w.endDate && w.endDate < now.toISOString().slice(0, 10) && w.executionStatus !== "Completed");
  const orderValue = sum(rows.map((w) => w.orderValue));
  const billed = sum(rows.map((w) => w.billed));
  const receivable = sum(rows.map((w) => w.receivable));
  const collected = sum(rows.map((w) => w.collected));
  const metrics: Metric[] = [
    { label: "Work orders", value: number(rows.length), detail: `${completed.length} completed` },
    { label: "Order value", value: money(orderValue), detail: `${money(billed)} billed` },
    { label: "Receivables", value: money(receivable), detail: `${money(collected)} collected` },
    { label: "Schedule risk", value: `${overdue.length}`, detail: "Past end date, not complete" },
  ];
  const insights = [
    `Completion rate is ${percent(rows.length ? completed.length / rows.length : 0)}; ${ongoing.length} are ongoing and ${notStarted.length} are not started/open.`,
    `Billed value is ${percent(orderValue ? billed / orderValue : 0)} of recorded order value.`,
    `Recorded collections equal ${percent((collected + receivable) ? collected / (collected + receivable) : 0)} of collections plus receivables.`,
  ];
  return { rows, metrics, insights, facts: { workOrders: rows.length, completed: completed.length, ongoing: ongoing.length, notStarted: notStarted.length, overdue: overdue.length, orderValue, billed, receivable, collected } };
}

export function computeBI(deals: Deal[], workOrders: WorkOrder[], plan: QueryPlan, now = new Date()) {
  const p = pipeline(deals, plan, now), o = operations(workOrders, plan, now);
  let metrics: Metric[], insights: string[], rowsUsedDeals = p.rows.length, rowsUsedWO = o.rows.length;
  if (plan.intent === "pipeline") { metrics = p.metrics; insights = p.insights; rowsUsedWO = 0; }
  else if (["revenue", "operations"].includes(plan.intent)) { metrics = o.metrics; insights = o.insights; rowsUsedDeals = 0; }
  else { metrics = [...p.metrics.slice(0, 2), ...o.metrics.slice(0, 2)]; insights = [...p.insights.slice(0, 2), ...o.insights.slice(0, 2)]; }
  const scope = [plan.sector ? `${plan.sector} sector` : "all sectors", plan.startDate && plan.endDate ? `${plan.startDate} to ${plan.endDate}` : "all available dates"].join(", ");
  const fallback = `For ${scope}, ${metrics.map((m) => `${m.label.toLowerCase()} is ${m.value}${m.detail ? ` (${m.detail})` : ""}`).join("; ")}. ${insights[0] ?? ""}`;
  return {
    metrics, insights, caveats: qualityCaveats(p.rows, o.rows), fallback,
    facts: { scope, pipeline: p.facts, operations: o.facts, insights }, rowsUsedDeals, rowsUsedWO,
  };
}

export function resultEnvelope(answer: string, plan: QueryPlan, computed: ReturnType<typeof computeBI>, dealCount: number, workOrderCount: number): BIResult {
  return {
    answer, metrics: computed.metrics, insights: computed.insights, caveats: computed.caveats,
    sources: [
      { board: "Deals", rowsUsed: computed.rowsUsedDeals, rowsAvailable: dealCount },
      { board: "Work Orders", rowsUsed: computed.rowsUsedWO, rowsAvailable: workOrderCount },
    ], plan, generatedAt: new Date().toISOString(),
  };
}
