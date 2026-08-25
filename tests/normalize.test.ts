import { describe, expect, it } from "vitest";
import { canonicalStatus, normalizeDeal, normalizeSector, normalizeWorkOrder, probabilityWeight } from "../src/lib/normalize";
import type { MondayRecord } from "../src/types/bi";

const record = (name: string, values: Record<string, string>): MondayRecord => ({
  id: "1", name, group: "Imported",
  cells: Object.entries(values).map(([title, text], i) => ({ id: `c${i}`, title, type: "text", text, value: JSON.stringify(text) })),
});

describe("normalization", () => {
  it("normalizes statuses and sectors", () => {
    expect(canonicalStatus("BIlled- partial completed")).toBe("Ongoing");
    expect(canonicalStatus("Pause / struck")).toBe("On Hold");
    expect(normalizeSector("Renewable Energy")).toBe("Renewables");
  });

  it("uses a disclosed default for missing probability", () => {
    expect(probabilityWeight(null)).toBe(0.3);
    const deal = normalizeDeal(record("Deal A", { "Deal Status": "Open", "Masked Deal value": "₹1,223,400", "Sector/service": "Mining" }));
    expect(deal.value).toBe(1223400);
    expect(deal.probabilityWeight).toBe(0.3);
    expect(deal.issues.join(" ")).toContain("30% default");
  });

  it("retains and flags negative billing data", () => {
    const wo = normalizeWorkOrder(record("WO A", { "Execution Status": "Completed", "Amount to be billed in Rs. (Incl. of GST) (Masked)": "-97830.60", "Sector": "Powerline" }));
    expect(wo.billed).toBe(-97830.6);
    expect(wo.issues.join(" ")).toContain("negative billing");
  });
});
