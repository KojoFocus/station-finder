import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(req: NextRequest) {
  try {
    const { destination, boardingStop, helpful } = await req.json() as {
      destination: string; boardingStop: string; helpful: boolean;
    };
    if (typeof helpful !== "boolean" || !destination) {
      return NextResponse.json({ error: "invalid" }, { status: 400 });
    }
    await prisma.feedbackLog.create({
      data: { destination: destination.trim().slice(0, 200), boardingStop: boardingStop?.trim().slice(0, 200) ?? "", helpful },
    });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "failed" }, { status: 500 });
  }
}
