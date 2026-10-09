#!/usr/bin/env bash
# Move Rankkw's MAIN data (users, payments, messages, settings, credits... every
# collection) from Atlas to the server's own MongoDB, into the same database that
# already holds the tracking data (MONGODB_TRACKING_URI). The 8 tracking collections
# are skipped: the server already has them, newer than Atlas.
#
# Steps (on the server, from the app folder):
#   bash scripts/server/move-main-db.sh check      read-only: what will be copied, sizes
#   bash scripts/server/move-main-db.sh trial      full copy + verify WHILE THE SITE RUNS
#                                                  (no downtime; times it, proves it works)
#   bash scripts/server/move-main-db.sh move       the real move: stops the app, copies
#                                                  everything again, verifies every count,
#                                                  switches MONGODB_URI, starts the app
#   bash scripts/server/move-main-db.sh rollback   back to Atlas (see the warning it prints)
#
# Nothing on Atlas is changed or deleted by any step.
set -euo pipefail
cd "$(dirname "$0")/../.."
export PATH="$PATH:/www/server/mongodb/bin"

ENV_FILE=.env.local
SRC_DB=${SRC_DB:-test}
TRACKING=(listingsnapshots trackedlistings searchranksnapshots shopsnapshots keywordmarketsnapshots keywordsuggestions keywordcaches etsycaches)

val() { grep -E "^$1=" "$ENV_FILE" | tail -1 | cut -d= -f2- | sed -E "s/^[\"']//; s/[\"']$//"; }
# with_db URI NAME: the same connection string pointed at database NAME ('' = none).
with_db() { printf '%s' "$1" | sed -E "s#^(mongodb(\+srv)?://[^/?]+)(/[^?]*)?#\1/$2#"; }
strip_db() { with_db "$1" ''; }
db_of() { printf '%s' "$1" | sed -E 's#^mongodb(\+srv)?://[^/]+/([^?]*).*#\2#'; }

ATLAS_URI=${ATLAS_URI:-$(val MONGODB_URI)}
TRACK_URI=$(val MONGODB_TRACKING_URI)
[ -n "$TRACK_URI" ] || { echo "MONGODB_TRACKING_URI missing in $ENV_FILE"; exit 1; }
DST_DB=$(db_of "$TRACK_URI")
EXCL_JS=$(printf "'%s'," "${TRACKING[@]}"); EXCL_JS="[${EXCL_JS%,}]"

atlas_sh() { mongosh "$(with_db "$ATLAS_URI" "$SRC_DB")" --quiet --eval "$1"; }
local_sh() { mongosh "$TRACK_URI" --quiet --eval "$1"; }

require_atlas() {
  case "$ATLAS_URI" in
    *mongodb.net*) ;;
    *) echo "MONGODB_URI is not Atlas any more (already moved?). Set ATLAS_URI=... to run against Atlas."; exit 1 ;;
  esac
}

check() {
  require_atlas
  echo "==> Collections on Atlas ($SRC_DB) that will be copied:"
  atlas_sh "
    const skip = $EXCL_JS; let n = 0, bytes = 0;
    db.getCollectionInfos({ type: 'collection' }).map(c => c.name).filter(c => !c.startsWith('system.')).sort().forEach(c => {
      if (skip.includes(c)) return;
      const s = db.getCollection(c).stats();
      n++; bytes += s.size;
      print('  ' + c.padEnd(34) + String(s.count).padStart(12) + ' docs ' + (s.size / 1048576).toFixed(1).padStart(9) + ' MB');
    });
    const views = db.getCollectionInfos({ type: 'view' }).map(v => v.name);
    print('==> ' + n + ' collections, ' + (bytes / 1073741824).toFixed(2) + ' GB of data' + (views.length ? '; VIEWS (not copied): ' + views.join(', ') : ''));
    print('==> Skipped (already on the server): ' + skip.join(', '));
    const others = db.getMongo().getDBNames().filter(d => !['admin', 'local', 'config', '$SRC_DB'].includes(d));
    print('==> Other databases on this Atlas cluster: ' + (others.length ? others.join(', ') : 'none'));
  "
  echo "==> Free disk on this server: $(df -h /www | awk 'NR==2 {print $4}')"
}

copy_all() {
  require_atlas
  local excl=() c
  for c in "${TRACKING[@]}"; do excl+=(--excludeCollection "$c"); done
  echo "==> $(date '+%H:%M:%S') copying every main collection (existing copies on the server are replaced)"
  # READ_PREF: the trial reads a secondary (no load on the live primary); the real move
  # reads the primary, so the very last writes before the app stopped are included.
  mongodump --uri "$(strip_db "$ATLAS_URI")" --readPreference "${READ_PREF:-primary}" --db "$SRC_DB" "${excl[@]}" \
      --numParallelCollections 8 --archive --gzip --quiet \
    | mongorestore --uri "$(strip_db "$TRACK_URI")" --archive --gzip \
        --nsFrom "$SRC_DB.*" --nsTo "$DST_DB.*" --drop \
        --numParallelCollections 8 --numInsertionWorkersPerCollection 4 2>&1 \
    | grep -E "finished restoring|document\(s\) restored|error|Failed" | tail -n 80
  echo "==> $(date '+%H:%M:%S') copy finished"
}

