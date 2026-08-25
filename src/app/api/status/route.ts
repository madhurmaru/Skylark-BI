import { NextResponse } from "next/server";
import { configurationState } from "@/lib/monday";

export const dynamic = "force-dynamic";
export async function GET() {
  const config = configurationState();
  return NextResponse.json({ ready: Object.values(config).every(Boolean), config });
}
