import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({
    status: "ok",
    service: "xdrama-web",
    timestamp: new Date().toISOString(),
  });
}
