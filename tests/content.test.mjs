import assert from "node:assert/strict";
import { readFile, stat } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);
const newExamples = [
  "full-riscv-pipeline",
  "full-derivative-foundations",
  "mathematics-local-derivative",
  "cybersecurity-phishing-check",
  "photography-exposure-triangle",
  "psychology-correlation-causation",
  "full-programming-foundations",
  "full-algorithm-analysis",
  "full-relational-data-management",
  "full-ai-search-foundations",
  "full-operating-systems-processes-memory",
  "full-computer-networks-tcp-routing",
  "full-compiler-design-front-end",
  "full-distributed-systems-consensus",
  "full-analog-circuits-rc-filters",
  "full-signals-sampling-fourier",
  "full-fluid-mechanics-continuity-bernoulli",
  "full-solid-mechanics-stress-strain",
];

test("the pilot page advertises the learning platform and has no duration cap", async () => {
  const html = await readFile(new URL("index.html", root), "utf8");
  assert.equal(
    (html.match(/<article class="showcase-card">/g) || []).length,
    16,
  );
  assert.match(html, /Learning platform/);
  assert.match(html, /href="\.\/learn\.html"/);
  assert.match(html, /no fixed duration limit/i);
  assert.doesNotMatch(html, /2[–-]5 minute pilot/i);
  assert.doesNotMatch(html, /female narration/i);
});

test("the learning platform exposes accessible, device-local course progress", async () => {
  const html = await readFile(new URL("learn.html", root), "utf8");
  assert.match(html, /id="course-grid"/);
  assert.match(html, /id="course-search"/);
  assert.match(html, /id="lesson-dialog"/);
  assert.match(html, /id="progress-percent"/);
  assert.match(html, /Progress stays on this device/);
  assert.match(html, /not an LMS/i);
  assert.doesNotMatch(html, /female narration/i);
});

test("the course catalog contains thirty-three complete, unique lessons", async () => {
  const catalog = JSON.parse(
    await readFile(new URL("course-catalog.json", root), "utf8"),
  );
  assert.equal(catalog.schemaVersion, 1);
  assert.equal(catalog.courses.length, 33);
  assert.equal(new Set(catalog.courses.map((course) => course.id)).size, 33);
  const fullLessons = catalog.courses.filter(
    (course) => course.format === "Full lesson",
  );
  assert.equal(fullLessons.length, 18);
  assert.ok(fullLessons.every((course) => course.durationSeconds >= 480));

  for (const course of catalog.courses) {
    assert.ok(course.title);
    assert.ok(course.area);
    assert.ok(course.subject);
    assert.ok(course.durationSeconds > 0);
    assert.ok(course.outcomes.length >= 2);
    assert.ok(course.paths.length >= 1);

    for (const key of ["video", "captions", "transcript", "poster", "sources"]) {
      assert.match(course[key], /^\.\/[a-z0-9/_\-.]+$/i);
      assert.ok((await stat(new URL(course[key].slice(2), root))).size > 0);
    }

    const captions = await readFile(
      new URL(course.captions.slice(2), root),
      "utf8",
    );
    assert.match(captions, /^WEBVTT/);
    const captionLines = captions
      .split(/\r?\n/)
      .filter((line) => line && !line.includes("-->") && line !== "WEBVTT");
    assert.ok(Math.max(...captionLines.map((line) => line.length)) <= 46);
  }
});

test("Computer Science lessons remain part of the unified course catalog", async () => {
  const html = await readFile(new URL("learn.html", root), "utf8");
  assert.doesNotMatch(html, /id="computer-science"/);
  assert.doesNotMatch(html, /Dedicated Computer Science series/);
  assert.doesNotMatch(html, /href="\.\/cs-pathway\.html"/);

  const catalog = JSON.parse(
    await readFile(new URL("course-catalog.json", root), "utf8"),
  );
  const csCourses = catalog.courses.filter(
    (course) =>
      course.area === "Computer Science" ||
      course.subject === "Computer Architecture" ||
      course.subject.includes("Cybersecurity"),
  );
  assert.ok(csCourses.length >= 8);
  assert.ok(
    csCourses.every((course) =>
      course.paths.includes("Computing & Engineering"),
    ),
  );
  for (const id of [
    "full-programming-foundations",
    "full-algorithm-analysis",
    "full-relational-data-management",
    "full-ai-search-foundations",
    "full-operating-systems-processes-memory",
    "full-computer-networks-tcp-routing",
    "full-compiler-design-front-end",
    "full-distributed-systems-consensus",
    "full-analog-circuits-rc-filters",
    "full-signals-sampling-fourier",
    "full-fluid-mechanics-continuity-bernoulli",
    "full-solid-mechanics-stress-strain",
  ]) {
    assert.equal(
      catalog.courses.find((course) => course.id === id)?.format,
      "Full lesson",
    );
  }
});

for (const slug of newExamples) {
  test(`${slug} includes video, captions, transcript, poster, and verified sources`, async () => {
    const directory = new URL(`examples/${slug}/`, root);
    for (const file of [
      "video.mp4",
      "captions.vtt",
      "transcript.txt",
      "poster.png",
      "sources.json",
    ]) {
      assert.ok((await stat(new URL(file, directory))).size > 0, file);
    }

    const captions = await readFile(new URL("captions.vtt", directory), "utf8");
    assert.match(captions, /^WEBVTT/);
    const captionLines = captions
      .split(/\r?\n/)
      .filter((line) => line && !line.includes("-->") && line !== "WEBVTT");
    assert.ok(Math.max(...captionLines.map((line) => line.length)) <= 46);

    const sourcePack = JSON.parse(
      await readFile(new URL("sources.json", directory), "utf8"),
    );
    assert.ok(sourcePack.sources.length >= 1);
    assert.ok(sourcePack.sources.every((source) => source.verified === true));
  });
}
