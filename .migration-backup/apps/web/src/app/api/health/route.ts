import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({ status: "ok", service: "7of1-web" });
}
