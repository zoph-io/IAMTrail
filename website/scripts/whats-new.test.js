const test = require("node:test");
const assert = require("node:assert/strict");
const {
  isMajorAnnouncement,
  readWhatsNewPost,
  fetchWhatsNew,
} = require("./whats-new");

function item(fields) {
  return { item: { additionalFields: fields } };
}

test("a product launch counts, and a region rollout or a support note does not", () => {
  assert.equal(
    isMajorAnnouncement("AWS Lambda announces Lambda Web Functions"),
    true
  );
  assert.equal(
    isMajorAnnouncement("AWS Well-Architected Agent is now available in preview"),
    true
  );
  assert.equal(
    isMajorAnnouncement(
      "Amazon EC2 G7 instances now available in Europe (Frankfurt) and Europe (Stockholm) Regions"
    ),
    false
  );
  assert.equal(
    isMajorAnnouncement(
      "Amazon S3 Express One Zone is now available in 4 additional AWS Regions"
    ),
    false
  );
  assert.equal(
    isMajorAnnouncement("Claude Haiku 5.5 is now available on AWS GovCloud (US)"),
    false
  );
  assert.equal(
    isMajorAnnouncement(
      "Amazon CloudFront now supports AWS Lambda Web Functions as an origin"
    ),
    false
  );
  assert.equal(
    isMajorAnnouncement(
      "Announcing consumption-based pricing for short-term memory in Amazon Bedrock AgentCore"
    ),
    false
  );
});

test("only a single What's New post URL is kept", () => {
  const post = readWhatsNewPost(
    item({
      headline: "AWS Lambda announces Lambda Web Functions",
      headlineUrl: "/about-aws/whats-new/2026/10/aws-lambda-web-functions/",
      postDateTime: "2026-10-12T19:30:00Z",
    })
  );
  assert.deepEqual(post, {
    headline: "AWS Lambda announces Lambda Web Functions",
    url: "https://aws.amazon.com/about-aws/whats-new/2026/10/aws-lambda-web-functions/",
    date: "2026-10-12",
  });
  assert.equal(
    readWhatsNewPost(
      item({
        headline: "Year index",
        headlineUrl: "/about-aws/whats-new/2026/",
        postDateTime: "2026-10-12T00:00:00Z",
      })
    ),
    null
  );
  assert.equal(
    readWhatsNewPost(
      item({
        headline: "Bare",
        headlineUrl: "https://aws.amazon.com/about-aws/whats-new/2026/10/aws-lambda-web-functions/",
        postDateTime: "2026-10-12T00:00:00Z",
      })
    ),
    null
  );
});

test("the open feed keeps a launch the year tag missed", async () => {
  const lambda = item({
    headline: "AWS Lambda announces Lambda Web Functions",
    headlineUrl: "/about-aws/whats-new/2026/10/aws-lambda-web-functions/",
    postDateTime: "2026-10-12T19:30:00Z",
  });
  const region = item({
    headline:
      "Amazon EC2 G7 instances now available in Europe (Frankfurt) Region",
    headlineUrl: "/about-aws/whats-new/2026/10/amazon-g7-european-regions/",
    postDateTime: "2026-10-12T22:30:00Z",
  });
  const september = item({
    headline: "Announcing a September launch",
    headlineUrl: "/about-aws/whats-new/2026/09/september-launch/",
    postDateTime: "2026-09-15T00:00:00Z",
  });

  const calls = [];
  function getJson(url) {
    calls.push(url);
    const parsed = new URL(url);
    const page = parsed.searchParams.get("page");
    const tag = parsed.searchParams.get("tags.id");
    if (page !== "0") return Promise.resolve({ items: [] });
    if (tag === "whats-new-v2#year#2026") {
      return Promise.resolve({ items: [region, september] });
    }
    if (!tag) return Promise.resolve({ items: [lambda, region, september] });
    return Promise.resolve({ items: [] });
  }

  const result = await fetchWhatsNew("2026-10-13T12:00:00Z", getJson);
  assert.deepEqual(
    result.byYear["2026"].posts.map((post) => post.url),
    [
      "https://aws.amazon.com/about-aws/whats-new/2026/10/aws-lambda-web-functions/",
    ]
  );
  assert.equal(result.byYear["2026"].available, true);
  assert.equal(
    calls.some((url) => url.includes("tags.id=whats-new-v2%23year%232025")),
    true
  );
  assert.equal(
    calls.some((url) => !url.includes("tags.id=") && url.includes("page=0")),
    true
  );
  assert.equal(
    calls.filter((url) => !url.includes("tags.id=")).length > 0 &&
      calls
        .filter((url) => !url.includes("tags.id="))
        .every((url) => url.includes("page=0")),
    true
  );
});

test("a post that does not resolve is dropped, and a redirect target is kept", async () => {
  const kept = item({
    headline: "Announcing Amazon Nova 2.5 Sonic",
    headlineUrl: "/about-aws/whats-new/2026/10/amazon-nova-2.5-sonic/",
    postDateTime: "2026-10-05T00:00:00Z",
  });
  const missing = item({
    headline: "Announcing a missing page",
    headlineUrl: "/about-aws/whats-new/2026/10/missing-page/",
    postDateTime: "2026-10-04T00:00:00Z",
  });
  const september = item({
    headline: "Announcing a September launch",
    headlineUrl: "/about-aws/whats-new/2026/09/september-launch/",
    postDateTime: "2026-09-15T00:00:00Z",
  });

  function getJson(url) {
    const parsed = new URL(url);
    if (parsed.searchParams.get("page") !== "0") return Promise.resolve({ items: [] });
    if (parsed.searchParams.get("tags.id") === "whats-new-v2#year#2026") {
      return Promise.resolve({ items: [kept, missing, september] });
    }
    return Promise.resolve({ items: [] });
  }

  async function resolveUrl(url) {
    if (url.includes("missing-page")) return null;
    if (url.includes("amazon-nova-2.5-sonic")) {
      return "https://aws.amazon.com/about-aws/whats-new/2026/10/amazon-nova-2.5-Sonic/";
    }
    return url;
  }

  const result = await fetchWhatsNew("2026-10-13T12:00:00Z", getJson, resolveUrl);
  assert.deepEqual(
    result.byYear["2026"].posts.map((post) => post.url),
    ["https://aws.amazon.com/about-aws/whats-new/2026/10/amazon-nova-2.5-Sonic/"]
  );
});

test("a failed year is unavailable instead of an empty season", async () => {
  function getJson(url) {
    const tag = new URL(url).searchParams.get("tags.id");
    if (tag === "whats-new-v2#year#2024") {
      return Promise.reject(new Error("down"));
    }
    return Promise.resolve({ items: [] });
  }
  const result = await fetchWhatsNew("2026-01-15T00:00:00Z", getJson);
  assert.equal(result.byYear["2024"].available, false);
  assert.deepEqual(result.byYear["2024"].posts, []);
  assert.equal(result.errors.some((failure) => failure.year === "2024"), true);
  assert.equal(result.byYear["2026"].available, true);
});
