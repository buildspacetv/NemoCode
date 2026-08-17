# nemocode

**Run NVIDIA Nemotron in Claude Code, Codex, and OpenCode on [Nebius Token Factory](https://tokenfactory.nebius.com/) (EU hosting).**

One install, and **Claude Code**, **Codex**, **OpenCode**, and **Pi** all talk to open-weight models (Nemotron 3 Ultra, Cosmos 3, Qwen 3.5, DeepSeek V4, MiniMax M3) served from the EU instead of their default backends.

```bash
curl -fsSL https://nemocode.org/install.sh | sh
```

Then:

```bash
claudemo     # Claude Code on Nemotron (long form: nemo claude)
```

> **Note:** [nemocode.org](https://nemocode.org) is the project's home; [nemo.guide](https://nemo.guide) serves the same content.

---

## What it does

Nebius Token Factory serves open models over an OpenAI-compatible API. It does **not** speak the Anthropic Messages API (Claude Code) or the OpenAI Responses API (Codex). nemocode runs a small local daemon that translates those wire formats to Nebius `/chat/completions` on the fly, so your agent believes it is talking to its native backend while every token is served by Nebius.

- **Proxied harnesses** (Claude Code, Codex): a local daemon translates each request/response, tracks cost, retries transient failures, trims context to fit, and emulates native web search.
- **Spawned harnesses** (OpenCode, Pi): launched with a generated provider config pointed at Nebius, no proxy needed.

Nothing about your agent install changes. The relay injects a base URL and API key per session and writes nothing permanent to your agent's config.

## Install

The one-liner installs the `nemo`, `claudemo`, `codemo`, `opencodemo`, and `pimo` commands to `~/.nemocode/bin/` and installs [Bun](https://bun.sh) for you if it isn't already present:

```bash
curl -fsSL https://nemocode.org/install.sh | sh
```

First run walks you through configuration (or run it directly):

```bash
nemo configure
```

You'll be asked for two keys:

| Key                | Where to get it                                          | Required?                                              |
| ------------------ | -------------------------------------------------------- | ------------------------------------------------------ |
| **Nebius API key** | <https://tokenfactory.nebius.com/?modals=create-api-key> | Yes                                                    |
| **Tavily API key** | <https://app.tavily.com>                                 | Optional, recommended (live web search + Tavily tools) |

Both are stored in `~/.nemocode/` and never leave your machine. You can also set `NEBIUS_API_KEY` / `TAVILY_API_KEY` in the environment instead.

If the underlying agent CLI (Claude Code, Codex, etc.) isn't installed, the relay prints its official install command and exits. It never installs agents for you.

## Usage

Pick a tool interactively:

```bash
nemocode
```

Or launch one directly (each has a short alias):

```bash
nemo claude       # alias: claudemo
nemo codex        # alias: codemo
nemo opencode     # alias: opencodemo
nemo pi           # alias: pimo
nemo chatgpt      # alpha: ChatGPT Desktop session with restore (alias: codex-app)
```

Any extra arguments are passed straight through to the underlying agent:

```bash
claudemo -p "explain this repo"
codemo exec "add a test for the parser"
```

## Models

The model list is **fetched live** from Nebius (`GET /v1/models?verbose=true`) at startup, so every model Nebius serves is available and each model's vision support comes straight from the API's modality field, never a hand-maintained list. Results are cached in `~/.nemocode/` and fall back to a bundled snapshot when offline. The default coding model is **Nemotron 3 Ultra 550B**; switch inside your agent or with `--model`.

Featured flagships:

| Model                                 | Best for                  | Context | Vision |
| ------------------------------------- | ------------------------- | ------- | ------ |
| **Nemotron 3 Ultra 550B** _(default)_ | General coding + agentic  | 256K    | No     |
| Cosmos 3 Super Reasoner               | Vision flagship           | 128K    | Yes    |
| Nemotron 3 Super 120B                 | Reasoning + tool use      | 256K    | No     |
| Nemotron 3 Nano 30B                   | Fast, cheap background    | 256K    | No     |
| MiniMax M3                            | Fast, cheap               | 196K    | No     |
| Qwen 3.5 397B                         | General / coding flagship | 262K    | No     |
| DeepSeek V4 Pro                       | Long-context reasoning    | 1M      | No     |
| Qwen2.5-VL 72B                        | Vision fallback           | 32K     | Yes    |

Claude Code and Codex are text-native; image blocks are auto-routed to a vision-capable model (Cosmos 3 Super Reasoner, then Qwen2.5-VL). OpenCode uses a dedicated `@vision` subagent pinned to the vision flagship. Run `scripts/list-nebius-models.mjs` (with `NEBIUS_API_KEY` set) to print the raw catalog Nebius serves.

## Web search

Claude Code and Codex expose a native `web_search` tool. The relay backs it with [Tavily](https://tavily.com): if a Tavily key is configured, searches return real results with citations. Without one, a search returns a clear "TAVILY_API_KEY not set" message instead of failing silently. Nebius has no hosted search tool, so this is how agents get live web access.

With a Tavily key configured, `claudemo`, `codemo`, and `opencodemo` also get [Tavily's remote MCP server](https://docs.tavily.com) injected per session, adding the explicit `tavily_search` / `tavily_extract` toolset. Each harness uses its native ephemeral mechanism (claudemo: a temp `--mcp-config` file; codemo: `-c` launch flags with env-var bearer auth; opencodemo: the generated config) - nothing durable is written and the key never appears in argv. For OpenCode this is notable: as a spawned harness it has no relay-emulated `web_search`, so the MCP server is its only live-web path. `pimo` is excluded on purpose - Pi has no MCP support by design. The inject is skipped when you pass `--strict-mcp-config` (claudemo) or `--no-mcp` (codemo), and `NEMOCODE_DISABLE_TAVILY_MCP=1` disables it everywhere.

## Configuration & env vars

| Variable                        | Effect                                                                                                                                                        |
| ------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `NEBIUS_API_KEY`                | Nebius Token Factory key (or set via `configure`).                                                                                                            |
| `TAVILY_API_KEY`                | Enables web search (or set via `configure`).                                                                                                                  |
| `NEBIUS_BASE_URL`               | Override the API base (default `https://api.tokenfactory.nebius.com/v1`).                                                                                     |
| `NEMOCODE_REASONING_EFFORT`     | `none`\|`low`\|`medium`\|`high`\|`max`. Default `none` for speed; raise for harder tasks.                                                                     |
| `NEMOCODE_FALLBACK_MODEL`       | Model to fail over to when the target model returns no response headers (down/overloaded). Default `nvidia/nemotron-3-super-120b-a12b`; set `off` to disable. |
| `NEBIUS_PROJECT`                | Nebius project id for Token Factory Sandboxes calls (or `--project`, or store once: `nemo sandbox project <id>`).                                             |
| `TENKI_API_KEY`                 | tenki.cloud credential (`tk_…`) for the default (tenki) sandbox provider.                                                                                     |
| `NEMOCODE_DISABLE_TAVILY_MCP=1` | Skip the Tavily MCP server auto-inject (claudemo, codemo, opencodemo).                                                                                        |
| `NEMOCODE_DISABLE_AUTOUPDATE=1` | Stop the installed binary from self-updating.                                                                                                                 |
| `NEMOCODE_TELEMETRY_URL`        | Opt in to telemetry by pointing at your own collector. Off by default.                                                                                        |

The installed binary keeps itself up to date from `nemocode.org`, throttled to once an hour, and swallows every failure. On the same cadence it refreshes the launcher wrappers (`nemo`, `claudemo`, …) next to the bundle, so wrapper fixes reach existing installs too. Dev/source runs never self-update.

## Sandboxing (beta)

[Nebius Token Factory Sandboxes](https://tokenfactory.nebius.com/sandboxes/about) integration ships as a first pass: `nemo sandbox status|run|advisory`, plus headless remote sessions with `claudemo --sandbox -p "<task>"` / `codemo --sandbox exec "<task>"` — the harness runs inside a disposable microVM against your repo's pushed state, on the same Nebius key as inference. Round 2 adds `sandbox status` permission reports, artifact download from result images (`--keep` / `--fetch` / `sandbox fetch`), and `sandbox prebake` for warm images that skip the cold bootstrap. Because Token Factory Sandboxes is a gated beta, [tenki.cloud](https://tenki.cloud) is the **default** provider (open signup; set `TENKI_API_KEY`), with Nebius selectable via `--provider contree` - see [`docs/TENKI-SANDBOXES-PRD.md`](docs/TENKI-SANDBOXES-PRD.md). Sandboxes itself is a beta behind an access request; the CLI says so when access is missing. Details, limitations, and the advisory block: [`docs/SANDBOXES.md`](docs/SANDBOXES.md).

## For AI agents

An LLM-readable doc is published at <https://nemocode.org/llms.txt>. If you are an agent asked to install, configure, or drive nemocode (including headless), read that first. It covers install, configure, every command, the models, and headless usage patterns.

## Local development

Monorepo: pnpm workspaces + Turbo. `packages/cli` (the relay), `packages/models` (the catalog), `packages/tests`, and `site/` (the install/update host).

```bash
pnpm install                     # from repo root
pnpm -F @nemocode/cli build     # build the CLI
pnpm dev                         # rebuild on change (run relay commands from another terminal)
pnpm test                        # offline test suite
```

Run the built CLI directly, or through the workspace bin (closest to how users invoke it):

```bash
node packages/cli/dist/bin/nemocode.js help
pnpm -F @nemocode/cli exec nemo help
```

Testing commands and live-smoke notes are in [TESTING.md](TESTING.md).

### Publishing

The install one-liner, the auto-updating bundle, and `llms.txt` are served from the static site in `site/`:

```bash
pnpm build:site        # builds the CLI bundle + latest.json + the site
# deploy site/ to Vercel (or any static host)
```

`scripts/build-bundle.sh` writes `site/public/nemocode.js` (the installed bundle) and `site/public/latest.json` (the self-update manifest). Cut a release with `pnpm bump-version`, rebuild, and redeploy so installed binaries pick it up.

## Credits

nemocode is a friendly fork of [shivaylamba/nebius-tf-relay](https://github.com/shivaylamba/nebius-tf-relay) (MIT). The daemon, wire-format translation, live model catalog, cost tracking, web-search emulation, and installer are that project's work; this fork rebrands the commands around NVIDIA Nemotron (`claudemo` / `codemo` / `opencodemo` / `pimo`) and plans Token Factory Sandboxes integration on top.

## License

MIT licensed. See [LICENSE](LICENSE).
