# 03. 데이터 모델

## 공통 원칙

모든 테이블의 PK는 내부 UUID 또는 안정적인 문자열 ID를 사용한다. 출석번호는 표시·정렬용이며 PK가 아니다. 날짜는 ISO 8601 문자열 또는 SQLite UTC timestamp로 저장하고, 화면 표시 시 로컬 날짜로 변환한다. 확정 기록은 생성 후 보존하며 수정은 감사 가능성이 필요한 필드에 제한한다.

## Entity 및 관계

### SchoolYear

목적: 학년도 경계와 활성 학년도를 관리한다. 필드 `schoolYearId`(PK, string), `label`(필수, 예 `2026학년도`), `startsOn`, `endsOn`(필수 date), `status`(active/archived), `createdAt`, `updatedAt`. 한 SchoolYear는 Student, ClassroomLayout, SeatingSession, 학기 설정과 연결된다. 학년도 삭제는 MVP에서 비활성화하고 Post-MVP의 명시적 내보내기 후 삭제로 둔다.

### Student

필드 `studentId`(PK), `schoolYearId`(FK), `studentNumber`(필수 integer), `name`(필수 text), `gender`(남/여), `enrollmentStatus`(재학/전출), `transferInDate`, `transferOutDate`, `createdAt`, `updatedAt`. 학년도별 학생 snapshot을 유지해 다음 학년도 명단과 과거 명단이 섞이지 않게 한다. 전출은 soft state 변경이며 삭제 금지.

### ClassroomLayout / ClassroomElement / Seat

`ClassroomLayout(classroomLayoutId PK, schoolYearId FK, name, canvasWidth, canvasHeight, coordinateVersion, createdAt, updatedAt)`는 한 학년도의 교실 버전이다. `ClassroomElement(elementId PK, classroomLayoutId FK, elementType: chalkboard/front-door/back-door/desk, x,y,width,height, rotation, zIndex, positionOverrideJson)`는 화면 요소를 저장한다. `Seat(seatId PK, classroomLayoutId FK, seatCode, elementId FK, isActive, autoPositionTagsJson, overridePositionTagsJson)`는 책상 요소와 1:1로 연결하며 비활성화해 과거 assignment를 보존한다. 정규화 좌표(0~1)를 기본으로 하되 canvas 크기와 coordinateVersion을 함께 저장한다.

### SeatPositionTag

목적: 앞/중간/뒤, 왼쪽/가운데/오른쪽, 앞문/뒷문 접근성과 사용자 정의 태그를 표현한다. `seatPositionTagId PK, seatId FK, tagKey, tagGroup, source(auto/manual), weight, createdAt`. 자동 계산 결과와 교사 override를 구분한다. 사용자 정의는 Post-MVP 확장 필드로 설계한다.

### SeatingSession / SeatingAssignment

`SeatingSession(seatingSessionId PK, schoolYearId FK, classroomLayoutId FK, sequenceNo, occurredOn, note, status: draft/confirmed, algorithmVersion, seed, scoreSummaryJson, createdAt, confirmedAt)`는 자리변경 한 회차다. `SeatingAssignment(assignmentId PK, seatingSessionId FK, studentId FK, seatId FK, positionSnapshotJson, displayNameSnapshot, studentNumberSnapshot)`는 확정 시점의 학생-자리 연결과 위치 snapshot이다. draft는 세션으로 저장하지 않거나 임시 저장소에만 두고, 실제 이력은 confirmed만 조회 대상으로 삼는다. 한 confirmed session에서 학생·좌석은 각각 최대 1회 연결한다.

### StudentSeatConstraint

`constraintId PK, schoolYearId FK, studentId FK, tagKey, strength(required/preferred/desired), isActive, note, createdAt, updatedAt`. 필수는 hard 검증 대상이 아니라면 명시적으로 soft penalty와 불가능 상태를 구분한다.

### StudentPairConstraint

`pairConstraintId PK, schoolYearId FK, studentAId FK, studentBId FK, relationType(no-adjacent/min-distance/far-as-possible), minDistance, strength(required/preferred/desired), isActive, note`. A/B 정렬 규칙으로 중복 pair를 방지한다. 학생 삭제 대신 전출 상태에서도 과거 constraint를 보존한다.

### CafeteriaLayout / CafeteriaSession / CafeteriaAssignment

