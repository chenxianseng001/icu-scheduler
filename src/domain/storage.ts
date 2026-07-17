import { createEmptySchedule } from "./rules";
import { sampleDoctors } from "./sampleData";
import type { AppState, DayIndex, Doctor, ShiftKey, WeeklySchedule } from "./types";

const STORAGE_KEY = "icu-scheduler-state-v1";

function createDefaultDoctors(): Doctor[] {
  return sampleDoctors.map((doctor) => ({
    ...doctor,
    unavailableDays: [...doctor.unavailableDays]
  }));
}

function createDefaultState(): AppState {
  return {
    doctors: createDefaultDoctors(),
    schedule: createEmptySchedule()
  };
}

function getStorage() {
  try {
    return localStorage;
  } catch {
    return undefined;
  }
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isDoctor(value: unknown): value is Doctor {
  if (!isObject(value)) {
    return false;
  }

  if (typeof value.id !== "string" || typeof value.name !== "string" || typeof value.kind !== "string") {
    return false;
  }

  if (value.kind !== "normal" && value.kind !== "dayOnly") {
    return false;
  }

  if (!Array.isArray(value.unavailableDays) || !value.unavailableDays.every((day) => Number.isInteger(day) && day >= 0 && day <= 6)) {
    return false;
  }

  if (value.kind === "dayOnly" && value.targetDayShifts !== undefined && value.targetDayShifts !== 2 && value.targetDayShifts !== 3) {
    return false;
  }

  return true;
}

function isSchedule(value: unknown): value is WeeklySchedule {
  if (!isObject(value) || !Array.isArray(value.days) || value.days.length !== 7) {
    return false;
  }

  return value.days.every((day, dayIndex) => {
    if (!isObject(day) || day.dayIndex !== dayIndex || !isObject(day.assignments)) {
      return false;
    }

    const assignments = day.assignments as Record<string, unknown>;
    return ["day1", "day2", "night1", "night2"].every((shiftKey) => {
      const assignment = assignments[shiftKey];
      return assignment === null || typeof assignment === "string";
    });
  });
}

function cloneDoctor(doctor: Doctor): Doctor {
  return {
    ...doctor,
    unavailableDays: [...doctor.unavailableDays]
  };
}

export function loadAppState(): AppState {
  const storage = getStorage();
  if (!storage) {
    return createDefaultState();
  }

  const raw = storage.getItem(STORAGE_KEY);
  if (!raw) {
    return createDefaultState();
  }

  try {
    const parsed: unknown = JSON.parse(raw);
    if (!isObject(parsed) || !Array.isArray(parsed.doctors) || !isSchedule(parsed.schedule)) {
      return createDefaultState();
    }

    const doctors = parsed.doctors.every(isDoctor) ? parsed.doctors.map(cloneDoctor) : undefined;
    if (!doctors) {
      return createDefaultState();
    }

    return {
      doctors,
      schedule: parsed.schedule
    };
  } catch {
    return createDefaultState();
  }
}

export function saveAppState(state: AppState): void {
  const storage = getStorage();
  if (!storage) {
    return;
  }

  storage.setItem(STORAGE_KEY, JSON.stringify(state));
}
