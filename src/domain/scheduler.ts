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
  const target = doctor.kind === "nightOnly" ? (doctor.targetNightShifts ?? 2) : 2;
  if (!previousWeek) return target;

  let prevNights = 0;
  for (const day of previousWeek.schedule.days) {
    for (const sk of nightShiftKeys) {
      if (day.assignments[sk] === doctor.id) prevNights++;
    }
    if (day.extraNight.includes(doctor.id)) prevNights++;
  }
  return prevNights >= target ? Math.max(1, target - 1) : target;
}

function hadSaturdayNight(doctorId: string, previousWeek?: WeekArchive): boolean {
  if (!previousWeek) return false;
  const sat = previousWeek.schedule.days[5];
  if (!sat) return false;
  return nightShiftKeys.some((sk) => sat.assignments[sk] === doctorId) ||
    sat.extraNight.includes(doctorId);
}

function hadWeekendShift(doctorId: string, previousWeek: WeekArchive): boolean {
  for (const dayIndex of [5, 6]) {
    const day = previousWeek.schedule.days[dayIndex];
    if (!day) continue;
    if (Object.values(day.assignments).some((v) => v === doctorId)) return true;
    if (day.extraDay.includes(doctorId) || day.extraNight.includes(doctorId)) return true;
  }
  return false;
}

function prevNightTier(doctorId: string, previousWeek: WeekArchive): "night1" | "night2" | null {
  for (const day of previousWeek.schedule.days) {
    if (day.assignments.night1 === doctorId) return "night1";
    if (day.assignments.night2 === doctorId) return "night2";
  }
  return null;
}

const SCHEDULER_TIMEOUT_MS = 15000;

export function generateSchedule(
  doctors: Doctor[],
  previousWeek?: WeekArchive
): SchedulerResult {
  const schedule = createEmptySchedule();
  const counts = getCounts(doctors);
  const requiredAssignments = schedule.days.length * shiftOrder.length;
  const deadline = Date.now() + SCHEDULER_TIMEOUT_MS;

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
    const isWeekend = dayIndex >= 5; // Saturday=5, Sunday=6

    let candidates = doctors.filter((doctor) => canAssign(doctor, dayIndex, shiftKey));

    // For day shifts: heavily prefer doctors with 0 nights, avoid those with 2 nights
    if (!isNightShift) {
      const withoutTwoNights = candidates.filter((d) => {
        const c = counts.get(d.id)!;
        return c.night < 2;
      });
      if (withoutTwoNights.length > 0) {
        candidates = withoutTwoNights;
      }
    }

    return candidates.sort((left, right) => {
      const leftCounts = counts.get(left.id)!;
      const rightCounts = counts.get(right.id)!;

      // Weekend rotation: deprioritize doctors who worked weekend last week
      if (isWeekend && previousWeek) {
        const leftHadWeekend = hadWeekendShift(left.id, previousWeek);
        const rightHadWeekend = hadWeekendShift(right.id, previousWeek);
        if (leftHadWeekend !== rightHadWeekend) {
          return leftHadWeekend ? 1 : -1;
        }
      }

      // Night tier fairness: balance night1/night2
      if (isNightShift && shiftKey === "night2") {
        // Prefer doctors who already have night1 (balanced)
        const leftHasNight1 = leftCounts.night > 0;
        const rightHasNight1 = rightCounts.night > 0;
        if (leftHasNight1 !== rightHasNight1) return leftHasNight1 ? -1 : 1;
      }
      if (isNightShift && shiftKey === "night1") {
        // Prefer doctors who don't have night2 yet
        // (night2 hasn't been assigned yet for most positions, so this is a cross-week concern)
        if (previousWeek) {
          const leftPrevTier = prevNightTier(left.id, previousWeek);
          const rightPrevTier = prevNightTier(right.id, previousWeek);
          // If someone had night1 last week, prefer them for night2 this week (not night1 again)
          const leftPrefer = leftPrevTier === "night1" ? 1 : 0;
          const rightPrefer = rightPrevTier === "night1" ? 1 : 0;
          if (leftPrefer !== rightPrefer) return leftPrefer - rightPrefer;
        }
      }

      // Preference matching
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

  function balanceNightTiers() {
    const normals = doctors.filter((d) => d.kind === "normal");
    for (const doctor of normals) {
      let n1Days: number[] = [];
      let n2Days: number[] = [];
      for (let d = 0; d < 7; d++) {
        if (schedule.days[d].assignments.night1 === doctor.id) n1Days.push(d);
        if (schedule.days[d].assignments.night2 === doctor.id) n2Days.push(d);
      }
      // If this doctor has 2 night1 and 0 night2
      if (n1Days.length >= 2 && n2Days.length === 0) {
        // Find another normal with 0 night1 and ≥1 night2
        for (const other of normals) {
          if (other.id === doctor.id) continue;
          let oN1: number[] = [];
          let oN2: number[] = [];
          for (let d = 0; d < 7; d++) {
            if (schedule.days[d].assignments.night1 === other.id) oN1.push(d);
            if (schedule.days[d].assignments.night2 === other.id) oN2.push(d);
          }
          if (oN1.length === 0 && oN2.length >= 1) {
            // Try swap: move doctor's night1 to other, other's night2 to doctor
            for (const n1Day of n1Days) {
              for (const n2Day of oN2) {
                // Check if swap would be valid (different days, both free on the other shift)
                if (n1Day === n2Day) continue;
                if (schedule.days[n1Day].assignments.night2 !== null) continue;
                if (schedule.days[n2Day].assignments.night1 !== null) continue;
                // Check that neither would have 2 of same shift after swap
                // Execute swap
                schedule.days[n1Day].assignments.night1 = other.id;
                schedule.days[n1Day].assignments.night2 = doctor.id;
                schedule.days[n2Day].assignments.night1 = doctor.id;
                schedule.days[n2Day].assignments.night2 = other.id;
                return; // One swap is enough
              }
            }
          }
        }
      }
    }
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
    if (Date.now() > deadline) return false;

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
    balanceNightTiers();
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
