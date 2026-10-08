#!/usr/bin/env bash
# Copy the tracking history (last 90 days of snapshots, tracked listings, keyword
# suggestions, keyword cache) from Atlas into the server's own MongoDB.
#
# Run it AFTER deploying with MONGODB_TRACKING_URI set: new data already goes to the
# server's MongoDB, and this fills in the older days. Rows that already exist there
# (written after the switch) are kept; the old copy is skipped as a duplicate, so
# "duplicate key" lines in the output are expected and harmless.
#
# Reads from an Atlas SECONDARY so the live primary is not slowed. Nothing on Atlas
# is changed or deleted. Safe to run again (it only adds what is missing).
#
# Usage (on the server, from the app folder):  bash scripts/server/tracking-db-copy-history.sh
set -euo pipefail
cd "$(dirname "$0")/../.."
# aaPanel installs the MongoDB tools here, outside the normal PATH.
export PATH="$PATH:/www/server/mongodb/bin"

ENV_FILE=${ENV_FILE:-.env.local}
val() { grep -E "^$1=" "$ENV_FILE" | tail -1 | cut -d= -f2- | sed -E 's/^["'\'']//; s/["'\'']$//'; }
ATLAS_URI=$(val MONGODB_URI)
TRACK_URI=$(val MONGODB_TRACKING_URI)
[ -n "$ATLAS_URI" ] || { echo "MONGODB_URI missing in $ENV_FILE"; exit 1; }
[ -n "$TRACK_URI" ] || { echo "MONGODB_TRACKING_URI missing in $ENV_FILE"; exit 1; }
command -v mongodump >/dev/null && command -v mongorestore >/dev/null \
  || { echo "mongodump/mongorestore not found: install mongodb-database-tools first"; exit 1; }

SRC_DB=${SRC_DB:-test}               # the app's database on Atlas
DST_DB=${DST_DB:-rankkw_tracking}
# mongodump refuses --db together with a database inside the URI, so drop it from the URI.
ATLAS_HOST_URI=$(printf '%s' "$ATLAS_URI" | sed -E 's#^(mongodb(\+srv)?://[^/]+)/[^?]*#\1/#')

# Smallest first, so a problem shows up early.
COLLECTIONS=${COLLECTIONS:-"keywordsuggestions keywordmarketsnapshots shopsnapshots trackedlistings keywordcaches searchranksnapshots listingsnapshots"}

for c in $COLLECTIONS; do
  echo "==> $(date '+%H:%M:%S') copying $c"
  mongodump --uri "$ATLAS_HOST_URI" --readPreference secondary --db "$SRC_DB" --collection "$c" --archive --gzip --quiet \
    | mongorestore --uri "$TRACK_URI" --archive --gzip \
        --nsFrom "$SRC_DB.$c" --nsTo "$DST_DB.$c" \
        --noIndexRestore --numInsertionWorkersPerCollection 4 2>&1 \
    | grep -v "E11000 duplicate key" | tail -3
done
echo "==> done $(date '+%H:%M:%S')"
