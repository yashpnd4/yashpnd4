import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const colors = ["#0b1b2d", "#123b62", "#1f6feb", "#388bfd", "#79c0ff"];

function getDays(calendar) {
  if (!Number.isInteger(calendar.totalContributions) || !Array.isArray(calendar.weeks)) {
    throw new TypeError("GitHub returned an invalid contribution calendar");
  }

  return calendar.weeks.flatMap((week) => {
    if (!Array.isArray(week.contributionDays)) {
      throw new TypeError("GitHub returned an invalid contribution week");
    }

    return week.contributionDays.map((day) => {
      if (!Number.isInteger(day.contributionCount) || day.contributionCount < 0 ||
          !/^\d{4}-\d{2}-\d{2}$/.test(day.date) ||
          new Date(`${day.date}T00:00:00Z`).toISOString().slice(0, 10) !== day.date) {
        throw new TypeError("GitHub returned an invalid contribution day");
      }

      return day;
    });
  });
}

export function renderActivityCard(calendar) {
  getDays(calendar);
  const cells = calendar.weeks.flatMap((week, weekIndex) =>
    week.contributionDays.map((day) => {
      const level = day.contributionCount === 0
        ? 0
        : Math.min(4, Math.ceil(day.contributionCount / 3));
      const x = 34 + weekIndex * 21;
      const y = 104 + new Date(`${day.date}T00:00:00Z`).getUTCDay() * 19;

      return `<rect x="${x}" y="${y}" width="14" height="14" rx="3" fill="${colors[level]}"><title>${day.date}: ${day.contributionCount} contributions</title></rect>`;
    }),
  ).join("");
  const total = calendar.totalContributions.toLocaleString("en-US");
  const legend = colors.slice(0, 5).map((color, index) =>
    `<rect x="${950 + index * 20}" y="48" width="13" height="13" rx="3" fill="${color}"/>`,
  ).join("");

  return `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="260" viewBox="0 0 1200 260">
  <defs>
    <linearGradient id="frame" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#123366"/>
      <stop offset=".52" stop-color="#0b2142"/>
      <stop offset="1" stop-color="#12508a"/>
    </linearGradient>
    <linearGradient id="glow" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0" stop-color="#168bff" stop-opacity=".08"/>
      <stop offset=".55" stop-color="#168bff" stop-opacity=".25"/>
      <stop offset="1" stop-color="#35d4c3" stop-opacity=".08"/>
    </linearGradient>
  </defs>
  <rect x="4" y="4" width="1192" height="252" rx="22" fill="#071426" stroke="#3d7fc2" stroke-width="3"/>
  <rect x="14" y="14" width="1172" height="232" rx="17" fill="url(#frame)"/>
  <rect x="14" y="14" width="1172" height="232" rx="17" fill="url(#glow)"/>
  <path d="M16 20h310" stroke="#2ea8ff" stroke-width="7" opacity=".55"/>
  <text x="34" y="51" fill="#e4f2ff" font-family="Arial,sans-serif" font-size="24" font-weight="700">Contribution Activity</text>
  <text x="35" y="75" fill="#91b3d2" font-family="Arial,sans-serif" font-size="15">${total} contributions in the last year</text>
  <g font-family="Arial,sans-serif" font-size="13" fill="#a9c9e6">
    <text x="910" y="60">Less</text>
    ${legend}
    <text x="1067" y="60">More</text>
  </g>
  <g>${cells}</g>
</svg>`;
}

function formatDate(value) {
  return new Date(`${value}T00:00:00Z`).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}

function formatRange(start, end) {
  if (!start) {
    return "—";
  }
  return start === end ? formatDate(start) : `${formatDate(start)} – ${formatDate(end)}`;
}

