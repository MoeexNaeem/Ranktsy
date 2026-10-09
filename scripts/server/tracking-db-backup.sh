#!/usr/bin/env bash
# Backups of the server's own MongoDB (the database in MONGODB_TRACKING_URI, which
# after the move also holds the main data: users, payments, messages, settings).
#
#   bash scripts/server/tracking-db-backup.sh          FULL: everything except the two
#                                                      caches. Keeps 3. Run daily.
#   MAIN_ONLY=1 bash scripts/server/tracking-db-backup.sh
#                                                      MAIN: users, payments, messages,
#                                                      settings... (no tracking history).
#                                                      Small and quick. Keeps 24. Run hourly.
#
# Cron (aaPanel > Cron > Shell script):
#   daily 04:00:  cd /www/wwwroot/rankkw && bash scripts/server/tracking-db-backup.sh >> /www/backup/rankkw-tracking/backup.log 2>&1
#   hourly:       cd /www/wwwroot/rankkw && MAIN_ONLY=1 bash scripts/server/tracking-db-backup.sh >> /www/backup/rankkw-tracking/backup.log 2>&1
# Restore one:    mongorestore --uri "$MONGODB_TRACKING_URI" --archive=FILE --gzip --drop
set -euo pipefail
cd "$(dirname "$0")/../.."
# aaPanel installs the MongoDB tools here, outside the normal PATH.
export PATH="$PATH:/www/server/mongodb/bin"

ENV_FILE=${ENV_FILE:-.env.local}
TRACK_URI=$(grep -E '^MONGODB_TRACKING_URI=' "$ENV_FILE" | tail -1 | cut -d= -f2- | sed -E 's/^["'\'']//; s/["'\'']$//')
[ -n "$TRACK_URI" ] || { echo "MONGODB_TRACKING_URI missing in $ENV_FILE"; exit 1; }

BACKUP_DIR=${BACKUP_DIR:-/www/backup/rankkw-tracking}
mkdir -p "$BACKUP_DIR"

# keywordcaches/etsycaches are caches (they refill by themselves), so they are never backed up.
EXCLUDE=(keywordcaches etsycaches)
if [ "${MAIN_ONLY:-0}" = 1 ]; then
  PREFIX=main; KEEP=${KEEP:-24}; STAMP=$(date +%F-%H%M)
  EXCLUDE+=(listingsnapshots trackedlistings searchranksnapshots shopsnapshots keywordmarketsnapshots keywordsuggestions)
else
  PREFIX=tracking; KEEP=${KEEP:-3}; STAMP=$(date +%F)
fi
ARGS=()
for c in "${EXCLUDE[@]}"; do ARGS+=(--excludeCollection "$c"); done

OUT="$BACKUP_DIR/$PREFIX-$STAMP.archive.gz"
echo "==> $(date '+%F %T') backing up to $OUT"
# --excludeCollection needs --db, and --db can not be combined with a database in the URI.
DB=${DB:-$(printf '%s' "$TRACK_URI" | sed -E 's#^mongodb(\+srv)?://[^/]+/([^?]*).*#\2#')}
HOST_URI=$(printf '%s' "$TRACK_URI" | sed -E 's#^(mongodb(\+srv)?://[^/]+)/[^?]*#\1/#')
mongodump --uri "$HOST_URI" --db "$DB" --archive="$OUT.part" --gzip --quiet "${ARGS[@]}"
mv "$OUT.part" "$OUT"
echo "==> $(du -h "$OUT" | cut -f1) written"

# Remove all but the newest KEEP backups of this kind.
ls -1t "$BACKUP_DIR/$PREFIX"-*.archive.gz 2>/dev/null | tail -n +"$((KEEP + 1))" | xargs -r rm -f
