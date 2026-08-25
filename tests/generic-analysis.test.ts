import { describe, expect, it, vi } from "vitest";
import { computeGenericAnalysis, normalizeGenericBoards, parseGenericValue } from "../src/lib/generic-analysis";
import { fetchBoards } from "../src/lib/monday";

const rawBoard = (id: string, name: string, columns: { id: string; title: string; type: string }[], rows: { id: string; name: string; group?: string; values: Record<string, string> }[]) => ({
  id,
  name,
  description: null,
  groups: [{ id: "g", title: "Main" }],
  rawColumns: columns,
  rows: rows.map((row) => ({
    id: row.id,
    name: row.name,
    group: row.group ?? "Main",
    cells: columns.map((column) => ({
      columnId: column.id,
      columnName: column.title,
      columnType: column.type,
      rawText: row.values[column.id] ?? "",
      rawValue: row.values[column.id] ? JSON.stringify(row.values[column.id]) : null,
      normalized: null,
    })),
  })),
  itemCount: rows.length,
  fetchedItemCount: rows.length,
  truncated: false,
});

describe("generic Monday board analysis", () => {
  it("parses numbers, currency, percentages, booleans, dates, and empty values", () => {
    expect(parseGenericValue("₹1,234.50", null)).toBe(1234.5);
    expect(parseGenericValue("42%", null)).toBe(0.42);
    expect(parseGenericValue("yes", null)).toBe(true);
    expect(parseGenericValue("", null)).toBeNull();
    expect(parseGenericValue("Aug 25, 2026", null, "date")).toBe("2026-08-25");
  });

  it("infers semantic roles with confidence and caveats for unfamiliar column names", () => {
    const [board] = normalizeGenericBoards([rawBoard("1", "Odd Schema", [
      { id: "v", title: "Gross Rs", type: "numbers" },
      { id: "x", title: "Mystery Field", type: "text" },
    ], [{ id: "i1", name: "A", values: { v: "1,000", x: "alpha" } }])]);

    expect(board.columns.find((column) => column.id === "v")?.role).toBe("amount/currency");
    const mystery = board.columns.find((column) => column.id === "x");
    expect(mystery?.role).toBe("free text");
    expect(mystery?.confidence).toBeLessThan(0.7);
    expect(mystery?.caveat).toMatch(/low confidence/i);
  });

  it("computes deterministic aggregations for one arbitrary board", () => {
    const boards = normalizeGenericBoards([rawBoard("1", "Projects", [
      { id: "status", title: "Current State", type: "status" },
      { id: "budget", title: "Budget Amount", type: "numbers" },
    ], [
      { id: "i1", name: "Alpha", values: { status: "Open", budget: "₹1,000" } },
      { id: "i2", name: "Beta", values: { status: "Done", budget: "2,500" } },
    ])]);

    const result = computeGenericAnalysis("What is the total budget and status distribution?", boards);

    expect("metrics" in result && result.metrics.some((metric) => metric.label === "Budget Amount" && metric.value.includes("3,500"))).toBe(true);
    expect("insights" in result && result.insights.join(" ")).toMatch(/Open|Done/);
  });

  it("supports several mixed-schema boards and reports compatible cross-board fields", () => {
    const boards = normalizeGenericBoards([
      rawBoard("1", "Sales", [{ id: "company", title: "Client Company", type: "text" }, { id: "amount", title: "Deal Value", type: "numbers" }], [{ id: "a", name: "A", values: { company: "Acme", amount: "100" } }]),
      rawBoard("2", "Delivery", [{ id: "company", title: "Client Company", type: "text" }, { id: "due", title: "Due Date", type: "date" }], [{ id: "b", name: "B", values: { company: "Acme", due: "2026-09-01" } }]),
    ]);

    const result = computeGenericAnalysis("Compare customers across boards", boards);

    expect("sources" in result && result.sources).toHaveLength(2);
    expect("insights" in result && result.insights.join(" ")).toMatch(/cross-board relationships/i);
  });

  it("asks for clarification on ambiguous performance questions", () => {
    const boards = normalizeGenericBoards([rawBoard("1", "Metrics", [
      { id: "score", title: "Win Probability", type: "numbers" },
      { id: "status", title: "Status", type: "status" },
    ], [{ id: "a", name: "A", values: { score: "50%", status: "Open" } }])]);

    const result = computeGenericAnalysis("How is performance?", boards);

    expect("clarification" in result && result.clarification).toMatch(/Which detected metric/i);
  });

  it("paginates and enforces row limits", async () => {
    const pageOne = Array.from({ length: 2 }, (_, index) => ({ id: `i${index}`, name: `Item ${index}`, group: { title: "Main" }, column_values: [] }));
    const pageTwo = [{ id: "i2", name: "Item 2", group: { title: "Main" }, column_values: [] }];
    const fetchMock = vi.fn(async (_url, init) => {
      const body = JSON.parse((init as RequestInit).body as string) as { query: string };
      if (body.query.includes("next_items_page")) return Response.json({ data: { next_items_page: { cursor: "still-more", items: pageTwo } } });
      return Response.json({ data: { boards: [{ id: "1", name: "Large Board", items_count: 10, groups: [], columns: [], items_page: { cursor: "cursor-1", items: pageOne } }] } });
    });
    vi.stubGlobal("fetch", fetchMock);

    const boards = await fetchBoards({ token: "temporary-token-secret", boardIds: ["1"] }, 3);

    expect(boards[0].fetchedItemCount).toBe(3);
    expect(boards[0].truncated).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    vi.restoreAllMocks();
  });
});
