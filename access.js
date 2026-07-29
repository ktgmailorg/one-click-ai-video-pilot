const ritSignIn = document.querySelector("#rit-sign-in");
const githubConnect = document.querySelector("#github-connect");
const ritIdentity = document.querySelector("#rit-identity");
const githubIdentity = document.querySelector("#github-identity");
const resourceActions = document.querySelector("#resource-actions");
const signOut = document.querySelector("#sign-out");
const message = document.querySelector("#access-message");

const setText = (selector, value) => {
  document.querySelector(selector).textContent = value;
};

function showMessage(text, type = "info") {
  message.textContent = text;
  message.className = `access-message ${type}`;
  message.hidden = false;
}

function queryMessage() {
  const query = new URLSearchParams(window.location.search);
  if (query.get("signed_in")) {
    showMessage("RIT identity verified. Connect the GitHub account that should receive access.", "success");
  }
  if (query.get("github") === "invited") {
    showMessage("GitHub invitation sent. Open GitHub and accept the repository invitation.", "success");
  }
  if (query.get("github") === "already-authorized") {
    showMessage("This GitHub account already has repository access.", "success");
  }
  const errors = {
    rit_sign_in: "RIT sign-in could not be verified. Select a Google Workspace account from the rit.edu domain.",
    rit_required: "Verify your RIT Google account before connecting GitHub.",
    github_access: "GitHub access could not be completed. Confirm the intended GitHub account and try again.",
  };
  if (errors[query.get("error")]) showMessage(errors[query.get("error")], "error");
}

async function loadAccessState() {
  queryMessage();
  try {
    const response = await fetch("/api/auth/session", {
      cache: "no-store",
      credentials: "same-origin",
    });
    const state = await response.json();
    if (!response.ok) throw new Error(state.error || "Access check failed");
    const { configuration } = state;

    if (!configuration.googleConfigured) {
      setText("#rit-step-state", "Administrator activation required");
      showMessage(
        "The secure sign-in flow is installed but its Google and GitHub credentials have not been activated yet.",
        "setup",
      );
      return;
    }

    if (!state.authenticated) {
      setText("#rit-step-state", "Ready");
      ritSignIn.hidden = false;
      return;
    }

    setText("#rit-step-state", "Verified");
    setText("#rit-name", state.identity.name);
    setText("#rit-email", state.identity.email);
    ritIdentity.hidden = false;
    signOut.hidden = false;

    if (!configuration.githubConfigured) {
      setText("#github-step-state", "Administrator activation required");
      showMessage(
        "RIT sign-in is active, but automatic GitHub invitations still need administrator configuration.",
        "setup",
      );
      return;
    }

    if (!state.identity.githubLogin) {
      setText("#github-step-state", "Ready");
      githubConnect.hidden = false;
      return;
    }

    setText("#github-step-state", "Verified");
    setText("#github-login", `@${state.identity.githubLogin}`);
    githubIdentity.hidden = false;
    setText("#access-step-state", "Invitation issued or access confirmed");
    resourceActions.hidden = false;
  } catch (error) {
    showMessage(error.message, "error");
  }
}

signOut.addEventListener("click", async () => {
  signOut.disabled = true;
  await fetch("/api/auth/logout", {
    method: "POST",
    credentials: "same-origin",
  });
  window.location.assign("/rit-access.html");
});

void loadAccessState();
