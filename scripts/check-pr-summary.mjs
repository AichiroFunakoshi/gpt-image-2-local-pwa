#!/usr/bin/env node
import https from "node:https";

const owner = "AichiroFunakoshi";
const repo = "gpt-image-2-local-pwa";
const prNumber = process.argv[2];

if (!/^\d+$/.test(prNumber || "")) {
  console.error("Usage: node scripts/check-pr-summary.mjs <pr-number>");
  process.exit(1);
}

function getJson(path) {
  return new Promise((resolve, reject) => {
    const req = https.get({
      hostname: "api.github.com",
      path,
      headers: {
        "Accept": "application/vnd.github+json",
        "User-Agent": "codex-local"
      }
    }, (res) => {
      let raw = "";
      res.on("data", chunk => {
        raw += chunk;
      });
      res.on("end", () => {
        try {
          resolve(JSON.parse(raw));
        } catch (err) {
          reject(err);
        }
      });
    });
    req.on("error", reject);
  });
}

function compactBody(body) {
  return String(body || "")
    .replace(/<details>[\s\S]*?<\/details>/g, " ")
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 180);
}

const base = `/repos/${owner}/${repo}/pulls/${prNumber}`;
const [pr, comments, reviews] = await Promise.all([
  getJson(base),
  getJson(`${base}/comments`),
  getJson(`${base}/reviews`)
]);

const codeRabbitComments = comments
  .filter(comment => comment?.user?.login === "coderabbitai[bot]")
  .map(comment => ({
    path: comment.path,
    commit: String(comment.commit_id || "").slice(0, 7),
    summary: compactBody(comment.body)
  }));

const codeRabbitReviews = reviews
  .filter(review => review?.user?.login === "coderabbitai[bot]")
  .map(review => ({
    state: review.state,
    commit: String(review.commit_id || "").slice(0, 7),
    at: review.submitted_at,
    summary: compactBody(review.body)
  }));

console.log(JSON.stringify({
  pr: Number(prNumber),
  state: pr.state,
  merged: Boolean(pr.merged),
  mergeable: pr.mergeable,
  mergeableState: pr.mergeable_state,
  head: String(pr?.head?.sha || "").slice(0, 7),
  codeRabbit: {
    reviewCount: codeRabbitReviews.length,
    commentCount: codeRabbitComments.length,
    reviews: codeRabbitReviews,
    comments: codeRabbitComments
  }
}, null, 2));
