import { createEmptySchedule, validateSchedule } from "./rules";
import type { DayIndex, Doctor, ScheduleIssue, ShiftKey, WeekArchive, WeeklySchedule } from "./types";

export type SchedulerResult =
  | { ok: true; schedule: WeeklySchedule }
  | { ok: false; issues: ScheduleIssue[]; message: string };

const shiftOrder: ShiftKey[] = ["night1", "night2", "day1", "day2"];
const dayShiftKeys: ShiftKey[] = ["day1", "day2"];
const nightShiftKeys: ShiftKey[] = ["night1", "night2"];

interface DoctorShiftCounts {
  day: number;
  night: number;
  total: number;
}

function isNight(shiftKey: ShiftKey) {
  return shiftKey === "night1" || shiftKey === "night2";
}

function getCounts(doctors: Doctor[]) {
  return new Map<string, DoctorShiftCounts>(
    doctors.map((doctor) => [doctor.id, { day: 0, night: 0, total: 0 }])
  );
}

function maxNightsForDoctor(doctor: Doctor, previousWeek?: WeekArchive): number {
  if (doctor.kind === "dayOnly") return 0;
  if (!previousWeek) return 2;

  let prevNights = 0;
  for (const day of previousWeek.schedule.days) {
    for (const sk of nightShiftKeys) {
      if (day.assignments[sk] === doctor.id) prevNights++;
    }
    if (day.extraNight.includes(doctor.id)) prevNights++;
  }
  return prevNights >= 2 ? 1 : 2;
}

function hadSaturdayNight(doctorId: string, previousWeek?: WeekArchive): boolean {
  if (!previousWeek) return false;
  const sat = previousWeek.schedule.days[5];
  if (!sat) return false;
  return nightShiftKeys.some((sk) => sat.assignments[sk] === doctorId) ||
    sat.extraNight.includes(doctorId);
}

