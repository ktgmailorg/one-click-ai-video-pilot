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
];

test("the pilot page advertises the learning platform and has no duration cap", async () => {
  const html = await readFile(new URL("index.html", root), "utf8");
  assert.equal(
    (html.match(/<article class="showcase-card">/g) || []).length,
    16,
  );
  assert.match(html, /Explore 17 course videos/);
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

test("the course catalog contains seventeen complete, unique lessons", async () => {
  const catalog = JSON.parse(
    await readFile(new URL("course-catalog.json", root), "utf8"),
  );
  assert.equal(catalog.schemaVersion, 1);
  assert.equal(catalog.courses.length, 17);
  assert.equal(new Set(catalog.courses.map((course) => course.id)).size, 17);

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
