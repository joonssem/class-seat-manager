import type { SeatPosition, PositionHorizontal, PositionVertical } from "./models";

export interface LayoutItem {
  id: string;
  type: "desk" | "chalkboard" | "front-door" | "back-door";
  x: number;
  y: number;
  width: number;
  height: number;
  positionOverride?: Partial<SeatPosition>;
}

export function calculateSeatPosition(seat: LayoutItem, frontDoor?: LayoutItem, backDoor?: LayoutItem): SeatPosition {
  const horizontal: PositionHorizontal = seat.x < 0.33 ? "왼쪽" : seat.x < 0.66 ? "가운데" : "오른쪽";
  const vertical: PositionVertical = seat.y < 0.33 ? "앞" : seat.y < 0.66 ? "중간" : "뒤";
  const center = (item: LayoutItem) => ({ x: item.x + item.width / 2, y: item.y + item.height / 2 });
  const current = center(seat);
  const near = (target?: LayoutItem) => target ? Math.hypot(current.x - center(target).x, current.y - center(target).y) < 0.25 : false;
  return { vertical, horizontal, nearFrontDoor: near(frontDoor), nearBackDoor: near(backDoor), ...seat.positionOverride };
}
