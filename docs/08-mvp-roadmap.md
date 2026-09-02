# 08. MVP 로드맵

## 범위 구분

Prototype은 도메인·엔진·Windows SQLite ABI를 검증하는 단계다. MVP는 한 담임교사가 한 학급을 오프라인에서 운영하는 데 필요한 핵심 흐름이다. Post-MVP는 급식실 고도화, Excel, 암호화, 자동 업데이트, 다중 사용자·서버 등이다.

## 구현 단계

| Phase | 목표 | 구현 기능 | 선행 조건 | 완료 기준·테스트 항목 | 위험·진입 조건 |
|---|---|---|---|---|---|
| 0 Prototype | 실행·구조 검증 | Electron/TS/React, SQLite 연결, 폴더·IPC, fixture | 문서 확정 | Windows 실행, migration, 엔진 unit 실행 | native module 위험; ABI 검증 후 Phase 1 |
| 1 MVP | 학생·로컬 저장 | 학년도, 학생 CRUD, 붙여넣기, 상태, 자동 저장 | 0 | 재실행 후 데이터 유지, 전입/전출 테스트 | 입력 오류; validator 통과 |
| 2 MVP | 교실 표현 | layout, 요소·좌표, seat, 자동 태그 | 1 | 자유 배치·재로드·태그 override | 좌표/회전; snapshot 설계 통과 |
| 3 MVP | 수동 운영 | 학생-자리 drag/교환, 현재 자리 | 2 | 중복·미배정 차단, 취소/재평가 | UX 실수; component test 통과 |
| 4 MVP | 이력 안전성 | confirmed session/assignment, 회차·메모 | 3 | draft 미저장, 확정 transaction, 전출 이력 보존 | layout 변경; snapshot 검증 |
| 5 Prototype→MVP | 기본 자동배치 | seed random + swap local search, 1 후보 | 4 | 20~30명 수 초, 재현성, 불가능 설명 | local optimum; 성능 기준 통과 |
| 6 MVP | 과거 기반 scoring | same seat, proximity, decay, 영역 경험, 설명 | 5 | 고정 fixture에서 우선순위 경향·통계 검증 | 가중치 논쟁; profile 문서화 |
| 7 MVP | 후보 비교 | restart, 상위 3개, 다양성, 항목별 점수 | 6 | 유사 후보 제거·비교·선택 | 후보 품질; 교사 검토 기준 확보 |
| 8 MVP 확장 | 개인 위치 조건 | tag/strength, 검증·재평가 | 7 | required 차단, preferred penalty, 신규 학생 완화 | 필수 충돌; 완화 흐름 합의 |
| 9 MVP 확장 | pair 조건 | 인접·최소거리·먼 거리 | 8 | 거리 계산, 위반 표시, 중복 pair 방지 | 복잡성; engine contract 고정 |
| 10 Post-MVP | 급식실 | 22자리, 줄서기, 인솔 4명, 수정·확정 | 학생·이력 서비스 | 순번·좌석·학기 역할 보존 테스트 | 별도 규칙; 교실 엔진과 분리 |
| 11 MVP | 교실 자리표 | 학생용/교사용 렌더 모델 | 4 | 좌우 반전, 이름 정상 방향, 미리보기 | 인쇄 레이아웃; fixture 출력 검토 |
| 12 MVP | 인쇄/PDF | native print, PDF 저장 | 11 | 오프라인 프린터/PDF 생성 | 권한·드라이버; 단계별 배포 검증 |
| 13 MVP | 백업/복원 | 단일 파일 export/import, 검증, pre-restore backup | 1,4 | 깨진/구버전 파일 처리, 복원 후 통계 동일 | 개인정보 파일; 안내문 완료 |
| 14 MVP 후반 | 통계 | 학생 경험, 전체 비교, pair 근접 | 4,6 | 전출·전입 집계 규칙 일치 | 성능; repository query 테스트 |
| 15 Post-MVP | Excel export | 이력·통계 `.xlsx` | 14 | 열 정의·한글 깨짐 없음 | dependency; 사용자 수요 확인 |

## 추천 구현 순서 조정

급식실은 교실 자리배치와 핵심 알고리즘이 달라 Phase 10의 Post-MVP로 분리한다. 교실 자리표는 핵심 교실 운영에 필요하므로 Phase 11~12에서 MVP에 포함하고, 급식실 자리표는 Phase 10 완료 후 같은 출력 인프라에 연결한다. 백업은 실제 데이터가 쌓이기 전인 Phase 13까지 반드시 완료한다. Phase 5~9 엔진은 화면보다 먼저 순수 fixture로 개발한다.

## MVP 최종 진입/종료 기준

MVP는 Phase 0~9, 11~14가 완료될 때로 정의한다. 최초 설정→학생 등록→교실 배치→후보 생성→수동 수정→확정→학생용/교사용 출력→백업 복원 전체를 인터넷 없이 수행할 수 있어야 한다. Phase 10과 15, 암호화, 자동 업데이트, Excel 내보내기는 MVP 종료 조건이 아니다.

## 다음 개발 단계에서 가장 먼저 할 일

1. 이 문서의 MVP 범위와 `AppSettings` 엔진 프로필을 확정한다.
2. TypeScript domain DTO, fixture, engine contract와 DB schema 초안을 만든다.
3. SQLite 네이티브 모듈의 Windows 개발/production ABI 호환을 빈 Prototype으로 검증한다.
4. 전입·전출·확정/초안·백업 복원에 대한 불변조건 테스트를 먼저 작성한다.
5. 그 후 학생 관리와 학년도 서비스부터 구현한다.
