export type EditorialCategory =
  | "actualites"
  | "competitions"
  | "forme"
  | "analyse"
  | "guides";

export type EditorialStatus =
  | "draft"
  | "validated"
  | "scheduled"
  | "published"
  | "rejected"
  | "failed";

export type EditorialSection = {
  heading: string;
  paragraphs: string[];
  bullets?: string[];
};

export type EditorialFaq = { question: string; answer: string };

export type EditorialContent = {
  summary: string;
  sections: EditorialSection[];
  faq: EditorialFaq[];
};

export type EditorialLink = {
  label: string;
  path: string;
  reason: string;
};

export type EditorialSource = {
  id?: string;
  title: string;
  url: string;
  publisher: string;
  excerpt?: string | null;
  publishedAt?: string | null;
  verified: boolean;
};

export type PublicEditorialArticle = {
  id: string;
  slug: string;
  category: EditorialCategory;
  title: string;
  seoTitle: string;
  seoDescription: string;
  excerpt: string;
  directAnswer: string;
  content: EditorialContent;
  internalLinks: EditorialLink[];
  qualityScore: number | null;
  wordCount: number;
  authorName: string;
  coverImage: string | null;
  coverAlt: string | null;
  coverCredit: string | null;
  coverSourceUrl: string | null;
  coverKind: "official" | "generated" | null;
  readingTimeMinutes: number;
  disclosure: string | null;
  publishedAt: string;
  updatedAt: string;
  sources: EditorialSource[];
  relatedArticles?: EditorialListItem[];
};

export type EditorialListItem = Pick<
  PublicEditorialArticle,
  | "id"
  | "slug"
  | "category"
  | "title"
  | "seoDescription"
  | "excerpt"
  | "wordCount"
  | "coverImage"
  | "coverAlt"
  | "readingTimeMinutes"
  | "publishedAt"
  | "updatedAt"
>;

export type EditorialComment = {
  id: string;
  articleId: string;
  userId: string;
  parentId: string | null;
  body: string;
  createdAt: string;
  authorName: string;
  reactions: Record<string, number>;
};
