import { describe, expect, it } from "vitest";
import { computeBI } from "../src/lib/analytics";
import type { Deal, QueryPlan, WorkOrder } from "../src/types/bi";

const plan: QueryPlan = { intent: "pipeline", sector: "Energy", owner: null, status: null, startDate: "2026-01-01", endDate: "2026-03-31", needsClarification: false, clarificationQuestion: null };
const deal = (sector: string, value: number, date: string): Deal => ({ id: sector, name: sector, owner: null, client: null, status: "Open", stage: "Proposal", probability: "High", probabilityWeight: .75, value, tentativeCloseDate: date, actualCloseDate: null, sector, product: null, createdDate: null, issues: [] });
const wo: WorkOrder = { id: "w", name: "WO", serial: null, customer: null, owner: null, sector: "Mining", nature: null, executionStatus: "Completed", startDate: null, endDate: null, orderValue: 100, billed: 50, receivable: 20, collected: 30, invoiceStatus: null, issues: [] };

describe("deterministic BI", () => {
  it("treats energy as powerline plus renewables and respects quarter dates", () => {
    const result = computeBI([
      deal("Powerline", 100, "2026-02-01"), deal("Renewables", 300, "2026-03-01"),
      deal("Mining", 999, "2026-02-01"), deal("Powerline", 500, "2026-05-01"),
    ], [wo], plan, new Date("2026-02-15T00:00:00Z"));
    expect(result.facts.pipeline.activeDeals).toBe(2);
    expect(result.facts.pipeline.totalPipeline).toBe(400);
    expect(result.facts.pipeline.weightedPipeline).toBe(300);
    expect(result.rowsUsedWO).toBe(0);
  });
});
