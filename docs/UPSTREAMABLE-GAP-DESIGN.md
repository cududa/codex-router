# Upstreamable Compatibility Gaps

Status: proposal

This document defines a small series of upstreamable changes for the current
Codex Router `main`. It deliberately excludes the private repository's research
notes, app-data snapshots, and convenience scripts.

## Goals

- Preserve upstream defaults unless a user explicitly opts into compatibility
  behavior.
- Use the existing CLI, provider registry, protected state, and platform service
  manager conventions instead of adding a parallel settings system.
- Keep credentials, catalog contents, and generated caller URLs out of logs and
  status output.
- Make every behavior testable without a real Codex installation, Windows user
  profile, provider credential, or paid request.
- Keep each product change in a separate branch and pull request.

## Proposed Series

### 1. Adopt an existing native catalog

**Problem:** Codex Router can capture a native catalog through the Codex CLI,
but an existing `model_catalog_json` owned by another router is currently a
hard conflict. This is common when migrating from an older local installation
or another compatible router.

**User-visible behavior:** Add an explicit `--adopt-native-catalog` option to
guided/automatic setup and the Windows installer. The default remains refusal.
Detection reports that an adoption is available without reading catalog
contents to the terminal. Setup must show the option in its summary before it
changes the config.

**Safety contract:** Adoption is allowed only when the path is absolute,
readable, valid JSON with a non-empty `models` array, contains no router-owned
model slugs, and does not conflict with another managed base URL. The original
path is recorded in protected per-target state. Enabling the router replaces it
with the generated merged catalog; disabling or rolling back restores the exact
original path and clears the adoption state. Any validation or ownership
ambiguity stops without modifying the config.

**Tests:** catalog validation, detection, opt-in refusal/default behavior,
config enable/disable restoration, malformed paths, routed-model collisions,
and Windows path escaping.

### 2. Opt into Windows user-environment credentials

**Problem:** A Windows user can store a provider environment variable in
`HKCU\Environment`, but a per-user scheduled task may not receive a newly
updated environment block until a new logon. The current process-environment
lookup therefore misses a credential that the user has explicitly configured.

**User-visible behavior:** Add a setup option such as
`--windows-user-environment`. It is off by default and is persisted as a
protected target policy, not as a credential. `doctor` and provider status report
only that the source is enabled or that a credential was found there. The
provider registry remains the source of truth for which environment variable
names may be read; no arbitrary registry key is accepted.

**Resolution order:** An explicitly supplied process environment value remains
highest priority. A protected router key remains authoritative over the Windows
user environment. When the opt-in policy is enabled, the resolver then checks
the declared variable names through `reg.exe`, followed by existing fallback
sources. Values never appear in output, arguments, snapshots, or logs.

**Tests:** registry output parsing, missing variables, malformed output,
precedence over fallback sources, opt-in/off behavior, source-only status, and
service-process behavior with mocked `reg.exe`.

### 3. Keep the Windows background service hidden

**Problem:** The managed Task Scheduler action currently launches a `.cmd`
wrapper directly. Depending on Windows/session policy, that can create a
console window for a service that is intended to be background-only.

**User-visible behavior:** The managed service should use a small `wscript.exe`
launcher by default, while retaining the existing `.cmd` wrapper for logging
and direct debugging. The service manager may expose an explicit visible or
foreground/debug mode for diagnosis; normal install, start, restart, and update
remain hidden. This is service-manager behavior, not an app model setting.

**Safety contract:** The launcher must use the same per-user task identity,
environment, log path, restart policy, and install directory as the current
wrapper. Uninstall removes both generated files. If the hidden launcher cannot
be installed, setup fails clearly rather than silently changing visibility.

**Tests:** exact rendered wrapper/launcher content, task action selection,
install/uninstall cleanup, environment propagation, and visible/debug opt-in.

### 4. Normalize Fireworks Responses requests

**Problem:** Fireworks rejects Codex-specific request metadata that other
providers tolerate. The Responses route and the API-key forwarder must apply
the same provider boundary rules.

**User-visible behavior:** No new setting is needed. For Fireworks only, remove
unsupported `client_metadata` and `web_search_options` fields immediately before
forwarding. Preserve the input for every other provider and do not mutate the
caller payload before route selection.

**Tests:** both forwarding paths, both fields, non-Fireworks preservation, and
streaming/non-streaming request shapes.

## Branch and PR Sequence

1. `docs/upstreamable-gap-design`: this proposal and review feedback.
2. `feat/adopt-native-catalog`: catalog adoption and config restoration.
3. `feat/windows-user-environment-credentials`: explicit credential-source
   policy and Windows resolver support.
4. `fix/windows-hidden-service`: hidden Task Scheduler launcher.
5. `fix/fireworks-codex-metadata`: provider-boundary normalization.

Each branch starts from the latest public-fork `main`, has one focused commit
where practical, and receives its own PR. If an earlier PR is required by a
later one, the dependency is stated in the PR description rather than folding
unrelated changes together. After upstream review, accepted changes can be
removed from the fork's maintenance burden instead of being replayed as a
private mega-merge.

## Open Review Questions

- Should the Windows user-environment opt-in be global per target, or selected
  per provider in the registry/configuration surface?
- Should catalog adoption be available only during setup, or also through an
  explicit `doctor --fix` confirmation flow?
- Should visible service mode be a CLI-only debug switch, or also be exposed in
  the desktop tray for troubleshooting?
- Does upstream want the Fireworks normalization in the shared Responses route,
  the API forwarder, or both as proposed here?
