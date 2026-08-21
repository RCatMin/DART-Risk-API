# TROUBLESHOOTING

프로젝트 진행 중 겪은 환경/도구 이슈와 원인, 해결책을 기록합니다.

---

## `npx prisma dev`가 EALLOWSCRIPTS 에러로 실패함

- **발생 시점**: Phase 1, 로컬 개발용 PostgreSQL을 준비하려고 `npx prisma dev --detach` 실행 시
- **증상**

  ```
  npm error code EALLOWSCRIPTS
  npm error --allow-scripts is not allowed in project-scoped installs.
  Add the entries to the "allowScripts" field in package.json, or to .npmrc, instead.

  ERROR  Failed to install dynamic subcommand via npm.
  ```

- **원인**

  `prisma dev`는 로컬 Postgres 바이너리를 받아오는 `@prisma/cli-dev` 패키지를 임시 폴더에
  즉석으로 설치한다 (`npm install @prisma/cli-dev@latest --prefix <임시폴더> --userconfig <임시폴더>`).
  이 설치 스크립트 실행 권한을 Prisma CLI는 예전 방식(전역/불리언 `--allow-scripts` 허용)으로
  요청하는데, 현재 npm(12.0.2)은 보안 정책 강화로 프로젝트 스코프 설치에서 이 방식을 더 이상
  허용하지 않는다. 반드시 **해당 프로젝트 자신의** `package.json`의 `allowScripts` 필드나
  `.npmrc`에 개별 패키지명으로 등록돼 있어야 한다.

  이 임시 프로젝트는 실행할 때마다 Prisma가 새로 만드는 폴더이고, 자체 `--userconfig`로
  격리되어 있어서 우리 프로젝트나 사용자 전역 npm 설정(`npm config set allow-scripts=... --location=user`)이
  적용되지 않는다. 즉 **Prisma CLI(`prisma dev`)가 아직 npm 12의 새 스크립트 허용 정책을
  지원하지 않아 생기는 버전 비호환 문제**이며, 우리 쪽 설정으로는 우회할 수 없는 구조적 이슈다.

- **검토한 해결책**

  | 옵션 | 왜 해결되는가 | 트레이드오프 |
  |---|---|---|
  | Prisma Postgres 클라우드로 전환 (`npx create-db` / `prisma init --db`) | 로컬 DB 바이너리를 설치하는 단계 자체가 없어서 이 npm 이슈가 발생하지 않음 | 인터넷 연결·Prisma 계정 필요, 데이터가 외부 서비스에 위치 |
  | npm을 이 작업만 구버전으로 실행 (corepack 등) | 문제의 원인인 새 npm 보안 정책 자체가 없는 버전이라 통과됨 | 근본 해결 아님, 전역 npm 버전 변경 시 다른 프로젝트 영향 가능 |
  | Homebrew로 로컬 PostgreSQL 직접 설치 (`brew install postgresql@16`) | npm/Prisma CLI를 거치지 않는 별개 설치 경로라 이슈와 무관 | 서비스 직접 기동/종료 관리 필요 |
  | Docker로 Postgres 컨테이너 실행 | 마찬가지로 npm 스크립트 경로를 안 거침 | 이 머신에 Docker 미설치 상태, 별도 설치 필요 |

- **상태**: 해결 — Homebrew로 로컬 PostgreSQL 직접 설치하는 방식으로 결정

  ```bash
  brew install postgresql@16
  brew services start postgresql@16
  createdb dart_risk_api
  ```

  이후 `.env`의 `DATABASE_URL`을 `postgresql://<macOS 사용자명>@localhost:5432/dart_risk_api?schema=public`로 교체.
  `npx prisma db execute --stdin`으로 실제 연결까지 확인함.

---

## 커스텀 output 경로로 생성한 Prisma Client가 `@prisma/client`를 못 찾음

- **발생 시점**: Phase 1, `seed-watchlist` 스크립트 첫 실행 시
- **증상**

  ```
  Error [ERR_MODULE_NOT_FOUND]: Cannot find package '@prisma/client' imported from
  .../dist/generated/prisma/client.js
  ```

- **원인**

  `schema.prisma`의 `generator client`에서 `output`을 `../src/generated/prisma`로 지정해서
  프로젝트 소스 안에 클라이언트 코드를 직접 생성했는데, 이 생성된 코드가 내부적으로
  `@prisma/client/runtime/client`의 공용 런타임 코드를 import한다. 즉 output 경로를
  커스터마이징해도 `@prisma/client` 패키지 자체는 별도로 설치돼 있어야 한다 (직접
  `import { PrismaClient } from "@prisma/client"`로 쓰지 않더라도 필요함).

- **해결**: `npm install @prisma/client` 추가 설치.

---

## data.go.kr 서비스키를 URLSearchParams에 그대로 넣으면 이중 인코딩됨

- **발생 시점**: Phase 1, 시가총액 랭킹 조회(`getStockPriceInfo`) 연동 중
- **원인**

  data.go.kr에서 발급하는 서비스키는 발급 시점에 이미 URL 인코딩된 형태로 제공된다
  (`%2B`, `%3D%3D` 등 포함). 이 값을 그대로 `URLSearchParams.set()`에 넘기면
  `%`, `+` 등이 다시 한번 퍼센트 인코딩되어(`%2B` → `%252B`) 서버가 키를 인식하지 못하고
  인증 오류가 난다.

- **해결**: `URLSearchParams.set()`에 넣기 전에 `decodeURIComponent(serviceKey)`로 한 번
  디코딩해서 원본 값을 복원한 뒤 넘긴다 (`src/marketcap/dataGoKr.ts`). 이렇게 하면
  사용자가 인코딩된 키/원본 키 중 어느 쪽을 `.env`에 넣어도 안전하게 동작한다.
