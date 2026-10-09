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

# The build needs ~1.7 GB+ of RAM and each live worker holds ~650 MB, so on this
# 3.6 GB server Linux kills the build ("Killed") unless workers make room; pausing
# just one was not enough (2026-10-03). So only BUILD_WORKERS (default 1) keep
# serving during the build (the site stays up, a little slower for ~2-3 min) and
# the rest come back right after.
WORKERS=$(pm2 jlist 2>/dev/null | node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>{try{console.log(JSON.parse(s).filter(p=>p.name==='rankkw').length)}catch{console.log(0)}})")
restore_workers() {
  if [ "${WORKERS:-0}" -gt 1 ]; then pm2 scale rankkw "$WORKERS" >/dev/null 2>&1 || true; fi
}
trap restore_workers EXIT
BUILD_WORKERS=${BUILD_WORKERS:-1}
# Only needed on a small server: with 4 GB+ free (the 23 GB server) the build fits
# beside every worker, so the site keeps full capacity during a deploy.
AVAIL_MB=$(awk '/MemAvailable/ {print int($2/1024)}' /proc/meminfo 2>/dev/null || echo 0)
if [ "${AVAIL_MB:-0}" -ge 4096 ]; then BUILD_WORKERS=${WORKERS:-1}; fi
if [ "${WORKERS:-0}" -gt "$BUILD_WORKERS" ]; then
  echo "==> Running $BUILD_WORKERS of $WORKERS workers during the build to free memory"
  pm2 scale rankkw "$BUILD_WORKERS" >/dev/null
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

# The new build must have everything `next start` needs before the live one is touched.
for f in BUILD_ID required-server-files.json routes-manifest.json prerender-manifest.json server; do
  if [ ! -e ".next-build/$f" ]; then
    echo
    echo "!! The new build is incomplete (.next-build/$f is missing). The live site was NOT touched."
    echo "!! Contents of .next-build:"; ls -la .next-build | head -30
    exit 1
  fi
done

# Put build folder $1 in place as .next. Live workers keep writing cache files, and
# in the instant after the old .next is moved away one of them can recreate an
# empty .next; a plain `mv` then puts the build INSIDE it (.next/.next-build), the
# workers find no BUILD_ID and the site goes down (2026-10-09 outage). `mv -T` never
# nests: it fails on a non-empty .next, which is then moved aside and retried.
swap_in() {
  local src="$1" i
  for i in 1 2 3 4 5 6 7 8 9 10; do
    if mv -T "$src" .next 2>/dev/null; then return 0; fi
    rm -rf .next-stray
    mv -T .next .next-stray 2>/dev/null || true
  done
  return 1
}

echo "==> Swapping in the new build"
rm -rf .next-old .next-stray
if [ -d .next ]; then mv -T .next .next-old; fi
if ! swap_in .next-build || [ ! -f .next/BUILD_ID ]; then
  echo "!! Could not put the new build in place. Restoring the previous one."
  [ -d .next-old ] && swap_in .next-old || true
  pm2 restart rankkw --update-env || true
  exit 1
fi
rm -rf .next-stray

echo "==> Restarting all workers"
restore_workers
pm2 restart rankkw --update-env
pm2 save >/dev/null

# Wait for the site to answer. If it does not within ~90 s, put the previous build
# back automatically so a bad deploy never leaves the site down.
echo "==> Health check"
healthy=0
for i in $(seq 1 18); do
  sleep 5
  if curl -s -m 10 http://localhost:3000/api/health | grep -q '"ok":true'; then healthy=1; break; fi
done
if [ "$healthy" = 1 ]; then
  curl -s -m 10 http://localhost:3000/api/health || true; echo
  pm2 list || true
  echo "Done. Previous build kept in .next-old (see the roll-back line at the top of this script)."
else
  echo "!! The new build did not come up healthy in 90 s. Rolling back to the previous build."
  pm2 logs rankkw --err --lines 20 --nostream 2>/dev/null | tail -20 || true
  if [ -d .next-old ]; then
    rm -rf .next-failed; mv -T .next .next-failed || true; swap_in .next-old || true
    pm2 restart rankkw --update-env || true
    sleep 10
    curl -s -m 20 http://localhost:3000/api/health || true; echo
    echo "!! Rolled back. The failed build is kept in .next-failed for inspection."
  fi
  exit 1
fi
