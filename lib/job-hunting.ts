export type JobSite = {
  id: string;
  name: string;
  url: string;
  purpose: string;
  loginId: string;
  password: string;
  displayOrder: number;
  createdAt?: string;
  updatedAt?: string;
};

export type CompanyEntryStatus =
  | "draft"
  | "internship_interested"
  | "internship_applied"
  | "internship_interview"
  | "internship_offer"
  | "internship_done"
  | "applied"
  | "es_passed"
  | "interview"
  | "final_interview"
  | "result_waiting"
  | "offer"
  | "finished";

export const COMPANY_STATUS_OPTIONS: Array<{ value: CompanyEntryStatus; label: string }> = [
  { value: "draft", label: "草稿中" },
  { value: "internship_interested", label: "インターン検討中" },
  { value: "internship_applied", label: "インターン応募済み" },
  { value: "internship_interview", label: "インターン面接中" },
  { value: "internship_offer", label: "インターン結果待ち" },
  { value: "internship_done", label: "インターン終了" },
  { value: "applied", label: "本選考応募済み" },
  { value: "es_passed", label: "ES通過" },
  { value: "interview", label: "面接中" },
  { value: "final_interview", label: "最終面接" },
  { value: "result_waiting", label: "結果待ち" },
  { value: "offer", label: "内定" },
  { value: "finished", label: "終了" }
];

export type JobCompany = {
  id: string;
  companyName: string;
  myPageUrl: string;
  loginId: string;
  password: string;
  status: CompanyEntryStatus;
  displayOrder: number;
  createdAt?: string;
  updatedAt?: string;
};

export type JobEssay = {
  id: string;
  companyId: string;
  question: string;
  answer: string;
  submittedAt: string | null;
  note: string | null;
  createdAt?: string;
  updatedAt?: string;
};

export type JobSubmission = {
  id: string;
  companyId: string;
  itemType: string;
  status: string;
  submittedAt: string | null;
  storagePath: string | null;
  note: string | null;
  createdAt?: string;
  updatedAt?: string;
};

export type JobTimeline = {
  id: string;
  companyId: string;
  eventType: string;
  title: string;
  eventDate: string;
  status: string;
  note: string | null;
  createdAt?: string;
  updatedAt?: string;
};

export type JobUsefulLink = {
  id: string;
  companyId: string;
  label: string;
  url: string;
  note: string | null;
  createdAt?: string;
  updatedAt?: string;
};

export type JobCompanyDetail = {
  company: JobCompany;
  essays: JobEssay[];
  submissions: JobSubmission[];
  timelines: JobTimeline[];
  usefulLinks: JobUsefulLink[];
};

export type MailAccount = {
  label: string;
  address: string;
  gmailUrl: string;
  routine: string;
  searchPresets: Array<{ label: string; query: string }>;
};

export type JobResourceLink = {
  id: string;
  label: string;
  url: string;
  description: string;
};

export type JobHuntingDashboardData = {
  generatedAt: string;
  hero: {
    title: string;
    description: string;
    focus: string;
  };
  summary: {
    activeCompanies: number;
    upcomingDeadlines: number;
    pendingActions: number;
    essayCount: number;
  };
  sites: JobSite[];
  companies: JobCompany[];
  mail: MailAccount;
  resources: JobResourceLink[];
};

export const DEFAULT_JOB_SITES: Array<Omit<JobSite, "id" | "createdAt" | "updatedAt">> = [
  {
    name: "就活会議",
    url: "https://syukatsu-kaigi.jp/",
    purpose: "選考体験記、ES、企業口コミの確認",
    loginId: "tusega3104@gmail.com",
    password: "",
    displayOrder: 10
  },
  {
    name: "LabBase",
    url: "https://compass.labbase.jp/lp",
    purpose: "理系向けスカウトと研究内容ベースのマッチング確認",
    loginId: "tusega3104@gmail.com",
    password: "",
    displayOrder: 20
  },
  {
    name: "TECH OFFER",
    url: "https://techoffer.jp/",
    purpose: "理系特化のオファー確認と選考導線の管理",
    loginId: "tusega3104@gmail.com",
    password: "",
    displayOrder: 30
  },
  {
    name: "キャリタス就活",
    url: "https://job.career-tasu.jp/",
    purpose: "本選考、インターン、口コミ、スカウトの確認",
    loginId: "tusega3104@gmail.com",
    password: "",
    displayOrder: 40
  },
  {
    name: "ビズリーチ・キャンパス",
    url: "https://br-campus.jp/",
    purpose: "OB/OG 訪問とキャリア面談の導線確認",
    loginId: "tusega3104@gmail.com",
    password: "",
    displayOrder: 50
  },
  {
    name: "外資就活ドットコム",
    url: "https://gaishishukatsu.com/",
    purpose: "外資・難関企業の選考情報と締切確認",
    loginId: "tusega3104@gmail.com",
    password: "",
    displayOrder: 60
  },
  {
    name: "ONE CAREER",
    url: "https://www.onecareer.jp/",
    purpose: "口コミ、選考体験記、ES 参考の確認",
    loginId: "tusega3104@gmail.com",
    password: "",
    displayOrder: 70
  },
  {
    name: "Voice Career",
    url: "https://voicecareer.net/",
    purpose: "面接音声や OBOG 訪問の情報確認",
    loginId: "tusega3104@gmail.com",
    password: "",
    displayOrder: 80
  }
];

