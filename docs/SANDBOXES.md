# Token Factory Sandboxes (beta)

nemocode can run commands — and whole harness sessions — inside
[Nebius Token Factory Sandboxes](https://tokenfactory.nebius.com/sandboxes/about):
disposable microVMs with network access, driven by the same `NEBIUS_API_KEY`
you already use for inference. The product is in beta behind an access
request; every nemo sandbox command maps a 401/403 to a message pointing
at the request form.

## Providers

Two sandbox backends share this surface (see `docs/TENKI-SANDBOXES-PRD.md`):

- **contree** - Nebius Token Factory Sandboxes: same `NEBIUS_API_KEY` as
  inference, but a gated beta (access request + per-key permission grants).
- **tenki** - [tenki.cloud](https://tenki.cloud): open signup; set
  `TENKI_API_KEY` (a `tk_…` key). `--fetch` reads files from the live
  session; post-hoc fetch/prebake land with snapshots (PRD milestone 2).

Select with `--provider <tenki|contree>` or `NEMOCODE_SANDBOX_PROVIDER`.
The default is tenki (open signup, CI-verified live); select Nebius with
`--provider contree`. Credentials in the env never switch providers on
their own. Harness keys reach tenki sessions via the create request body
over TLS - never argv, never disk.

## Project header

Some Nebius accounts require a project on every Sandboxes call (the API
answers `400 Missing "Project" header` otherwise). Pass it per command with
`--project <id>`, per shell via `NEBIUS_PROJECT=<id>`, or store it once with
`nemo sandbox project <id>` (kept in `~/.nemocode/config.json`). The id
is shown in the Token Factory console - there is no discovery API: `/v1/projects`
404s on both the Token Factory and Sandboxes APIs (probed 2026-08-02), and
`whoami` rejects a missing Project header before even checking auth. Live-observed permission model: a key can hold the
`spawn` permission without `list`, so `nemo sandbox status` reports a
list-permission 403 as qualified success and the definitive check is
`nemo sandbox run -- echo ok`. A `403 Insufficient permissions: spawn`
means the key needs Sandboxes permissions granted for that project in the
console - it is not a beta-access problem.

## Commands

```sh
nemo sandbox status          # your key's exact Sandboxes permissions (via /whoami)
nemo sandbox run echo hello  # one shell command in a disposable sandbox
nemo sandbox run --image tag:ubuntu:latest --timeout 300 -- apt-get moo
nemo sandbox run --keep -- make build       # snapshot the filesystem on success
nemo sandbox run --fetch /work/report.md -- "make report"  # download artifacts after
nemo sandbox fetch <image-uuid> /work/out.txt --out out.txt
nemo sandbox prebake         # bake tooling into tag:nemocode:prebaked
nemo sandbox advisory        # print the agent-instructions advisory block
nemo sandbox advisory --write  # append it to ~/.claude/CLAUDE.md + ~/.codex/AGENTS.md
```

## Artifacts (result images)

Every **non-disposable** run snapshots its full filesystem into an immutable
result image on success. `--keep` turns that on; `--fetch <path>` (implying
`--keep`) downloads files from the snapshot right after the run, and
`nemo sandbox fetch <image-uuid> <path>` pulls files from any past
result image. `claudemo --sandbox --keep …` prints the result image UUID so a
remote session's outputs (the repo lives at `/work`) can be retrieved without
asking the agent to push. Untagged images are retained for 180 days.

## Prebaked images

`nemo sandbox prebake` runs the tooling install (nemocode + Claude Code

- Codex CLIs) once in a non-disposable sandbox and tags the result image
  (default `nemocode:prebaked`). Because every bootstrap install is
  `command -v`-guarded, later runs with `--image tag:nemocode:prebaked` skip
  the ~1-minute cold bootstrap entirely:

```sh
nemo sandbox prebake
claudemo --sandbox --image tag:nemocode:prebaked -p "fix the failing test"
```

Re-run `prebake` whenever you want the baked tooling refreshed (the tag moves
to the new image).

## Remote harness sessions

```sh
claudemo --sandbox -p "fix the failing test and commit"
codemo --sandbox exec "add input validation to the signup form"
```

What happens: the wrapper spawns a disposable, networked instance, bootstraps
it (installs nemocode via the public one-liner plus the agent CLI), clones
your repository's **pushed** state (`origin` + current branch), and runs the
harness headlessly with your passthrough args. Output streams back as the
operation progresses; the sandbox is disposable and vanishes afterwards.

Honest limitations of this first pass:

- **Headless only.** The beta API surface we build on (instance spawn +
  operation polling) does not carry an interactive TTY, so pass a task
  (`-p` / `exec ...`), not an interactive session.
- **Pushed state only.** The sandbox clones `origin`; local uncommitted
  changes do not travel. The CLI says so at launch. Private repositories work
  only if the clone URL embeds credentials the sandbox can use.
- **Results live in the transcript by default.** Run with `--keep` to
  snapshot the sandbox filesystem into a result image and pull files out via
  `nemo sandbox fetch` (see Artifacts above); or ask the agent to push.
- **Cold bootstrap on the stock image.** Each `tag:ubuntu:latest` run
  installs tooling from scratch (~a minute); `nemo sandbox prebake`
  eliminates this (see Prebaked images above).
- **No true TTY, by API design.** The API has no PTY/attach/resize surface -
  all I/O is HTTP (stdin POSTs + an SSE event stream); even Nebius's own
  `contree shell` is a client-side line-mode REPL. Full-screen TUIs will not
  run remotely; headless tasks are the supported shape.

## Advisory block

`nemo sandbox advisory --write` appends a marked, idempotent block to
`~/.claude/CLAUDE.md` and `~/.codex/AGENTS.md` steering agents to prefer
sandboxes for risky commands. Steering only — the `--sandbox` wrapper is the
enforcement boundary.

## API notes

Client: `packages/cli/src/lib/sandbox/contree.ts` against
`https://api.tokenfactory.nebius.com/sandboxes` (`POST /v1/instances`,
`GET /v1/operations/{id}`; Bearer auth). Beta limits per the docs: 50
simultaneous operations, checkpoint images retained 180 days. The operation
payload shape is normalized defensively (`normalizeOperation`) because the
beta surface is still settling.
