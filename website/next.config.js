const crypto = require("crypto");
const fs = require("fs");
const path = require("path");

/**
 * Deterministic build ID: Next.js embeds the buildId in every exported
 * .html/.txt file. The default (random per build) would make all ~16k pages
 * differ on every build, defeating the incremental S3 deploy (deploy-s3.mjs).
 * Derived from the lockfile so it only changes when dependencies change;
 * page content changes are already reflected by content-hashed chunks and
 * page HTML itself.
 */
function deterministicBuildId() {
  const lockfile = path.join(__dirname, "package-lock.json");
  const hash = crypto
    .createHash("sha256")
    .update(fs.readFileSync(lockfile))
    .digest("hex")
    .slice(0, 16);
  return `iamtrail-${hash}`;
}

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "export",
  trailingSlash: true,
  images: {
    unoptimized: true,
  },
  generateBuildId: deterministicBuildId,
};

module.exports = nextConfig;
