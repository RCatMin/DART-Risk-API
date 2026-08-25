# CLAUDE.md

이 파일은 프로젝트 루트에 두고, Claude Code가 매 세션마다 컨텍스트로 자동 로드하는 앵커 문서입니다.
여기 적힌 스코프·순서·규칙은 명시적으로 변경 요청이 있을 때만 바뀝니다. 임의로 확장하지 마세요.

## 프로젝트 한 줄 요약
상장사 전자공시(DART)를 자동 수집·분석하여 리스크 조항을 탐지·요약하는 백엔드 API + 조회용 대시보드. 포트폴리오 목적.

## 기술 스택 (고정)
- Node.js + TypeScript
- Express (또는 Fastify)
- PostgreSQL + Prisma
- Redis + BullMQ
- Claude API (분류/요약, structured JSON output) — Phase 3에서는 API 크레딧 미확보로 룰 기반(키워드+부정문 감지) 엔진으로 대체 구현. 크레딧 확보 시 보강 예정, 코드는 그대로 유지
- Railway (배포)
- k6 (부하 테스트)
- pino (구조화 로깅)
- React + Vite (Phase 8 대시보드 — 백엔드 REST API를 소비하는 순수 클라이언트사이드 SPA)

새 패키지를 추가해야 할 경우, 설치 전에 왜 필요한지 먼저 설명할 것.

## 스코프 (고정 — 반드시 지킬 것)
- 대상 종목: 전 상장사 아님. 워치리스트(50~100개 종목)만.
- 대상 문서: 사업보고서, 감사보고서, 주요사항보고서 3종. 주요사항보고서는 소송 제기·유상증자·관리절차 개시 등 리스크가 실제 발생하는 시점에 장중 수시로 올라오는 문서라, 사업보고서/감사보고서(연 1회, 사후 요약)만으로는 놓치는 실시간성을 보완하기 위해 추가. 다른 보고서 타입은 v1 범위 아님.
- 리스크 유형: 감사의견 비적정 / 횡령·배임 / 소송 / 관리종목 지정 / 해당없음 — 이 5개로 고정.
- 응답에는 항상 "투자 자문이 아니라 참고용 정보"라는 disclaimer 포함.

## 하지 않을 것
- 전 상장사 대상 실시간 감시
- 실시간 웹소켓 알림 (v1은 REST 조회 + 선택적 Slack 알림만)
- XBRL 재무제표 정밀 분석 (숫자 분석은 별도 프로젝트 영역)
- 투자 판단/매수매도 추천으로 읽힐 수 있는 문구

## 데이터 모델 (초안 — Prisma 스키마 작성 시 기준)
```
Company     { corp_code, corp_name, stock_code, is_watched }
Disclosure  { rcept_no(unique), corp_code(FK), report_nm, rcept_dt, raw_text,
              status: pending | processing | done | failed }
RiskFlag    { disclosure_id(FK), risk_type, severity, summary, confidence, source_snippet }
JobLog      { job_id, job_type, status, duration_ms, error_message }
```

## 개발 순서 (Phase) — 한 번에 한 Phase만 진행

| Phase | 내용 | 완료 기준 (DoD) |
|---|---|---|
| 0 | 프로젝트 셋업 (package.json, tsconfig, prisma init, .env.example) | `npm run build` 통과, DART API 테스트 호출 성공 |
| 1 | Prisma 스키마(Company/Disclosure), 공시목록 API 연동, 중복 방지 | 신규 공시만 DB에 쌓이고 재실행해도 중복 안 생김 |
| 2 | 공시원문 zip 다운로드·해제·텍스트 추출 | 사업보고서/감사보고서 각 1건 이상 텍스트 추출 성공 |
| 3 | 키워드 1차 필터 + 룰 기반 리스크 분류(부정문 감지로 오탐 제거) — Claude API는 크레딧 확보 후 보강 | RiskFlag 저장, 수동 샘플 10건 검증 |
| 4 | BullMQ 전환 (수집/파싱/분류 job 분리), 재시도·백오프 | 강제로 실패시켜도 정책대로 재시도 후 dead-letter 처리됨 |
| 5 | 조회 REST API, API Key 인증, Redis 캐시 | 캐시 적용 전/후 응답시간 차이 확인 가능 |
| 6 | 구조화 로깅, job 실행 로그 | 실패 job의 원인을 로그만 보고 파악 가능 |
| 7 | k6 부하 테스트 + OpenAPI 스펙 + 설계 문서 | p95/처리량/에러율 리포트 산출 |
| 8 | React+Vite 대시보드 (워치리스트/공시/리스크플래그 조회 화면) — Phase 7의 OpenAPI 스펙을 API 계약으로 사용 | 브라우저에서 워치리스트 종목별 리스크 현황을 조회할 수 있음 |

## 작업 규칙
1. 매 Phase는 별도 요청으로 진행하고, 요청받지 않은 이전 Phase의 코드는 임의로 수정하지 않는다.
2. Phase 완료 시 위 표의 DoD를 기준으로 스스로 점검 결과를 보고한다.
3. Phase 종료 후에는 에러 처리·재시도·보안 관점에서 self-review를 한 번 더 수행한다.
4. 커밋은 Phase 단위로 하고, 커밋 메시지에 Phase 번호를 명시한다 (예: `feat(phase-1): 공시목록 수집 파이프라인`).
5. API 키/시크릿은 `.env`에서만 관리하고 코드에 하드코딩하지 않는다. `.env.example`은 항상 최신 상태로 유지한다.
