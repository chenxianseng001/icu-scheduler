import type {
  DayIndex,
  Doctor,
  DoctorCounts,
  DoctorDayStatus,
  ScheduleIssue,
  ScheduleValidationOptions,
  ShiftKey,
  WeeklySchedule
} from "./types";

export const shiftLabels = {
  day1: "白1",
  day2: "白2",
  night1: "夜1",
  night2: "夜2"
} as const;

export const dayLabels = ["周一", "周二", "周三", "周四", "周五", "周六", "周日"] as const;

const shiftKeys: ShiftKey[] = ["day1", "day2", "night1", "night2"];
const dayShiftKeys: ShiftKey[] = ["day1", "day2"];
const nightShiftKeys: ShiftKey[] = ["night1", "night2"];

const MAX_NORMAL_TOTAL_SHIFTS = 3;
const MAX_NORMAL_DAY_SHIFTS = 2;
const MAX_NORMAL_NIGHT_SHIFTS = 2;

function createEmptyAssignments() {
  return {
    day1: null,
    day2: null,
    night1: null,
    night2: null
  } as const;
}

function getDoctorById(doctors: Doctor[], doctorId: string) {
  return doctors.find((doctor) => doctor.id === doctorId);
}

function isNightShift(shiftKey: ShiftKey) {
  return shiftKey === "night1" || shiftKey === "night2";
}

export function createEmptySchedule(): WeeklySchedule {
  return {
    days: Array.from({ length: 7 }, (_, dayIndex) => ({
      dayIndex: dayIndex as DayIndex,
      assignments: { ...createEmptyAssignments() },
      extraDay: [] as string[],
      extraNight: [] as string[]
    }))
  };
}

export function getDoctorCounts(schedule: WeeklySchedule, doctorId: string): DoctorCounts {
  let day = 0;
  let night = 0;

  for (const scheduleDay of schedule.days) {
    for (const shiftKey of shiftKeys) {
      if (scheduleDay.assignments[shiftKey] !== doctorId) {
        continue;
      }

      if (isNightShift(shiftKey)) {
        night += 1;
      } else {
        day += 1;
      }
    }

    if (scheduleDay.extraDay.includes(doctorId)) day += 1;
    if (scheduleDay.extraNight.includes(doctorId)) night += 1;
  }

  return {
    day,
    night,
    total: day + night
  };
}

export function getDoctorDayStatus(
  schedule: WeeklySchedule,
  doctorId: string,
  day: DayIndex
): DoctorDayStatus {
  const scheduleDay = schedule.days[day];
  if (!scheduleDay) {
    return "rest";
  }

  for (const shiftKey of shiftKeys) {
    if (scheduleDay.assignments[shiftKey] === doctorId) {
      return shiftKey;
    }
  }

  if (scheduleDay.extraDay.includes(doctorId)) return "extraDay";
  if (scheduleDay.extraNight.includes(doctorId)) return "extraNight";

  if (day > 0) {
    const previousDay = schedule.days[day - 1];
    if (
      previousDay &&
      (nightShiftKeys.some((shiftKey) => previousDay.assignments[shiftKey] === doctorId) ||
       previousDay.extraNight.includes(doctorId))
    ) {
      return "offAfterNight";
    }
  }

  return "rest";
}

