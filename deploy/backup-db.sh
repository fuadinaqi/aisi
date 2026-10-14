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

dump_database() {
  local dbname="$1"
  local exists
  exists="$(docker exec "$CONTAINER" psql -U "$POSTGRES_USER" -d postgres -tAc "SELECT 1 FROM pg_database WHERE datname='${dbname}'" | tr -d '[:space:]')"
  if [[ "$exists" != "1" ]]; then
    echo "WARN: database ${dbname} tidak ada, backup dilewati"
    return 0
  fi
  local backup_file="$BACKUP_DIR/${dbname}_${TIMESTAMP}.sql.gz"
  docker exec "$CONTAINER" pg_dump -U "$POSTGRES_USER" "$dbname" | gzip > "$backup_file"
  echo "Backup: $backup_file ($(du -h "$backup_file" | cut -f1))"
}

dump_database "$POSTGRES_DB"
dump_database "pgm_db"

find "$BACKUP_DIR" -name '*_db_*.sql.gz' -mtime +"$RETENTION_DAYS" -delete
echo "Retensi $RETENTION_DAYS hari diterapkan"
