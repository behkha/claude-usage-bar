# STATE: update notice (2026-11-23)
## Goal: when a newer version of the mod is out, the band says so and one press updates it.

## Facts (tested 2026-11-23 in a throwaway config + local git marketplace)
- A release = a `version` bump in `.claude-plugin/plugin.json`. A commit without one is not an update.
- `claude plugin update usage-bar@<mkt> --json` alone answers `up_to_date`; run
  `claude plugin marketplace update <mkt>` first. Then `updateOutcome: "updated"`, `newVersion`.
- Installed copy lives in `<config>/plugins/cache/<marketplace>/<plugin>/<version>/` (`$.plugin.root`).
- New code runs after `/reload-plugins` (`$.command.run`) or a restart.
- Desktop sessions: the CLI is `CLAUDE_CODE_EXECPATH`; this machine loads the mod from the dev folder (dev folder, no updates).

## Decisions (mine, until the user says otherwise)
- Check: GET `raw.githubusercontent.com/<repo>/HEAD/.claude-plugin/plugin.json`, at most once a day,
  result in `$.store` (shared by sessions); `checkedAt` moves only on success; failures are silent.
- Notice colour: sky blue, not amber/red (those mean limits ahead/high in this mod).
- Keyboard path: slash command `/usage-bar-update`. No dismiss, no changelog in v1.
- No unit tests. Checks: validate, tsc, `bun docs/pictures.ts`, real run.

## Approved by the owner 2026-11-23 (mockups: claude.ai/artifact/97EBg6Q1C8g2n2d3jFzFaJ)
- Notice = "Update tab": twin of the project tab at the card's top-right, all five modes, `TAB_STYLE`
  colours; lamp + word + version, the tab is the button. Update / Updating (spinner, light on top
  edge) / Restart (#63d297, only where the session cannot reload) / Retry (#ff5f5f). Sky #6fb7ff.
- Arrival = "Toast once": tab rises, lamp pops; one toast per version, one session.
- Terminal: `● Update 0.2.0` at the right of the project line. `/usage-bar-update` = the press.
  Never updates by itself. No dismiss, no changelog.
- Installed version: `<config>/plugins/installed_plugins.json` -> `plugins["usage-bar@<mkt>"][].version`.
- `Button` takes only strings/`Text` (engine types): the tab is an `Svg` with a text Button laid over.

## Done (2026-11-23, not committed)
- hooks/update.ts, state types, updateTab in tab.ts, wiring + /usage-bar-update, manifest 0.2.0
  + repository, README, docs/images/update.png. validate + tsc clean (tests/: 8 old errors).
- Lab runs: check finds 0.1.0, one toast, `/usage-bar-update` moves lab 0.0.9 -> 0.2.0, pinned
  copy turns to Restart after the reload; a 0.2.0 session shows no notice. Review fixes applied.

## Left
- [ ] desktop look, seen by the owner; commit (owner's call). plugin.json is 0.0.9 on purpose for
  the look: it must be 0.2.0 again before a commit. Toasts no longer repeat the mod's name.
- Lead review round 2 (done): with a notice the project tab gives way at the pane's narrowest
  (worktree chip, branch chip, name cut, then none), 12 px clear; install path matched with \ or /.
- Known, not fixed: toast-once is get-then-set. Windows path handling not verified on Windows.
