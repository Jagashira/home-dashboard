export type NewsArticle = {
  title: string;
  url: string;
  source?: string;
  published_date?: string;
  score?: number;
  content?: string;
};

export type NewsPayload = {
  state: string;
  attributes: {
    tool: string;
    query: string;
    total_results: number;
    top_headline?: string;
    top_url?: string;
    updated_at: string;
    metadata?: Record<string, unknown>;
    articles: NewsArticle[];
  };
};

export type NewsErrorResponse = {
  ok: false;
  error: string;
};

export type NewsApiResponse = NewsPayload | NewsErrorResponse;

export type TavilyNewsArgs = {
  query: string;
  max_results: number;
  days: number;
};
