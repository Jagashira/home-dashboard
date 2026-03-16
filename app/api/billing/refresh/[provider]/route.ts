import { NextResponse } from "next/server";
import {
  runHepcoElectricityFetch,
  runMitsuurokoGasFetch
} from "@/lib/home-billing-api";

type ProviderKey = "electricity" | "gas";

const handlers: Record<ProviderKey, () => Promise<unknown>> = {
  electricity: () => runHepcoElectricityFetch(),
  gas: () => runMitsuurokoGasFetch()
};

export async function POST(
  _request: Request,
  context: { params: Promise<{ provider: string }> }
) {
  const { provider } = await context.params;

  if (provider !== "electricity" && provider !== "gas") {
    return NextResponse.json({ ok: false, error: "Unsupported provider" }, { status: 404 });
  }

  try {
    const result = await handlers[provider]();
    return NextResponse.json({
      ok: true,
      ...(typeof result === "object" && result !== null ? result : {})
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Unexpected error"
      },
      { status: 500 }
    );
  }
}