export function validateSchedule(
  schedule: WeeklySchedule,
  doctors: Doctor[],
  options: ScheduleValidationOptions
): ScheduleIssue[] {
  const issues: ScheduleIssue[] = [];

  for (const daySchedule of schedule.days) {
    for (const shiftKey of shiftKeys) {
      const doctorId = daySchedule.assignments[shiftKey];

      if (!doctorId) {
        if (options.requireFilledPositions) {
          issues.push({
            type: "missingPosition",
            message: `${dayLabels[daySchedule.dayIndex]} ${shiftLabels[shiftKey]} 缺少排班`,
            dayIndex: daySchedule.dayIndex,
            shiftKey
          });
        }
        continue;
      }

      const doctor = getDoctorById(doctors, doctorId);
      if (!doctor) {
        continue;
      }

      if (doctor.kind === "dayOnly" && isNightShift(shiftKey)) {
        issues.push({
          type: "dayOnlyDoctorOnNight",
          message: `${doctor.name} 不能排夜班`,
          doctorId,
          dayIndex: daySchedule.dayIndex,
          shiftKey
        });
      }

      if (doctor.unavailableDays.includes(daySchedule.dayIndex)) {
        issues.push({
          type: "unavailableAssignment",
          message: `${doctor.name} 在 ${dayLabels[daySchedule.dayIndex]} 不可排班`,
          doctorId,
          dayIndex: daySchedule.dayIndex,
          shiftKey
        });
      }

      if (doctor.kind === "nightOnly" && !isNightShift(shiftKey)) {
        issues.push({
          type: "dayOnlyDoctorOnNight",
          message: `${doctor.name} 不能排白班`,
          doctorId,
          dayIndex: daySchedule.dayIndex,
          shiftKey
        });
      }

      if (isNightShift(shiftKey)) {
        // Check night spacing: ≥4 days between nights
        for (let prev = daySchedule.dayIndex - 1; prev >= Math.max(0, daySchedule.dayIndex - 4); prev--) {
          const prevDay = schedule.days[prev];
          if (!prevDay) continue;
          if (nightShiftKeys.some((sk) => prevDay.assignments[sk] === doctorId) ||
              prevDay.extraNight.includes(doctorId)) {
            issues.push({
              type: "nightRecoveryConflict",
              message: `${doctor.name} 夜班间隔不足 4 天`,
              doctorId,
              dayIndex: daySchedule.dayIndex
            });
            break;
          }
        }

        // Check day→night adjacency
        if (daySchedule.dayIndex > 0) {
          const prevDay = schedule.days[daySchedule.dayIndex - 1];
          if (prevDay && (dayShiftKeys.some((sk) => prevDay.assignments[sk] === doctorId) ||
              prevDay.extraDay.includes(doctorId))) {
            issues.push({
              type: "nightRecoveryConflict",
              message: `${doctor.name} 白班与夜班相邻`,
              doctorId,
              dayIndex: daySchedule.dayIndex
            });
          }
        }
      }
    }
  }

  for (const daySchedule of schedule.days) {
    const assignedDoctorsByShift = new Map<string, ShiftKey[]>();

    for (const shiftKey of shiftKeys) {
      const doctorId = daySchedule.assignments[shiftKey];
      if (!doctorId) {
        continue;
      }

      const currentShifts = assignedDoctorsByShift.get(doctorId) ?? [];
      currentShifts.push(shiftKey);
      assignedDoctorsByShift.set(doctorId, currentShifts);
    }

    for (const [doctorId, doctorShifts] of assignedDoctorsByShift.entries()) {
      if (doctorShifts.length <= 1) {
        continue;
      }

      const doctor = getDoctorById(doctors, doctorId);
      const doctorName = doctor?.name ?? doctorId;
      issues.push({
        type: "sameDayMultipleAssignments",
        message: `${doctorName} 在 ${dayLabels[daySchedule.dayIndex]} 被安排了多个班次`,
        doctorId,
        dayIndex: daySchedule.dayIndex
      });
    }
  }

  for (const doctor of doctors) {
    const counts = getDoctorCounts(schedule, doctor.id);

    for (const daySchedule of schedule.days) {
      const status = getDoctorDayStatus(schedule, doctor.id, daySchedule.dayIndex);
      if (status === "rest" || status === "offAfterNight") {
        continue;
      }

      const previousDay = daySchedule.dayIndex > 0 ? schedule.days[daySchedule.dayIndex - 1] : undefined;
      if (
        previousDay &&
        nightShiftKeys.some((shiftKey) => previousDay.assignments[shiftKey] === doctor.id)
      ) {
        issues.push({
          type: "nightRecoveryConflict",
          message: `${doctor.name} 在夜班后次日仍有排班`,
          doctorId: doctor.id,
          dayIndex: daySchedule.dayIndex
        });
      }
    }

    if (doctor.kind === "normal") {
      if (counts.total > MAX_NORMAL_TOTAL_SHIFTS) {
        issues.push({
          type: "normalDoctorOverLimit",
          message: `${doctor.name} 总班次数超过 ${MAX_NORMAL_TOTAL_SHIFTS}`,
          doctorId: doctor.id
        });
      }

      if (counts.day > MAX_NORMAL_DAY_SHIFTS) {
        issues.push({
          type: "normalDoctorOverLimit",
          message: `${doctor.name} 白班次数超过 ${MAX_NORMAL_DAY_SHIFTS}`,
          doctorId: doctor.id
        });
      }

      if (counts.night > MAX_NORMAL_NIGHT_SHIFTS) {
        issues.push({
          type: "normalDoctorOverLimit",
          message: `${doctor.name} 夜班次数超过 ${MAX_NORMAL_NIGHT_SHIFTS}`,
          doctorId: doctor.id
        });
      }
    }

    if (doctor.kind === "dayOnly" && typeof doctor.targetDayShifts === "number") {
      if (counts.day !== doctor.targetDayShifts) {
        issues.push({
          type: "dayOnlyTargetNotMet",
          message: `${doctor.name} 白班目标为 ${doctor.targetDayShifts}，当前为 ${counts.day}`,
          doctorId: doctor.id
        });
      }
    }
  }

  // H6: normal doctors with 2 night shifts must have one night1 + one night2
  for (const doctor of doctors) {
    if (doctor.kind !== "normal") continue;
    const counts = getDoctorCounts(schedule, doctor.id);
    if (counts.night < 2) continue;
    let n1 = 0, n2 = 0;
    for (const day of schedule.days) {
      if (day.assignments.night1 === doctor.id) n1++;
      if (day.assignments.night2 === doctor.id) n2++;
    }
    if (n1 >= 2 || n2 >= 2) {
      issues.push({
        type: "imbalancedNightTiers",
        message: `${doctor.name} 两个夜班应为夜1+夜2，当前夜1×${n1} 夜2×${n2}`,
        doctorId: doctor.id
      });
    }
  }

  // nightOnly target validation
  for (const doctor of doctors) {
    if (doctor.kind !== "nightOnly" || typeof doctor.targetNightShifts !== "number") continue;
    const counts = getDoctorCounts(schedule, doctor.id);
    if (counts.night !== doctor.targetNightShifts) {
      issues.push({
        type: "nightOnlyTargetNotMet",
        message: `${doctor.name} 夜班目标为 ${doctor.targetNightShifts}，当前为 ${counts.night}`,
        doctorId: doctor.id
      });
    }
  }

  return issues;
}
