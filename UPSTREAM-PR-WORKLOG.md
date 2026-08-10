# Upstream PR Worklog

Goal: get fork PRs #2–#5 (cududa/codex-router) into a buildable, tested,
maintainer-acceptable state for submission to upstream duolahypercho/codex-router.

Working repo: C:\Users\cullendudas\Documents\GitHub\codex-router
Scratch worktree for PR2: ..\codex-router-pr2check (may be stale; re-verify)

Isolated test env:
  CODEX_HOME = %TEMP%\codex-router-test-codexhome
  CODEX_ROUTER_STATE_DIR = %TEMP%\codex-router-test-state

## PR inventory (open)

- #2 feat/adopt-native-catalog  — adopt existing Codex model catalog (opt-in)
- #3 feat/windows-user-environment-credentials — opt-in HKCU credential source
- #4 fix/windows-hidden-service — hidden Task Scheduler service (wscript)
- #5 fix/fireworks-codex-metadata — strip unsupported Fireworks metadata
- (#1 closed — design doc, superseded)

## Baseline on main (b8e6726)

- npm ci: OK
- npm run check: OK (syntax)
- npm test: 1 failing test
  - control.test.mjs "login-free aliasing applies even when a ChatGPT
    credential is still stored"
  - actual aliases include extra { gpt-5.6-terra: deepseek/deepseek-v4-pro }
    beyond expected { gpt-5.6-sol: deepseek/deepseek-v4-flash }

### Root cause (pre-existing, NOT a PR regression)

control.mjs setLoginFreeMode() spawns src/catalog.mjs with env
  { ...process.env, MODEL_ROUTER_TARGET, MODEL_ROUTER_LOGIN_FREE }
It does NOT forward the test's MODEL_ROUTER_STATE_DIR / CODEX_HOME overrides.
catalog.mjs then resolves managedStateDir() against the real home (~/.codex),
so a machine with a live router install leaks its real native-models.json
(e.g. gpt-5.6-terra from the user's Codex fork) into the alias map.

=> Green on clean CI runners; red for any developer with the router installed.
   Cross-platform, not Windows-specific (POSIX shows it too if ~/.codex exists).

Candidate fix: in setLoginFreeMode's catalog spawn env, explicitly forward
CODEX_HOME and MODEL_ROUTER_STATE_DIR when set. Verify both this control spawn
and the config-manager spawn forward the same overrides.

## PR 2 branch extra failure

feat/adopt-native-catalog additionally fails
  registry.test.mjs "provider registry exposes configured API and OAuth model families"
(list mismatch). Need to determine whether same env leak or a real change.
PR 2 does not modify control.test.mjs / native-alias.mjs; only catalog.mjs
nativeCatalog() gained a readNativeCatalogSource() branch.

## Test matrix (isolated CODEX_HOME/STATE_DIR, npm ci each)

| Branch | pass | fail | notes |
|---|---|---|---|
| main (b8e6726) | 398 | 1 | control login-free aliasing (the Windows test bug) |
| + fix/windows-control-test-codex-bin (9d6fdc0) | 399 | 0 | baseline green |
| #2 feat/adopt-native-catalog (+ctrl fix) | 402 | 0 | incl. new catalog tests |
| #3 feat/windows-user-environment-credentials | 400 | 1* | only the known control bug; own tests pass |
| #4 fix/windows-hidden-service | 398 | 1* | only the known control bug; operation-lock PASSES |
| #5 fix/fireworks-codex-metadata | 400 | 1* | only the known control bug; routing tests pass |

* = the pre-existing control.test.mjs Windows bug, fixed by
fix/windows-control-test-codex-bin. All four PR branches are green once that
test fix is applied.

## control.test.mjs bug — RESOLVED (it was a test bug, not source)

Earlier hypothesis (env forwarding in setLoginFreeMode) was WRONG. Actual
cause: the test stubbed Codex with CODEX_BIN=/usr/bin/true. That path does not
exist on Windows, so findCodexBinary() fell through to the real Codex install
and captureNative() re-captured the live 2-model catalog (gpt-5.6-sol +
gpt-5.6-terra), overwriting the seeded 1-model file and adding an extra alias.
Fix: use process.execPath (runnable everywhere, empty output -> reuses seeded
catalog). Committed on fix/windows-control-test-codex-bin. This is
pre-existing on main, independent of all four PRs; land as its own tiny PR.

## PR4 proper-lockfile note — RESOLVED

The PR description said service-operation-lock couldn't run (dependency
absent). After a full npm ci here it passes. Stale note from the previous
agent's incomplete install; remove that caveat from the PR description.

## Naming decision (user-approved)

Avoid "hidden" (reads as concealment for a security-sensitive change). Use
"background service" / "without a console window". New branch pushed:
fix/windows-background-service (same content as fix/windows-hidden-service).
Plan: open PR against new branch with corrected title/body/docs, close old #4
with a pointer. Old branch left in place (not deleted) to avoid surprises.

## Code review notes (against upstream patterns)

PR2 catalog: principled. Opt-in flag threaded through setup + both installers;
fail-closed default; validated before recording; reversible on disable;
protected state file; cross-platform path equality. Good.

PR3 windows creds: well-scoped + defensive. Policy file protected, registry is
the allowlist for variable names, precedence preserved (explicit process env >
protected file > HKCU > CLI session), non-Windows rejected, explicit on/off,
never prints values. Good.

PR4 background service: VBScript launcher + wscript hidden action, --visible
debug retained, both files removed on uninstall, same task identity/env/logs.
Docs say "hidden wscript launcher" -> reword to "background"/"no console
window". Tests cover launcher render + action selection + visible opt-in.

PR5 fireworks: centralized normalizeProviderPayload applied at the three
forwarding boundaries (API forwarder, routed Responses, routed compaction).
Fireworks-only web_search_options strip; client_metadata already handled.
Good, minimal.

## TODO

- [x] Confirm registry.test.mjs failure cause on PR 2 (env leak, hermetic in isolation)
- [x] Re-run full suite per PR branch in worktrees with isolated env
- [x] Diagnose + fix control.test.mjs Windows bug
- [x] Confirm PR4 operation-lock test runs after npm ci (passes)
- [x] Code review each PR diff against upstream patterns
- [x] Push fix/windows-control-test-codex-bin + open its PR (#6)
- [x] Open PR for fix/windows-background-service (#7); closed #4 with pointer
- [x] Reword PR7 docs to drop "hidden" (commit 1fd32b8)
- [x] Rewrite PR titles/descriptions (maintainer voice) for #2,#3,#5,#7
- [ ] Upstream submission plan (order, whether to open an issue first)

## Current PR state (all on cududa/codex-router -> main)

- #2 feat(catalog): adopt an existing Codex model catalog (opt-in) — green
- #3 feat(windows): opt in to user-environment credentials — green
- #5 fix(fireworks): drop unsupported web_search_options on routed requests — green
- #6 test(control): make login-free alias test hermetic on Windows — NEW, the
  pre-existing test fix; green
- #7 fix(windows): start the background service without a console window —
  replaces #4 (closed), same change on renamed branch, docs reworded; green

## Upstream submission plan (proposal)

Order by risk/independence, smallest and least controversial first:
1. #6 test hermeticity fix — trivial, universally correct, unblocks a green
   Windows suite for every developer with a live install. Submit first.
2. #5 fireworks — small, single-purpose, well-tested runtime fix.
3. #7 background service — Windows UX fix; moderate surface (service manager).
4. #3 windows creds — opt-in security-sensitive; expect maintainer questions.
5. #2 catalog adoption — largest surface; the most likely to need an upstream
   issue/discussion first to confirm the maintainer wants an opt-in adopt flow
   at all. Consider opening a lightweight upstream issue describing the
   problem (custom native catalog / migration) before submitting the PR.

Branches are independent (each diffed against main), so they can be submitted
in this order without stacking. If upstream prefers stacking, reorder so #2
lands before anything that builds on catalog behavior (none currently do).

## Upstream PR style (learned from duolahypercho/codex-router merged PRs)

No CONTRIBUTING.md, no PR template. Accepted external PRs (michaelyosta's
fix(win): series #65-#69, rajivpoddar #74, slavakurilyak #75) use:
  ## Problem   — symptom (often literal error output) + precise root cause
  ## Fix       — mechanism, why safe, what stays unchanged
  ## Verification — named tests + evidence, sometimes "confirmed live on Windows"
Titles are conventional-commit style, lowercase scope: fix(win):, fix(codex):,
feat(tray):. Bodies are tight; small focused diffs win.

All five fork PRs (#2,#3,#5,#6,#7) rewritten to this idiom. Cross-references
to #6 removed from feature PR bodies so each stands alone when submitted
upstream (where fork PR numbers don't exist). #7 body folds the rename
rationale inline.

## Open housekeeping

- .pr-bodies/ scratch dir: removal blocked by shell policy; harmless, untracked.
- wt-* worktrees + codex-router-pr2check on disk; clean up when done.
- UPSTREAM-PR-WORKLOG.md is untracked on main.

## 2026-08-09 — issue opened + upstream moved

Upstream issue filed: https://github.com/duolahypercho/codex-router/issues/138
(from the user's account; lists all five changes, flags #2 for maintainer
read). No maintainer response yet as of this writing.

IMPORTANT: upstream/main advanced to 3b9524c. Fork main (b8e6726) is ~50
commits behind. Notable upstream merges that overlap our PRs:

- **#110 "fix(win): start the background service without a console window"
  (49bdd09) — UPSTREAM ALREADY MERGED THE EQUIVALENT OF OUR #7.** Same
  wscript.exe //B //NoLogo VBS-launcher approach. Our #7 is now REDUNDANT.
  (Amusing: upstream's own launcher file is still named
  `start-codex-router-hidden.vbs` — they kept "hidden" in the filename.)
- #107/#108/#118/#95/#113 etc. touched api-forwarder.mjs and router.mjs
  (Gemini strip, tool_choice, compaction) — overlap our #5's files.

Rebase/merge-check vs upstream/main (3b9524c):
- fix/windows-control-test-codex-bin (#6): clean
- feat/adopt-native-catalog (#2): CONFLICT src/catalog.mjs
- feat/windows-user-environment-credentials (#3): CONFLICT install.sh,
  test/provider-credentials.test.mjs
- fix/windows-background-service (#7): CONFLICT src/service-windows.mjs,
  test/service-render.test.mjs — and now redundant with upstream #110
- fix/fireworks-codex-metadata (#5): CONFLICT src/api-forwarder.mjs,
  src/router.mjs, test/routing.test.mjs

Still-needed assessment:
- #5 fireworks: STILL NEEDED. Upstream strips web_search_options only for
  Gemini in api-forwarder.mjs; no Fireworks handling, no provider-payload.mjs.
  But must be rebased and reconciled with upstream's new per-provider
  normalization comments/structure (they now centralize some of this in the
  forwarder). Our normalizeProviderPayload may want to live where upstream now
  puts Gemini logic rather than as a new module.
- #7: DROP (redundant with #110) unless ours does something theirs doesn't —
  verify before discarding.
- #2, #3: still needed, need rebase onto current upstream/main.

NEXT STEPS
- [x] Diff our #7 vs upstream #110: confirmed redundant EXCEPT our #7 added a
  `--visible` debug opt-in that #110 lacks. Closed #7 with a note offering the
  `--visible` flag as a small follow-up if upstream wants it.
- [x] Rebase #2, #3, #5 onto upstream/main; resolve conflicts.
- [x] Re-verify tests after rebase.
- [ ] When maintainer responds to #138, submit in order, dropping #7.

## 2026-08-09 — rebase results (onto upstream/main 3b9524c)

All three remaining code PRs rebased, force-pushed, and merge clean vs
upstream/main. Full suite on each: 652-653 pass, 1 fail — the lone failure is
the pre-existing control.test.mjs Windows bug, resolved by #6.

- #5 fireworks: RESTRUCTURED per maintainer's idiom. Dropped the
  provider-payload.mjs shared-module approach; now uses upstream's inline
  per-provider pattern (provider?.id === "fireworks", cf. isGeminiProvider) at
  the three boundaries: forwarder normalizeBody, routed /responses, and
  summarize() compaction. New head 97159a9. Branch force-pushed; PR body
  updated to match.
- #3 windows creds: rebased, additive conflicts resolved (kept upstream's
  --force help + keychainProbeCount test alongside our additions). New head
  b878f65.
- #2 catalog: rebased, single additive import conflict (vision-bridge imports
  vs ours). New head 4490ee8.

Open PRs ready for upstream submission: #6, #5, #3, #2.

## 2026-08-09 — text cleanup (clean rewrites, no addenda)

- Issue #138: removed the stale "Background service console window" bullet
  (upstream landed that fix in #110) via a clean body rewrite, not an edit
  note. The `--visible` opt-in delta is not mentioned in the issue; it can be
  offered as a follow-up PR later if wanted.
- PR #5 body: confirmed the `## Fix` section already describes the inline
  `provider?.id === "fireworks"` idiom (post-restructure); re-applied body for
  consistency.
- Scratch body files (.pr5.md etc.) left on disk; shell policy blocks cleanup.
