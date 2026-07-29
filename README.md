# One-Click AI Video Generator — public pilot page

This public repository contains only the static outreach page and approved demo
media for the official RIT AI Club project. The implementation repository,
provider traces, and contributor materials remain private.

The page is intentionally conservative: it describes a supervised,
source-grounded pilot with no fixed duration limit; identifies current
capabilities and limitations; provides verified-RIT contributor instructions;
and includes captioned examples across sixteen educational topics. Short
demonstrations are used for browsing, while the workflow also supports
full-length lessons.

The public `professor-guide.html` provides a nontechnical faculty quick start,
including pilot preparation, private GitHub access, GitHub Desktop cloning,
browser-studio operation, data boundaries, review requirements, and
troubleshooting. Technical provider setup remains in `local-studio.html`.

`rit-access.html` provides a disabled-by-default RIT Google and GitHub identity
flow. When activated, a Google-verified `rit.edu` identity connects its own
GitHub account and receives an automatic read-only repository invitation.
Write-enabled `RIT Contributors` membership remains manual. See
`docs/AUTHENTICATION_SETUP.md` and `.env.example`; no OAuth or repository
credentials belong in this repository.

The interest form stores nothing on GitHub Pages. It opens a prefilled email
draft addressed to the project lead, and the visitor chooses whether to send it
from an RIT account.
