import { MAX_ROWS_PER_BOARD, MONDAY_TIMEOUT_MS } from "@/lib/request-safety";
import type { AssignmentMondayConfig, GenericBoard, MondayConfig, MondayRecord } from "@/types/bi";

const MONDAY_ENDPOINT = "https://api.monday.com/v2";

type RawItem = {
  id: string; name: string; group: { title: string };
  column_values: { id: string; text: string; value: string | null; column: { title: string; type: string } }[];
};

type RawBoard = {
  id: string;
  name: string;
  description?: string | null;
  items_count?: number | null;
  groups?: { id: string; title: string }[];
  columns?: { id: string; title: string; type: string }[];
  items_page: { cursor: string | null; items: RawItem[] };
};

export type MondayCredentials = AssignmentMondayConfig;

function defaultCredentials(): MondayCredentials {
  const token = process.env.MONDAY_API_TOKEN;
  const dealsBoardId = process.env.MONDAY_DEALS_BOARD_ID;
  const workOrdersBoardId = process.env.MONDAY_WORK_ORDERS_BOARD_ID;
  if (!token) throw new Error("MONDAY_API_TOKEN is not configured.");
  if (!dealsBoardId || !workOrdersBoardId) throw new Error("Both Monday board IDs must be configured.");
  return { token, dealsBoardId, workOrdersBoardId };
}

function mondayError(status: number, messages: string[]) {
  if (status === 401 || status === 403 || messages.some((m) => /auth|token|permission|access/i.test(m))) {
    return "Monday authentication failed or the boards are not accessible.";
  }
  if (status === 429 || messages.some((m) => /rate limit|complexity/i.test(m))) {
    return "Monday rate limit reached. Please wait a moment and try again.";
  }
  return `Monday API failed (${status}).`;
}

async function request<T>(token: string, query: string, variables: Record<string, unknown>): Promise<T> {
  const response = await fetch(MONDAY_ENDPOINT, {
    method: "POST",
    headers: { Authorization: token, "Content-Type": "application/json", "API-Version": "2025-04" },
    body: JSON.stringify({ query, variables }),
    cache: "no-store",
    signal: AbortSignal.timeout(MONDAY_TIMEOUT_MS),
  });
  const body = await response.json().catch(() => ({})) as { data?: T; errors?: { message: string }[] };
  if (!response.ok || body.errors?.length || !body.data) {
    throw new Error(mondayError(response.status, body.errors?.map((e) => e.message) ?? []));
  }
  return body.data;
}

function convert(items: RawItem[]): MondayRecord[] {
  return items.map((item) => ({
    id: item.id, name: item.name, group: item.group?.title ?? "Ungrouped",
    cells: item.column_values.map((c) => ({ id: c.id, title: c.column.title, type: c.column.type, text: c.text ?? "", value: c.value })),
  }));
}

async function readRawBoard(token: string, boardId: string, maxRows = MAX_ROWS_PER_BOARD): Promise<RawBoard> {
  const pageLimit = Math.min(100, maxRows);
  const first = await request<{ boards: RawBoard[] }>(token, `
    query BoardItems($ids: [ID!]!) {
      boards(ids: $ids) { id name description items_count groups { id title } columns { id title type } items_page(limit: ${pageLimit}) { cursor items { id name group { title } column_values { id text value column { title type } } } } }
    }`, { ids: [boardId] });
  const board = first.boards[0];
  if (!board) throw new Error(`Monday board ${boardId} was not found or is not accessible.`);
  const records = [...board.items_page.items];
  let cursor = board.items_page.cursor;
  while (cursor && records.length < maxRows) {
    const remaining = Math.min(100, maxRows - records.length);
    const next = await request<{ next_items_page: { cursor: string | null; items: RawItem[] } }>(token, `
      query NextItems($cursor: String!) { next_items_page(limit: ${remaining}, cursor: $cursor) { cursor items { id name group { title } column_values { id text value column { title type } } } } }
    `, { cursor });
    records.push(...next.next_items_page.items);
    cursor = next.next_items_page.cursor;
  }
  return { ...board, items_page: { cursor, items: records } };
}

export async function readBoard(credentials: MondayCredentials, boardId: string): Promise<{ name: string; records: MondayRecord[] }> {
  const board = await readRawBoard(credentials.token, boardId);
  return { name: board.name, records: convert(board.items_page.items) };
}

export async function fetchAssignmentBoards(override?: MondayCredentials) {
  const credentials = override ?? defaultCredentials();
  const [deals, workOrders] = await Promise.all([
    readBoard(credentials, credentials.dealsBoardId),
    readBoard(credentials, credentials.workOrdersBoardId),
  ]);
  return { deals, workOrders };
}

export const readBusinessBoards = fetchAssignmentBoards;

function toGenericBoard(board: RawBoard, maxRows: number): Omit<GenericBoard, "columns"> & { rawColumns: { id: string; title: string; type: string }[] } {
  const rawColumns = board.columns?.length ? board.columns : Array.from(
    new Map(board.items_page.items.flatMap((item) => item.column_values).map((cell) => [cell.id, { id: cell.id, title: cell.column.title, type: cell.column.type }] as const)).values(),
  );
  return {
    id: board.id,
    name: board.name,
    description: board.description?.trim() || null,
    groups: board.groups ?? [],
    rawColumns,
    rows: board.items_page.items.map((item) => ({
      id: item.id,
      name: item.name,
      group: item.group?.title ?? "Ungrouped",
      cells: item.column_values.map((cell) => ({
        columnId: cell.id,
        columnName: cell.column.title,
        columnType: cell.column.type,
        rawText: cell.text ?? "",
        rawValue: cell.value,
        normalized: null,
      })),
    })),
    itemCount: board.items_count ?? board.items_page.items.length,
    fetchedItemCount: board.items_page.items.length,
    truncated: Boolean(board.items_page.cursor) || board.items_page.items.length >= maxRows && (board.items_count ?? 0) > board.items_page.items.length,
  };
}

export async function fetchBoards(config: MondayConfig, maxRows = MAX_ROWS_PER_BOARD) {
  const boards = await Promise.all(config.boardIds.map((boardId) => readRawBoard(config.token, boardId, maxRows)));
  const found = new Set(boards.map((board) => board.id));
  const missing = config.boardIds.filter((boardId) => !found.has(boardId));
  if (missing.length) throw new Error("One or more Monday boards were not found or are not accessible.");
  return boards.map((board) => toGenericBoard(board, maxRows));
}

export async function testBoards(config: MondayConfig) {
  const boards = await fetchBoards(config);
  return {
    boards: boards.map((board) => ({
      id: board.id,
      name: board.name,
      accessible: true,
      itemCount: board.itemCount,
      columnNames: board.rawColumns.map((column) => column.title),
    })),
  };
}

export function configurationState() {
  return {
    mondayToken: Boolean(process.env.MONDAY_API_TOKEN), dealsBoard: Boolean(process.env.MONDAY_DEALS_BOARD_ID),
    workOrdersBoard: Boolean(process.env.MONDAY_WORK_ORDERS_BOARD_ID), hfToken: Boolean(process.env.HF_TOKEN),
  };
}