# Count every copied collection on both sides; exits 1 on any difference.
# Rows that expire by themselves (TTL indexes: one-time codes, rate-limit marks, old
# messages...) are compared only if they are still valid 2 minutes from now: Atlas
# and this server each delete expired rows on their own clock, so counting those
# would report a "difference" that is not missing data (seen 2026-10-09).
verify() {
  require_atlas
  echo "==> Comparing document counts (Atlas vs server); rows already expiring are left out on both sides"
  local cutoff a l
  cutoff=$(( $(date +%s) * 1000 + 120000 ))
  local live_js="const T = $cutoff;
    function counts(c) {
      const coll = db.getCollection(c);
      const all = coll.countDocuments({});
      const ttl = coll.getIndexes().filter(i => typeof i.expireAfterSeconds === 'number' && Object.keys(i.key).length === 1);
      if (!ttl.length) return [all, all];
      const and = ttl.map(i => { const f = Object.keys(i.key)[0]; return { \$or: [ { [f]: { \$gt: new Date(T - i.expireAfterSeconds * 1000) } }, { [f]: { \$not: { \$type: 'date' } } } ] }; });
      return [coll.countDocuments({ \$and: and }), all];
    }"
  a=$(atlas_sh "$live_js const skip = $EXCL_JS; db.getCollectionInfos({ type: 'collection' }).map(c => c.name).filter(c => !c.startsWith('system.') && !skip.includes(c)).sort().forEach(c => print(c + ' ' + counts(c).join(' ')))")
  l=$(local_sh "$live_js db.getCollectionNames().sort().forEach(c => print(c + ' ' + counts(c).join(' ')))")
  local bad=0 name live all lline llive lall note
  while read -r name live all; do
    [ -n "$name" ] || continue
    lline=$(printf '%s\n' "$l" | awk -v n="$name" '$1==n {print $2, $3}')
    llive=${lline% *}; lall=${lline#* }
    note=""; [ "$all" != "$live" ] || [ "${lall:-}" != "${llive:-}" ] && note="  (expiring rows left out: atlas $((all - live)), server $(( ${lall:-0} - ${llive:-0} )))"
    if [ -n "$lline" ] && [ "$live" = "$llive" ]; then printf '  OK        %-34s %12s%s\n' "$name" "$live" "$note"
    else printf '  MISMATCH  %-34s atlas=%s server=%s%s\n' "$name" "$live" "${llive:-missing}" "$note"; bad=1; fi
  done <<< "$a"
  [ "$bad" = 0 ] && echo "==> ALL COLLECTIONS MATCH" || { echo "==> SOME COLLECTIONS DIFFER"; return 1; }
}

case "${1:-}" in
  check) check ;;
  trial)
    echo "Trial run: the site keeps running, so counts of busy collections may differ by a few rows at the end. That is expected here; the real move stops the app first."
    time READ_PREF=secondary copy_all
    verify || true
    ;;
  move)
    require_atlas
    BACKUP="$ENV_FILE.before-local-db-$(date +%Y%m%d-%H%M%S)"
    cp "$ENV_FILE" "$BACKUP"
    echo "==> Settings backed up to $BACKUP"
    # If anything fails or the script is interrupted before the switch, the app is
    # started again on Atlas, unchanged: a failed move never leaves the site down.
    SWITCHED=0
    on_exit() {
      if [ "$SWITCHED" = 0 ]; then
        echo "!! Move did not finish. MONGODB_URI is unchanged (still Atlas). Starting the app again."
        pm2 start rankkw >/dev/null 2>&1 || true
      fi
    }
    trap on_exit EXIT
    trap 'exit 1' HUP INT TERM
    echo "==> $(date '+%H:%M:%S') Stopping the app so nothing is written to Atlas during the copy"
    pm2 stop rankkw >/dev/null
    copy_all
    verify
    echo "==> Switching MONGODB_URI to the server's MongoDB (old Atlas line kept as a comment)"
    sed -i -E 's|^MONGODB_URI=|# MONGODB_URI_ATLAS_OLD=|' "$ENV_FILE"
    printf '\nMONGODB_URI=%s\n' "$TRACK_URI" >> "$ENV_FILE"
    SWITCHED=1
    pm2 restart rankkw --update-env >/dev/null
    echo "==> $(date '+%H:%M:%S') App started on the server's MongoDB"
    sleep 8
    echo "==> Health check: $(curl -s --max-time 15 http://127.0.0.1:${PORT:-3000}/api/health || echo 'no answer yet, run: curl -s http://127.0.0.1:3000/api/health')"
    echo "==> Done. Atlas still holds its copy, untouched. Pause the Atlas cluster (do not delete) once everything is tested."
    ;;
  rollback)
    LAST=$(ls -1t "$ENV_FILE".before-local-db-* 2>/dev/null | head -1)
    [ -n "$LAST" ] || { echo "No settings backup found."; exit 1; }
    echo "WARNING: anything written since the move (signups, payments, messages, credits) is on the server only and will NOT be on Atlas."
    read -r -p "Type ROLLBACK to restore $LAST and restart: " ok
    [ "$ok" = ROLLBACK ] || { echo "Cancelled."; exit 1; }
    cp "$LAST" "$ENV_FILE"
    pm2 restart rankkw --update-env >/dev/null
    echo "==> Back on Atlas."
    ;;
  *) sed -n '2,17p' "$0"; exit 1 ;;
esac
