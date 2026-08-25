import { afterEach, describe, expect, it, vi } from "vitest";
import { POST as chatPost } from "../src/app/api/chat/route";
import { POST as testPost } from "../src/app/api/monday/test/route";
import { fetchAssignmentBoards, fetchBoards, testBoards } from "../src/lib/monday";
import { chatBodySchema, safeErrorMessage } from "../src/lib/request-safety";

const originalEnv = { ...process.env };
const itemPage = { cursor: null, items: [] };
type FetchCall = [string | URL | Request, RequestInit | undefined];

function fetchCalls(mock: ReturnType<typeof vi.fn>) {
  return mock.mock.calls as unknown as FetchCall[];
}

function mondayBoardResponse(ids: string[]) {
  return Response.json({ data: { boards: ids.map((id) => ({
    id,
    name: `Board ${id}`,
    description: "A board",
    items_count: 0,
    groups: [{ id: "g1", title: "Main" }],
    columns: [{ id: "status", title: "Status", type: "status" }],
    items_page: itemPage,
  })) } });
}

afterEach(() => {
  vi.restoreAllMocks();
  process.env = { ...originalEnv };
});

describe("Monday credential boundaries", () => {
  it("uses server environment variables by default", async () => {
    process.env.MONDAY_API_TOKEN = "env-token-secret";
    process.env.MONDAY_DEALS_BOARD_ID = "111";
    process.env.MONDAY_WORK_ORDERS_BOARD_ID = "222";
    const fetchMock = vi.fn(async () => mondayBoardResponse(["111"]));
    vi.stubGlobal("fetch", fetchMock);

    await fetchAssignmentBoards();

    const headers = fetchCalls(fetchMock).map(([, init]) => init?.headers as Record<string, string>);
    expect(headers.every((h) => h.Authorization === "env-token-secret")).toBe(true);
  });

  it("uses temporary credentials only for the supplied request and falls back after clearing", async () => {
    process.env.MONDAY_API_TOKEN = "env-token-secret";
    process.env.MONDAY_DEALS_BOARD_ID = "111";
    process.env.MONDAY_WORK_ORDERS_BOARD_ID = "222";
    const fetchMock = vi.fn(async (_url, init) => {
      const body = JSON.parse((init as RequestInit).body as string) as { variables: { ids?: string[] } };
      return mondayBoardResponse(body.variables.ids ?? ["111"]);
    });
    vi.stubGlobal("fetch", fetchMock);

    await fetchBoards({ token: "temporary-token-secret", boardIds: ["333", "444"] });
    await fetchAssignmentBoards();

    const authorizations = fetchCalls(fetchMock).map(([, init]) => (init?.headers as Record<string, string>).Authorization);
    expect(authorizations.slice(0, 2)).toEqual(["temporary-token-secret", "temporary-token-secret"]);
    expect(authorizations.slice(2)).toEqual(["env-token-secret", "env-token-secret"]);
  });

  it("accepts numeric board IDs and Monday board URLs", () => {
    const parsed = chatBodySchema.parse({ question: "Summarize this board.", mondayConfig: { token: "temporary-token-secret", boardIds: ["111", "https://example.monday.com/boards/222/pulses/3"] } });
    expect(parsed.mondayConfig?.boardIds).toEqual(["111", "222"]);
  });

  it("rejects malformed, duplicate, and excessive board IDs", () => {
    expect(() => chatBodySchema.parse({ question: "How is pipeline?", mondayConfig: { token: "temporary-token-secret", boardIds: ["abc"] } })).toThrow();
    expect(() => chatBodySchema.parse({ question: "How is pipeline?", mondayConfig: { token: "temporary-token-secret", boardIds: ["111", "https://x.monday.com/boards/111"] } })).toThrow();
    expect(() => chatBodySchema.parse({ question: "How is pipeline?", mondayConfig: { token: "temporary-token-secret", boardIds: Array.from({ length: 11 }, (_, i) => String(i + 1)) } })).toThrow();
  });

  it("keeps Monday queries read-only", async () => {
    const fetchMock = vi.fn(async (_url, init) => {
      const body = JSON.parse((init as RequestInit).body as string) as { variables: { ids?: string[] } };
      return mondayBoardResponse(body.variables.ids ?? ["111"]);
    });
    vi.stubGlobal("fetch", fetchMock);

    await testBoards({ token: "temporary-token-secret", boardIds: ["111", "222"] });

    const body = JSON.parse((fetchCalls(fetchMock)[0][1]?.body as string)) as { query: string };
    expect(body.query).toMatch(/\bquery\b/);
    expect(body.query).not.toMatch(/\bmutation\b/i);
  });

  it("returns safe test-connection errors for invalid or inaccessible credentials", async () => {
    const secret = "temporary-token-secret";
    vi.stubGlobal("fetch", vi.fn(async () => Response.json({ errors: [{ message: `Invalid token ${secret}` }] }, { status: 401 })));

    const response = await testPost(new Request("http://test.local/api/monday/test", {
      method: "POST",
      body: JSON.stringify({ token: secret, boardIds: ["111"] }),
    }));
    const body = await response.json();

    expect(response.status).toBe(503);
    expect(JSON.stringify(body)).not.toContain(secret);
    expect(body.error).toMatch(/authentication|accessible/i);
  });

  it("rejects inaccessible boards without returning the token", async () => {
    const secret = "temporary-token-secret";
    vi.stubGlobal("fetch", vi.fn(async () => Response.json({ data: { boards: [{ id: "111", name: "Deals", items_page: itemPage }] } })));

    const response = await testPost(new Request("http://test.local/api/monday/test", {
      method: "POST",
      body: JSON.stringify({ token: secret, boardIds: ["111", "222"] }),
    }));
    const body = await response.json();

    expect(response.status).toBe(503);
    expect(body.error).toMatch(/not found|accessible/i);
    expect(JSON.stringify(body)).not.toContain(secret);
  });

  it("rejects malformed test-connection requests safely", async () => {
    const response = await testPost(new Request("http://test.local/api/monday/test", {
      method: "POST",
      body: JSON.stringify({ token: "temporary-token-secret", boardIds: ["abc"] }),
    }));
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toMatch(/board IDs|board URLs/i);
  });

  it("does not leak temporary Monday tokens to Hugging Face prompts or API responses", async () => {
    process.env.HF_TOKEN = "hf-token-secret";
    const temporaryToken = "temporary-token-secret";
    const hfBodies: string[] = [];
    const mondayAuthorizations: string[] = [];
    vi.stubGlobal("fetch", vi.fn(async (url, init) => {
      const target = String(url);
      if (target.includes("huggingface")) {
        hfBodies.push(String((init as RequestInit).body));
        return Response.json({ choices: [{ message: { content: hfBodies.length === 1 ? JSON.stringify({ intent: "overview", sector: null, owner: null, status: null, startDate: null, endDate: null, needsClarification: false, clarificationQuestion: null }) : "Safe answer" } }] });
      }
      mondayAuthorizations.push(((init as RequestInit).headers as Record<string, string>).Authorization);
      const requestBody = JSON.parse((init as RequestInit).body as string) as { variables: { ids?: string[] } };
      return mondayBoardResponse(requestBody.variables.ids ?? ["111"]);
    }));

    const response = await chatPost(new Request("http://test.local/api/chat", {
      method: "POST",
      body: JSON.stringify({ question: "Summarize status.", mondayConfig: { token: temporaryToken, boardIds: ["111"] } }),
    }));
    const bodyText = JSON.stringify(await response.json());

    expect(response.status).toBe(200);
    expect(mondayAuthorizations).toEqual([temporaryToken]);
    expect(hfBodies.join("\n")).not.toContain(temporaryToken);
    expect(bodyText).not.toContain(temporaryToken);
    expect(bodyText).not.toContain("hf-token-secret");
  });

  it("redacts secret-shaped serialized errors", () => {
    expect(safeErrorMessage(new Error("Bearer temporary-token-secret failed"))).toBe("The request could not be completed.");
  });
});
