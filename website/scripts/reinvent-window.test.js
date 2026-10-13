const test = require("node:test");
const assert = require("node:assert/strict");
const { seasonYear, buildArchive } = require("./reinvent-window");

test("the season runs October 1 through December 31, excluding the 2019 import", () => {
  assert.equal(seasonYear("2024-09-30T23:00:00Z"), null);
  assert.equal(seasonYear("2024-10-01"), "2024");
  assert.equal(seasonYear("2024-12-31T23:59:59Z"), "2024");
  assert.equal(seasonYear("2025-01-01T00:00:00Z"), null);
  assert.equal(seasonYear("2019-11-20T00:00:00Z"), null);
  assert.equal(seasonYear("not-a-date"), null);
});

test("a new prefix keeps its actions, and an older prefix is grouped apart", () => {
  const archive = buildArchive({
    generatedAt: "2024-11-02T00:00:00Z",
    services: [
      {
        prefix: "q",
        firstSeen: "2024-10-18",
        firstPolicy: "AmazonQFullAccess",
      },
    ],
    actions: [
      {
        action: "q:SendMessage",
        firstSeen: "2024-10-18",
        firstPolicy: "AmazonQFullAccess",
        hasPage: true,
      },
      {
        action: "q:StartConversation",
        firstSeen: "2024-10-18",
        firstPolicy: "AmazonQFullAccess",
        hasPage: true,
      },
      {
        action: "s3:GetFoo",
        firstSeen: "2024-11-01",
        firstPolicy: "SecurityAudit",
        hasPage: true,
      },
      {
        action: "s3:GetFoo",
        firstSeen: "2024-06-01",
        firstPolicy: "SecurityAudit",
        hasPage: true,
      },
    ],
    policies: [
      { name: "AmazonQFullAccess", firstSeen: "2024-10-18T00:00:00Z" },
    ],
    changeDates: ["2024-10-18T01:00:00Z", "2024-06-01T00:00:00Z"],
    endpointChanges: [
      {
        detectedAt: "2024-12-03T00:00:00Z",
        type: "new_region",
        id: "ap-southeast-5",
        description: "Asia Pacific (Malaysia)",
      },
      {
        detectedAt: "2024-12-03T00:00:00Z",
        type: "service_expansion",
        id: "s3",
        description: "",
      },
    ],
    announcements: [
      {
        detected_at: "2024-12-02T00:00:00Z",
        short_description: "New finding type",
        link: "https://example.com/gd",
        type: "NEW_FINDING",
      },
    ],
    editions: {
      2024: {
        starts: "2024-12-02",
        ends: "2024-12-06",
        place: "Las Vegas",
        roundup:
          "https://aws.amazon.com/blogs/aws/top-announcements-of-aws-reinvent-2024/",
        roundupTitle: "Top announcements of AWS re:Invent 2024",
      },
    },
    serviceNames: { q: "Amazon Q", s3: "Amazon S3" },
    permissions: new Set(["s3:getfoo"]),
  });

  assert.equal(archive.currentYear, "2024");
  assert.equal(archive.windowLabel, "October 1 through December 31");
  const year = archive.editions[0];
  assert.equal(year.year, "2024");
  assert.equal(year.status, "open");
  assert.equal(year.services.length, 1);
  assert.equal(year.services[0].name, "Amazon Q");
  assert.equal(year.services[0].timing, "before");
  assert.equal(year.services[0].actions.length, 2);
  assert.equal(year.beforeConference, 1);
  assert.equal(year.neverBeforeSeen, 3);
  assert.equal(year.actionGroups.length, 1);
  assert.equal(year.actionGroups[0].prefix, "s3");
  assert.equal(year.actionGroups[0].actions[0].permissionsManagement, true);
  assert.equal(year.permissionsManagement.length, 1);
  assert.equal(year.newPolicies.length, 1);
  assert.equal(year.changes, 1);
  assert.equal(year.endpoints.newRegions[0].id, "ap-southeast-5");
  assert.equal(year.endpoints.expansions, 1);
  assert.equal(year.guardduty.total, 1);
  assert.equal(year.guardduty.items[0].href, "https://example.com/gd");
  assert.ok(year.roundup.url.includes("2024"));
  assert.equal(year.lastmod, "2024-12-03");
});

test("an open season with nothing spotted yet is still listed", () => {
  const archive = buildArchive({
    generatedAt: "2026-10-13T12:00:00Z",
    services: [],
    actions: [],
    policies: [],
    changeDates: [],
    endpointChanges: [],
    announcements: [],
    editions: {
      2026: {
        starts: "2026-11-30",
        ends: "2026-12-04",
        place: "Las Vegas",
        event: "https://aws.amazon.com/events/reinvent/",
      },
    },
    serviceNames: {},
    permissions: new Set(),
  });

  assert.equal(archive.currentYear, "2026");
  assert.equal(archive.editions.length, 1);
  assert.equal(archive.editions[0].status, "open");
  assert.equal(archive.editions[0].services.length, 0);
  assert.equal(archive.editions[0].roundup, null);
  assert.equal(
    archive.editions[0].eventUrl,
    "https://aws.amazon.com/events/reinvent/"
  );
  assert.equal(archive.editions[0].lastmod, null);
});

test("outside the season the latest closed year leads and the next one is absent", () => {
  const archive = buildArchive({
    generatedAt: "2026-09-01T00:00:00Z",
    services: [
      { prefix: "nova", firstSeen: "2025-10-20", firstPolicy: "AmazonNovaFullAccess" },
    ],
    actions: [],
    policies: [],
    changeDates: [],
    endpointChanges: [],
    announcements: [],
    editions: {
      2026: { starts: "2026-11-30", ends: "2026-12-04", place: "Las Vegas" },
    },
    serviceNames: {},
    permissions: new Set(),
  });

  assert.equal(archive.currentYear, null);
  assert.deepEqual(
    archive.editions.map((edition) => edition.year),
    ["2025"]
  );
  assert.equal(archive.editions[0].status, "closed");
});
