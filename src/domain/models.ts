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

export interface EngineSettings {
  nearDistance: number;
  timeDecayLambda: number;
  newcomerRelaxedSessions: number;
  weights: {
    sameSeat: number;
    repeatProximity: number;
    genderAdjacency: number;
    positionExperience: number;
    studentPosition: number;
    pairDistance: number;
  };
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
  settings?: Partial<Omit<EngineSettings, "weights">> & { weights?: Partial<EngineSettings["weights"]> };
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
  };
  reasonCodes: string[];
  conditionSummary: Array<{ group: string; label: string; status: "satisfied" | "warning" | "violation"; detail: string; penalty: number }>;
  pairDetails: Array<{ studentAId: string; studentAName: string; studentBId: string; studentBName: string; seatAId: string; seatBId: string; type: PairConstraintType; strength: ConstraintStrength; currentDistance: number; targetDistance?: number; status: "satisfied" | "warning" | "violation" }>;
}

export interface AllocationCandidate {
  assignments: SeatingAssignment[];
  evaluation: Evaluation;
  seed: number;
  algorithmVersion: string;
}
