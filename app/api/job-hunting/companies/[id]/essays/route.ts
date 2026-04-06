import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

type Params = { params: Promise<{ id: string }> };

export async function POST(request: NextRequest, { params }: Params) {
  try {
    const { id: companyId } = await params;
    const payload = await request.json();
    const question = typeof payload.question === "string" ? payload.question.trim() : "";
    const answer = typeof payload.answer === "string" ? payload.answer.trim() : "";
    const note = typeof payload.note === "string" ? payload.note.trim() : "";
    const submittedAtRaw = typeof payload.submittedAt === "string" ? payload.submittedAt : "";

    if (!question || !answer) {
      return NextResponse.json({ ok: false, error: "question/answer are required" }, { status: 400 });
    }

    const submittedAt = submittedAtRaw ? new Date(`${submittedAtRaw}T00:00:00.000Z`) : null;
    const item = await prisma.jobEssay.create({
      data: {
        companyId,
        question,
        answer,
        note: note || null,
        submittedAt: submittedAt && !Number.isNaN(submittedAt.getTime()) ? submittedAt : null
      }
    });

    return NextResponse.json({ ok: true, item });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "failed" }, { status: 500 });
  }
}
