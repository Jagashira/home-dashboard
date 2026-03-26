import { NextRequest } from "next/server";
import { getBillingReportData } from "@/lib/home-billing-report";

export async function GET(request: NextRequest) {
  const mode = request.nextUrl.searchParams.get("mode") ?? undefined;
  const period = request.nextUrl.searchParams.get("period") ?? undefined;
  const report = await getBillingReportData({ mode, period });
  const format = request.nextUrl.searchParams.get("format") === "txt" ? "txt" : "md";
  const filename = `billing-report-${report.mode}-${report.period}-${report.generatedAtIso.slice(0, 10)}.${format}`;

  return new Response(report.markdown, {
    headers: {
      "Content-Type": format === "txt" ? "text/plain; charset=utf-8" : "text/markdown; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`
    }
  });
}
