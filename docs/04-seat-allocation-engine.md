# 04. 자리배치 엔진 설계

## 문제 정의

활성 학생을 활성 책상에 일대일 배정하는 제약조건 기반 최적화 문제다. 목표는 같은 자리 반복과 과거 근접 반복을 줄이고 공간 경험을 균형화하며, 개인·pair 조건과 성별 인접을 가중치로 반영하는 것이다. 후보는 추천일 뿐이며 교사가 수정·확정한다.

## 입력과 출력

입력은 활성 Student, Seat와 좌표/태그, confirmed `SeatingAssignment` 이력, StudentSeatConstraint, StudentPairConstraint, engine settings, seed다. 출력 `AllocationCandidate`는 `assignmentByStudent`, 총점, 항목별 점수·위반 수, 설명용 `reasonCodes`, seed, algorithmVersion을 가진다.

## 제약조건

### Hard constraint

- 한 활성 학생은 정확히 한 자리, 한 자리는 최대 한 학생.
- 비활성 좌석·전출 학생은 자동배치 대상에서 제외.
- 좌석 수가 학생 수보다 부족하면 생성 중단.
- `required` pair의 바로 인접 금지 또는 최소거리 조건은 위반 후보를 확정할 수 없게 한다.

개인 위치 `required`는 MVP에서 hard로 적용할지 설정 가능한 설계 판단이다. 필수 조건을 만족할 좌석이 부족하면 “배치 불가”와 완화 제안을 별도로 표시한다.

### Soft constraint

같은 자리 반복, 공간 영역 편중, 과거 근접, 성별 인접, preferred/desired 위치, preferred/desired pair 거리다. soft 점수는 조건 우선순위를 반영하되 한 항목의 극단값이 전체 설명을 가리지 않도록 정규화한다.

## 거리와 근접 정의

좌표 중심점 간 유클리드 거리 `sqrt(dx²+dy²)`를 정규화 canvas 기준으로 계산한다. 교실의 통로·벽을 아직 모델링하지 않으므로 직선거리이며, 회전과 desk 크기는 중심점 보정에만 사용한다. 기본 근접은 8방향 이웃 또는 거리 임계값 `nearDistance` 이내로 정의하고, 임계값은 좌석 간격의 중앙값에 기반해 계산한다. 세로·가로 인접이 중요할 때는 실제 좌표의 방향을 함께 기록한다.

## 점수 모델

낮을수록 좋은 penalty를 기본 내부 모델로 사용하고 UI에는 `100 - normalizedPenalty` 형태로 점수화한다.

`totalPenalty = 30*sameSeat + 25*repeatProximity + 15*genderAdjacency + 15*positionExperience + 10*studentPosition + 5*pairDistance`

기본 가중치는 설계 판단이며 `AppSettings`의 `engineProfile`로 조정 가능하게 한다. 우선순위는 가중치뿐 아니라 단계별 lexicographic 비교로도 보호한다: (1) hard 위반 0 여부, (2) sameSeat, (3) repeatProximity, (4) gender, (5) 개인 조건, (6) pair 조건. 교사가 프로필을 바꿔도 hard 검증은 무시하지 않는다.

### 항목별 계산

- `sameSeat`: 학생의 과거 해당 seat 착석 횟수를 전체 최대값으로 정규화. 적게 경험한 좌석일수록 낮은 penalty.
- `positionExperience`: 앞/중간/뒤와 왼쪽/가운데/오른쪽 각 태그별 누적 횟수에 decay를 적용하고, 현재 후보 태그의 상대 빈도를 penalty로 산출.
- `repeatProximity`: 과거 각 회차에서 가까웠던 학생 pair를 찾아 현재도 가까우면 penalty. 최근 회차가 클수록 영향이 큼.
- `genderAdjacency`: 인접 pair 중 같은 성별 비율을 계산한다. 성별 불균형을 보정하여 적은 성별 학생의 동일 성별 인접을 우선 줄이되, 성별을 절대 제약으로 만들지 않는다.
- `studentPosition`: required/preferred/desired 태그 부합 여부에 따라 큰/중간/작은 penalty. 이유 코드로 표시.
- `pairDistance`: no-adjacent, min-distance, far-as-possible를 조건별로 평가. required 위반은 hard 검증과 연결한다.

## Time decay

회차가 현재에서 `age`만큼 오래될 때 `decay = exp(-lambda * age)`를 사용한다. 기본 lambda는 0.15를 설정 후보로 두고, 최근 기록을 더 중요하게 하되 오래된 기록을 0으로 만들지 않는다. 같은 자리 경험은 장기 균형이 중요하므로 decay를 약하게 하거나 전체 누적과 최근 누적을 혼합한다. lambda와 기준은 테스트 후 조정한다.

## 후보 생성

1. 입력을 검증하고 hard 불가능성을 빠르게 검사한다.
2. seed 기반 랜덤 초기배치를 만든다. 가능하면 낮은 sameSeat 좌석부터 가중 샘플링한다.
3. 전체 penalty를 계산한다.
4. 임의 학생 2명 swap을 시도하고 개선되면 채택한다.
5. 일정 횟수 정체 시 restart하거나 simulated annealing 수용 확률을 적용한다(Post-MVP 선택).
6. 서로 다른 seed로 반복하고 상위 후보를 수집한다.
7. assignment 차이가 일정 비율 미만인 후보를 제거해 다양성을 확보하고 상위 3개를 반환한다.

MVP 추천은 “random restart + swap local search + 제한적 hill climbing”이다. 20~30명 규모에서 TypeScript로 설명·테스트가 쉽고 solver 배포 의존성이 없다. simulated annealing은 local optimum 문제가 관찰될 때 추가한다. genetic algorithm과 외부 constraint solver는 MVP에서 과도하므로 보류한다.

## 수동 변경 후 재평가

후보 선택 후 swap/drag는 draft assignment만 변경한다. 엔진의 `evaluateAllocation`을 다시 호출해 총점, 위반, 이유를 갱신한다. required 위반은 확정 버튼을 막고, soft 악화는 경고와 확인을 요구한다. 확정 시에만 `SeatingSession(status=confirmed)`과 snapshot을 transaction으로 저장한다.

## 전입·전출

전입생은 이력이 없으므로 prior count를 0이 아닌 “정보 부족” 상태로 취급하고 초기 N회(기본 3회) 위치 경험 penalty를 완화한다. 전출생은 이력 계산에는 남기되 현재 후보의 학생·근접 pair에서 제외한다. 전출로 인해 pair 조건의 한쪽이 비활성이면 해당 조건은 평가하지 않고 경고한다.

## 배치 불가능과 성능

좌석 부족, 중복 입력, 충돌하는 required 조건, 필수 위치 태그 좌석 부족을 사용자에게 원인별로 표시한다. hard 조건을 자동 완화하지 않으며 “soft로 완화해 다시 계산”은 교사 확인 후 별도 실행으로 둔다. 목표는 30명·40좌석에서 설정된 restart/iteration을 수 초 내 완료하는 것. 실행 중 취소와 진행 상태를 고려하고, Renderer를 막지 않도록 Main의 worker 또는 비동기 서비스로 이동할 수 있다.

## 테스트

중복 배정 불가, 전출 제외, 전입 완화, sameSeat 감소 경향, decay 단조성, 거리·근접 판정, gender soft 처리, required 위반 차단, 후보 3개 다양성, 같은 seed 재현성, 수동 수정 재평가, 불가능 설명을 fixture로 검증한다. 절대 점수보다 제약·순위·불변조건을 테스트한다.
