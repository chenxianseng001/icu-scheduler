import React from "react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import App from "./App";
import { createEmptySchedule } from "./domain/rules";
import { sampleDoctors } from "./domain/sampleData";
import type { V2AppState } from "./domain/types";

function defaultState(): V2AppState {
  return {
    version: 2,
    doctors: sampleDoctors,
    schedule: createEmptySchedule(),
    weekStart: "2026-07-13",
    archives: []
  };
}

beforeEach(() => {
  const fetchMock = vi.fn().mockResolvedValue({
    status: 200,
    ok: true,
    json: async () => defaultState()
  });
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.restoreAllMocks();
});

it("renders the scheduler title", async () => {
  render(<App />);
  await waitFor(() => {
    expect(screen.getByText("ICU 排班系统")).toBeInTheDocument();
  });
});

it("renders the main scheduler controls and grid", async () => {
  render(<App />);

  await waitFor(() => {
    expect(screen.getByRole("button", { name: "自动排班" })).toBeInTheDocument();
  });

  expect(screen.getByRole("button", { name: "导出 Excel" })).toBeInTheDocument();
  expect(screen.getByText("白1")).toBeInTheDocument();
  expect(screen.getByText("白2")).toBeInTheDocument();
  expect(screen.getByText("夜1")).toBeInTheDocument();
  expect(screen.getByText("夜2")).toBeInTheDocument();
  expect(screen.getByDisplayValue("钟医生")).toBeInTheDocument();
});

it("allows editing doctor names", async () => {
  const user = userEvent.setup();
  render(<App />);

  await waitFor(() => {
    expect(screen.getByDisplayValue("王医生")).toBeInTheDocument();
  });

  const nameInput = screen.getByDisplayValue("王医生");
  await user.clear(nameInput);
  await user.type(nameInput, "测试医生");

  expect(screen.getByDisplayValue("测试医生")).toBeInTheDocument();
  expect(screen.queryByDisplayValue("王医生")).not.toBeInTheDocument();
});

it("allows clearing one assigned shift without clearing the whole week", async () => {
  const user = userEvent.setup();
  render(<App />);

  await waitFor(() => {
    expect(screen.getByDisplayValue("王医生")).toBeInTheDocument();
  });

  await user.click(screen.getByDisplayValue("王医生"));
  await user.click(screen.getAllByRole("button", { name: "缺人" })[0]);

  expect(screen.getByRole("button", { name: "王医生" })).toBeInTheDocument();

  await user.click(screen.getByRole("button", { name: "清除 周一 白1 王医生" }));

  expect(screen.getAllByRole("button", { name: "缺人" })[0]).toBeInTheDocument();
});
