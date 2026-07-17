import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { createEmptySchedule } from "./rules";
import { sampleDoctors } from "./sampleData";
import { archiveCurrentWeek, loadState, saveState } from "./storage";
import type { V2AppState } from "./types";

beforeEach(() => {
  vi.stubGlobal("fetch", vi.fn());
});

afterEach(() => {
  vi.restoreAllMocks();
});

function mockFetchResponse(status: number, body?: unknown) {
  (fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
    status,
    ok: status >= 200 && status < 300,
    json: async () => body
    // saveState doesn't call .json(), but loadState does
  });
}

it("returns default state when server returns 204", async () => {
  mockFetchResponse(204);
  const state = await loadState();
  expect(state.version).toBe(2);
  expect(state.doctors).toHaveLength(15);
  expect(state.schedule).toEqual(createEmptySchedule());
  expect(state.archives).toEqual([]);
});

it("loads data from server", async () => {
  const saved: V2AppState = {
    version: 2,
    doctors: sampleDoctors,
    schedule: createEmptySchedule(),
    weekStart: "2026-07-06",
    archives: []
  };
  saved.schedule.days[0].assignments.day1 = "a";

  mockFetchResponse(200, saved);
  const state = await loadState();
  expect(state.schedule.days[0].assignments.day1).toBe("a");
});

it("sends POST to save data", async () => {
  mockFetchResponse(200);
  const state: V2AppState = {
    version: 2,
    doctors: sampleDoctors,
    schedule: createEmptySchedule(),
    weekStart: "2026-07-06",
    archives: []
  };
  await saveState(state);

  expect(fetch).toHaveBeenCalledWith("/api/save", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(state)
  });
});

it("archiveCurrentWeek is pure (no I/O)", () => {
  const state: V2AppState = {
    version: 2,
    doctors: sampleDoctors,
    schedule: createEmptySchedule(),
    weekStart: "2026-07-06",
    archives: []
  };
  state.schedule.days[0].assignments.day1 = "a";

  const newState = archiveCurrentWeek(state);
  expect(newState.archives).toHaveLength(1);
  expect(newState.archives[0].weekStart).toBe("2026-07-06");
  expect(newState.archives[0].doctors).toEqual(sampleDoctors);
  expect(newState.weekStart).not.toBe("2026-07-06");
  expect(newState.schedule).toEqual(createEmptySchedule());
});

it("falls back to default when fetch throws", async () => {
  (fetch as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error("network error"));
  const state = await loadState();
  expect(state.doctors).toHaveLength(15);
});

it("does not throw when save fetch throws", async () => {
  (fetch as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error("network error"));
  await expect(saveState({
    version: 2,
    doctors: sampleDoctors,
    schedule: createEmptySchedule(),
    weekStart: "2026-07-06",
    archives: []
  })).resolves.not.toThrow();
});
