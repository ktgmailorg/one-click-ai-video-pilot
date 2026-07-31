import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const catalogPath = resolve(option("--catalog") || "course-catalog.json");
const baseUrl = new URL(
  option("--base-url") || "https://one-click-ai-video-pilot.vercel.app/",
);
const expected = Number.parseInt(option("--expected") || "63", 10);
const concurrency = Number.parseInt(option("--concurrency") || "8", 10);

if (!Number.isInteger(expected) || expected < 1) {
  throw new Error("--expected must be a positive integer");
}
if (!Number.isInteger(concurrency) || concurrency < 1 || concurrency > 16) {
  throw new Error("--concurrency must be an integer from 1 to 16");
}

function option(name) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : "";
}

async function verifyResponse(url, expectedType, expectedBytes) {
  const response = await fetch(url, {
    method: "HEAD",
    redirect: "follow",
    signal: AbortSignal.timeout(15_000),
  });
  if (!response.ok) {
    throw new Error(`${url}: HTTP ${response.status}`);
  }
  const contentType = response.headers.get("content-type") || "";
  if (!contentType.toLowerCase().startsWith(expectedType)) {
    throw new Error(`${url}: expected ${expectedType}, received ${contentType}`);
  }
  if (expectedBytes) {
    const length = Number.parseInt(
      response.headers.get("content-length") || "",
      10,
    );
    if (length !== expectedBytes) {
      throw new Error(
        `${url}: expected ${expectedBytes} bytes, received ${length || "unknown"}`,
      );
    }
  }
}

async function mapLimit(values, limit, worker) {
  const results = new Array(values.length);
  let next = 0;
  async function run() {
    while (next < values.length) {
      const index = next;
      next += 1;
      results[index] = await worker(values[index], index);
    }
  }
  await Promise.all(
    Array.from({ length: Math.min(limit, values.length) }, () => run()),
  );
  return results;
}

const localCatalog = JSON.parse(await readFile(catalogPath, "utf8"));
const localCourses = localCatalog.courses.filter((course) =>
  course.id.startsWith("rit-csci-"),
);
if (localCourses.length !== expected) {
  throw new Error(
    `Expected ${expected} catalog CSCI courses, found ${localCourses.length}`,
  );
}

const liveCatalogUrl = new URL("course-catalog.json", baseUrl);
const liveCatalogResponse = await fetch(liveCatalogUrl, {
  signal: AbortSignal.timeout(15_000),
});
if (!liveCatalogResponse.ok) {
  throw new Error(
    `${liveCatalogUrl}: HTTP ${liveCatalogResponse.status}`,
  );
}
const liveCatalog = await liveCatalogResponse.json();
const liveById = new Map(liveCatalog.courses.map((course) => [course.id, course]));

await mapLimit(localCourses, concurrency, async (course) => {
  const live = liveById.get(course.id);
  if (!live) throw new Error(`${course.id}: missing from live catalog`);
  if (live.videoSha256 !== course.videoSha256) {
    throw new Error(`${course.id}: live video checksum metadata differs`);
  }
  await Promise.all([
    verifyResponse(live.video, "video/mp4", live.videoBytes),
    verifyResponse(new URL(live.captions, baseUrl), "text/vtt"),
    verifyResponse(new URL(live.transcript, baseUrl), "text/plain"),
    verifyResponse(new URL(live.poster, baseUrl), "image/"),
    verifyResponse(new URL(live.sources, baseUrl), "application/json"),
  ]);
});

console.log(
  JSON.stringify(
    {
      ok: true,
      baseUrl: baseUrl.href,
      verifiedCourses: localCourses.length,
      verifiedAssets: localCourses.length * 5,
    },
    null,
    2,
  ),
);
