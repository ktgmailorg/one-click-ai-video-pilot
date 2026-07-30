const mapUrl = "./cs-degree-map.json";
const catalogUrl = "./course-catalog.json";
const stageList = document.querySelector("#cs-stage-list");
const stageButtons = [...document.querySelectorAll("[data-stage]")];
let selectedStage = "";
let degreeMap;
let catalog;

function element(name, className, text) {
  const node = document.createElement(name);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function render() {
  const stages = degreeMap.stages.filter(
    (stage) => !selectedStage || stage.id === selectedStage,
  );
  stageList.replaceChildren(
    ...stages.map((stage) => {
      const section = element("section", "cs-stage");
      const header = element("header", "cs-stage-heading");
      const count = degreeMap.courses.filter(
        (course) => course.stage === stage.id,
      ).length;
      header.append(
        element("span", "", stage.label),
        element("h3", "", stage.description),
        element("b", "", `${count} requirements`),
      );
      const grid = element("div", "cs-course-grid");
      const courses = degreeMap.courses.filter(
        (course) => course.stage === stage.id,
      );
      grid.append(...courses.map(courseCard));
      section.append(header, grid);
      return section;
    }),
  );
  const visibleCount = degreeMap.courses.filter(
    (course) => !selectedStage || course.stage === selectedStage,
  ).length;
  document.querySelector("#cs-status").textContent =
    `${visibleCount} of ${degreeMap.courses.length} requirements shown`;
}

function courseCard(course) {
  const article = element("article", "cs-course-card");
  const code = element("span", "cs-course-code", course.code);
  const title = element("h4", "", course.title);
  const prerequisites = element("div", "cs-prerequisites");
  prerequisites.append(element("b", "", "Prerequisites"));
  prerequisites.append(
    element(
      "p",
      "",
      course.prerequisites.length
        ? course.prerequisites.join(" · ")
        : "No prerequisite shown on supplied flowchart",
    ),
  );
  const linked = course.linkedLessons
    .map((id) => catalog.courses.find((lesson) => lesson.id === id))
    .filter(Boolean);
  const coverage = element(
    "div",
    linked.length ? "cs-coverage available" : "cs-coverage planned",
  );
  coverage.append(
    element(
      "strong",
      "",
      linked.length
        ? `${linked.length} learning module${linked.length === 1 ? "" : "s"} available`
        : "Full lesson opportunity",
    ),
  );
  if (linked.length) {
    for (const lesson of linked) {
      const link = element("a", "", lesson.title);
      link.href = `./learn.html#course-${lesson.id}`;
      coverage.append(link);
    }
  } else {
    const link = element("a", "", `Propose ${course.code} content`);
    link.href = `./index.html#interest`;
    coverage.append(link);
  }
  article.append(code, title, prerequisites, coverage);
  return article;
}

function renderRequirements() {
  const grid = document.querySelector("#cs-requirements-grid");
  grid.replaceChildren(
    ...degreeMap.supportingRequirements.map((requirement) => {
      const article = element("article", "");
      article.append(element("h3", "", requirement.group));
      const list = element("ul", "");
      for (const item of requirement.items) {
        list.append(element("li", "", item));
      }
      article.append(list);
      return article;
    }),
  );
  const notes = document.querySelector("#cs-degree-notes");
  notes.replaceChildren(
    ...degreeMap.notes.map((note) => element("li", "", note)),
  );
}

for (const button of stageButtons) {
  button.addEventListener("click", () => {
    selectedStage = button.dataset.stage;
    for (const item of stageButtons) {
      item.setAttribute("aria-pressed", String(item === button));
    }
    render();
  });
}

Promise.all([
  fetch(mapUrl).then((response) => {
    if (!response.ok) throw new Error("Degree map unavailable");
    return response.json();
  }),
  fetch(catalogUrl).then((response) => {
    if (!response.ok) throw new Error("Course catalog unavailable");
    return response.json();
  }),
])
  .then(([loadedMap, loadedCatalog]) => {
    degreeMap = loadedMap;
    catalog = loadedCatalog;
    const linked = degreeMap.courses.flatMap((course) => course.linkedLessons);
    const covered = degreeMap.courses.filter(
      (course) => course.linkedLessons.length,
    ).length;
    document.querySelector("#cs-course-count").textContent = String(
      degreeMap.courses.length,
    );
    document.querySelector("#cs-covered-count").textContent = String(covered);
    document.querySelector("#cs-lesson-count").textContent = String(
      new Set(linked).size,
    );
    document.querySelector("#cs-disclaimer").textContent =
      degreeMap.disclaimer;
    render();
    renderRequirements();
  })
  .catch(() => {
    document.querySelector("#cs-status").textContent =
      "The curriculum map could not be loaded.";
  });
