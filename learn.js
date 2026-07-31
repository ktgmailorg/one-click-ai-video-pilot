const catalogUrl = "./course-catalog.json";
const storageKey = "rit-ai-video-learning-progress-v1";

const grid = document.querySelector("#course-grid");
const status = document.querySelector("#catalog-status");
const empty = document.querySelector("#catalog-empty");
const search = document.querySelector("#course-search");
const areaFilter = document.querySelector("#area-filter");
const formatFilter = document.querySelector("#format-filter");
const levelFilter = document.querySelector("#level-filter");
const filters = document.querySelector("#catalog-filters");
const pathButtons = [...document.querySelectorAll("[data-path]")];
const activePath = document.querySelector("#active-path");
const activePathName = document.querySelector("#active-path-name");
const clearPath = document.querySelector("#clear-path");
const dialog = document.querySelector("#lesson-dialog");
const video = document.querySelector("#lesson-video");

let courses = [];
let selectedPath = "";
let currentCourse = null;

function loadProgress() {
  try {
    const value = JSON.parse(localStorage.getItem(storageKey) || "{}");
    return {
      completed: Array.isArray(value.completed) ? value.completed : [],
      recent: typeof value.recent === "string" ? value.recent : "",
    };
  } catch {
    return { completed: [], recent: "" };
  }
}

let progress = loadProgress();

function saveProgress() {
  try {
    localStorage.setItem(storageKey, JSON.stringify(progress));
  } catch {
    // The catalog still works when a browser blocks device-local storage.
  }
}

function unique(values) {
  return [...new Set(values)].sort((a, b) => a.localeCompare(b));
}

function addOptions(select, values) {
  for (const value of values) {
    const option = document.createElement("option");
    option.value = value;
    option.textContent = value;
    select.append(option);
  }
}

function matches(course) {
  const query = search.value.trim().toLowerCase();
  const haystack = [
    course.title,
    course.area,
    course.subject,
    course.description,
    ...course.outcomes,
    ...course.paths,
  ].join(" ").toLowerCase();

  return (
    (!query || haystack.includes(query)) &&
    (!areaFilter.value || course.area === areaFilter.value) &&
    (!formatFilter.value || course.format === formatFilter.value) &&
    (!levelFilter.value || course.level === levelFilter.value) &&
    (!selectedPath || course.paths.includes(selectedPath))
  );
}

function courseCard(course, { assignId = true } = {}) {
  const article = document.createElement("article");
  article.className = "learn-card";
  if (assignId) article.id = `course-${course.id}`;

  const image = document.createElement("img");
  image.src = course.poster;
  image.alt = "";
  image.loading = "lazy";

  const heading = document.createElement("div");
  heading.className = "learn-card-heading";
  const headingArea = document.createElement("span");
  headingArea.textContent = course.area;
  const headingFormat = document.createElement("b");
  headingFormat.textContent = course.format;
  heading.append(headingArea, headingFormat);

  const content = document.createElement("div");
  content.className = "learn-card-content";

  const title = document.createElement("h3");
  title.textContent = course.title;

  const metadata = document.createElement("p");
  metadata.className = "learn-card-meta";
  metadata.textContent = `${course.subject} · ${course.level} · ${course.duration}`;

  const description = document.createElement("p");
  description.className = "learn-card-description";
  description.textContent = course.description;

  const outcomes = document.createElement("ul");
  outcomes.className = "learn-card-outcomes";
  for (const outcome of course.outcomes.slice(0, 2)) {
    const item = document.createElement("li");
    item.textContent = outcome;
    outcomes.append(item);
  }

  const actions = document.createElement("div");
  actions.className = "learn-card-actions";

  const watch = document.createElement("button");
  watch.type = "button";
  watch.textContent = "Watch lesson";
  watch.addEventListener("click", () => openLesson(course));

  const complete = document.createElement("button");
  complete.type = "button";
  complete.className = "card-complete";
  complete.dataset.courseId = course.id;
  complete.addEventListener("click", () => toggleComplete(course.id));

  actions.append(watch, complete);
  content.append(title, metadata, description, outcomes, actions);
  article.append(image, heading, content);
  updateCompleteButton(complete, course.id);
  return article;
}