export function generateSchedule(
  doctors: Doctor[],
  previousWeek?: WeekArchive
): SchedulerResult {
  const schedule = createEmptySchedule();
  const counts = getCounts(doctors);
  const requiredAssignments = schedule.days.length * shiftOrder.length;

  const maximumAssignments = doctors.reduce((total, doctor) => {
    if (doctor.kind === "dayOnly") return total + (doctor.targetDayShifts ?? 2);
    if (doctor.kind === "nightOnly") return total + 2;
    return total + 3;
  }, 0);

  if (maximumAssignments < requiredAssignments) {
    return {
      ok: false,
      issues: [{
        type: "insufficientCapacity",
        message: `医生总排班容量不足：最多可安排 ${maximumAssignments} 班，需安排 ${requiredAssignments} 班`
      }],
      message: "医生总排班容量不足，无法生成合法排班"
    };
  }

  function canAssign(doctor: Doctor, dayIndex: number, shiftKey: ShiftKey) {
    const day = schedule.days[dayIndex];
    const doctorCounts = counts.get(doctor.id);
    if (!day || !doctorCounts) return false;

    // Unavailable days
    if (doctor.unavailableDays.includes(day.dayIndex)) return false;
    if (isNight(shiftKey) && doctor.unavailableNightShifts.includes(day.dayIndex)) return false;
    if (!isNight(shiftKey) && doctor.unavailableDayShifts.includes(day.dayIndex)) return false;

    // Already assigned this day
    if (Object.values(day.assignments).includes(doctor.id)) return false;

    const isNightShift = isNight(shiftKey);

    // Previous night → must be 出 (already handled by existing logic, but double-check)
    if (dayIndex > 0) {
      const prevDay = schedule.days[dayIndex - 1];
      if (prevDay && nightShiftKeys.some((sk) => prevDay.assignments[sk] === doctor.id)) return false;
      if (prevDay && prevDay.extraNight.includes(doctor.id)) return false;
    }

    // Night spacing: ≥4 days between nights
    if (isNightShift) {
      for (let prev = dayIndex - 1; prev >= Math.max(0, dayIndex - 4); prev--) {
        const prevDay = schedule.days[prev];
        if (!prevDay) continue;
        if (nightShiftKeys.some((sk) => prevDay.assignments[sk] === doctor.id)) return false;
        if (prevDay.extraNight.includes(doctor.id)) return false;
      }

      // Day→night adjacency: can't have day then night on consecutive days
      if (dayIndex > 0) {
        const prevDay = schedule.days[dayIndex - 1];
        if (prevDay && (dayShiftKeys.some((sk) => prevDay.assignments[sk] === doctor.id) ||
            prevDay.extraDay.includes(doctor.id))) return false;
      }

      // Saturday rule
      if (day.dayIndex === 5 && hadSaturdayNight(doctor.id, previousWeek)) return false;
    }

    // Type constraints
    if (doctor.kind === "dayOnly") {
      return !isNightShift && doctorCounts.day < (doctor.targetDayShifts ?? 2);
    }
    if (doctor.kind === "nightOnly") {
      if (!isNightShift) return false;
      if (doctorCounts.night >= maxNightsForDoctor(doctor, previousWeek)) return false;
      return true;
    }

    // Normal doctor caps
    if (doctorCounts.total >= 3) return false;

    if (isNightShift) {
      if (doctorCounts.night >= maxNightsForDoctor(doctor, previousWeek)) return false;
    } else {
      if (doctorCounts.day >= 2) return false;
    }

    return true;
  }

  function getCandidates(dayIndex: number, shiftKey: ShiftKey) {
    const isNightShift = isNight(shiftKey);

    return doctors
      .filter((doctor) => canAssign(doctor, dayIndex, shiftKey))
      .sort((left, right) => {
        const leftCounts = counts.get(left.id)!;
        const rightCounts = counts.get(right.id)!;

        // Preference matching: prioritize doctors who prefer this shift type
        const leftPref = left.preference;
        const rightPref = right.preference;
        const leftMatchesPref = (isNightShift && leftPref === "1白2夜") || (!isNightShift && leftPref === "2白1夜");
        const rightMatchesPref = (isNightShift && rightPref === "1白2夜") || (!isNightShift && rightPref === "2白1夜");
        if (leftMatchesPref !== rightMatchesPref) {
          return leftMatchesPref ? -1 : 1;
        }

        // Fairness: fewer total shifts first
        if (leftCounts.total !== rightCounts.total) {
          return leftCounts.total - rightCounts.total;
        }

        // Fewer same-kind shifts first
        const leftSameKind = isNightShift ? leftCounts.night : leftCounts.day;
        const rightSameKind = isNightShift ? rightCounts.night : rightCounts.day;
        if (leftSameKind !== rightSameKind) {
          return leftSameKind - rightSameKind;
        }

        // Stable sort
        return left.name.localeCompare(right.name) || left.id.localeCompare(right.id);
      });
  }

  function assign(doctor: Doctor, dayIndex: number, shiftKey: ShiftKey) {
    const doctorCounts = counts.get(doctor.id)!;
    schedule.days[dayIndex].assignments[shiftKey] = doctor.id;
    doctorCounts.total += 1;
    if (isNight(shiftKey)) {
      doctorCounts.night += 1;
    } else {
      doctorCounts.day += 1;
    }
  }

  function unassign(doctor: Doctor, dayIndex: number, shiftKey: ShiftKey) {
    const doctorCounts = counts.get(doctor.id)!;
    schedule.days[dayIndex].assignments[shiftKey] = null;
    doctorCounts.total -= 1;
    if (isNight(shiftKey)) {
      doctorCounts.night -= 1;
    } else {
      doctorCounts.day -= 1;
    }
  }

  function targetsMet() {
    return doctors.every((doctor) => {
      if (doctor.kind === "dayOnly" && typeof doctor.targetDayShifts === "number") {
        return counts.get(doctor.id)?.day === doctor.targetDayShifts;
      }
      return true;
    });
  }

  function hasForwardFeasibility(position: number) {
    for (let remainingPosition = position; remainingPosition < requiredAssignments; remainingPosition += 1) {
      const dayIndex = Math.floor(remainingPosition / shiftOrder.length);
      const shiftKey = shiftOrder[remainingPosition % shiftOrder.length];
      if (schedule.days[dayIndex].assignments[shiftKey] === null && getCandidates(dayIndex, shiftKey).length === 0) {
        return false;
      }
    }

    return doctors.every((doctor) => {
      if (doctor.kind !== "dayOnly" || typeof doctor.targetDayShifts !== "number") return true;
      const remainingTarget = doctor.targetDayShifts - counts.get(doctor.id)!.day;
      if (remainingTarget < 0) return false;
      const remainingDayIndices = new Set<number>();
      for (let rp = position; rp < requiredAssignments; rp++) {
        const dIdx = Math.floor(rp / shiftOrder.length);
        const sk = shiftOrder[rp % shiftOrder.length];
        if (!isNight(sk) && canAssign(doctor, dIdx, sk)) remainingDayIndices.add(dIdx);
      }
      return remainingDayIndices.size >= remainingTarget;
    });
  }

  function search(position: number): boolean {
    if (position === requiredAssignments) {
      return targetsMet() && validateSchedule(schedule, doctors, { requireFilledPositions: true }).length === 0;
    }

    if (!hasForwardFeasibility(position)) return false;

    const dayIndex = Math.floor(position / shiftOrder.length);
    const shiftKey = shiftOrder[position % shiftOrder.length];

    for (const doctor of getCandidates(dayIndex, shiftKey)) {
      assign(doctor, dayIndex, shiftKey);
      if (search(position + 1)) return true;
      unassign(doctor, dayIndex, shiftKey);
    }

    return false;
  }

  if (search(0)) {
    return { ok: true, schedule };
  }

  return {
    ok: false,
    issues: [{
      type: "unsatisfiableConstraints",
      message: "现有约束无法满足全部排班需求"
    }],
    message: "现有约束无法满足全部排班需求"
  };
}
