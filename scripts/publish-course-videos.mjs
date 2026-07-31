import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";
import { readFile, rename, stat, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { list, put } from "@vercel/blob";

const catalogPath = resolve(option("--catalog") || "course-catalog.json");
const maximumStoreBytes = integerOption("--max-store-bytes", 900_000_000);
const dryRun = process.argv.includes("--dry-run");
const only = new Set(
  (option("--only") || "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean),
);
const token = process.env.BLOB_READ_WRITE_TOKEN;

if (!dryRun && !token) {
  throw new Error(
    "BLOB_READ_WRITE_TOKEN is required. Link the public Vercel Blob store first.",
  );
}

function option(name) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : "";
}

function integerOption(name, fallback) {
  const raw = option(name);
  if (!raw) return fallback;
  const value = Number.parseInt(raw, 10);
  if (!Number.isInteger(value) || value < 1) {
    throw new Error(`${name} must be a positive integer`);
  }
  return value;
}

function isLocalPath(value) {
  return typeof value === "string" && value.startsWith("./");
}

async function sha256(path) {
  const hash = createHash("sha256");
  for await (const chunk of createReadStream(path)) hash.update(chunk);
  return hash.digest("hex");
}

async function listPublished() {
  const blobs = [];
  let cursor;
  do {
    const page = await list({
      limit: 1000,
      cursor,
      token,
    });
    blobs.push(...page.blobs);
    cursor = page.hasMore ? page.cursor : undefined;
  } while (cursor);
  return blobs;
}

async function writeJsonAtomic(path, value) {
  const temporary = `${path}.tmp-${process.pid}`;
  await writeFile(temporary, `${JSON.stringify(value, null, 2)}\n`);
  await rename(temporary, path);
}

const catalog = JSON.parse(await readFile(catalogPath, "utf8"));
const candidates = catalog.courses.filter(
  (course) =>
    course.id.startsWith("rit-csci-") &&
    isLocalPath(course.video) &&
    (only.size === 0 || only.has(course.id)),
);
if (only.size && candidates.length !== only.size) {
  const found = new Set(candidates.map((course) => course.id));
  throw new Error(
    `Requested course media is missing: ${[...only].filter((id) => !found.has(id)).join(", ")}`,
  );
}

const prepared = [];
for (const course of candidates) {
  const path = resolve(course.video.slice(2));
  const file = await stat(path);
  const digest = await sha256(path);
  prepared.push({
    course,
    path,
    digest,
    size: file.size,
    pathname: `rit-csci/2025-2026/${course.id}/${digest}.mp4`,
  });
}

if (dryRun) {
  console.log(
    JSON.stringify(
      {
        dryRun: true,
        catalogPath,
        count: prepared.length,
        bytes: prepared.reduce((sum, item) => sum + item.size, 0),
        maximumStoreBytes,
        videos: prepared.map(({ course, size, digest, pathname }) => ({
          courseId: course.id,
          size,
          sha256: digest,
          pathname,
        })),
      },
      null,
      2,
    ),
  );
  process.exit(0);
}

const published = await listPublished();
const byPathname = new Map(published.map((blob) => [blob.pathname, blob]));
let committedBytes = published.reduce((sum, blob) => sum + blob.size, 0);

const results = [];
for (const item of prepared) {
  let blob = byPathname.get(item.pathname);
  if (!blob) {
    if (committedBytes + item.size > maximumStoreBytes) {
      throw new Error(
        `Publishing ${item.course.id} would exceed the ${maximumStoreBytes}-byte media budget`,
      );
    }
    blob = await put(item.pathname, createReadStream(item.path), {
      access: "public",
      addRandomSuffix: false,
      allowOverwrite: false,
      cacheControlMaxAge: 31_536_000,
      contentType: "video/mp4",
      multipart: item.size > 100_000_000,
      token,
    });
    committedBytes += item.size;
  } else if (blob.size !== item.size) {
    throw new Error(
      `${item.course.id}: existing content-addressed blob has the wrong size`,
    );
  }

  item.course.video = blob.url;
  item.course.videoSha256 = item.digest;
  item.course.videoBytes = item.size;
  item.course.videoVariant = "web-preview";
  results.push({
    courseId: item.course.id,
    url: blob.url,
    pathname: item.pathname,
    size: item.size,
    sha256: item.digest,
  });
  await writeJsonAtomic(catalogPath, catalog);
}

await writeJsonAtomic(resolve("media-publish-manifest.json"), {
  schemaVersion: 1,
  storeBudgetBytes: maximumStoreBytes,
  storeBytesAfterPublish: committedBytes,
  published: results,
});

console.log(
  JSON.stringify(
    {
      catalogPath,
      count: results.length,
      storeBytesAfterPublish: committedBytes,
      maximumStoreBytes,
    },
    null,
    2,
  ),
);
