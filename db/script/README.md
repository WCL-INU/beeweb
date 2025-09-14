# 📦 Database Backup & Restore Scripts

이 디렉토리는 MariaDB 데이터베이스의 **백업** 및 **복원**을 위한 스크립트를 포함하고 있습니다.

## 🗂 구성

- `backup.sh` – 현재 데이터베이스를 백업하여 `../data` 디렉토리에 저장합니다.
- `restore.sh` – 특정 백업 파일을 이용해 데이터베이스를 복원합니다.
- `.env` – 프로젝트 루트(`projectroot/.env`)에 위치하며, DB 접속 정보 등을 담고 있습니다.

## 🔧 사전 준비

1. **`.env` 파일 설정**

   `projectroot/.env`에 다음 항목이 포함되어 있어야 합니다:

   ```env
   MYSQL_ROOT_PASSWORD=rootpassword
   MYSQL_DATABASE=hive_data
   MYSQL_USER=user
   MYSQL_PASSWORD=password

2. **Docker 설치 및 MariaDB 컨테이너 실행**

   * 컨테이너 이름은 기본적으로 `beeweb-mariadb`로 설정되어 있어야 합니다.
   * Docker가 `/snap/bin/docker`에 설치되어 있다고 가정합니다.

     * 다른 경로일 경우, 스크립트 상단의 `DOCKER_PATH`를 수정하세요.



## 🧪 백업 사용법

```bash
cd projectroot/db/script
./backup.sh
```

* 실행 시 `../data/hive_data_backup_YYYYMMDD.sql` 형식으로 파일이 생성됩니다.
* 백업 실패 시 `mysqldump_error.log`에 오류가 기록됩니다.

---

## ♻️ 복원 사용법

```bash
cd projectroot/db/script
./restore.sh ../data/hive_data_backup_YYYYMMDD.sql
```

* 기존 데이터베이스가 삭제된 후, 백업 파일을 통해 복원됩니다.
* 복원 완료 후 백업 파일은 컨테이너에서 자동 삭제됩니다.

---

## 📌 참고 사항

* 백업 및 복원은 **root 사용자** 권한으로 실행됩니다.
* 복원 시 기존 데이터베이스는 **완전히 초기화**되므로 주의하십시오.
* 백업 파일은 `projectroot/db/data` 경로에 보관됩니다.
