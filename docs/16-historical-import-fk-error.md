# 1학기 과거 자리 기록 저장 오류 기록

작성일: 2026-09-01

## 사용자 재현 오류

- PowerShell에서 `npm.cmd run dev`로 실행한 뒤 자리 기록 화면에서 1학기 과거 기록 저장을 시도했다.
- IPC handler: `history:import-historical`
- 오류: `SqliteError: FOREIGN KEY constraint failed`
- 발생 위치: 빌드된 `out/main/index.js`의 `SqliteSeatingRepository.saveConfirmedBatch` 내부 저장 구간
- 동일 요청에서 같은 오류가 2회 출력되었다.

## 현재 판단

- `saveConfirmedBatch`는 먼저 `seating_session`을 저장하고 이어서 각 `seating_assignment`를 저장한다.
- 현재 입력 검증은 학생 이름과 자리번호의 매칭·중복 여부를 확인하지만, 저장 직전의 `student_id`, `seat_id`, `school_year_id`, `classroom_layout_id`가 실제 외래키 대상 테이블에 존재하는지까지 확인하는 단계는 별도로 기록되어 있지 않다.
- 따라서 정확한 FK 위반 대상은 학생 ID, 자리 ID, 학년도 ID, 교실 layout ID 중 하나일 수 있다. 오류 로그만으로 단정하지 않는다.
- transaction 내부 오류이므로 해당 batch 전체가 rollback되었을 가능성이 높다. 재시도 전에 실제 저장 여부를 확인해야 한다.

## 수정 전 확인 계획

1. 오류가 발생한 앱이 최신 빌드(`out/main`)를 사용하고 있는지 확인한다.
2. 저장 직전 batch의 `schoolYearId`, `classroomLayoutId`, 각 `studentId`, 각 `seatId`를 조회 대상과 대조한다.
3. 현재 layout에서 과거 자리번호가 `classroom_element.element_id`로 변환되는 방식과 `seat_id`의 실제 스키마를 확인한다.
4. 학생·자리·학년도·layout 중 어느 외래키가 누락되었는지 최소 재현 데이터로 분리한다.
5. 원인이 확인된 뒤에만 검증 로직 또는 ID 매칭 로직을 수정하고, transaction rollback 및 재저장 테스트를 추가한다.

## 처리 상태

- 원인 확인 결과: `classroom_element`의 책상 ID를 `seating_assignment.seat_id`로 사용했지만, 외래키 대상인 `seat` 테이블에 대응 레코드가 생성되지 않았다.
- 기존 데이터베이스 대응: `005-seat-sync.sql` migration에서 기존 책상 요소를 `seat` 레코드로 보완한다.
- 신규·변경 교실 대응: `SqliteClassroomRepository.save`에서 책상 요소 저장 시 `seat` 레코드를 함께 upsert한다.
- 검증 결과: 타입 검사 통과, 전체 테스트 24개 통과·1개 스킵, 프로덕션 빌드 통과.
- 아직 실제 사용자 데이터 재저장은 수행하지 않았다. 앱 재시작 후 migration 적용을 확인한 다음 과거 기록 저장을 재시도해야 한다.
