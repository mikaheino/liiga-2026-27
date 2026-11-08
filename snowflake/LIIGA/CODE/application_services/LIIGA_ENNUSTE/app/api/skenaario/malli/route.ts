// Onko Qwen ladattu tällä palvelimella (8.11.2026): liukusäädin näkyy vain silloin.
import { NextResponse } from "next/server";
import { qwenReady } from "@/lib/qwen";

export const dynamic = "force-dynamic";
export async function GET() {
  return NextResponse.json({ qwen: await qwenReady() });
}
