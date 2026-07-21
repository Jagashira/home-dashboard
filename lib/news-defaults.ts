import { Topic } from "@/lib/types";

type DefaultTopic = Omit<Topic, "id" | "isActive"> & { isActive?: boolean };

export const DEFAULT_NEWS_TOPICS: DefaultTopic[] = [
  { name: "半導体", query: "半導体 semiconductor chip foundry TSMC NVIDIA HBM EUV fab", allocationPercent: 58, displayOrder: 1 },
  {
    name: "社会人必須",
    query: "経済 政策 企業 産業 法改正 金融 セキュリティ 雇用 インフラ 税 年金 規制",
    allocationPercent: 42,
    displayOrder: 2
  }
];

export const DEFAULT_RSS_FEEDS = [
  "https://rss.itmedia.co.jp/rss/2.0/topstory.xml",
  "https://rss.itmedia.co.jp/rss/2.0/news_domestic.xml",
  "https://rss.itmedia.co.jp/rss/2.0/news_security.xml",
  "https://rss.itmedia.co.jp/rss/2.0/news_technology.xml",
  "https://rss.itmedia.co.jp/rss/2.0/news_industry.xml",
  "https://rss.itmedia.co.jp/rss/2.0/enterprise.xml",
  "https://rss.itmedia.co.jp/rss/2.0/ait_news.xml",
  "https://rss.itmedia.co.jp/rss/2.0/ait_security.xml",
  "https://rss.itmedia.co.jp/rss/2.0/tt_security.xml",
  "https://rss.itmedia.co.jp/rss/2.0/monoist.xml",
  "https://rss.itmedia.co.jp/rss/2.0/eetimes.xml",
  "https://rss.itmedia.co.jp/rss/2.0/edn.xml",
  "https://codezine.jp/rss/new/20/index.xml",
  "https://techwave.jp/feed",
  "https://news.yahoo.co.jp/rss/topics/top-picks.xml",
  "https://news.yahoo.co.jp/rss/topics/domestic.xml",
  "https://news.yahoo.co.jp/rss/topics/business.xml",
  "https://news.yahoo.co.jp/rss/topics/it.xml",
  "https://news.mynavi.jp/rss/techplus/enterprise",
  "https://news.mynavi.jp/rss/techplus/enterprise/infrastructure",
  "https://news.mynavi.jp/rss/techplus/enterprise/security",
  "https://news.mynavi.jp/rss/techplus/enterprise/engineer",
  "https://news.mynavi.jp/rss/techplus/enterprise/saas",
  "https://news.mynavi.jp/rss/techplus/enterprise/cloud",
  "https://news.mynavi.jp/rss/techplus/technology",
  "https://news.mynavi.jp/rss/techplus/technology/semiconductor",
  "https://semiengineering.com/feed/",
  "http://feeds.arstechnica.com/arstechnica/index"
];

export function dedupeFeedUrls(feedUrls: string[]) {
  return [...new Set(feedUrls.map((feedUrl) => feedUrl.trim()).filter(Boolean))];
}
