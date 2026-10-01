import type { Seat } from "./models";

/**
 * 세로 한 줄 모둠: 책상 중심의 x좌표가 같은 줄(책상 폭의 절반 이내)에 있는 좌석끼리 묶는다.
 * 좌석이 1개뿐인 줄은 모둠이 아니므로 제외한다.
 */
export function columnGroups(seats: Seat[]): string[][] {
  const sorted = [...seats].sort((a, b) => a.x + a.width / 2 - (b.x + b.width / 2));
  const groups: Seat[][] = [];
  for (const seat of sorted) {
    const cx = seat.x + seat.width / 2;
    const last = groups[groups.length - 1];
    const anchor = last ? last.reduce((sum, item) => sum + item.x + item.width / 2, 0) / last.length : 0;
    if (last && Math.abs(cx - anchor) <= seat.width * 0.5) last.push(seat);
    else groups.push([seat]);
  }
  return groups.filter((group) => group.length > 1).map((group) => group.sort((a, b) => a.y - b.y).map((seat) => seat.seatId));
}
