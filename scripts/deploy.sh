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

# The build needs ~1.7 GB of RAM. With all workers running, the server (3.6 GB)
# has no room and Linux kills the build ("Killed"). So one worker is paused for
# the build and comes back afterwards; the others keep the site up throughout.
WORKERS=$(pm2 jlist 2>/dev/null | node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>{try{console.log(JSON.parse(s).filter(p=>p.name==='rankkw').length)}catch{console.log(0)}})")
restore_workers() {
  if [ "${WORKERS:-0}" -gt 1 ]; then pm2 scale rankkw "$WORKERS" >/dev/null 2>&1 || true; fi
}
trap restore_workers EXIT
if [ "${WORKERS:-0}" -gt 1 ]; then
  echo "==> Pausing 1 of $WORKERS workers to free memory for the build"
  pm2 scale rankkw $((WORKERS - 1)) >/dev/null
fi

echo "==> Building into .next-build (the live site keeps running meanwhile)"
rm -rf .next-build
if ! NEXT_DIST_DIR=.next-build npm run build; then
  echo
  echo "!! Build failed. The live site was NOT touched and is still running the old version."
  echo "!! If the line above says 'Killed', the server ran out of memory during the build:"
  echo "!!   check with: dmesg -T | grep -i 'out of memory' | tail -3"
  rm -rf .next-build
  exit 1
fi

echo "==> Swapping in the new build"
rm -rf .next-old
if [ -d .next ]; then mv .next .next-old; fi
mv .next-build .next

echo "==> Restarting all workers"
restore_workers
pm2 restart rankkw --update-env
pm2 save >/dev/null

sleep 5
pm2 list
echo "==> Health check"
curl -s -m 20 http://localhost:3000/api/health || echo "(health check did not answer yet, run: pm2 logs rankkw --lines 50)"
echo
echo "Done. Previous build kept in .next-old (see the roll-back line at the top of this script)."
