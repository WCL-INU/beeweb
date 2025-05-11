# Docker Hub에서 공식 MariaDB 이미지를 사용
FROM mariadb:11.4

# MariaDB 환경 변수 설정
# docker-compose.yml 파일에서 설정함
# ENV MYSQL_ROOT_PASSWORD=rootpassword
# ENV MYSQL_DATABASE=hive_data
# ENV MYSQL_USER=user
# ENV MYSQL_PASSWORD=password

# 초기화 스크립트를 Docker entrypoint 디렉토리에 복사
COPY init.sql /docker-entrypoint-initdb.d/

# 커스텀 MariaDB 구성 파일 복사
COPY custom-mariadb.cnf /etc/mysql/conf.d/

# 추가: MySQL 클라이언트 도구 설치
RUN apt-get update && apt-get install -y mariadb-client

# 기본 MariaDB 포트 노출
# docker-compose.yml 파일에서 설정함
# EXPOSE 3306
