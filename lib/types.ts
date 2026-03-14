export type SourceType = "rss" | "gdelt" | "hackernews" | "newsapi" | "youtube" | "reddit";

export type NormalizedArticle = {
  topicName: string;
  sourceType: SourceType;
  sourceLabel: string;
  externalId?: string | null;
  title: string;
  url: string;
  publishedAt?: string | null;
  fetchedAt: string;
  content?: string | null;
  language?: string | null;
  isJapanese: boolean;
  score?: number | null;
};

export type Topic = {
  id: number;
  name: string;
  query: string;
  isActive: boolean;
  allocationPercent: number;
  displayOrder: number;
};

export type Source = {
  id: number;
  sourceType: SourceType;
  sourceName: string;
  isActive: boolean;
  configJson: string | null;
};

export type AppSettings = {
  totalRequested: number;
  days: number;
  preferJapanese: boolean;
  updatedAt: string;
};
