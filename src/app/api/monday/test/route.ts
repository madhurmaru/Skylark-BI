import { NextResponse } from "next/server";
import { z } from "zod";
import { testBoards } from "@/lib/monday";
import { isMondayConfigurationError, mondayConfigSchema, safeErrorMessage } from "@/lib/request-safety";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const mondayConfig = mondayConfigSchema.parse(await request.json());
    const result = await testBoards(mondayConfig);
    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof z.ZodError ? "Enter a Monday token and one or more valid board IDs or board URLs." : safeErrorMessage(error, "Unable to verify these Monday boards.");
    const status = error instanceof z.ZodError ? 400 : isMondayConfigurationError(message) ? 503 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
