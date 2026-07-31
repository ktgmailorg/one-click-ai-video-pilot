import assert from "node:assert/strict";
import { readFile, stat } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);
const localAssetPattern = /^\.\/[a-z0-9/_\-.]+$/i;
const hostedVideoPattern =
  /^https:\/\/[a-z0-9-]+\.public\.blob\.vercel-storage\.com\/[a-z0-9/_\-.]+$/i;
const publishedVideoPattern = /^\.\/media\/[a-z0-9-]+-[a-f0-9]{16}\.mp4$/i;
const newExamples = [
  "full-riscv-pipeline",
  "full-derivative-foundations",
  "mathematics-local-derivative",
  "cybersecurity-phishing-check",
  "photography-exposure-triangle",
  "psychology-correlation-causation",
  "mis-business-process-decisions",
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
    17,
  );
  assert.match(html, /Learning platform/);
  assert.match(html, /href="\.\/learn\.html"/);
  assert.match(html, /no fixed duration limit/i);
  assert.doesNotMatch(html, /2[–-]5 minute pilot/i);
  assert.doesNotMatch(html, /female narration/i);
});

test("the pilot page separates measured fresh production from cached replay", async () => {
  const html = await readFile(new URL("index.html", root), "utf8");
  assert.match(html, /Measured production speed/);
  assert.match(html, /28:49/);
  assert.match(html, /20:31/);
  assert.match(html, /1\.41× real-time media throughput/);
  assert.match(html, /2:10/);
  assert.match(html, /10:02/);
  assert.match(html, /4\.63× real-time throughput/);
  assert.match(html, /7\.51× faster/);
  assert.match(html, /Narration was an exact verified cache hit/);
  assert.match(html, /19:43/);
  assert.match(html, /4:00/);
  assert.match(html, /4\.93× aggregate real-time throughput/);
  assert.match(html, /without blockers or warnings/);
  assert.match(html, /0\.65s/);
  assert.match(html, /621× faster/);
  assert.match(html, /not guaranteed completion times/i);
  assert.match(html, /planning.*verified replay are separate/is);
  assert.doesNotMatch(html, /10 lessons in 10 minutes/i);
});

