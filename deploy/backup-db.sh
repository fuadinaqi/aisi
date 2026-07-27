#!/usr/bin/env bash
# Backup Postgres harian — pasang via cron:
# 0 2 * * * /opt/aisi/deploy/backup-db.sh >> /var/log/aisi-backup.log 2>&1

set -euo pipefail

BACKUP_DIR="/var/backups/aisi"
RETENTION_DAYS=7
TIMESTAMP="$(date +%Y%m%d_%H%M%S)"
ENV_FILE="/opt/aisi/deploy/env/db.env"

mkdir -p "$BACKUP_DIR"

if [[ ! -f "$ENV_FILE" ]]; then
  echo "ERROR: $ENV_FILE tidak ditemukan"
  exit 1
fi

# shellcheck disable=SC1090
source "$ENV_FILE"

CONTAINER="$(docker ps --filter 'ancestor=postgres:16-alpine' --format '{{.Names}}' | head -1)"
if [[ -z "$CONTAINER" ]]; then
  echo "ERROR: container Postgres tidak ditemukan"
  exit 1
fi

BACKUP_FILE="$BACKUP_DIR/aisi_db_${TIMESTAMP}.sql.gz"
docker exec "$CONTAINER" pg_dump -U "$POSTGRES_USER" "$POSTGRES_DB" | gzip > "$BACKUP_FILE"

echo "Backup: $BACKUP_FILE ($(du -h "$BACKUP_FILE" | cut -f1))"

find "$BACKUP_DIR" -name 'aisi_db_*.sql.gz' -mtime +"$RETENTION_DAYS" -delete
echo "Retensi $RETENTION_DAYS hari diterapkan"
