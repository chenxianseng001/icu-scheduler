import { createEmptySchedule, validateSchedule } from "./rules";
import type { Doctor, ScheduleIssue, ShiftKey, WeeklySchedule } from "./types";

export type SchedulerResult =
  | { ok: true; schedule: WeeklySchedule }
  | { ok: false; issues: ScheduleIssue[]; message: string };

const shiftOrder: ShiftKey[] = ["night1", "night2", "day1", "day2"];

interface DoctorShiftCounts {
  day: number;
  night: number;
  total: number;
}

function isNightShift(shiftKey: ShiftKey) {
  return shiftKey === "night1" || shiftKey === "night2";
}

function getCounts(doctors: Doctor[]) {
  return new Map<string, DoctorShiftCounts>(
    doctors.map((doctor) => [doctor.id, { day: 0, night: 0, total: 0 }])
  );
}

export function generateSchedule(doctors: Doctor[]): SchedulerResult {
  const schedule = createEmptySchedule();
  const counts = getCounts(doctors);
  const requiredAssignments = schedule.days.length * shiftOrder.length;

  const maximumAssignments = doctors.reduce((total, doctor) => {
    return total + (doctor.kind === "normal" ? 3 : doctor.targetDayShifts ?? 0);
  }, 0);

  if (maximumAssignments < requiredAssignments) {
    return {
      ok: false,
      issues: [
        {
          type: "insufficientCapacity",
          message: `医生总排班容量不足：最多可安排 ${maximumAssignments} 班，需安排 ${requiredAssignments} 班`
        }
      ],
      message: "医生总排班容量不足，无法生成合法排班"
    };
  }

  function canAssign(doctor: Doctor, dayIndex: number, shiftKey: ShiftKey) {
    const day = schedule.days[dayIndex];
    const doctorCounts = counts.get(doctor.id);
    if (!day || !doctorCounts || doctor.unavailableDays.includes(day.dayIndex)) {
      return false;
    }

    if (Object.values(day.assignments).includes(doctor.id)) {
      return false;
    }

    const previousDay = dayIndex > 0 ? schedule.days[dayIndex - 1] : undefined;
    if (
      previousDay &&
      (previousDay.assignments.night1 === doctor.id || previousDay.assignments.night2 === doctor.id)
    ) {
      return false;
    }

    if (doctor.kind === "dayOnly") {
      return !isNightShift(shiftKey) && doctorCounts.day < (doctor.targetDayShifts ?? 0);
    }

    if (doctorCounts.total >= 3) {
      return false;
    }

    return isNightShift(shiftKey) ? doctorCounts.night < 2 : doctorCounts.day < 2;
  }

  function getCandidates(dayIndex: number, shiftKey: ShiftKey) {
    return doctors
      .filter((doctor) => canAssign(doctor, dayIndex, shiftKey))
      .sort((left, right) => {
        const leftCounts = counts.get(left.id)!;
        const rightCounts = counts.get(right.id)!;
        const sameKindDifference = isNightShift(shiftKey)
          ? leftCounts.night - rightCounts.night
          : leftCounts.day - rightCounts.day;

        return (
          leftCounts.total - rightCounts.total ||
          sameKindDifference ||
          left.name.localeCompare(right.name) ||
          left.id.localeCompare(right.id)
        );
      });
  }

  function assign(doctor: Doctor, dayIndex: number, shiftKey: ShiftKey) {
    const doctorCounts = counts.get(doctor.id)!;
    schedule.days[dayIndex].assignments[shiftKey] = doctor.id;
    doctorCounts.total += 1;
    if (isNightShift(shiftKey)) {
      doctorCounts.night += 1;
    } else {
      doctorCounts.day += 1;
    }
  }

  function unassign(doctor: Doctor, dayIndex: number, shiftKey: ShiftKey) {
    const doctorCounts = counts.get(doctor.id)!;
    schedule.days[dayIndex].assignments[shiftKey] = null;
    doctorCounts.total -= 1;
    if (isNightShift(shiftKey)) {
      doctorCounts.night -= 1;
    } else {
      doctorCounts.day -= 1;
    }
  }

  function targetsMet() {
    return doctors.every((doctor) => {
      if (doctor.kind !== "dayOnly" || typeof doctor.targetDayShifts !== "number") {
        return true;
      }

      return counts.get(doctor.id)?.day === doctor.targetDayShifts;
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
      if (doctor.kind !== "dayOnly" || typeof doctor.targetDayShifts !== "number") {
        return true;
      }

      const remainingTarget = doctor.targetDayShifts - counts.get(doctor.id)!.day;
      if (remainingTarget < 0) {
        return false;
      }

      const remainingDayIndices = new Set<number>();
      for (let remainingPosition = position; remainingPosition < requiredAssignments; remainingPosition += 1) {
        const dayIndex = Math.floor(remainingPosition / shiftOrder.length);
        const shiftKey = shiftOrder[remainingPosition % shiftOrder.length];
        if (!isNightShift(shiftKey) && canAssign(doctor, dayIndex, shiftKey)) {
          remainingDayIndices.add(dayIndex);
        }
      }

      return remainingDayIndices.size >= remainingTarget;
    });
  }

  function search(position: number): boolean {
    if (position === requiredAssignments) {
      return targetsMet() && validateSchedule(schedule, doctors, { requireFilledPositions: true }).length === 0;
    }

    if (!hasForwardFeasibility(position)) {
      return false;
    }

    const dayIndex = Math.floor(position / shiftOrder.length);
    const shiftKey = shiftOrder[position % shiftOrder.length];

    for (const doctor of getCandidates(dayIndex, shiftKey)) {
      assign(doctor, dayIndex, shiftKey);
      if (search(position + 1)) {
        return true;
      }
      unassign(doctor, dayIndex, shiftKey);
    }

    return false;
  }

  if (search(0)) {
    return { ok: true, schedule };
  }

  return {
    ok: false,
    issues: [
      {
        type: "unsatisfiableConstraints",
        message: "现有可用日期、夜班后休息及班次限制无法满足全部排班需求"
      }
    ],
    message: "现有约束无法满足全部排班需求"
  };
}
