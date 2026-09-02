import type { Seat, Student } from "../../src/domain/models";

export const students: Student[] = Array.from({ length: 6 }, (_, index) => ({
  studentId: `stu-${index + 1}`,
  schoolYearId: "sy_2026",
  studentNumber: index + 1,
  name: `학생${index + 1}`,
  gender: index % 2 === 0 ? "남" : "여",
  enrollmentStatus: "재학",
  createdAt: "2026-03-01T00:00:00.000Z",
  updatedAt: "2026-03-01T00:00:00.000Z"
}));

export const seats: Seat[] = Array.from({ length: 6 }, (_, index) => ({
  seatId: `seat-${index + 1}`,
  seatCode: `SEAT-${String(index + 1).padStart(3, "0")}`,
  x: (index % 3) * 0.3,
  y: Math.floor(index / 3) * 0.3,
  width: 0.1,
  height: 0.1,
  position: {
    vertical: index < 2 ? "앞" : index < 4 ? "중간" : "뒤",
    horizontal: index % 3 === 0 ? "왼쪽" : index % 3 === 1 ? "가운데" : "오른쪽",
    nearFrontDoor: index === 0,
    nearBackDoor: index === 5
  },
  isActive: true
}));
