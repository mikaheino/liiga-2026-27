// GET: onko tämän ennusteen diat jo renderöity. POST: renderöi ne.
import { NextResponse } from "next/server";
import { currentStamp, dirName, manifest, render, status, unavailable } from "@/lib/linkedin";

export const dynamic = "force-dynamic";

export async function GET() {
  const why = unavailable();
  if (why) return NextResponse.json({ unavailable: why });
  try {
    const stamp = currentStamp();
    return NextResponse.json({ stamp, dir: dirName(stamp), manifest: manifest(stamp), ...status() });
  } catch (e) {
    return NextResponse.json({ unavailable: String((e as Error).message) });
  }
}

export async function POST() {
  const why = unavailable();
  if (why) return NextResponse.json({ unavailable: why }, { status: 409 });
  return NextResponse.json({ started: render(), ...status() });
}