test("the learning platform exposes accessible, device-local course progress", async () => {
  const html = await readFile(new URL("learn.html", root), "utf8");
  const script = await readFile(new URL("learn.js", root), "utf8");
  assert.match(html, /id="course-grid"/);
  assert.match(html, /id="course-search"/);
  assert.match(html, /id="lesson-dialog"/);
  assert.match(html, /id="progress-percent"/);
  assert.match(html, /Progress stays on this device/);
  assert.match(html, /not an LMS/i);
  assert.match(html, /Download MP4/);
  assert.match(html, /Copy direct lesson link/);
  assert.match(script, /searchParams\.set\("course", courseId\)/);
  assert.match(script, /searchParams\.get\(\s*"course"/);
  assert.match(script, /navigator\.clipboard\.writeText/);
  assert.doesNotMatch(html, /female narration/i);
});

test("the production media verifier resolves catalog video paths", async () => {
  const script = await readFile(
    new URL("scripts/verify-published-catalog.mjs", root),
    "utf8",
  );
  assert.match(
    script,
    /verifyVideoResponse\(new URL\(live\.video, baseUrl\), live\.videoBytes\)/,
  );
  assert.match(script, /"video\/mp4", undefined, "manual"/);
  assert.match(script, /\["video\/mp4", "application\/octet-stream"\]/);
  assert.match(script, /redirect === "manual" && response\.status >= 300/);
  assert.match(script, /option\("--concurrency"\) \|\| "2"/);
});

test("the course catalog contains complete, unique lessons", async () => {
  const catalog = JSON.parse(
    await readFile(new URL("course-catalog.json", root), "utf8"),
  );
  assert.equal(catalog.schemaVersion, 1);
  assert.ok(catalog.courses.length >= 33);
  assert.equal(
    new Set(catalog.courses.map((course) => course.id)).size,
    catalog.courses.length,
  );
  const fullLessons = catalog.courses.filter(
    (course) => course.format === "Full lesson",
  );
  assert.ok(fullLessons.length >= 18);
  // A full lesson is a complete instructional module, not an artificially
  // padded runtime. Keep every module at seven minutes or longer while still
  // allowing concise topics to finish before the eight-minute target.
  assert.ok(fullLessons.every((course) => course.durationSeconds >= 420));
  assert.ok(
    fullLessons.filter((course) => course.durationSeconds >= 480).length /
      fullLessons.length >=
      0.85,
  );

  for (const course of catalog.courses) {
    assert.ok(course.title);
    assert.ok(course.area);
    assert.ok(course.subject);
    assert.ok(course.durationSeconds > 0);
    assert.ok(course.outcomes.length >= 2);
    assert.ok(course.paths.length >= 1);
    assert.ok(Array.isArray(course.generationProvenance));
    assert.equal(course.generationProvenance.length, 3);
    assert.ok(
      course.generationProvenance.every(
        (record) =>
          record.stage &&
          record.provider &&
          record.model &&
          record.executionLocation &&
          record.mode &&
          record.humanReviewRequired === true,
      ),
    );

    for (const key of ["captions", "transcript", "poster", "sources"]) {
      assert.match(course[key], localAssetPattern);
      assert.ok((await stat(new URL(course[key].slice(2), root))).size > 0);
    }

    if (publishedVideoPattern.test(course.video)) {
      assert.match(course.videoSha256, /^[a-f0-9]{64}$/);
      assert.ok(course.videoBytes > 1_000_000);
      assert.equal(course.mediaBackend, "github-release-via-vercel-rewrite");
    } else if (localAssetPattern.test(course.video)) {
      assert.ok((await stat(new URL(course.video.slice(2), root))).size > 0);
    } else {
      assert.match(course.video, hostedVideoPattern);
    }

    const captions = await readFile(
      new URL(course.captions.slice(2), root),
      "utf8",
    );
    const transcript = await readFile(
      new URL(course.transcript.slice(2), root),
      "utf8",
    );
    const releasedSpeech = `${transcript}\n${captions}`;
    assert.doesNotMatch(releasedSpeech, /\b(?:NARRATOR|VOICEOVER)\s*:/i);
    assert.doesNotMatch(
      releasedSpeech,
      /(?:^|[.!?]\s+)(?:on[- ]screen|show on[- ]screen|display on[- ]screen|cut to|camera(?:\s+(?:shows|moves|pans|zooms))?|fade (?:in|out))\b/im,
    );
    assert.match(captions, /^WEBVTT/);
    const captionLines = captions
      .split(/\r?\n/)
      .filter((line) => line && !line.includes("-->") && line !== "WEBVTT");
    assert.ok(Math.max(...captionLines.map((line) => line.length)) <= 46);
    if (course.videoBytes) {
      assert.ok(
        course.videoBytes / course.durationSeconds >= 35_000,
        `${course.id} preview is below the catalog quality floor`,
      );
    }
    if (course.releaseManifest) {
      const release = JSON.parse(
        await readFile(new URL(course.releaseManifest.slice(2), root), "utf8"),
      );
      const preview = release.webPreviewEncoding;
      if (preview) {
        assert.ok(preview.videoKbps >= 1100, `${course.id} video bitrate`);
        assert.ok(preview.audioKbps >= 96, `${course.id} audio bitrate`);
        assert.ok(preview.width >= 1280, `${course.id} preview width`);
        assert.ok(preview.height >= 720, `${course.id} preview height`);
      }
      if (course.videoSha256) {
        assert.equal(
          release.artifacts?.["video.mp4"]?.sha256,
          course.videoSha256,
          `${course.id} published checksum`,
        );
      }
    }
    if (course.qualityReport) {
      const quality = JSON.parse(
        await readFile(new URL(course.qualityReport.slice(2), root), "utf8"),
      );
      const checks = new Map(
        (quality.checks || []).map((check) => [check.name, check]),
      );
      assert.equal(quality.ok, true, `${course.id} quality status`);
      assert.deepEqual(quality.blockers || [], [], `${course.id} blockers`);
      assert.equal(
        checks.get("final-master-loudness")?.ok,
        true,
        `${course.id} loudness`,
      );
      assert.equal(
        checks.get("caption-audio-start-sync")?.ok,
        true,
        `${course.id} caption/audio sync`,
      );
      assert.equal(
        checks.get("subject-matched-visuals")?.ok,
        true,
        `${course.id} subject visuals`,
      );
    }
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
      "captions.vtt",
      "transcript.txt",
      "poster.png",
      "sources.json",
    ]) {
      assert.ok((await stat(new URL(file, directory))).size > 0, file);
    }

    const catalog = JSON.parse(
      await readFile(new URL("course-catalog.json", root), "utf8"),
    );
    const course = catalog.courses.find((candidate) => candidate.id === slug);
    assert.ok(course, `${slug} catalog entry`);
    if (publishedVideoPattern.test(course.video)) {
      assert.match(course.videoSha256, /^[a-f0-9]{64}$/);
      assert.ok(course.videoBytes > 1_000_000);
    } else {
      assert.ok((await stat(new URL("video.mp4", directory))).size > 0);
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
