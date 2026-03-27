import { Topic } from "@/lib/types";

type DefaultTopic = Omit<Topic, "id" | "isActive"> & { isActive?: boolean };

export const DEFAULT_NEWS_TOPICS: DefaultTopic[] = [
  { name: "半導体", query: "半導体 semiconductor chip foundry TSMC NVIDIA HBM EUV", allocationPercent: 24, displayOrder: 1 },
  { name: "AI", query: "AI 生成AI LLM OpenAI Anthropic Google DeepMind GPU 推論", allocationPercent: 22, displayOrder: 2 },
  { name: "IT", query: "IT technology software cloud security developer platform SaaS", allocationPercent: 22, displayOrder: 3 },
  { name: "世界", query: "世界 国際 海外 geopolitics economy conflict diplomacy technology", allocationPercent: 16, displayOrder: 4 },
  { name: "日本", query: "日本 国内 政府 経済 産業 防災 重大ニュース IT 半導体 AI", allocationPercent: 16, displayOrder: 5 }
];

export const DEFAULT_RSS_FEEDS = [
  "https://rss.itmedia.co.jp/rss/2.0/itmedia_all.xml",
  "https://rss.itmedia.co.jp/rss/2.0/topstory.xml",
  "https://rss.itmedia.co.jp/rss/2.0/news_bursts.xml",
  "https://rss.itmedia.co.jp/rss/2.0/news_domestic.xml",
  "https://rss.itmedia.co.jp/rss/2.0/news_foreign.xml",
  "https://rss.itmedia.co.jp/rss/2.0/news_security.xml",
  "https://rss.itmedia.co.jp/rss/2.0/news_technology.xml",
  "https://rss.itmedia.co.jp/rss/2.0/news_industry.xml",
  "https://rss.itmedia.co.jp/rss/2.0/aiplus.xml",
  "https://rss.itmedia.co.jp/rss/2.0/enterprise.xml",
  "https://rss.itmedia.co.jp/rss/2.0/ait.xml",
  "https://rss.itmedia.co.jp/rss/2.0/ait_news.xml",
  "https://rss.itmedia.co.jp/rss/2.0/ait_coding.xml",
  "https://rss.itmedia.co.jp/rss/2.0/ait_dotnet.xml",
  "https://rss.itmedia.co.jp/rss/2.0/ait_java.xml",
  "https://rss.itmedia.co.jp/rss/2.0/ait_linux.xml",
  "https://rss.itmedia.co.jp/rss/2.0/ait_security.xml",
  "https://rss.itmedia.co.jp/rss/2.0/techtarget.xml",
  "https://rss.itmedia.co.jp/rss/2.0/tt_develop.xml",
  "https://rss.itmedia.co.jp/rss/2.0/tt_security.xml",
  "https://rss.itmedia.co.jp/rss/2.0/monoist.xml",
  "https://rss.itmedia.co.jp/rss/2.0/eetimes.xml",
  "https://rss.itmedia.co.jp/rss/2.0/edn.xml",
  "https://rss.itmedia.co.jp/rss/2.0/smartjapan.xml",
  "https://rss.itmedia.co.jp/rss/2.0/techfactory.xml",
  "https://rss.itmedia.co.jp/rss/2.0/fav.xml",
  "https://codezine.jp/rss/new/20/index.xml",
  "https://gigazine.net/news/rss_2.0/",
  "https://techcrunch.com/feed/",
  "https://techwave.jp/feed",
  "https://www.gizmodo.jp/index.xml",
  "https://nelog.jp/feed",
  "https://creive.me/feed/",
  "https://getnews.jp/feed/ext/orig",
  "https://rocketnews24.com/feed/",
  "https://news.yahoo.co.jp/rss/topics/top-picks.xml",
  "https://news.yahoo.co.jp/rss/topics/domestic.xml",
  "https://news.yahoo.co.jp/rss/topics/world.xml",
  "https://news.yahoo.co.jp/rss/topics/business.xml",
  "https://news.yahoo.co.jp/rss/topics/it.xml",
  "https://news.yahoo.co.jp/rss/topics/science.xml",
  "https://news.mynavi.jp/rss/index",
  "https://news.mynavi.jp/rss/techplus/enterprise",
  "https://news.mynavi.jp/rss/techplus/enterprise/infrastructure",
  "https://news.mynavi.jp/rss/techplus/enterprise/security",
  "https://news.mynavi.jp/rss/techplus/enterprise/engineer",
  "https://news.mynavi.jp/rss/techplus/enterprise/saas",
  "https://news.mynavi.jp/rss/techplus/enterprise/cloud",
  "https://news.mynavi.jp/rss/techplus/technology",
  "https://news.mynavi.jp/rss/techplus/technology/semiconductor",
  "https://news.mynavi.jp/rss/techplus/technology/science",
  "https://news.mynavi.jp/rss/digital/pc/ai_pc",
  "https://news.mynavi.jp/rss/digital/gadget",
  "https://semiengineering.com/feed/",
  "http://feeds.arstechnica.com/arstechnica/index",
  "https://www.marktechpost.com/feed/"
];

export function dedupeFeedUrls(feedUrls: string[]) {
  return [...new Set(feedUrls.map((feedUrl) => feedUrl.trim()).filter(Boolean))];
}
