export type Gender = "남" | "여";
export type EnrollmentStatus = "재학" | "전출";
export type PositionVertical = "앞" | "중간" | "뒤";
export type PositionHorizontal = "왼쪽" | "가운데" | "오른쪽";

export interface Student {
  studentId: string;
  schoolYearId: string;
  studentNumber: number;
  name: string;
  gender: Gender;
  enrollmentStatus: EnrollmentStatus;
  transferInDate?: string;
  transferOutDate?: string;
  createdAt: string;
  updatedAt: string;
}

export interface SeatPosition {
  vertical: PositionVertical;
  horizontal: PositionHorizontal;
  nearFrontDoor: boolean;
  nearBackDoor: boolean;
}

export interface Seat {
  seatId: string;
  seatCode: string;
  x: number;
  y: number;
  width: number;
  height: number;
  position: SeatPosition;
  isActive: boolean;
}

export interface SeatingAssignment {
  studentId: string;
  seatId: string;
}

export interface ConfirmedSeatingSession {
  sequenceNo: number;
  occurredOn: string;
  assignments: SeatingAssignment[];
}

export type ConstraintStrength = "필수" | "가급적" | "선호";

export interface StudentSeatConstraint {
  studentId: string;
  tag: keyof SeatPosition;
  strength: ConstraintStrength;
  expected?: boolean | string;
}

export type PairConstraintType = "바로 인접 금지" | "최소 거리" | "가능한 한 멀리";

export interface StudentPairConstraint {
  studentAId: string;
  studentBId: string;
  type: PairConstraintType;
  minDistance?: number;
  strength: ConstraintStrength;
}

export interface ProximitySettings {
  /** 모두가 바라보는 교실 앞 집중점(캔버스 좌표). */
  focusX: number;
  focusY: number;
  /** 책상 가장자리 간격이 이 값 이하이면 바로 이웃으로 본다. */
  adjacentGap: number;
  /** 이 간격 이상이면 서로 영향이 없다고 본다. */
  reachGap: number;
  /** 기본 시선에서 이 각도까지는 고개만 돌려 편하게 볼 수 있다고 본다. */
  comfortableTurnDeg: number;
  /** 편하게 볼 수 있는 쪽의 가중치(나머지는 더 많이 돌려야 하는 쪽). */
  easierSideWeight: number;
  /** 이 위험도 이상이면 "가까운 자리"로 판정한다. */
  nearRisk: number;
}

export interface EngineSettings {
  proximity: ProximitySettings;
  timeDecayLambda: number;
  newcomerRelaxedSessions: number;
  weights: {
    sameSeat: number;
    repeatProximity: number;
    genderAdjacency: number;
    positionExperience: number;
    studentPosition: number;
    pairDistance: number;
    groupActivity: number;
  };
  /** 세로 한 줄 모둠 활동을 고려할지 여부. */
  groupActivity: boolean;
  restartCount: number;
  maxIterations: number;
  diversityThreshold: number;
}

export interface AllocationInput {
  students: Student[];
  seats: Seat[];
  history: ConfirmedSeatingSession[];
  seatConstraints?: StudentSeatConstraint[];
  pairConstraints?: StudentPairConstraint[];
  settings?: Partial<Omit<EngineSettings, "weights" | "proximity">> & { proximity?: Partial<ProximitySettings>; weights?: Partial<EngineSettings["weights"]> };
  seed?: number;
}

export interface Evaluation {
  totalPenalty: number;
  score: number;
  hardViolations: string[];
  breakdown: {
    sameSeat: number;
    repeatProximity: number;
    genderAdjacency: number;
    positionExperience: number;
    studentPosition: number;
    pairDistance: number;
    groupActivity: number;
  };
  reasonCodes: string[];
  /** 항목별 부담도. 0이면 문제 없음, 1이면 무작위 배치와 같은 수준(기준 대비 비율). 기준이 0인 항목은 0. */
  relative: Evaluation["breakdown"];
  conditionSummary: Array<{ group: string; label: string; status: "satisfied" | "warning" | "violation"; detail: string; penalty: number }>;
  pairDetails: Array<{ studentAId: string; studentAName: string; studentBId: string; studentBName: string; seatAId: string; seatBId: string; type: PairConstraintType; strength: ConstraintStrength; currentDistance: number; targetDistance?: number; relation?: string; risk?: number; status: "satisfied" | "warning" | "violation" }>;
}

export interface AllocationCandidate {
  assignments: SeatingAssignment[];
  evaluation: Evaluation;
  seed: number;
  algorithmVersion: string;
}
