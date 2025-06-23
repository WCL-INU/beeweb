#!/bin/bash
set -x

# 경로 설정
SCRIPT_DIR=$(dirname "$(realpath "$0")")

# .env 로드
set -a
source "$SCRIPT_DIR/../../.env"
set +a

# 사용자 정의 변수
DB_USER="$MYSQL_ROOT_USER"     # 루트 계정은 .env에 없으므로 직접 'root'로 설정
DB_PASSWORD="$MYSQL_ROOT_PASSWORD"
DB_NAME="$MYSQL_DATABASE"
CONTAINER_NAME="beeweb-mariadb-1"

DOCKER_PATH=/snap/bin/docker
BACKUP_DATE=$(date +"%Y%m%d")
CONTAINER_BACKUP_DIR="/backup"
BACKUP_FILE="$CONTAINER_BACKUP_DIR/${DB_NAME}_backup_${BACKUP_DATE}.sql"
HOST_BACKUP_DIR="$SCRIPT_DIR/../data"
HOST_BACKUP_FILE="$HOST_BACKUP_DIR/${DB_NAME}_backup_${BACKUP_DATE}.sql"
ERROR_LOG="$HOST_BACKUP_DIR/mysqldump_error.log"

mkdir -p "$HOST_BACKUP_DIR"

CONTAINER_ID=$($DOCKER_PATH ps -q -f "name=$CONTAINER_NAME")
if [ -z "$CONTAINER_ID" ]; then
  echo "Error: container '$CONTAINER_NAME' not found"
  exit 1
fi

$DOCKER_PATH exec "$CONTAINER_ID" mkdir -p "$CONTAINER_BACKUP_DIR"
$DOCKER_PATH exec "$CONTAINER_ID" sh -c "mysqldump -u root -p'$DB_PASSWORD' $DB_NAME > $BACKUP_FILE" 2> "$ERROR_LOG"
if [ $? -eq 0 ]; then
  $DOCKER_PATH cp "$CONTAINER_ID:$BACKUP_FILE" "$HOST_BACKUP_FILE"
  if [ $? -eq 0 ]; then
    echo "✅ Backup successful: $HOST_BACKUP_FILE"
  else
    echo "❌ Backup file copy failed"
  fi
else
  echo "❌ Backup failed"
  echo "See log: $ERROR_LOG"
fi

set +x
