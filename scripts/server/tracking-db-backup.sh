#!/usr/bin/env bash
# Daily backup of the server's own tracking MongoDB (snapshot history can not be
# re-fetched from Etsy, so a lost disk would lose it for good). Keeps the newest
# KEEP copies (default 3) in BACKUP_DIR.
#
# Usage (on the server, from the app folder):  bash scripts/server/tracking-db-backup.sh
# Cron (aaPanel > Cron > Shell script, daily at 04:00):
#   cd /path/to/app && bash scripts/server/tracking-db-backup.sh >> /www/backup/rankkw-tracking/backup.log 2>&1
set -euo pipefail
cd "$(dirname "$0")/../.."
# aaPanel installs the MongoDB tools here, outside the normal PATH.
export PATH="$PATH:/www/server/mongodb/bin"

ENV_FILE=${ENV_FILE:-.env.local}
TRACK_URI=$(grep -E '^MONGODB_TRACKING_URI=' "$ENV_FILE" | tail -1 | cut -d= -f2- | sed -E 's/^["'\'']//; s/["'\'']$//')
[ -n "$TRACK_URI" ] || { echo "MONGODB_TRACKING_URI missing in $ENV_FILE"; exit 1; }

BACKUP_DIR=${BACKUP_DIR:-/www/backup/rankkw-tracking}
KEEP=${KEEP:-3}
mkdir -p "$BACKUP_DIR"

OUT="$BACKUP_DIR/tracking-$(date +%F).archive.gz"
echo "==> $(date '+%F %T') backing up to $OUT"
# keywordcaches/etsycaches are caches (they refill by themselves), so they are skipped.
# --excludeCollection needs --db, and --db can not be combined with a database in the URI.
DB=${DB:-rankkw_tracking}
HOST_URI=$(printf '%s' "$TRACK_URI" | sed -E 's#^(mongodb(\+srv)?://[^/]+)/[^?]*#\1/#')
mongodump --uri "$HOST_URI" --db "$DB" --archive="$OUT.part" --gzip --quiet \
  --excludeCollection keywordcaches --excludeCollection etsycaches
mv "$OUT.part" "$OUT"
echo "==> $(du -h "$OUT" | cut -f1) written"

# Remove all but the newest KEEP backups.
ls -1t "$BACKUP_DIR"/tracking-*.archive.gz 2>/dev/null | tail -n +"$((KEEP + 1))" | xargs -r rm -f
# Restore one:  mongorestore --uri "$MONGODB_TRACKING_URI" --archive=FILE --gzip
