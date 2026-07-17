export type DayIndex = 0 | 1 | 2 | 3 | 4 | 5 | 6;
export type DoctorKind = "normal" | "dayOnly";
export type ShiftKey = "day1" | "day2" | "night1" | "night2";
export type DoctorDayStatus = ShiftKey | "extraDay" | "extraNight" | "offAfterNight" | "rest";

export interface Doctor {
  id: string;
  name: string;
  kind: DoctorKind;
  unavailableDays: DayIndex[];
  targetDayShifts?: 2 | 3;
}

export interface DaySchedule {
  dayIndex: DayIndex;
  assignments: Record<ShiftKey, string | null>;
  extraDay: string[];
  extraNight: string[];
}

export interface WeeklySchedule {
  days: DaySchedule[];
}

export interface AppState {
  doctors: Doctor[];
  schedule: WeeklySchedule;
}

export interface WeekArchive {
  weekStart: string;
  doctors: Doctor[];
  schedule: WeeklySchedule;
  archivedAt: string;
}

export interface V2AppState {
  version: 2;
  doctors: Doctor[];
  schedule: WeeklySchedule;
  weekStart: string;
  archives: WeekArchive[];
}

export interface DoctorStats {
  doctorId: string;
  doctorName: string;
  kind: DoctorKind;
  day: number;
  night: number;
  total: number;
  offAfterNight: number;
  rest: number;
  weekCount: number;
}

export interface DoctorCounts {
  day: number;
  night: number;
  total: number;
}

export type ScheduleIssueType =
  | "missingPosition"
  | "sameDayMultipleAssignments"
  | "unavailableAssignment"
  | "nightRecoveryConflict"
  | "normalDoctorOverLimit"
  | "dayOnlyDoctorOnNight"
  | "dayOnlyTargetNotMet"
  | "insufficientCapacity"
  | "unsatisfiableConstraints";

export interface ScheduleIssue {
  type: ScheduleIssueType;
  message: string;
  doctorId?: string;
  dayIndex?: DayIndex;
  shiftKey?: ShiftKey;
}

export interface ScheduleValidationOptions {
  requireFilledPositions?: boolean;
}
