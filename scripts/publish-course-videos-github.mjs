import { createHash } from "node:crypto";
import { spawn } from "node:child_process";
import { createReadStream } from "node:fs";
import { cp, mkdtemp, readFile, rename, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const catalogPath = resolve(option("--catalog") || "course-catalog.json");
const repository = option("--repo") || "ktgmailorg/one-click-ai-video-pilot";
const releaseTag = option("--tag") || "course-media-2025-2026-v1";
const dryRun = process.argv.includes("--dry-run");
const removeLocal = process.argv.includes("--remove-local");
const requestedUploadConcurrency = Number.parseInt(
  option("--concurrency") || "3",
  10,
);
if (
  !Number.isInteger(requestedUploadConcurrency) ||
  requestedUploadConcurrency < 1 ||
  requestedUploadConcurrency > 4
) {
  throw new Error("--concurrency must be an integer from 1 to 4");
}
const uploadConcurrency = requestedUploadConcurrency;
const only = new Set(
  (option("--only") || "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean),
);

function option(name) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : "";
}

function isLocalPath(value) {
  return typeof value === "string" && value.startsWith("./");
}

async function sha256(path) {
  const hash = createHash("sha256");
  for await (const chunk of createReadStream(path)) hash.update(chunk);
  return hash.digest("hex");
}

async function writeJsonAtomic(path, value) {
  const temporary = `${path}.tmp-${process.pid}`;
  await writeFile(temporary, `${JSON.stringify(value, null, 2)}\n`);
  await rename(temporary, path);
}

function gh(args, { capture = false } = {}) {
  return new Promise((resolvePromise, reject) => {
    const child = spawn("gh", args, {
      cwd: resolve("."),
      env: process.env,
      shell: false,
      stdio: ["ignore", capture ? "pipe" : "inherit", "inherit"],
    });
    let output = "";
    if (capture) child.stdout.on("data", (chunk) => (output += chunk));
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) resolvePromise(output);
      else reject(new Error(`gh ${args[0]} exited with code ${code}`));
    });
  });
}

async function releaseAssets() {
  const output = await gh(
    [
      "release",
      "view",
      releaseTag,
      "--repo",
      repository,
      "--json",
      "assets,url,isPrerelease",
    ],
    { capture: true },
  );
  return JSON.parse(output);
}

const catalog = JSON.parse(await readFile(catalogPath, "utf8"));
const candidates = catalog.courses.filter(
  (course) =>
    isLocalPath(course.video) &&
    (only.size === 0 || only.has(course.id)),
);
if (only.size && candidates.length !== only.size) {
  const found = new Set(candidates.map((course) => course.id));
  throw new Error(
    `Requested course media is missing: ${[...only]
      .filter((id) => !found.has(id))
      .join(", ")}`,
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
    filename: `${course.id}-${digest.slice(0, 16)}.mp4`,
  });
}

if (dryRun) {
  console.log(
    JSON.stringify(
      {
        dryRun: true,
        repository,
        releaseTag,
        uploadConcurrency,
        count: prepared.length,
        bytes: prepared.reduce((sum, item) => sum + item.size, 0),
        videos: prepared.map(({ course, size, digest, filename }) => ({
          courseId: course.id,
          size,
          sha256: digest,
          filename,
        })),
      },
      null,
      2,
    ),
  );
  process.exit(0);
}

let release = await releaseAssets();
let byName = new Map(release.assets.map((asset) => [asset.name, asset]));
const missing = prepared.filter((item) => !byName.has(item.filename));
await mapLimit(missing, uploadConcurrency, async (item) => {
  const uploadDirectory = await mkdtemp(join(tmpdir(), "rit-course-media-"));
  const uploadPath = join(uploadDirectory, item.filename);
  try {
    await cp(item.path, uploadPath);
    await gh([
      "release",
      "upload",
      releaseTag,
      `${uploadPath}#${item.course.title} reviewed web preview`,
      "--repo",
      repository,
    ]);
  } finally {
    await rm(uploadDirectory, { recursive: true, force: true });
  }
});
if (missing.length > 0) {
  release = await releaseAssets();
  byName = new Map(release.assets.map((asset) => [asset.name, asset]));
}
const published = [];
for (const item of prepared) {
  let asset = byName.get(item.filename);
  if (!asset) throw new Error(`${item.course.id}: uploaded asset is missing`);
  if (asset.size !== item.size) {
    throw new Error(`${item.course.id}: release asset has the wrong size`);
  }
  if (asset.digest && asset.digest !== `sha256:${item.digest}`) {
    throw new Error(`${item.course.id}: release asset checksum differs`);
  }

  item.course.video = `./media/${item.filename}`;
  item.course.videoSha256 = item.digest;
  item.course.videoBytes = item.size;
  item.course.videoVariant = "web-preview";
  item.course.mediaBackend = "github-release-via-vercel-rewrite";
  item.course.mediaRelease = releaseTag;
  published.push({
    courseId: item.course.id,
    filename: item.filename,
    size: item.size,
    sha256: item.digest,
    releaseUrl: asset.url,
  });
  await writeJsonAtomic(catalogPath, catalog);

  const htmlFiles = ["index.html", "learn.html", "professor-guide.html"];
  for (const filename of htmlFiles) {
    const path = resolve(filename);
    let html;
    try {
      html = await readFile(path, "utf8");
    } catch (error) {
      if (error.code === "ENOENT") continue;
      throw error;
    }
    const localReference = `./examples/${item.course.id}/video.mp4`;
    const publishedReference = item.course.video;
    if (html.includes(localReference)) {
      await writeJsonAtomicHtml(path, html.split(localReference).join(publishedReference));
    }
  }

  if (removeLocal) {
    await rm(item.path, { force: true });
    await rm(resolve(`examples/${item.course.id}/master.mp4`), { force: true });
  }
}

await writeJsonAtomic(resolve("media-publish-github-manifest.json"), {
  schemaVersion: 1,
  repository,
  releaseTag,
  releaseUrl: release.url,
  published,
});

console.log(
  JSON.stringify(
    {
      catalogPath,
      repository,
      releaseTag,
      uploadConcurrency,
      count: published.length,
      bytes: published.reduce((sum, item) => sum + item.size, 0),
      removedLocalCopies: removeLocal,
    },
    null,
    2,
  ),
);

async function writeJsonAtomicHtml(path, value) {
  const temporary = `${path}.tmp-${process.pid}`;
  await writeFile(temporary, value);
  await rename(temporary, path);
}

async function mapLimit(values, limit, operation) {
  let next = 0;
  async function worker() {
    while (next < values.length) {
      const index = next;
      next += 1;
      await operation(values[index]);
    }
  }
  await Promise.all(
    Array.from({ length: Math.min(limit, values.length) }, () => worker()),
  );
}
