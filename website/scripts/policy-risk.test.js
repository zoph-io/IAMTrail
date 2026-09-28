const test = require("node:test");
const assert = require("node:assert/strict");
const { createRiskEngine, diffAssessments, resourceCoversAll } = require("./policy-risk");

const PATHS = [
  { id: "iam-007", name: "iam:PutUserPolicy", category: "self-escalation", permissions: { required: [{ permission: "iam:PutUserPolicy" }] } },
  { id: "iam-002", name: "iam:CreateAccessKey", category: "principal-access", permissions: { required: [{ permission: "iam:CreateAccessKey" }] } },
  { id: "sts-001", name: "sts:AssumeRole", category: "principal-access", permissions: { required: [{ permission: "sts:AssumeRole" }] } },
  {
    id: "lambda-001",
    name: "iam:PassRole + lambda:CreateFunction + lambda:InvokeFunction",
    category: "new-passrole",
    permissions: { required: ["iam:PassRole", "lambda:CreateFunction", "lambda:InvokeFunction"] },
  },
];
const PM = ["iam:putuserpolicy", "iam:createaccesskey", "iam:createservicelinkedrole", "s3:putbucketpolicy", "glue:describeentity"];
const engine = createRiskEngine({ paths: PATHS, permissionsManagement: PM });

const doc = (...Statement) => ({ Version: "2012-10-17", Statement });
const allow = (Action, Resource = "*", extra = {}) => ({ Effect: "Allow", Action, Resource, ...extra });
const ids = (r) => r.signals.map((s) => `${s.id}:${s.severity}`);

test("a wildcard straight after the resource type covers every resource", () => {
  assert.equal(resourceCoversAll("*", "iam"), true);
  assert.equal(resourceCoversAll("arn:aws:iam::*:role/*", "iam"), true);
  assert.equal(resourceCoversAll("arn:aws:secretsmanager:*:*:secret:*", "secretsmanager"), true);
  assert.equal(resourceCoversAll("arn:aws:iam::*:role/*", "sts"), true, "sts:AssumeRole targets IAM roles");
});

test("a path, a name prefix or a named bucket narrows the resource", () => {
  assert.equal(resourceCoversAll("arn:aws:iam::*:role/service-role/*", "iam"), false);
  assert.equal(resourceCoversAll("arn:aws:iam::*:role/AmazonSageMaker*", "iam"), false);
  assert.equal(resourceCoversAll("arn:aws:s3:::my-bucket/*", "s3"), false);
  assert.equal(resourceCoversAll("arn:aws:s3:::*", "s3"), true);
  assert.equal(resourceCoversAll("arn:aws:s3:::*", "iam"), false, "another service's ARN grants nothing");
});

test("AdministratorAccess is critical and does not list every path under it", () => {
  const r = engine.assess(doc(allow("*")));
  assert.equal(r.level, "critical");
  assert.deepEqual(ids(r), ["admin:critical"]);
  assert.equal(r.openPathIds.length, PATHS.length);
});

test("full access behind a condition is high, not critical", () => {
  const r = engine.assess(doc(allow("*", "*", { Condition: { Bool: { "aws:IsMcpServiceAction": "true" } } })));
  assert.equal(r.signals[0].id, "admin");
  assert.equal(r.level, "high");
});

test("NotAction on every resource is near-administrator access", () => {
  const r = engine.assess(doc({ Effect: "Allow", NotAction: ["iam:*", "organizations:*"], Resource: "*" }));
  assert.equal(r.signals[0].title, "Near-administrator access");
  assert.equal(r.level, "critical");
  assert.ok(ids(r).includes("principal-access:high"), "sts:AssumeRole is not excluded");
});

