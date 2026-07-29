const form = document.querySelector("#pilot-interest-form");
const status = document.querySelector("#form-status");

form.addEventListener("submit", (event) => {
  event.preventDefault();
  status.hidden = false;
  status.className = "form-status";

  if (!form.reportValidity()) {
    status.classList.add("error");
    status.textContent = "Please complete the required fields.";
    return;
  }

  const values = Object.fromEntries(new FormData(form));
  if (!String(values.email).toLowerCase().endsWith("@rit.edu")) {
    status.classList.add("error");
    status.textContent = "Please use an @rit.edu email address.";
    return;
  }

  const subject = `RIT video pilot interest — ${values.name}`;
  const body = [
    "Hello Kenju,",
    "",
    "I am interested in discussing a One-Click AI Video Generator pilot.",
    "",
    `Name: ${values.name}`,
    `RIT email: ${values.email}`,
    `Role: ${values.role}`,
    `Department, course, or organization: ${values.area}`,
    "",
    "Possible topic or use case:",
    values.topic,
    "",
    "I have not included student records, restricted information, or source files.",
  ].join("\n");

  status.classList.add("success");
  status.textContent =
    "Opening an email draft. Review it in your email app before sending.";
  window.location.href =
    `mailto:kt7432@rit.edu?subject=${encodeURIComponent(subject)}` +
    `&body=${encodeURIComponent(body)}`;
});
