# ------------------------------
# 📦 Dockerfile for TypeScript API
# ------------------------------
FROM node:18

# 앱 디렉터리 생성
WORKDIR /usr/src/app

# package.json 복사 및 의존성 설치
COPY package*.json tsconfig.json ./
RUN npm install

# 소스 코드 복사
COPY . .

# TypeScript 빌드
RUN npm run build

# 실행 스크립트 권한 설정
RUN chmod +x wait-for-it.sh

# 앱 실행 (컴파일된 JavaScript 실행)
CMD ["./wait-for-it.sh", "mariadb:3306", "--", "node", "dist/server.js"]
