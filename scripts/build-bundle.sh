#!/usr/bin/env bash
# Build the single cross-platform Bun-target JS bundle for distribution.
#
# The CLI is pure JS (only node: child_process/http/fs/os/crypto - all
# Bun-compatible, no native modules), so one bundle runs on every OS/arch
# when executed with `bun run`. The version from the root package.json is
# baked in via --define so the binary's self-update check knows its version.
#
# Output: site/public/nemocode.js for the Vercel static build, mirrored to
# tracked site/* artifacts so manual/static release flows stay in sync too.

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

# Version is the single source of truth from the root package.json.
VERSION="$(node -p "require('./package.json').version")"
echo "Building nemocode v${VERSION} bundle…"

# The CLI depends on the workspace @nemocode/models package, so build that
# first so `bun build` can resolve and inline it into the bundle.
pnpm --filter @nemocode/models build

PUBLIC_DIR="$ROOT/site/public"
TRACKED_DIR="$ROOT/site"
mkdir -p "$PUBLIC_DIR"
cp "$ROOT/scripts/install.sh" "$PUBLIC_DIR/install.sh"
cp "$ROOT/scripts/install.sh" "$TRACKED_DIR/install.sh"
echo "✓ installer → site/public/install.sh and site/install.sh"

# Bundle the CLI entry. --target=bun keeps Bun-only runtime assumptions; the
# result is a single self-contained JS file with models inlined.
bun build \
  "$ROOT/packages/cli/src/bin/nemocode.ts" \
  --target=bun \
  --production \
  --define "process.env.NEMOCODE_VERSION=\"${VERSION}\"" \
  --outfile "$PUBLIC_DIR/nemocode.js"

cp "$PUBLIC_DIR/nemocode.js" "$TRACKED_DIR/nemocode.js"
echo "✓ bundle → site/public/nemocode.js and site/nemocode.js ($(wc -c < "$PUBLIC_DIR/nemocode.js") bytes)"

# Refresh the manifest the auto-updater and install script read.
#
# `sha256` is not optional metadata: both the installer and the self-updater
# refuse to install a bundle they cannot verify against it (see the integrity
# note in packages/cli/src/lib/autoupdate.ts). It must therefore be computed
# from the exact bytes written above, in the same step that publishes them.
node -e "
const fs = require('node:fs');
const crypto = require('node:crypto');
const version = '${VERSION}';
const bundle = fs.readFileSync('$PUBLIC_DIR/nemocode.js');
const sha256 = crypto.createHash('sha256').update(bundle).digest('hex');
const manifest = {
  version,
  url: 'https://nemocode.com/nemocode.js',
  sha256,
  publishedAt: new Date().toISOString(),
};
const json = JSON.stringify(manifest, null, 2) + '\n';
fs.writeFileSync('$PUBLIC_DIR/latest.json', json);
fs.writeFileSync('$TRACKED_DIR/latest.json', json);
console.log('✓ manifest → site/public/latest.json and site/latest.json (v' + version + ', sha256 ' + sha256.slice(0, 12) + '…)');
"
