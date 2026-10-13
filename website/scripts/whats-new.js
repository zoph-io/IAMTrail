/**
 * Major AWS What's New posts for a re:Invent season.
 *
 * Year index pages such as /about-aws/whats-new/2026/ do not resolve, so the
 * only links we keep are individual posts the directory API returns. The year
 * tag lags new launches (Lambda Web Functions was missing from it), so the
 * open season also walks the unfiltered feed back to October 1.
 *
 * Regional rollouts and incremental "now supports" notes are left out. A
 * launch dated before the conference is pre-re:Invent.
 */

const https = require("https");
const { seasonYear } = require("./reinvent-window");

const FIRST_SEASON = 2020;
const PAGE_CAP = 20;
const ORIGIN = "https://aws.amazon.com";

const REGIONAL =
  /additional (aws )?regions?|now available in \d+ additional|now available in .*(region|europe|asia pacific|\bus east\b|\bus west\b|africa|middle east|canada \(|\bisrael\b|\bmexico\b|south america|govcloud|\bchina\b)|direct connect location|new location in|\bgovcloud\b/i;

const LAUNCH =
  /\bannounces\b|\bannouncing\b|\bintroduces\b|\bintroducing\b|\blaunches\b|\bgenerally available\b|\bin preview\b|\bnow in preview\b|\bis now available\b/i;

const NOISE =
  /\bpricing\b|\bpatch updates?\b|\blatest cu\b|\bcumulative update\b|\bsupport for\b|\bnow supports\b|\badds support\b|\blaunches support\b/i;

function isMajorAnnouncement(headline) {
  const text = String(headline || "")
    .replace(/\s+/g, " ")
    .trim();
  if (!text) return false;
  if (REGIONAL.test(text) || NOISE.test(text)) return false;
  return LAUNCH.test(text);
}

/**
 * A directory item becomes a post only when headlineUrl is one announcement,
 * /about-aws/whats-new/YYYY/MM/slug. A year index cannot match.
 */
function readWhatsNewPost(raw) {
  const fields = raw && raw.item && raw.item.additionalFields;
  if (!fields) return null;
  const headline = String(fields.headline || "")
    .replace(/\s+/g, " ")
    .trim();
  const date = String(fields.postDateTime || "").slice(0, 10);
  const path = String(fields.headlineUrl || "");
  if (!headline || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;
  if (!/^\/about-aws\/whats-new\/\d{4}\/\d{2}\/[^/?#]+\/?$/.test(path)) return null;
  return { headline, url: `${ORIGIN}${path}`, date };
}

function searchUrl({ year, page, openFeed }) {
  const params = new URLSearchParams({
    "item.directoryId": "whats-new-v2",
    "item.locale": "en_US",
    size: "100",
    page: String(page),
    sort_by: "item.additionalFields.postDateTime",
    sort_order: "desc",
  });
  if (!openFeed) params.set("tags.id", `whats-new-v2#year#${year}`);
  return `${ORIGIN}/api/dirs/items/search?${params.toString()}`;
}

function defaultGetJson(url) {
  return new Promise((resolve, reject) => {
    const req = https.get(
      url,
      {
        headers: {
          "User-Agent": "IAMTrail/1.0",
          Accept: "application/json",
        },
      },
      (res) => {
        if (res.statusCode !== 200) {
          res.resume();
          reject(new Error(`What's New returned ${res.statusCode}`));
          return;
        }
        let body = "";
        res.setEncoding("utf8");
        res.on("data", (chunk) => {
          body += chunk;
        });
        res.on("end", () => {
          try {
            resolve(JSON.parse(body));
          } catch (error) {
            reject(error);
          }
        });
      }
    );
    req.on("error", reject);
    req.setTimeout(20000, () => {
      req.destroy(new Error("What's New timed out"));
    });
  });
}

async function mapPool(list, limit, fn) {
  const out = new Array(list.length);
  let next = 0;
  async function worker() {
    while (next < list.length) {
      const index = next;
      next += 1;
      out[index] = await fn(list[index]);
    }
  }
  const workers = Math.min(limit, list.length);
  await Promise.all(Array.from({ length: workers }, () => worker()));
  return out;
}

async function collectPosts(getJson, year, openFeed) {
  const start = `${year}-10-01`;
  const end = `${year}-12-31`;
  const posts = [];
  for (let page = 0; page < PAGE_CAP; page += 1) {
    const data = await getJson(searchUrl({ year, page, openFeed }));
    const items = (data && data.items) || [];
    if (items.length === 0) return posts;
    let oldest = "9999-12-31";
    for (const raw of items) {
      const post = readWhatsNewPost(raw);
      if (post && post.date < oldest) oldest = post.date;
      if (
        post &&
        post.date >= start &&
        post.date <= end &&
        post.date.startsWith(year) &&
        isMajorAnnouncement(post.headline)
      ) {
        posts.push(post);
      }
    }
    if (oldest < start) return posts;
  }
  throw new Error(
    `What's New for ${year} was still inside the season after ${PAGE_CAP} pages`
  );
}

function canonicalPostUrl(url) {
  let parsed;
  try {
    parsed = new URL(url, ORIGIN);
  } catch {
    return null;
  }
  if (parsed.origin !== ORIGIN) return null;
  let path = parsed.pathname;
  if (!/^\/about-aws\/whats-new\/\d{4}\/\d{2}\/[^/?#]+\/?$/.test(path)) return null;
  if (!path.endsWith("/")) path += "/";
  return `${ORIGIN}${path}`;
}

function defaultResolve(url) {
  return followPost(url, 0);
}

function followPost(url, hops) {
  return new Promise((resolve, reject) => {
    const req = https.request(
      url,
      { method: "HEAD", headers: { "User-Agent": "IAMTrail/1.0" } },
      (res) => {
        res.resume();
        if (
          res.statusCode >= 300 &&
          res.statusCode < 400 &&
          res.headers.location &&
          hops < 3
        ) {
          resolve(followPost(new URL(res.headers.location, url).toString(), hops + 1));
          return;
        }
        if (res.statusCode === 200) {
          resolve(canonicalPostUrl(url));
          return;
        }
        if (res.statusCode === 404 || res.statusCode === 410) {
          resolve(null);
          return;
        }
        reject(new Error(`What's New link returned ${res.statusCode}`));
      }
    );
    req.on("error", reject);
    req.setTimeout(15000, () => {
      req.destroy(new Error("What's New link timed out"));
    });
    req.end();
  });
}

async function settlePosts(posts, resolveUrl) {
  const checked = await mapPool(posts, 8, async (post) => {
    const slashed = canonicalPostUrl(post.url) || post.url;
    try {
      const finalUrl = await resolveUrl(slashed);
      if (!finalUrl) return null;
      return { ...post, url: finalUrl };
    } catch {
      return { ...post, url: slashed };
    }
  });
  return dedupe(checked.filter(Boolean));
}

function dedupe(posts) {
  const seen = new Set();
  const out = [];
  for (const post of posts) {
    if (seen.has(post.url)) continue;
    seen.add(post.url);
    out.push(post);
  }
  out.sort(
    (a, b) => b.date.localeCompare(a.date) || a.headline.localeCompare(b.headline)
  );
  return out;
}

function yearsFor(generatedAt) {
  const end = new Date(generatedAt).getUTCFullYear();
  if (!Number.isFinite(end)) {
    throw new Error("What's New needs a generatedAt timestamp");
  }
  const years = [];
  for (let year = FIRST_SEASON; year <= end; year += 1) years.push(String(year));
  return years;
}

/**
 * { byYear: { "2026": { available, posts } }, errors: [{ year, error }] }
 * A failed year is available: false so the page can say the data is missing
 * instead of showing an empty season.
 */
async function fetchWhatsNew(generatedAt, getJson = defaultGetJson, resolveUrl) {
  const resolve =
    resolveUrl ||
    (getJson === defaultGetJson
      ? defaultResolve
      : async (url) => canonicalPostUrl(url));
  const open = seasonYear(generatedAt);
  const rows = await mapPool(yearsFor(generatedAt), 3, async (year) => {
    try {
      const tagged = await collectPosts(getJson, year, false);
      const posts =
        open === year
          ? dedupe(tagged.concat(await collectPosts(getJson, year, true)))
          : dedupe(tagged);
      return { year, available: true, posts: await settlePosts(posts, resolve) };
    } catch (error) {
      return { year, available: false, posts: [], error };
    }
  });
  const byYear = {};
  const errors = [];
  for (const row of rows) {
    byYear[row.year] = { available: row.available, posts: row.posts };
    if (!row.available) errors.push({ year: row.year, error: row.error });
  }
  return { byYear, errors };
}

module.exports = {
  isMajorAnnouncement,
  readWhatsNewPost,
  fetchWhatsNew,
};
