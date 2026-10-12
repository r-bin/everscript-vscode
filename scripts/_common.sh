# Sourced by the other scripts: run from the repo root and find npm.
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"
if command -v npm >/dev/null 2>&1; then NPM=npm
elif [ -x /opt/homebrew/bin/npm ]; then NPM=/opt/homebrew/bin/npm
else echo "npm not found (install Node, or add /opt/homebrew/bin to PATH)" >&2; exit 1; fi
step() { printf '\n== %s\n' "$*"; }
