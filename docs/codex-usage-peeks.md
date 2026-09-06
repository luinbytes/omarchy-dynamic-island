# Codex usage peeks

Each available Codex window uses the existing small Live Peek. The label identifies
weekly or five-hour usage and shows the remaining percentage. Clicking the peek
opens the existing Codex usage panel.

- Every cumulative drop of ten percentage points produces one alert.
- Crossing strictly below 25%, 10%, and 5% produces a low-usage alert once per cycle.
- An advancing numeric reset time produces a reset alert and rearms checkpoints.
- A poll crossing multiple checkpoints produces the most urgent alert, without a
  backlog of notifications. Existing attention-event ranking still applies.

The first valid sample is silent. Missing or unavailable data rebaselines silently
when it returns. Small upward corrections do not rearm warnings. The peek uses the
existing five-second lifetime, screen selection, DND and fullscreen suppression.
Suppressed changes are consumed rather than replayed when suppression ends.

The existing usage provider remains the only poller. Its normal refresh interval
is three minutes. Its public payload can additionally supply `weekly_reset_at`
and `session_reset_at` as numeric Unix timestamps from the corresponding rate-limit
window. The local provider now exposes those values. A missing five-hour window
stays unavailable. Display countdown strings never establish a reset.

Run `node scripts/verify-scaffold.mjs` for deterministic model and integration
checks. Live verification uses temporary synthetic usage samples through the real
provider binding and the existing peek renderer, then removes the sample override.

## Verification on 2026-09-06

Portable scaffold checks, provider self-tests, exact reset-field checks and the
installed plugin validator pass. Independent review found no blocking issue.
The optional upstream-checkout wrapper could not run because the installed
Omarchy package is not a Git checkout; validation used the installed plugin CLI
and running shell instead.

Live QA on DP-1 fed synthetic samples through the real Codex provider binding.
The 10-point drop, below-25%, below-10%, below-5%, reset and five-hour events all
produced the small 306 by 68 pixel peek. Fresh cropped screenshots were inspected.
The final event expired automatically after five seconds. HDMI-A-1 remained
ineligible under its existing presenter policy. No monitor focus was changed.

The final local verification used the historical build name `codex-usage-peek-1`. Its two changed model
files matched the source at that checkpoint. The temporary usage override and QA build were removed,
and the provider returned to live data. Quickshell retained its existing process.
The work was uncommitted at the end of that pass, alongside preserved
pre-existing work. Captures, the task-only diff, provider backup and exact final
working-tree inventory were local QA evidence and are not included in this repository.
