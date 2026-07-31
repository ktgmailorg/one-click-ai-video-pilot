import { readFile, rename, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const catalogPath = resolve("course-catalog.json");
const catalog = JSON.parse(await readFile(catalogPath, "utf8"));
let updated = 0;

for (const course of catalog.courses) {
  if (
    Array.isArray(course.generationProvenance) &&
    course.generationProvenance.length > 0
  ) {
    continue;
  }

  let generation = {};
  try {
    generation = JSON.parse(
      await readFile(resolve(`examples/${course.id}/generation.json`), "utf8"),
    );
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }

  const generatedScript = Boolean(generation.provider && generation.model);
  course.generationProvenance = [
    {
      stage: "Script and evidence",
      provider: generatedScript
        ? generation.provider
        : "instructor-or-pilot-team-authored",
      model: generatedScript ? generation.model : "No generative model",
      executionLocation: "local",
      mode: generatedScript ? "recorded" : "source-grounded",
      humanReviewRequired: true,
    },
    {
      stage: "Narration voice and timestamps",
      provider: "edge-tts",
      model: "edge-tts-7.2.8 / en-US-AndrewMultilingualNeural",
      executionLocation: "hosted",
      mode: "recorded",
      humanReviewRequired: true,
    },
    {
      stage: "Educational diagrams and composition",
      provider: "deterministic-svg-runtime",
      model: "No generative model",
      executionLocation: "local",
      mode: "deterministic",
      humanReviewRequired: true,
    },
  ];
  updated += 1;
}

const temporaryPath = `${catalogPath}.tmp-${process.pid}`;
await writeFile(temporaryPath, `${JSON.stringify(catalog, null, 2)}\n`);
await rename(temporaryPath, catalogPath);

console.log(JSON.stringify({ catalogPath, updated }, null, 2));
