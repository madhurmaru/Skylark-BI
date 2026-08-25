export type MondayCell = {
  id: string;
  title: string;
  type: string;
  text: string;
  value: string | null;
};

export type MondayRecord = {
  id: string;
  name: string;
  group: string;
  cells: MondayCell[];
};

export type MondayConfig = {
  token: string;
  boardIds: string[];
};

export type AssignmentMondayConfig = {
  token: string;
  dealsBoardId: string;
  workOrdersBoardId: string;
};

export type GenericColumnRole =
  | "identifier"
  | "title/name"
  | "status"
  | "date"
  | "amount/currency"
  | "percentage/probability"
  | "owner/person"
  | "customer/company"
  | "category/sector"
  | "quantity"
  | "duration"
  | "boolean"
  | "free text";

export type GenericBoardColumn = {
  id: string;
  name: string;
  type: string;
  role: GenericColumnRole;
  confidence: number;
  caveat?: string;
};

export type GenericBoardCell = {
  columnId: string;
  columnName: string;
  columnType: string;
  rawText: string;
  rawValue: string | null;
  normalized: string | number | boolean | null;
};

export type GenericBoardRow = {
  id: string;
  name: string;
  group: string;
  cells: GenericBoardCell[];
};

export type GenericBoard = {
  id: string;
  name: string;
  description: string | null;
  groups: { id: string; title: string }[];
  columns: GenericBoardColumn[];
  rows: GenericBoardRow[];
  itemCount: number;
  fetchedItemCount: number;
  truncated: boolean;
};

export type Deal = {
  id: string;
  name: string;
  owner: string | null;
  client: string | null;
  status: string;
  stage: string;
  probability: string | null;
  probabilityWeight: number;
  value: number | null;
  tentativeCloseDate: string | null;
  actualCloseDate: string | null;
  sector: string;
  product: string | null;
  createdDate: string | null;
  issues: string[];
};

export type WorkOrder = {
  id: string;
  name: string;
  serial: string | null;
  customer: string | null;
  owner: string | null;
  sector: string;
  nature: string | null;
  executionStatus: string;
  startDate: string | null;
  endDate: string | null;
  orderValue: number | null;
  billed: number | null;
  receivable: number | null;
  collected: number | null;
  invoiceStatus: string | null;
  issues: string[];
};

export type QueryPlan = {
  intent: "pipeline" | "revenue" | "operations" | "sector" | "leadership_update" | "overview";
  sector: string | null;
  owner: string | null;
  status: string | null;
  startDate: string | null;
  endDate: string | null;
  needsClarification: boolean;
  clarificationQuestion: string | null;
};

export type Metric = { label: string; value: string; detail?: string };
export type BIResult = {
  answer: string;
  metrics: Metric[];
  insights: string[];
  caveats: string[];
  sources: { board: string; rowsUsed: number; rowsAvailable: number }[];
  plan: QueryPlan;
  generatedAt: string;
};
