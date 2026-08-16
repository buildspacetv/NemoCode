#!/usr/bin/env bash
# nemocode installer.
#
#   curl -fsSL https://nemocode.com/install.sh | sh
#
# Installs the nemocode CLI as a Bun-target JS bundle at
# ~/.nemocode/bin/nemocode.js, with a `nemocode` wrapper script on
# PATH that runs it with `bun`. Installs Bun for the user if `bun` isn't on
# PATH. Also installs `nclaude`, `nopencode`, `ncodex`, and `npi` convenience wrappers.
#
# After install, the CLI prompts once for a Nebius API key on first use
# (Enter skips - the key is optional). The CLI self-updates in the background.

set -eu
# pipefail is not POSIX; the documented one-liner pipes into `sh`, which is
# dash on Debian/Ubuntu. Enable it only where the shell supports it.
if (set -o pipefail) 2>/dev/null; then set -o pipefail; fi

ORIGIN="${NEMOCODE_ORIGIN:-https://nemocode.com}"
INSTALL_DIR="${NEMOCODE_HOME:-$HOME/.nemocode}"
BIN_DIR="$INSTALL_DIR/bin"

bold() { printf "\033[1m%s\033[0m\n" "$1"; }
info() { printf "  %s\n" "$1"; }
ok()   { printf "  \033[32m✓\033[0m %s\n" "$1"; }
err()  { printf "  \033[31m✗ %s\033[0m\n" "$1" >&2; }

bold "Installing nemocode…"

# --- 1. Ensure Bun is present (install it for the user if not) ----------------
if command -v bun >/dev/null 2>&1; then
  ok "Bun found: $(bun --version)"
else
  info "Bun not found - installing it for you…"
  if command -v curl >/dev/null 2>&1; then
    curl -fsSL https://bun.sh/install | bash
  elif command -v fetch >/dev/null 2>&1; then
    fetch -o - https://bun.sh/install | sh
  else
    err "Need curl to install Bun. Please install curl and re-run."
    exit 1
  fi
  # bun.sh writes to ~/.bun; add to PATH for this script's later bun calls.
  export BUN_INSTALL="$HOME/.bun"
  export PATH="$BUN_INSTALL/bin:$PATH"
  if ! command -v bun >/dev/null 2>&1; then
    err "Bun install finished but bun isn't on PATH. Open a new shell and re-run."
    exit 1
  fi
  ok "Bun installed: $(bun --version)"
fi

# --- 2. Download the latest bundle + manifest --------------------------------
mkdir -p "$BIN_DIR"
info "Downloading nemocode from $ORIGIN …"

if ! curl -fsSL "$ORIGIN/nemocode.js" -o "$BIN_DIR/nemocode.js"; then
  err "Failed to download $ORIGIN/nemocode.js"
  exit 1
fi
ok "Bundle saved → $BIN_DIR/nemocode.js"

# --- 3. Write the launcher wrappers that run the bundle with bun -------------
# The wrappers locate bun themselves (PATH first, then ~/.bun/bin) so they
# work in shells that haven't picked up bun's PATH line yet - a fresh install
# in a fresh terminal must never die with "exec: bun: not found".
# Keep the generated text in lockstep with launcherScript() in
# packages/cli/src/lib/wrappers.ts, which rewrites these on self-update.
write_launcher() {
  launcher_name="$1"
  launcher_subcmd="$2"
  cat > "$BIN_DIR/$launcher_name" <<EOF
#!/usr/bin/env sh
# nemocode launcher - runs the installed Bun-target JS bundle.
BUN_BIN="\$(command -v bun 2>/dev/null || true)"
[ -n "\$BUN_BIN" ] || BUN_BIN="\$HOME/.bun/bin/bun"
if [ ! -x "\$BUN_BIN" ]; then
  echo "nemocode: the bun runtime was not found (looked on PATH and in ~/.bun/bin)." >&2
  echo "Install it with: curl -fsSL https://bun.sh/install | bash" >&2
  exit 127
fi
exec "\$BUN_BIN" "$BIN_DIR/nemocode.js"${launcher_subcmd:+ $launcher_subcmd} "\$@"
EOF
  chmod +x "$BIN_DIR/$launcher_name"
}

write_launcher nemocode ""
write_launcher nclaude claude
write_launcher nopencode opencode
write_launcher ncodex codex
write_launcher npi pi

ok "Wrappers installed: nemocode, nclaude, nopencode, ncodex, npi → $BIN_DIR"

# Remove old nemocode-owned wrappers that used the upstream agent names.
# Current installs must never shadow `claude`, `codex`, or `opencode`; users
# should get the real CLIs unless they explicitly run nclaude/ncodex/nopencode/npi.
remove_legacy_shadow_wrapper() {
  name="$1"
  path="$BIN_DIR/$name"

  [ -e "$path" ] || [ -L "$path" ] || return 0

  if [ -L "$path" ]; then
    target="$(readlink "$path" 2>/dev/null || true)"
    case "$target" in
      "$BIN_DIR/nclaude"|"$BIN_DIR/ncodex"|"$BIN_DIR/nopencode"|"$BIN_DIR/npi"|"$BIN_DIR/nemocode"|"$BIN_DIR/nemocode.js")
        rm -f "$path"
        ok "Removed old nemocode shadow command: $path"
        ;;
    esac
    return 0
  fi

  if [ -f "$path" ] && grep -Fqs "$BIN_DIR/nemocode.js" "$path"; then
    rm -f "$path"
    ok "Removed old nemocode shadow command: $path"
  fi
}

