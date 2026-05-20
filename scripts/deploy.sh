#!/usr/bin/env bash
# Pull latest main; if nothing changed, exit. Otherwise rebuild and restart.
# Safe to invoke from a systemd timer — no-ops when already up to date.
set -euo pipefail

REPO=/srv/bs_poker
cd "$REPO"

# nvm doesn't load in non-interactive shells, and Go isn't on the system PATH
# by default — pull both in so the build steps can find `node` and `go`.
export NVM_DIR="${NVM_DIR:-$HOME/.nvm}"
# shellcheck disable=SC1091
[ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh"
export PATH="$PATH:/usr/local/go/bin"

git fetch --quiet origin main

LOCAL=$(git rev-parse HEAD)
REMOTE=$(git rev-parse origin/main)

if [ "$LOCAL" = "$REMOTE" ]; then
  exit 0
fi

echo "$(date -Iseconds) deploying $LOCAL → $REMOTE"

git merge --ff-only origin/main

(cd "$REPO/server" && go build -o "$REPO/bin/bs-poker-server" .)
(cd "$REPO/client" && npm ci --no-audit --no-fund && npm run build)

sudo systemctl restart bs-poker
echo "$(date -Iseconds) deploy complete: $REMOTE"
