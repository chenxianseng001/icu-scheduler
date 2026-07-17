import { createEmptySchedule } from "./rules";
import { sampleDoctors } from "./sampleData";
import type { Doctor, V2AppState, WeekArchive } from "./types";

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

export function createDefaultState(): V2AppState {
  return {
    version: 2,
    doctors: createDefaultDoctors(),
    schedule: createEmptySchedule(),
    weekStart: getMondayOfWeek(new Date()),
    archives: []
  };
}

function cloneDoctor(doctor: Doctor): Doctor {
  return { ...doctor, unavailableDays: [...doctor.unavailableDays] };
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isDoctor(value: unknown): value is Doctor {
  if (!isObject(value)) return false;
  if (typeof value.id !== "string" || typeof value.name !== "string" || typeof value.kind !== "string") return false;
  if (value.kind !== "normal" && value.kind !== "dayOnly") return false;
  if (!Array.isArray(value.unavailableDays) || !value.unavailableDays.every((day: unknown) => typeof day === "number" && day >= 0 && day <= 6)) return false;
  if (value.kind === "dayOnly" && value.targetDayShifts !== undefined && value.targetDayShifts !== 2 && value.targetDayShifts !== 3) return false;
  return true;
}

function isSchedule(value: unknown): boolean {
  if (!isObject(value) || !Array.isArray(value.days) || value.days.length !== 7) return false;
  return (value.days as unknown[]).every((day: unknown, dayIndex: number) => {
    if (!isObject(day) || (day as Record<string, unknown>).dayIndex !== dayIndex || !isObject((day as Record<string, unknown>).assignments)) return false;
    const assignments = (day as Record<string, unknown>).assignments as Record<string, unknown>;
    return ["day1", "day2", "night1", "night2"].every((shiftKey) => {
      const assignment = assignments[shiftKey];
      return assignment === null || typeof assignment === "string";
    });
  });
}

function isArchive(value: unknown): boolean {
  if (!isObject(value)) return false;
  if (typeof (value as Record<string, unknown>).weekStart !== "string") return false;
  if (typeof (value as Record<string, unknown>).archivedAt !== "string") return false;
  if (!Array.isArray((value as Record<string, unknown>).doctors) || !((value as Record<string, unknown>).doctors as unknown[]).every(isDoctor)) return false;
  return isSchedule((value as Record<string, unknown>).schedule);
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

export async function loadState(): Promise<V2AppState> {
  try {
    const response = await fetch("/api/load");
    if (response.status === 204) return createDefaultState();
    if (!response.ok) return createDefaultState();
    const parsed: unknown = await response.json();
    if (isValidV2State(parsed)) {
      return {
        ...parsed,
        doctors: parsed.doctors.map(cloneDoctor)
      };
    }
    return createDefaultState();
  } catch {
    return createDefaultState();
  }
}

export async function saveState(state: V2AppState): Promise<void> {
  try {
    await fetch("/api/save", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(state)
    });
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