remove_legacy_shadow_wrapper claude
remove_legacy_shadow_wrapper codex
remove_legacy_shadow_wrapper opencode

# --- 4. Link into the current PATH when possible -----------------------------
find_writable_path_dir() {
  old_ifs="$IFS"
  IFS=:
  for dir in $PATH; do
    IFS="$old_ifs"
    [ -n "$dir" ] || continue
    [ "$dir" != "$BIN_DIR" ] || continue
    [ -d "$dir" ] && [ -w "$dir" ] || continue
    case "$dir" in
      "$HOME"/*|/usr/local/bin|/opt/homebrew/bin)
        printf "%s" "$dir"
        return 0
        ;;
    esac
    IFS=:
  done
  IFS="$old_ifs"
  return 1
}

if LINK_DIR="$(find_writable_path_dir)"; then
  links_changed=0
  links_skipped=0

  install_link() {
    name="$1"
    target="$2"
    dest="$LINK_DIR/$name"

    if [ -e "$dest" ] || [ -L "$dest" ]; then
      current="$(readlink "$dest" 2>/dev/null || true)"
      case "$current" in
        "$BIN_DIR"/*)
          ln -sf "$target" "$dest"
          links_changed=$((links_changed + 1))
          return 0
          ;;
        *)
          links_skipped=$((links_skipped + 1))
          info "Skipped $dest (already exists; remove it or put $BIN_DIR earlier on PATH to use nemocode here)"
          return 0
          ;;
      esac
    fi

    ln -s "$target" "$dest"
    links_changed=$((links_changed + 1))
  }

  install_link nemocode "$BIN_DIR/nemocode"
  install_link nclaude "$BIN_DIR/nclaude"
  install_link nopencode "$BIN_DIR/nopencode"
  install_link ncodex "$BIN_DIR/ncodex"
  install_link npi "$BIN_DIR/npi"
  if [ "$links_changed" -gt 0 ]; then
    ok "Linked $links_changed command(s) into current PATH → $LINK_DIR"
  fi
  if [ "$links_skipped" -gt 0 ]; then
    info "Skipped $links_skipped existing command(s) in $LINK_DIR"
  fi
fi

# --- 5. Help the user get it on PATH permanently -----------------------------
path_line="export PATH=\"$BIN_DIR:\$PATH\""

detect_shell_rc() {
  case "${SHELL:-}" in
    */zsh)  printf "%s/.zshrc" "$HOME" ;;
    */bash) printf "%s/.bashrc" "$HOME" ;;
    *)      printf "%s/.profile" "$HOME" ;;
  esac
}

case ":$PATH:" in
  *":$BIN_DIR:"*) ok "Already on PATH" ;;
  *)
    SHELL_RC="$(detect_shell_rc)"
    mkdir -p "$(dirname "$SHELL_RC")"
    touch "$SHELL_RC"

    if grep -Fqs "$path_line" "$SHELL_RC"; then
      ok "PATH already configured in $SHELL_RC"
    else
      {
        printf "\n# nemocode\n"
        printf "%s\n" "$path_line"
      } >> "$SHELL_RC"
      ok "Added nemocode to PATH in $SHELL_RC"
    fi

    info "Restart your shell, or run this now:"
    info "  export PATH=\"$BIN_DIR:\$PATH\""
    ;;
esac

# Verify the install works right now if already on PATH, else with explicit PATH.
INSTALLED_VERSION=""
if PATH="$BIN_DIR:$PATH" nemocode --version >/dev/null 2>&1; then
  INSTALLED_VERSION="$(PATH="$BIN_DIR:$PATH" nemocode --version)"
  PATH="$BIN_DIR:$PATH" nemocode __telemetry-install-completed >/dev/null 2>&1 || true
fi

# --- Post-install summary ----------------------------------------------------
echo ""
bold "✔ nemocode installed"
info "Version:  ${INSTALLED_VERSION:-unknown (verify with: nemocode --version)}"
info "Location: $BIN_DIR"
info "Next:     run \`nclaude\` (Claude Code on Nemotron) or \`nemocode\` to pick a tool."
info "          First run asks for your Nebius API key, plus an optional"
info "          (recommended) Tavily key for live web search."

# Setup notes come LAST so they can't scroll away. The PATH line was already
# appended to the shell rc above; the current shell just hasn't loaded it.
if ! command -v nemocode >/dev/null 2>&1; then
  echo ""
  bold "⚠ Setup note: nemocode is not on this shell's PATH yet. Run:"
  info "  export PATH=\"$BIN_DIR:\$PATH\""
  info "or open a new terminal (your shell profile already has the PATH line)."
fi
