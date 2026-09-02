# 02. 기술스택 결정

## 결정 기준

한 명의 개발자와 AI 코딩 에이전트가 읽고 테스트·수정하기 쉬운지, Windows 오프라인 안정성, 개인정보 경계, 의존성 수, 장기 유지보수성을 기준으로 판단한다.

## 후보 비교

### Desktop Runtime

Electron을 채택한다. Windows 배포, 인쇄/PDF, 파일 선택, SQLite 연계가 성숙하고 웹 UI 기술을 재사용할 수 있다. Tauri는 가볍지만 Rust 학습·네이티브 연계 복잡성이 증가하므로 Post-MVP 대안이다.

### 언어

JavaScript보다 TypeScript를 채택한다. 학생·좌석·제약조건처럼 관계가 많은 데이터와 엔진 입력/출력의 타입 오류를 줄이고, 문서와 코드의 계약을 명확히 할 수 있다.

### Frontend

React + TypeScript를 추천한다. 화면 수가 많고 후보 비교·편집·미리보기가 복합적이며 컴포넌트 테스트 생태계가 좋다. Vue도 적합하지만 팀의 React 경험과 채용·AI 생성 자료의 폭을 고려한다. Vanilla는 초기 의존성은 적으나 상태·화면 전환이 커질수록 유지보수 비용이 커진다.

### Styling

CSS Modules 또는 일반 CSS + CSS 변수 기반 디자인 토큰을 추천한다. MVP에서 무거운 UI 프레임워크는 피하고, 큰 버튼·명확한 상태·인쇄 스타일을 직접 통제한다. `@dnd-kit`은 편집 상호작용이 커질 때 후보로 검토하되 MVP에는 포인터 이벤트 기반의 작은 내부 drag 모듈도 가능하다.

### 상태 관리

초기에는 React Context를 전역 설정에, 화면별 `useReducer`를 편집 상태에 사용한다. 서버 캐시가 없으므로 Redux/Zustand를 처음부터 넣지 않는다. 여러 화면에서 draft를 공유해야 할 때 Zustand를 추가하는 설계 판단을 둔다. 영속화는 상태 라이브러리가 아니라 Application Service를 통해서만 한다.

### 데이터베이스

SQLite를 추천한다. 관계·외래키·트랜잭션·조회 통계·migration에 강하고, 단일 JSON보다 이력과 제약조건을 안전하게 연결한다. JSON/file 기반은 prototype에 빠르지만 부분 수정, 무결성, migration이 약하다. DB 파일은 Main Process에서 `app.getPath('userData')` 아래에 저장한다.

### 검증

IPC DTO와 서비스 입력은 Zod 스키마로 검증하는 방안을 추천한다. 도메인 불변조건(중복 좌석, 전출 학생 배치 등)은 별도 순수 validator가 담당한다. 검증 오류는 필드·행 단위로 반환한다.

### 테스트

- Vitest: 엔진·도메인 서비스·migration unit test
- React Testing Library: 주요 화면·후보 수정 흐름 component test
- Playwright 또는 Electron Forge의 E2E 전략: 최초 설정→확정→복원과 인쇄 미리보기
- 샘플 데이터 fixture와 고정 seed로 회귀 테스트

### Build / Packaging

`electron-builder`를 추천한다. Windows NSIS installer와 portable target, 버전·아이콘·설정이 익숙하다. Electron Forge도 관리형 선택지이나 현재 요구에는 builder의 산출물 제어가 유리하다. 실제 프로젝트 초기화·설치 명령은 MVP Phase 0에서 결정한다.

## 최종 추천 스택

Electron + TypeScript + React + CSS Modules/CSS variables + React Context/useReducer + SQLite(`better-sqlite3` 계열을 우선 검토) + Zod + Vitest + React Testing Library + Playwright(선택적 E2E) + electron-builder.

SQLite 네이티브 모듈의 Electron ABI 호환과 Windows 빌드 도구는 Prototype에서 검증한다. 문제가 크면 `sql.js`/파일 저장 대안을 재평가하되 보안 경계를 유지한다.

## 의존성 원칙

각 dependency는 사용자 가치 또는 안정성 근거를 문서화한다. 엔진은 React, Electron, DB에 의존하지 않는 순수 TypeScript로 유지한다. 날짜·거리·랜덤 등도 필요한 최소 유틸만 사용하고, 알고리즘 결과를 외부 서비스에 의존하지 않는다.
