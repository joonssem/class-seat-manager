# 시선 기반 근접도 및 테스트 보강

## 문제
- 인접 판정이 책상 중심 간 유클리드 거리(`nearDistance` 0.18)였다. 기본 배치에서 옆자리 중심 거리는 약 0.20, 앞뒤는 약 0.14라 옆자리가 "인접하지 않음"으로 판정되어 같은 성별이 좌우에 배치됐다.

## 변경 (`src/domain/seat-proximity.ts`)
- 위험도(0~1) = 거리 감쇠 × 회전 용이성.
  - 거리 감쇠: 책상 가장자리 간 간격 기준(`adjacentGap` 0.10 이하 1, `reachGap` 0.25 이상 0).
  - 회전 용이성: 각 학생의 기본 시선(칠판 중앙 `focusX/Y` 방향)에서 이웃까지 돌려야 하는 각도. `comfortableTurnDeg`(90°) 이하면 1, 180°에서 0. 쉬운 쪽 40% + 어려운 쪽 60%로 섞는다.
  - 결과: 옆자리 ≈ 1.0, 앞뒤 대각선 ≈ 0.8, 바로 앞뒤 ≈ 0.4, 한 칸 건너뛰면 0. 측면·앞줄 학생의 몸 방향이 자동 반영된다.
- 엔진: `genderAdjacency`(가중치 15→40, 위험도 비례 연속 감점), `repeatProximity`, `가능한 한 멀리`는 위험도 사용. `바로 인접 금지`는 8방향 이웃(거리 감쇠 1)이면 위반. 필수 제약이 아니라 강한 감점이다(성비·좌석 제약 때문).
- 한계: 교실 캔버스를 정사각 좌표로 보며, 실제 자세·의자 방향은 모델링하지 않는다. 값은 `settings.proximity`로 조정.
- UI: 짝 조건 상세에 관계(옆자리/대각선/앞뒤) 표시.

## 테스트
- `tests/unit/seat-proximity.test.ts`, `tests/renderer/*.test.tsx`(jsdom + Testing Library: 자리표 돌아가기, 교사용 반전, 새 자리 화면).
- SQLite 통합 테스트: better-sqlite3가 Electron ABI로 빌드되어 시스템 Node에서 스킵되었다. `npm run test:integration`은 Electron을 Node 모드로 실행(`ELECTRON_RUN_AS_NODE`)해 재빌드 없이 실행하며, 바인딩이 없으면 스킵 대신 실패한다. 전체: `npm run test:all`.
