import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { createEmptySchedule } from "./rules";
import { sampleDoctors } from "./sampleData";
import { loadAppState, saveAppState } from "./storage";
import type { AppState } from "./types";

beforeEach(() => {
  localStorage.clear();
});

afterEach(() => {
  vi.restoreAllMocks();
});

it("returns sample data and an empty schedule when localStorage is missing", () => {
  const state = loadAppState();

  expect(state.doctors).toEqual(sampleDoctors);
  expect(state.schedule).toEqual(createEmptySchedule());
});

it("loads a saved state with the same doctors and assignments", () => {
  const state: AppState = {
    doctors: sampleDoctors,
    schedule: createEmptySchedule()
  };
  state.schedule.days[0].assignments.day1 = "a";
  state.schedule.days[3].assignments.night2 = "zhong";

  saveAppState(state);

  expect(loadAppState()).toEqual(state);
});

it("falls back to default state when localStorage.getItem throws", () => {
  vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
    throw new Error("boom");
  });

  const state = loadAppState();

  expect(state.doctors).toEqual(sampleDoctors);
  expect(state.schedule).toEqual(createEmptySchedule());
});

it("does not throw when localStorage.setItem throws", () => {
  vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
    throw new Error("boom");
  });

  expect(() =>
    saveAppState({
      doctors: sampleDoctors,
      schedule: createEmptySchedule()
    })
  ).not.toThrow();
});
