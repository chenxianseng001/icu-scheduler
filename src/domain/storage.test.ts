import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { createEmptySchedule } from "./rules";
import { sampleDoctors } from "./sampleData";
import { archiveCurrentWeek, loadState, saveState } from "./storage";
import type { V2AppState } from "./types";

beforeEach(() => {
  localStorage.clear();
});

afterEach(() => {
  vi.restoreAllMocks();
});

it("returns default state when localStorage is missing", () => {
  const state = loadState();
  expect(state.version).toBe(2);
  expect(state.doctors).toHaveLength(14);
  expect(state.schedule).toEqual(createEmptySchedule());
  expect(state.archives).toEqual([]);
  expect(typeof state.weekStart).toBe("string");
});

it("loads a saved state", () => {
  const state: V2AppState = {
    version: 2,
    doctors: sampleDoctors,
    schedule: createEmptySchedule(),
    weekStart: "2026-07-06",
    archives: []
  };
  state.schedule.days[0].assignments.day1 = "a";
  saveState(state);
  expect(loadState()).toEqual(state);
});

it("archives current week and creates a new empty week", () => {
  const state: V2AppState = {
    version: 2,
    doctors: sampleDoctors,
    schedule: createEmptySchedule(),
    weekStart: "2026-07-06",
    archives: []
  };
  state.schedule.days[0].assignments.day1 = "a";
  state.schedule.days[3].assignments.night2 = "zhong";

  const newState = archiveCurrentWeek(state);

  expect(newState.archives).toHaveLength(1);
  expect(newState.archives[0].weekStart).toBe("2026-07-06");
  expect(newState.archives[0].schedule.days[0].assignments.day1).toBe("a");
  expect(newState.weekStart).not.toBe("2026-07-06");
  expect(newState.schedule).toEqual(createEmptySchedule());
});

it("migrates v1 data to v2 format", () => {
  const v1Data = JSON.stringify({
    doctors: sampleDoctors.slice(0, 10),
    schedule: createEmptySchedule()
  });
  localStorage.setItem("icu-scheduler-state-v1", v1Data);

  const state = loadState();

  expect(state.version).toBe(2);
  expect(state.archives).toEqual([]);
  expect(typeof state.weekStart).toBe("string");
});

it("falls back to default state when localStorage.getItem throws", () => {
  vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
    throw new Error("boom");
  });

  const state = loadState();
  expect(state.doctors).toHaveLength(14);
});

it("does not throw when localStorage.setItem throws", () => {
  vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
    throw new Error("boom");
  });

  expect(() =>
    saveState({
      version: 2,
      doctors: sampleDoctors,
      schedule: createEmptySchedule(),
      weekStart: "2026-07-06",
      archives: []
    })
  ).not.toThrow();
});