function render() {
  const visible = courses.filter(matches);
  grid.replaceChildren(...visible.map(courseCard));
  grid.setAttribute("aria-busy", "false");
  empty.hidden = visible.length !== 0;
  status.textContent = `${visible.length} of ${courses.length} course videos`;
}

function updateCompleteButton(button, courseId) {
  const isComplete = progress.completed.includes(courseId);
  button.textContent = isComplete ? "Completed ✓" : "Mark complete";
  button.setAttribute("aria-pressed", String(isComplete));
}

function toggleComplete(courseId) {
  if (progress.completed.includes(courseId)) {
    progress.completed = progress.completed.filter((id) => id !== courseId);
  } else {
    progress.completed = [...progress.completed, courseId];
  }
  saveProgress();
  updateProgress();
  render();
  if (currentCourse?.id === courseId) updateDialogCompletion();
}

function updateProgress() {
  const completedCourses = courses.filter((course) =>
    progress.completed.includes(course.id)
  );
  const percent = courses.length
    ? Math.round((completedCourses.length / courses.length) * 100)
    : 0;
  const minutes = Math.round(
    completedCourses.reduce((sum, course) => sum + course.durationSeconds, 0) / 60
  );

  document.querySelector("#progress-percent").textContent = `${percent}%`;
  document.querySelector("#progress-fill").style.width = `${percent}%`;
  document.querySelector(".learn-progress-track").setAttribute("aria-valuenow", String(percent));
  document.querySelector("#completed-count").textContent = String(completedCourses.length);
  document.querySelector("#learning-time").textContent = `${minutes} min`;
  document.querySelector("#catalog-count").textContent = String(courses.length);
  updateContinue();
}

function updateContinue() {
  const section = document.querySelector("#continue-learning");
  const course = courses.find((item) => item.id === progress.recent);
  if (!course) {
    section.hidden = true;
    return;
  }
  section.hidden = false;
  document.querySelector("#continue-title").textContent = course.title;
  document.querySelector("#continue-description").textContent =
    `${course.subject} · ${course.duration} · ${course.format}`;
  document.querySelector("#continue-button").onclick = () => openLesson(course);
}

function directLessonUrl(courseId) {
  const url = new URL(window.location.href);
  url.hash = "";
  url.searchParams.set("course", courseId);
  return url;
}

function openLesson(course) {
  currentCourse = course;
  progress.recent = course.id;
  saveProgress();
  updateContinue();
  const url = directLessonUrl(course.id);
  window.history.replaceState({ courseId: course.id }, "", url);

  document.querySelector("#lesson-format").textContent =
    `${course.area} · ${course.format} · ${course.duration}`;
  document.querySelector("#lesson-title").textContent = course.title;
  document.querySelector("#lesson-description").textContent = course.description;
  const alignment = document.querySelector("#lesson-alignment");
  if (course.catalogAlignment) {
    alignment.hidden = false;
    alignment.textContent =
      `${course.catalogAlignment.courseCode} · ${course.catalogAlignment.relationship}`;
  } else {
    alignment.hidden = true;
    alignment.textContent = "";
  }
  const provenance = document.querySelector("#lesson-provenance");
  const provenanceList = document.querySelector("#lesson-provenance-list");
  const contributions = Array.isArray(course.generationProvenance)
    ? course.generationProvenance
    : course.aiContribution
      ? [course.aiContribution]
      : [];
  provenance.hidden = contributions.length === 0;
  provenanceList.replaceChildren(
    ...contributions.map((contribution) => {
      const item = document.createElement("div");
      const stage = document.createElement("strong");
      const details = document.createElement("span");
      stage.textContent = contribution.stage || "Generation";
      details.textContent = [
        contribution.provider,
        contribution.model,
        contribution.modelRevision,
        contribution.executionLocation,
        contribution.mode,
      ].filter(Boolean).join(" · ");
      item.append(stage, details);
      return item;
    })
  );

  video.pause();
  video.replaceChildren();
  video.poster = course.poster;
  const source = document.createElement("source");
  source.src = course.video;
  source.type = "video/mp4";
  const track = document.createElement("track");
  track.kind = "captions";
  track.label = "English";
  track.srclang = "en";
  track.src = course.captions;
  track.default = true;
  video.append(source, track);
  video.load();

  const outcomes = document.querySelector("#lesson-outcomes");
  outcomes.replaceChildren(
    ...course.outcomes.map((outcome) => {
      const item = document.createElement("li");
      item.textContent = outcome;
      return item;
    })
  );

  document.querySelector("#lesson-transcript").href = course.transcript;
  document.querySelector("#lesson-captions").href = course.captions;
  document.querySelector("#lesson-sources").href = course.sources;
  document.querySelector("#lesson-video-download").href = course.video;
  document.querySelector("#lesson-video-download").download =
    `${course.id}.mp4`;
  document.querySelector("#lesson-link-status").textContent = "";
  updateDialogCompletion();
  dialog.showModal();
}

