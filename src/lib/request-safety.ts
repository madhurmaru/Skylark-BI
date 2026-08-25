import { z } from "zod";

export const MAX_TEMPORARY_BOARDS = 10;
export const MAX_ROWS_PER_BOARD = 500;
export const MONDAY_TIMEOUT_MS = 20_000;

export function normalizeBoardIdInput(input: string) {
  const value = input.trim();
  const urlMatch = value.match(/\/boards\/(\d{1,20})(?:\D|$)/);
  if (urlMatch) return urlMatch[1];
  if (/^\d{1,20}$/.test(value)) return value;
  return null;
}

const boardInputSchema = z.string().trim().min(1).max(300).transform((value, ctx) => {
  const id = normalizeBoardIdInput(value);
  if (!id) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Board entries must be numeric IDs or Monday board URLs." });
    return z.NEVER;
  }
  return id;
});

export const mondayConfigSchema = z.object({
  token: z.string().trim().min(10).max(300),
  boardIds: z.array(boardInputSchema).min(1, "Add at least one board.").max(MAX_TEMPORARY_BOARDS, `Use ${MAX_TEMPORARY_BOARDS} or fewer boards.`),
}).superRefine((value, ctx) => {
  const seen = new Set<string>();
  for (const [index, boardId] of value.boardIds.entries()) {
    if (seen.has(boardId)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["boardIds", index], message: "Duplicate board IDs are not allowed." });
    }
    seen.add(boardId);
  }
});

export const chatBodySchema = z.object({
  question: z.string().trim().min(3).max(1000),
  mondayConfig: mondayConfigSchema.optional(),
});

const secretish = /(token|authorization|bearer|api[_\s-]*key|secret)/i;

export function safeErrorMessage(error: unknown, fallback = "The request could not be completed.") {
  if (error instanceof z.ZodError) return "Check the request fields and try again.";
  if (!(error instanceof Error)) return fallback;
  const message = error.message || fallback;
  if (secretish.test(message)) return fallback;
  return message.slice(0, 300);
}

export function isMondayConfigurationError(message: string) {
  return /configured|board|Monday|inaccessible|rate limit|permission|authentication|API failed/i.test(message);
}
