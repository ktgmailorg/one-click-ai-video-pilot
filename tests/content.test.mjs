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

test("the pilot page advertises eighteen real examples and no duration cap", async () => {
  const html = await readFile(new URL("index.html", root), "utf8");
  assert.equal(
    (html.match(/<article class="showcase-card">/g) || []).length,
    16,
  );
  assert.match(html, /Watch all 18 examples/);
  assert.match(html, /no fixed duration limit/i);
  assert.doesNotMatch(html, /2[–-]5 minute pilot/i);
  assert.doesNotMatch(html, /female narration/i);
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