export function renderStreakCard(calendar, today = new Date()) {
  const days = getDays(calendar).sort((left, right) => left.date.localeCompare(right.date));
  const latestDate = today.toISOString().slice(0, 10);
  let currentStreak = 0;
  let currentStart = null;
  let currentEnd = null;
  let todayIndex = days.findIndex((day) => day.date === latestDate);
  if (todayIndex < 0 || !days[todayIndex].contributionCount) {
    const yesterday = new Date(today.getTime() - 86400000).toISOString().slice(0, 10);
    todayIndex = days.findIndex((day) => day.date === yesterday);
  }

  if (todayIndex >= 0 && days[todayIndex].contributionCount > 0) {
    currentStart = days[todayIndex].date;
    currentEnd = days[todayIndex].date;
    currentStreak = 1;
    for (let index = todayIndex - 1; index >= 0; index -= 1) {
      const previous = days[index];
      const next = days[index + 1];
      if (previous.contributionCount === 0 ||
          new Date(`${next.date}T00:00:00Z`) - new Date(`${previous.date}T00:00:00Z`) !== 86400000) {
        break;
      }
      currentStart = previous.date;
      currentStreak += 1;
    }
  }

  let longestStreak = 0;
  let longestStart = null;
  let longestEnd = null;
  let streakStart = null;
  let streakEnd = null;
  let streakLength = 0;

  for (const [index, day] of days.entries()) {
    const previous = days[index - 1];
    const consecutive = !previous ||
      new Date(`${day.date}T00:00:00Z`) - new Date(`${previous.date}T00:00:00Z`) === 86400000;
    if (!day.contributionCount) {
      streakStart = null;
      streakEnd = null;
      streakLength = 0;
    } else {
      if (!consecutive || !streakLength) {
        streakStart = day.date;
        streakLength = 0;
      }
      streakEnd = day.date;
      streakLength += 1;
      if (streakLength > longestStreak) {
        longestStreak = streakLength;
        longestStart = streakStart;
        longestEnd = streakEnd;
      }
    }
  }

  const firstActiveDay = days.find((day) => day.contributionCount > 0)?.date;
  const total = calendar.totalContributions.toLocaleString("en-US");

  return `<svg xmlns="http://www.w3.org/2000/svg" width="600" height="220" viewBox="0 0 600 220">
  <rect x="1" y="1" width="598" height="218" rx="8" fill="#0d1117" stroke="#30363d" stroke-width="2"/>
  <path d="M200 25v170M400 25v170" stroke="#8b949e" stroke-width="2"/>
  <g font-family="Arial,sans-serif" text-anchor="middle">
    <text x="100" y="78" fill="#70a5fd" font-size="32" font-weight="700">${total}</text>
    <text x="100" y="112" fill="#c9d1d9" font-size="15">Total Contributions</text>
    <text x="100" y="143" fill="#39d3c4" font-size="13">${firstActiveDay ? `${formatDate(firstActiveDay)} – Present` : "No contributions yet"}</text>

    <circle cx="300" cy="70" r="36" fill="none" stroke="#70a5fd" stroke-width="6"/>
    <path d="M300 29c-9 10-9 15 0 20 9-5 9-10 0-20z" fill="#70a5fd"/>
    <text x="300" y="80" fill="#c9a0ff" font-size="26" font-weight="700">${currentStreak}</text>
    <text x="300" y="126" fill="#c9a0ff" font-size="15" font-weight="700">Current Streak</text>
    <text x="300" y="153" fill="#39d3c4" font-size="13">${formatRange(currentStart, currentEnd)}</text>

    <text x="500" y="78" fill="#70a5fd" font-size="32" font-weight="700">${longestStreak}</text>
    <text x="500" y="112" fill="#c9d1d9" font-size="15">Longest Streak</text>
    <text x="500" y="143" fill="#39d3c4" font-size="13">${formatRange(longestStart, longestEnd)}</text>
  </g>
</svg>`;
}

async function main() {
  const token = process.env.GITHUB_TOKEN;
  const username = process.env.GITHUB_USER_NAME;
  if (!token || !username) {
    throw new Error("GITHUB_TOKEN and GITHUB_USER_NAME are required");
  }

  const to = new Date();
  const from = new Date(to.getTime() - 364 * 24 * 60 * 60 * 1000);
  const query = `query($login: String!, $from: DateTime!, $to: DateTime!) {
    user(login: $login) {
      contributionsCollection(from: $from, to: $to) {
        contributionCalendar {
          totalContributions
          weeks {
            contributionDays {
              contributionCount
              date
            }
          }
        }
      }
    }
  }`;

  const response = await fetch("https://api.github.com/graphql", {
    method: "POST",
    headers: {
      accept: "application/vnd.github+json",
      authorization: `Bearer ${token}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      query,
      variables: { login: username, from: from.toISOString(), to: to.toISOString() },
    }),
  });
  const result = await response.json();
  if (!response.ok || result.errors?.length) {
    throw new Error(`GitHub contribution query failed: ${JSON.stringify(result.errors ?? result)}`);
  }

  const calendar = result.data?.user?.contributionsCollection?.contributionCalendar;
  if (!calendar) {
    throw new Error(`GitHub returned no contribution calendar for ${username}`);
  }

  getDays(calendar);
  await mkdir("dist", { recursive: true });
  await writeFile("dist/profile-activity.svg", renderActivityCard(calendar), "utf8");
  await writeFile("dist/profile-streak.svg", renderStreakCard(calendar), "utf8");
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await main();
}
