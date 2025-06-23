#!/bin/bash
set -x

SCRIPT_DIR=$(dirname "$(realpath "$0")")

# .env 로드
set -a
source "$SCRIPT_DIR/../../.env"
set +a

DB_USER="root"  # 복원은 루트 계정 사용
DB_PASSWORD="$MYSQL_ROOT_PASSWORD"
DB_NAME="$MYSQL_DATABASE"
CONTAINER_NAME="beeweb-mariadb"
DOCKER_PATH=/snap/bin/docker

BACKUP_FILE=$1
if [ -z "$BACKUP_FILE" ]; then
  echo "Usage: $0 <backup_file_path>"
  exit 1
fi

CONTAINER_ID=$($DOCKER_PATH ps -q -f "name=$CONTAINER_NAME")
if [ -z "$CONTAINER_ID" ]; then
  echo "Error: container '$CONTAINER_NAME' not found"
  exit 1
fi

CONTAINER_BACKUP_FILE="/backup/restore_backup.sql"
$DOCKER_PATH exec "$CONTAINER_ID" mkdir -p /backup
$DOCKER_PATH cp "$BACKUP_FILE" "$CONTAINER_ID:$CONTAINER_BACKUP_FILE"

$DOCKER_PATH exec "$CONTAINER_ID" sh -c "mariadb -u $DB_USER -p'$DB_PASSWORD' -e 'DROP DATABASE IF EXISTS $DB_NAME; CREATE DATABASE $DB_NAME;'"
$DOCKER_PATH exec "$CONTAINER_ID" sh -c "mariadb -u $DB_USER -p'$DB_PASSWORD' $DB_NAME < $CONTAINER_BACKUP_FILE"
if [ $? -eq 0 ]; then
  echo "✅ Database restored successfully from $BACKUP_FILE"
else
  echo "❌ Database restoration failed"
fi

$DOCKER_PATH exec "$CONTAINER_ID" rm -f "$CONTAINER_BACKUP_FILE"

set +x
