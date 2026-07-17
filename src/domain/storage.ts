import { createEmptySchedule } from "./rules";
import { sampleDoctors } from "./sampleData";
import type { AppState, Doctor, V2AppState, WeekArchive, WeeklySchedule } from "./types";

const STORAGE_KEY_V2 = "icu-scheduler-state-v2";
const STORAGE_KEY_V1 = "icu-scheduler-state-v1";

function getMondayOfWeek(date: Date): string {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  d.setDate(diff);
  return d.toISOString().slice(0, 10);
}

function createDefaultDoctors(): Doctor[] {
  return sampleDoctors.map((doctor) => ({
    ...doctor,
    unavailableDays: [...doctor.unavailableDays]
  }));
}

function createDefaultState(): V2AppState {
  return {
    version: 2,
    doctors: createDefaultDoctors(),
    schedule: createEmptySchedule(),
    weekStart: getMondayOfWeek(new Date()),
    archives: []
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
  if (!isObject(value)) return false;
  if (typeof value.id !== "string" || typeof value.name !== "string" || typeof value.kind !== "string") return false;
  if (value.kind !== "normal" && value.kind !== "dayOnly") return false;
  if (!Array.isArray(value.unavailableDays) || !value.unavailableDays.every((day) => Number.isInteger(day) && day >= 0 && day <= 6)) return false;
  if (value.kind === "dayOnly" && value.targetDayShifts !== undefined && value.targetDayShifts !== 2 && value.targetDayShifts !== 3) return false;
  return true;
}

function isSchedule(value: unknown): value is WeeklySchedule {
  if (!isObject(value) || !Array.isArray(value.days) || value.days.length !== 7) return false;
  return value.days.every((day, dayIndex) => {
    if (!isObject(day) || day.dayIndex !== dayIndex || !isObject(day.assignments)) return false;
    const assignments = day.assignments as Record<string, unknown>;
    return ["day1", "day2", "night1", "night2"].every((shiftKey) => {
      const assignment = assignments[shiftKey];
      return assignment === null || typeof assignment === "string";
    });
  });
}

function isV1State(value: unknown): value is AppState {
  if (!isObject(value)) return false;
  if (!Array.isArray(value.doctors)) return false;
  if (!isSchedule(value.schedule)) return false;
  return value.doctors.every(isDoctor);
}

function isArchive(value: unknown): value is WeekArchive {
  if (!isObject(value)) return false;
  if (typeof value.weekStart !== "string") return false;
  if (typeof value.archivedAt !== "string") return false;
  if (!Array.isArray(value.doctors) || !value.doctors.every(isDoctor)) return false;
  return isSchedule(value.schedule);
}

function isValidV2State(value: unknown): value is V2AppState {
  if (!isObject(value)) return false;
  if (value.version !== 2) return false;
  if (!Array.isArray(value.doctors) || !value.doctors.every(isDoctor)) return false;
  if (!isSchedule(value.schedule)) return false;
  if (typeof value.weekStart !== "string") return false;
  if (!Array.isArray(value.archives) || !value.archives.every(isArchive)) return false;
  return true;
}

function migrateV1ToV2(v1State: AppState): V2AppState {
  return {
    version: 2,
    doctors: v1State.doctors,
    schedule: v1State.schedule,
    weekStart: getMondayOfWeek(new Date()),
    archives: []
  };
}

function cloneDoctor(doctor: Doctor): Doctor {
  return { ...doctor, unavailableDays: [...doctor.unavailableDays] };
}

export function loadState(): V2AppState {
  const storage = getStorage();
  if (!storage) return createDefaultState();

  try {
    const raw = storage.getItem(STORAGE_KEY_V2);
    if (raw) {
      const parsed: unknown = JSON.parse(raw);
      if (isValidV2State(parsed)) {
        return {
          ...parsed,
          doctors: parsed.doctors.map(cloneDoctor)
        };
      }
    }
  } catch {
    /* fall through to v1 */
  }

  try {
    const raw = storage.getItem(STORAGE_KEY_V1);
    if (raw) {
      const parsed: unknown = JSON.parse(raw);
      if (isV1State(parsed)) {
        const v2State = migrateV1ToV2(parsed);
        try {
          storage.setItem(STORAGE_KEY_V2, JSON.stringify(v2State));
          storage.removeItem(STORAGE_KEY_V1);
        } catch {
          /* best effort */
        }
        return v2State;
      }
    }
  } catch {
    /* fall through to default */
  }

  return createDefaultState();
}

export function saveState(state: V2AppState): void {
  const storage = getStorage();
  if (!storage) return;
  try {
    storage.setItem(STORAGE_KEY_V2, JSON.stringify(state));
  } catch {
    /* fail silently */
  }
}

export function archiveCurrentWeek(state: V2AppState): V2AppState {
  const archive: WeekArchive = {
    weekStart: state.weekStart,
    doctors: state.doctors.map(cloneDoctor),
    schedule: state.schedule,
    archivedAt: new Date().toISOString()
  };

  return {
    ...state,
    schedule: createEmptySchedule(),
    weekStart: getMondayOfWeek(new Date()),
    archives: [...state.archives, archive]
  };
}

export function loadArchives(): WeekArchive[] {
  const state = loadState();
  return state.archives;
}