`CafeteriaLayout(cafeteriaLayoutId PK, schoolYearId FK, seatCount default 22, rows default 2, seatsPerRow default 11, teacherSeatJson, seatGeometryJson)`는 긴 식탁의 좌표와 교사 자리를 저장한다. `CafeteriaSession(cafeteriaSessionId PK, schoolYearId FK, semester, sequenceNo, occurredOn, note, status, seed, scoreSummaryJson)`는 확정된 줄서기 회차다. `CafeteriaAssignment(assignmentId PK, sessionId FK, studentId FK, queueOrder, cafeteriaSeatId, role)`는 순번·착석 위치·인솔 역할을 저장한다. 교실 `Seat`와 공유하지 않는다.

### SemesterLeadership

`leadershipId PK, schoolYearId FK, semester(1/2), studentId FK, role(president/vice-president), startsOn, endsOn, isCafeteriaMarshal`. 학급 임원은 Student 영구 속성이 아니며 학기별 연결이다. 급식실 인솔 4명 제한은 서비스 validator에서 확인한다.

### AppSettings

`settingKey PK, settingValueJson, schemaVersion, updatedAt`. 표시 방식(이름/번호/번호+이름), 엔진 가중치 preset, 마지막 활성 학년도, 인쇄 기본값을 저장한다. 개인정보를 불필요하게 복제하지 않는다.

## 무결성 및 삭제 정책

FK는 활성화하고, 확정 이력의 학생·좌석은 삭제 cascade하지 않는다. 학생·좌석은 soft state로 비활성화한다. layout 변경은 새 layout version을 만들거나 assignment의 position snapshot으로 과거 출력을 보호한다. DB 쓰기는 확정·복원·migration 단위로 transaction 처리한다.

## 예시 데이터

```json
{
  "studentId": "stu_01J...",
  "schoolYearId": "sy_2026",
  "studentNumber": 7,
  "name": "김민서",
  "gender": "여",
  "enrollmentStatus": "재학",
  "seatId": "SEAT-014",
  "positionSnapshot": {"vertical": "중간", "horizontal": "오른쪽", "nearFrontDoor": false}
}
```

## 백업 포맷

단일 파일은 `formatVersion`, `appVersion`, `exportedAt`, `schoolYears`, 관련 entity 배열을 포함하는 검증된 JSON 백업을 기본으로 한다. 복원 전 현재 DB 백업을 만들고 schema version을 확인한다. 파일이 깨졌거나 다른 앱 버전이면 미리보기 검증 후 복원을 거부한다.

## Entity 필드 요약과 예시

아래 표기에서 `PK`는 Primary Key, `FK`는 Foreign Key, `Y/N`은 필수 여부다. `createdAt`·`updatedAt`은 모든 변경 가능한 Entity에 공통으로 포함한다.