function updateDialogCompletion() {
  const button = document.querySelector("#lesson-complete");
  const isComplete = currentCourse && progress.completed.includes(currentCourse.id);
  button.textContent = isComplete ? "Completed — mark incomplete" : "Mark lesson complete";
  button.setAttribute("aria-pressed", String(Boolean(isComplete)));
}

function closeLesson() {
  video.pause();
  dialog.close();
}

for (const element of [search, areaFilter, formatFilter, levelFilter]) {
  element.addEventListener("input", render);
}

filters.addEventListener("reset", () => {
  selectedPath = "";
  activePath.hidden = true;
  for (const button of pathButtons) button.setAttribute("aria-pressed", "false");
  setTimeout(render, 0);
});

for (const button of pathButtons) {
  button.setAttribute("aria-pressed", "false");
  button.addEventListener("click", () => {
    selectedPath = button.dataset.path;
    activePathName.textContent = selectedPath;
    activePath.hidden = false;
    for (const item of pathButtons) {
      item.setAttribute("aria-pressed", String(item === button));
    }
    render();
    document.querySelector("#catalog").scrollIntoView();
  });
}

clearPath.addEventListener("click", () => {
  selectedPath = "";
  activePath.hidden = true;
  for (const button of pathButtons) button.setAttribute("aria-pressed", "false");
  render();
});

document.querySelector("#reset-progress").addEventListener("click", () => {
  progress = { completed: [], recent: "" };
  saveProgress();
  updateProgress();
  render();
});

document.querySelector("#lesson-close").addEventListener("click", closeLesson);
document.querySelector("#lesson-complete").addEventListener("click", () => {
  if (currentCourse) toggleComplete(currentCourse.id);
});
document.querySelector("#lesson-copy-link").addEventListener("click", async () => {
  if (!currentCourse) return;
  const status = document.querySelector("#lesson-link-status");
  try {
    await navigator.clipboard.writeText(
      directLessonUrl(currentCourse.id).toString(),
    );
    status.textContent = "Direct lesson link copied.";
  } catch {
    status.textContent =
      "Copy the current page address to share this exact lesson.";
  }
});
dialog.addEventListener("click", (event) => {
  if (event.target === dialog) closeLesson();
});
dialog.addEventListener("close", () => {
  video.pause();
  const url = new URL(window.location.href);
  url.searchParams.delete("course");
  window.history.replaceState({}, "", url);
});

fetch(catalogUrl)
  .then((response) => {
    if (!response.ok) throw new Error("Catalog unavailable");
    return response.json();
  })
  .then((data) => {
    if (!Array.isArray(data.courses)) throw new Error("Invalid catalog");
    courses = data.courses;
    document.querySelector("#hero-catalog-count").textContent =
      `${courses.length} course videos`;
    addOptions(areaFilter, unique(courses.map((course) => course.area)));
    addOptions(formatFilter, unique(courses.map((course) => course.format)));
    addOptions(levelFilter, unique(courses.map((course) => course.level)));
    updateProgress();
    render();
    const requestedCourse = new URL(window.location.href).searchParams.get(
      "course",
    );
    const directCourse = courses.find((course) => course.id === requestedCourse);
    if (directCourse) {
      openLesson(directCourse);
    }
  })
  .catch(() => {
    grid.setAttribute("aria-busy", "false");
    status.textContent = "The course catalog could not be loaded.";
    empty.hidden = false;
  });
