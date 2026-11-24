import assert from "node:assert/strict";
import test from "node:test";
import { renderActivityCard, renderStreakCard } from "./generate-activity-card.mjs";

test("renders a dark contribution calendar with the supplied total", () => {
  const days = Array.from({ length: 7 }, (_, index) => ({
    contributionCount: index,
    date: `2026-01-0${index + 1}`,
  }));
  const svg = renderActivityCard({
    totalContributions: 21,
    weeks: [{ contributionDays: days }],
  });

  assert.match(svg, /21 contributions in the last year/);
  assert.match(svg, /Contribution Activity/);
  assert.equal((svg.match(/<title>/g) ?? []).length, 7);
  assert.match(svg, /2026-01-01: 0 contributions/);
  assert.match(svg, /2026-01-07: 6 contributions/);
});

test("rejects malformed contribution data", () => {
  assert.throws(() => renderActivityCard({ totalContributions: "21", weeks: [] }), TypeError);
  assert.throws(() => renderActivityCard({
    totalContributions: 0,
    weeks: [{ contributionDays: [{ contributionCount: 0, date: "bad" }] }],
  }), TypeError);
});

test("renders current and longest streaks from contribution days", () => {
  const calendar = {
    totalContributions: 3,
    weeks: [{
      contributionDays: [
        { contributionCount: 1, date: "2026-11-20" },
        { contributionCount: 1, date: "2026-11-21" },
        { contributionCount: 0, date: "2026-11-22" },
        { contributionCount: 0, date: "2026-11-23" },
        { contributionCount: 1, date: "2026-11-24" },
        { contributionCount: 0, date: "2026-11-25" },
        { contributionCount: 0, date: "2026-11-26" },
      ],
    }],
  };
  const svg = renderStreakCard(calendar, new Date("2026-11-24T12:00:00Z"));

  assert.match(svg, />3</);
  assert.match(svg, /Current Streak/);
  assert.match(svg, /Longest Streak/);
  assert.match(svg, /Nov 20 – Nov 21/);
});

test("keeps yesterday's active streak current until today ends", () => {
  const svg = renderStreakCard({
    totalContributions: 1,
    weeks: [{
      contributionDays: [
        { contributionCount: 0, date: "2026-11-20" },
        { contributionCount: 0, date: "2026-11-21" },
        { contributionCount: 0, date: "2026-11-22" },
        { contributionCount: 1, date: "2026-11-23" },
        { contributionCount: 0, date: "2026-11-24" },
      ],
    }],
  }, new Date("2026-11-24T12:00:00Z"));

  assert.match(svg, /Nov 23/);
});