| Entity | 주요 필드(타입 / 필수 / 키) | 예시 |
|---|---|---|
| SchoolYear | schoolYearId(string/Y/PK), label(string/Y), startsOn·endsOn(date/Y), status(enum/Y) | `{schoolYearId:"sy_2026", label:"2026학년도", startsOn:"2026-03-01", endsOn:"2027-02-28", status:"active"}` |
| Student | studentId(string/Y/PK), schoolYearId(string/Y/FK), studentNumber(int/Y), name(string/Y), gender(enum/Y), enrollmentStatus(enum/Y), transferInDate·transferOutDate(date/N) | `{studentId:"stu_01", schoolYearId:"sy_2026", studentNumber:7, name:"김민서", gender:"여", enrollmentStatus:"재학"}` |
| ClassroomLayout | classroomLayoutId(string/Y/PK), schoolYearId(string/Y/FK), name(string/Y), canvasWidth·canvasHeight(number/Y), coordinateVersion(int/Y) | `{classroomLayoutId:"cl_01", schoolYearId:"sy_2026", name:"2반 기본 교실", canvasWidth:1, canvasHeight:1, coordinateVersion:1}` |
| ClassroomElement | elementId(string/Y/PK), classroomLayoutId(string/Y/FK), elementType(enum/Y), x·y·width·height(number/Y), rotation(number/Y) | `{elementId:"el_01", classroomLayoutId:"cl_01", elementType:"desk", x:0.2, y:0.3, width:0.05, height:0.05, rotation:0}` |
| Seat | seatId(string/Y/PK), classroomLayoutId(string/Y/FK), elementId(string/Y/FK), seatCode(string/Y), isActive(boolean/Y), auto/override tags(JSON/N) | `{seatId:"SEAT-001", classroomLayoutId:"cl_01", elementId:"el_01", seatCode:"SEAT-001", isActive:true}` |
| SeatPositionTag | seatPositionTagId(string/Y/PK), seatId(string/Y/FK), tagKey·tagGroup(string/Y), source(enum/Y), weight(number/N) | `{seatPositionTagId:"tag_01", seatId:"SEAT-001", tagKey:"front", tagGroup:"vertical", source:"auto", weight:1}` |
| SeatingSession | seatingSessionId(string/Y/PK), schoolYearId·classroomLayoutId(string/Y/FK), sequenceNo(int/Y), occurredOn(date/Y), status(enum/Y), note(string/N), algorithmVersion·seed(string/N) | `{seatingSessionId:"ss_07", schoolYearId:"sy_2026", classroomLayoutId:"cl_01", sequenceNo:7, occurredOn:"2026-09-01", status:"confirmed"}` |
| SeatingAssignment | assignmentId(string/Y/PK), seatingSessionId·studentId·seatId(string/Y/FK), positionSnapshot(JSON/Y), displayNameSnapshot(string/Y), studentNumberSnapshot(int/Y) | `{assignmentId:"as_07_01", seatingSessionId:"ss_07", studentId:"stu_01", seatId:"SEAT-001", positionSnapshot:{vertical:"front"}, displayNameSnapshot:"김민서", studentNumberSnapshot:7}` |
| StudentSeatConstraint | constraintId(string/Y/PK), schoolYearId·studentId(string/Y/FK), tagKey(string/Y), strength(enum/Y), isActive(boolean/Y), note(string/N) | `{constraintId:"sc_01", schoolYearId:"sy_2026", studentId:"stu_01", tagKey:"front", strength:"required", isActive:true}` |
| StudentPairConstraint | pairConstraintId(string/Y/PK), schoolYearId·studentAId·studentBId(string/Y/FK), relationType(enum/Y), minDistance(number/N), strength(enum/Y), isActive(boolean/Y) | `{pairConstraintId:"pc_01", schoolYearId:"sy_2026", studentAId:"stu_01", studentBId:"stu_02", relationType:"no-adjacent", strength:"required", isActive:true}` |
| CafeteriaLayout | cafeteriaLayoutId(string/Y/PK), schoolYearId(string/Y/FK), seatCount·rows·seatsPerRow(int/Y), teacherSeatJson·seatGeometryJson(JSON/Y) | `{cafeteriaLayoutId:"caf_01", schoolYearId:"sy_2026", seatCount:22, rows:2, seatsPerRow:11}` |
| CafeteriaSession | cafeteriaSessionId(string/Y/PK), schoolYearId(string/Y/FK), semester·sequenceNo(int/Y), occurredOn(date/Y), status(enum/Y), seed(string/N) | `{cafeteriaSessionId:"cfs_01", schoolYearId:"sy_2026", semester:1, sequenceNo:3, occurredOn:"2026-09-01", status:"confirmed"}` |
| CafeteriaAssignment | assignmentId(string/Y/PK), cafeteriaSessionId·studentId(string/Y/FK), queueOrder·cafeteriaSeatId(int/string/Y), role(enum/N) | `{assignmentId:"cfa_01", cafeteriaSessionId:"cfs_01", studentId:"stu_01", queueOrder:4, cafeteriaSeatId:"CAF-08", role:"marshal"}` |
| SemesterLeadership | leadershipId(string/Y/PK), schoolYearId·studentId(string/Y/FK), semester(int/Y), role(enum/Y), startsOn·endsOn(date/N), isCafeteriaMarshal(boolean/Y) | `{leadershipId:"lead_01", schoolYearId:"sy_2026", studentId:"stu_01", semester:1, role:"president", isCafeteriaMarshal:true}` |
| AppSettings | settingKey(string/Y/PK), settingValueJson(JSON/Y), schemaVersion(int/Y), updatedAt(timestamp/Y) | `{settingKey:"display.studentLabel", settingValueJson:"number-name", schemaVersion:1}` |
