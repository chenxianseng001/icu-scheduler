import { expect, it, vi } from "vitest";
import { createEmptySchedule } from "./rules";
import { sampleDoctors } from "./sampleData";
import { buildWorkbook, exportWorkbook } from "./exportExcel";
import type { AppState, ScheduleIssue } from "./types";

vi.mock("xlsx", async () => {
  const actual = await vi.importActual<typeof import("xlsx")>("xlsx");
  return {
    ...actual,
    writeFile: vi.fn()
  };
});

import * as XLSX from "xlsx";

const state: AppState = {
  doctors: sampleDoctors,
  schedule: createEmptySchedule()
};

it("creates date, doctor, and issue sheets when issues are present", () => {
  const issues: ScheduleIssue[] = [
    {
      type: "missingPosition",
      message: "周一 白1 缺少排班",
      dayIndex: 0,
      shiftKey: "day1"
    }
  ];

  const workbook = buildWorkbook(state, issues);

  expect(workbook.SheetNames).toEqual(["按日期查看", "按医生查看", "问题列表"]);
});

it("exports the workbook as ICU排班.xlsx", () => {
  exportWorkbook(state, []);

  expect(XLSX.writeFile).toHaveBeenCalledTimes(1);
  expect(XLSX.writeFile).toHaveBeenCalledWith(expect.anything(), "ICU排班.xlsx");
});
