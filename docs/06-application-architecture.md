# 06. 애플리케이션 아키텍처

## 전체 구조

```text
Renderer(React UI)
        ↓ typed API
Preload(Safe API bridge)
        ↓ IPC
Main(Electron lifecycle)
        ↓
Application Services ── Seat Allocation Engine(순수 TS)
        ↓              ↙
SQLite Repository   File/Print Services
```

## Renderer Process

화면 렌더링, 폼 입력, drag & drop draft, 후보 비교, 미리보기와 접근성만 담당한다. DB SQL, 파일 경로, Node API, Electron 객체를 알지 못한다. API 호출 결과의 도메인 오류를 상태로 표시한다.

## Preload / IPC

`contextIsolation: true`, `nodeIntegration: false`를 기본으로 한다. preload는 `window.app` 아래 필요한 좁은 함수만 노출한다(예: `students.list`, `seating.generate`, `backup.export`). IPC 채널은 요청/응답 DTO와 Zod 검증을 갖고, 임의 채널명·경로·SQL을 Renderer에서 받지 않는다. 파일 선택은 Main의 native dialog를 사용한다.

## Main Process

창 lifecycle, SQLite 연결, transaction, 백업 파일, 인쇄/PDF, 앱 경로와 migration을 담당한다. Application Service를 호출해 업무 규칙을 실행하며 Renderer 상태를 직접 조작하지 않는다.

## Application Services

`SchoolYearService`, `StudentService`, `ClassroomService`, `SeatingService`, `CafeteriaService`, `BackupService`, `PrintService`로 나눈다. 서비스는 repository와 순수 도메인 함수를 조합한다. 확정은 `SeatingService.confirm` 한 곳에서만 수행하고, 초안은 메모리 또는 draft 저장 정책을 명시한다.

## Seat Allocation Engine

`generateCandidates(input, settings): AllocationCandidate[]`, `evaluateAllocation(input, assignment): Evaluation`, `validateHardConstraints(...)`를 Electron 없이 실행한다. 랜덤은 seed 주입 방식으로 재현 가능하게 한다. 엔진은 DB 모델이 아니라 명시적 domain DTO를 사용한다.

## 데이터·파일 경계

Repository만 SQL을 실행하며 외래키와 transaction을 활성화한다. 사용자 데이터는 `app.getPath('userData')/data/app.sqlite`, 백업은 사용자가 선택한 경로, 임시 PDF는 OS temp 경로를 사용한다. 프로그램 설치 폴더에 DB를 두지 않는다.

## 권장 폴더 구조

```text
src/
  main/
    main.ts
    ipc/
    db/{migrations,repositories}/
    services/
    system/{backup,print,paths}/
  preload/
    index.ts
    api.ts
  renderer/
    app/
    screens/
    components/
    state/
    styles/
  domain/
    models/
    validators/
    seating-engine/
    statistics/
  shared/
    contracts/
    errors/
tests/
  fixtures/
  unit/
  component/
  e2e/
```

## 흐름 예시

“새 자리 생성”은 Renderer가 설정 DTO를 preload API에 보내고, IPC가 검증한 뒤 `SeatingService.generateCandidates`가 repository에서 confirmed 이력을 읽어 engine에 전달한다. 결과 DTO만 Renderer에 반환한다. “확정”은 Renderer draft를 다시 검증하고 service가 assignment·session을 transaction으로 저장한 뒤 현재 자리와 통계를 갱신한다.

## 보안·오류 처리

학생 개인정보는 production 로그에 남기지 않는다. IPC 오류는 사용자 오류, 충돌, 저장 실패, 시스템 오류로 분류한다. Renderer에는 내부 stack trace 대신 correlation id와 해결 행동을 보여주며, 개발 모드에서만 상세 로그를 활성화한다.
