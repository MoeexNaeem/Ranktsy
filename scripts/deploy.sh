#!/usr/bin/env bash
# Deploy Rankkw with (almost) no downtime.
#
# The old way (git pull && npm run build && pm2 reload) rebuilt `.next` while the
# live site was serving from it, so for the ~2 minutes of the build pages and tools
# broke, and a failed `pm2 reload` could leave workers running a mix of old and new
# code. Here the new build goes into `.next-build` while the site keeps serving the
# current `.next`; only when the build has succeeded are the folders swapped and the
# workers restarted, so visitors only notice the few seconds of the restart.
#
# Usage (on the server):   bash scripts/deploy.sh
# Roll back to the previous build:
#   mv .next .next-bad && mv .next-old .next && pm2 restart rankkw
set -euo pipefail
cd "$(dirname "$0")/.."

echo "==> Pulling latest code"
git pull --ff-only

echo "==> Installing packages"
npm install --no-audit --no-fund

echo "==> Building into .next-build (the live site keeps running meanwhile)"
rm -rf .next-build
NEXT_DIST_DIR=.next-build npm run build

echo "==> Swapping in the new build"
rm -rf .next-old
if [ -d .next ]; then mv .next .next-old; fi
mv .next-build .next

echo "==> Restarting all workers"
pm2 restart rankkw --update-env
pm2 save >/dev/null

sleep 5
pm2 list
echo "==> Health check"
curl -s -m 20 http://localhost:3000/api/health || echo "(health check did not answer yet, run: pm2 logs rankkw --lines 50)"
echo
echo "Done. Previous build kept in .next-old (see the roll-back line at the top of this script)."