test("an unrestricted self-escalation is critical, a scoped one medium", () => {
  assert.ok(ids(engine.assess(doc(allow("iam:PutUserPolicy")))).includes("self-escalation:critical"));
  const scoped = engine.assess(doc(allow("iam:PutUserPolicy", "arn:aws:iam::*:user/${aws:username}")));
  assert.ok(ids(scoped).includes("self-escalation:medium"));
  assert.equal(scoped.openPathIds.length, 0);
});

test("sts:AssumeRole alone stops at high, since it needs a trust policy to exist", () => {
  const r = engine.assess(doc(allow("sts:AssumeRole")));
  assert.deepEqual(ids(r), ["principal-access:high"]);
});

test("partial wildcards match, and the grant says which pattern did it", () => {
  const r = engine.assess(doc(allow(["iam:Put*", "ssm:GetParameter*"])));
  assert.ok(ids(r).includes("self-escalation:critical"));
  const secrets = r.signals.find((s) => s.id === "secrets");
  assert.equal(secrets.severity, "high");
  assert.ok(secrets.actions.includes("ssm:GetParameter (via ssm:GetParameter*)"));
});

test("an unconditional Deny in the same policy cancels the grant", () => {
  const r = engine.assess(doc(allow("iam:*"), { Effect: "Deny", Action: "iam:PutUserPolicy", Resource: "*" }));
  assert.ok(!r.pathIds.includes("iam-007"));
  assert.ok(r.pathIds.includes("iam-002"));
});

test("a NotResource Deny does not cancel the grant, since it spares what it names", () => {
  const r = engine.assess(
    doc(allow("iam:*"), { Effect: "Deny", Action: "iam:PutUserPolicy", NotResource: "arn:aws:iam::*:user/ops/*" })
  );
  assert.ok(r.pathIds.includes("iam-007"));
});

test("a PassRole path is high only when every action is unrestricted", () => {
  const open = engine.assess(doc(allow(["iam:PassRole", "lambda:CreateFunction", "lambda:InvokeFunction"])));
  assert.ok(ids(open).includes("new-passrole:high"));
  const scoped = engine.assess(
    doc(
      allow("iam:PassRole", "*", { Condition: { StringEquals: { "iam:PassedToService": "lambda.amazonaws.com" } } }),
      allow(["lambda:CreateFunction", "lambda:InvokeFunction"])
    )
  );
  assert.ok(ids(scoped).includes("new-passrole:medium"));
});

test("service-linked roles and reads classed as permissions management are left out", () => {
  const r = engine.assess(doc(allow(["iam:CreateServiceLinkedRole", "glue:DescribeEntity"])));
  assert.equal(r.level, null);
  const sharing = engine.assess(doc(allow("s3:PutBucketPolicy")));
  assert.deepEqual(ids(sharing), ["resource-sharing:medium"]);
});

test("svc:* on every resource is flagged as broad, on a named resource it is not", () => {
  assert.ok(ids(engine.assess(doc(allow("s3:*")))).includes("service-wildcard:medium"));
  assert.equal(engine.assess(doc(allow("s3:*", "arn:aws:s3:::my-bucket/*"))).level, null);
});

test("Access Analyzer security warnings become a medium signal", () => {
  const r = engine.assess(doc(allow("s3:GetBucketLocation")), {
    securityWarnings: [{ issueCode: "PASS_ROLE_WITH_STAR_IN_RESOURCE", findingDetails: "..." }],
  });
  assert.deepEqual(ids(r), ["access-analyzer:medium"]);
});

test("the diff reports what got riskier and ignores what did not move", () => {
  const before = engine.assess(doc(allow("s3:GetBucketLocation")));
  const after = engine.assess(doc(allow("iam:PutUserPolicy")));
  const diff = diffAssessments(before, after);
  assert.equal(diff.direction, "riskier");
  assert.equal(diff.to, "critical");
  assert.deepEqual(diff.pathsAdded, ["iam-007"]);
  assert.equal(diffAssessments(after, after), null);
  assert.equal(diffAssessments(after, before).direction, "safer");
});