export const DEFAULT_JOB_COMPANIES: Array<Omit<JobCompany, "id" | "createdAt" | "updatedAt">> = [
  {
    companyName: "Mercari",
    myPageUrl: "https://careers.mercari.com/",
    loginId: "jobhunt+mercari@gmail.com",
    password: "",
    status: "applied",
    displayOrder: 10
  },
  {
    companyName: "LINEヤフー",
    myPageUrl: "https://hrmos.co/pages/linecorp/jobs",
    loginId: "jobhunt+ly@gmail.com",
    password: "",
    status: "es_passed",
    displayOrder: 20
  },
  {
    companyName: "CyberAgent",
    myPageUrl: "https://www.cyberagent.co.jp/careers/",
    loginId: "jobhunt+ca@gmail.com",
    password: "",
    status: "draft",
    displayOrder: 30
  }
];

function countActiveCompanies(companies: JobCompany[]) {
  return companies.filter((company) => company.status !== "finished" && company.status !== "internship_done").length;
}

function countPendingActions(companies: JobCompany[]) {
  return companies.filter((company) =>
    company.status === "draft" ||
    company.status === "internship_interested" ||
    company.status === "internship_offer" ||
    company.status === "applied" ||
    company.status === "result_waiting"
  ).length;
}

function countUpcomingDeadlines(companies: JobCompany[]) {
  return companies.filter((company) => company.status !== "finished" && company.status !== "internship_done").length;
}

export function getJobHuntingStaticData(companies: JobCompany[] = []) {
  const mail: MailAccount = {
    label: "就活 Gmail",
    address: "tusega3104@gmail.com",
    gmailUrl: "https://mail.google.com/mail/u/0/#inbox",
    routine: "朝に未読とスター付き、夜に各社検索プリセットを確認する",
    searchPresets: [
      {
        label: "未読のみ",
        query: "label:unread category:primary newer_than:7d"
      },
      {
        label: "締切が近いメール",
        query: "(締切 OR 期限 OR 面接 OR 日程) newer_than:14d"
      },
      {
        label: "結果待ち企業",
        query: "(選考 OR 結果 OR 合否) newer_than:21d"
      }
    ]
  };

  const resources: JobResourceLink[] = [
    {
      id: "portfolio",
      label: "ポートフォリオ",
      url: "https://github.com/Jagashira",
      description: "提出時に添付する GitHub / 成果物"
    },
    {
      id: "docs",
      label: "提出済みドキュメント",
      url: "/storage",
      description: "履歴書、成績証明書、ポートフォリオ PDF をまとめて置く想定"
    },
    {
      id: "test",
      label: "SPI / 玉手箱",
      url: "https://www.spi.recruit.co.jp/",
      description: "適性検査の受験ページと案内確認"
    }
  ];

  return {
    generatedAt: "2026-04-07",
    hero: {
      title: "Job Hunting Hub",
      description:
        "応募先ごとの ES・提出物・メール動線を一つの画面にまとめ、どの企業に何を出したかが混ざらない状態をつくる。",
      focus: "今週は応募先の状態更新とマイページ管理を優先"
    },
    summary: {
      activeCompanies: countActiveCompanies(companies),
      upcomingDeadlines: countUpcomingDeadlines(companies),
      pendingActions: countPendingActions(companies),
      essayCount: 0
    },
    companies,
    sites: [],
    mail,
    resources
  };
}
