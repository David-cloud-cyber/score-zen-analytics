import { EDITORIAL_CAMPAIGN_TOPICS } from "../src/data/editorial-campaign-topics.ts";

const expectedCount = 200;
const keys = new Set(EDITORIAL_CAMPAIGN_TOPICS.map((topic) => topic.key));
const titles = new Set(EDITORIAL_CAMPAIGN_TOPICS.map((topic) => topic.title));

if (EDITORIAL_CAMPAIGN_TOPICS.length !== expectedCount || keys.size !== expectedCount || titles.size !== expectedCount) {
  throw new Error(`Editorial campaign audit failed: expected ${expectedCount} unique topics.`);
}

if (EDITORIAL_CAMPAIGN_TOPICS.some((topic) => !topic.title.trim() || topic.queryTerms.length < 2 || topic.trendScore <= 0)) {
  throw new Error("Editorial campaign audit failed: invalid topic metadata.");
}

console.log(`Editorial campaign audit passed: ${expectedCount} unique briefs.`);
