import { NextResponse } from "next/server";
import { z } from "zod";
import { computeBI, resultEnvelope } from "@/lib/analytics";
import { synthesizeAnswer, synthesizeGenericAnswer, understandGenericQuestion, understandQuery } from "@/lib/ai";
import { computeGenericAnalysis, genericFactsForAi, normalizeGenericBoards } from "@/lib/generic-analysis";
import { fetchAssignmentBoards, fetchBoards } from "@/lib/monday";
import { normalizeRecords } from "@/lib/normalize";
import { chatBodySchema, isMondayConfigurationError, safeErrorMessage } from "@/lib/request-safety";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const { question, mondayConfig } = chatBodySchema.parse(await request.json());
    if (mondayConfig) {
      const rawBoards = await fetchBoards(mondayConfig);
      const boards = normalizeGenericBoards(rawBoards);
      const genericPlan = await understandGenericQuestion(question, {
        boards: boards.map((board) => ({
          id: board.id,
          name: board.name,
          description: board.description,
          rowsAnalyzed: board.fetchedItemCount,
          columns: board.columns.map((column) => ({ name: column.name, type: column.type, role: column.role, confidence: column.confidence })),
        })),
      });
      if (genericPlan.needsClarification && genericPlan.clarificationQuestion) return NextResponse.json({ clarification: genericPlan.clarificationQuestion });
      const computed = computeGenericAnalysis(question, boards);
      if ("clarification" in computed) return NextResponse.json({ clarification: computed.clarification });
      const answer = await synthesizeGenericAnswer(question, genericFactsForAi(computed), computed.answer);
      return NextResponse.json({ ...computed, answer });
    }
    const plan = await understandQuery(question);
    if (plan.needsClarification && plan.clarificationQuestion) {
      return NextResponse.json({ clarification: plan.clarificationQuestion, plan });
    }
    const raw = await fetchAssignmentBoards();
    const normalized = normalizeRecords(raw.deals.records, raw.workOrders.records);
    const computed = computeBI(normalized.deals, normalized.workOrders, plan);
    const answer = await synthesizeAnswer(question, { ...computed.facts, caveats: computed.caveats }, computed.fallback);
    return NextResponse.json(resultEnvelope(answer, plan, computed, normalized.deals.length, normalized.workOrders.length));
  } catch (error) {
    const message = error instanceof z.ZodError ? "Please enter a specific business question and valid board IDs or board URLs." : safeErrorMessage(error, "Unexpected error.");
    const status = error instanceof z.ZodError ? 400 : isMondayConfigurationError(message) ? 503 : 500;
    return NextResponse.json({ error: message, hint: status === 503 ? "Check Monday credentials and board access. No Monday.com data was modified." : "Retry the question. No Monday.com data was modified." }, { status });
  }
}
