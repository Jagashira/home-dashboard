import { summarizeToJapanese3Lines } from "@/lib/clients/openai";

export async function summarizeArticle(input: {
  title: string;
  content: string | null;
  sourceLabel: string;
}) {
  return summarizeToJapanese3Lines({
    title: input.title,
    content: input.content ?? input.title,
    sourceLabel: input.sourceLabel
  });
}

