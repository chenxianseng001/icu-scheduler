# ICU Scheduler Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the first version of a local ICU weekly scheduling web app that supports doctor setup, weekly constraints, automatic scheduling, manual drag adjustment, rule checking, and Excel export.

**Architecture:** Use a React + TypeScript + Vite single-page app. Keep scheduling rules in pure TypeScript domain modules so they can be tested without the UI, then make the UI consume those domain functions. Persist the current app state in browser localStorage and export Excel from the client.

**Tech Stack:** Vite, React, TypeScript, Vitest, Testing Library, @dnd-kit/core, xlsx, localStorage.

## Global Constraints

- First version is a local web app; no login, cloud sync, or network backend.
- The app opens directly to the weekly scheduling page.
- Each day requires exactly four positions: 白1, 白2, 夜1, 夜2.
- 夜1 or 夜2 automatically makes the next day 出 for that doctor.
- 休 is derived when the doctor has no shift and is not 出.
- 普通医生: max 3 total shifts, max 2 day shifts, max 2 night shifts.
- 特殊白班医生: day shifts only, weekly target is 2 or 3 day shifts.
- First version supports weekly unavailable-date checkboxes only, not natural language rules.
- Manual drag is allowed to create rule violations; violations must be shown clearly.
- Automatic scheduling should generate only legal schedules or explain that it cannot.
- Excel export includes date view and doctor view; if problems remain, export must include a problem list sheet.
- The current folder is not a git repository as of planning time; commit steps should be skipped unless a repository is initialized before implementation.

---

## File Structure

- `package.json`: project scripts and dependencies.
- `index.html`: Vite entry HTML.
- `tsconfig.json`, `tsconfig.node.json`, `vite.config.ts`, `vitest.config.ts`: TypeScript, Vite, and test configuration.
- `src/main.tsx`: React entrypoint.
- `src/App.tsx`: top-level app shell and state orchestration.
- `src/App.css`: layout and visual states.
- `src/domain/types.ts`: shared scheduling types.
- `src/domain/sampleData.ts`: starter doctors for development.
- `src/domain/rules.ts`: derived status, counts, and issue detection.
- `src/domain/scheduler.ts`: automatic schedule generation.
- `src/domain/storage.ts`: localStorage load/save helpers.
- `src/domain/exportExcel.ts`: Excel workbook generation.
- `src/components/DoctorPanel.tsx`: doctor list, counts, and unavailable controls.
- `src/components/ScheduleGrid.tsx`: weekly 白1/白2/夜1/夜2 grid and drag/drop targets.
- `src/components/IssuePanel.tsx`: global issue list.
- `src/components/Toolbar.tsx`: new week, auto schedule, clear, export controls.
- `src/test/setup.ts`: Testing Library setup.
- `src/domain/*.test.ts`: domain tests.
- `src/App.test.tsx`: smoke test for rendered UI.

---

### Task 1: Project Scaffold

**Files:**
- Create: `package.json`
- Create: `index.html`
- Create: `tsconfig.json`
- Create: `tsconfig.node.json`
- Create: `vite.config.ts`
- Create: `vitest.config.ts`
- Create: `src/main.tsx`
- Create: `src/App.tsx`
- Create: `src/App.css`
- Create: `src/test/setup.ts`
- Create: `src/App.test.tsx`

**Interfaces:**
- Produces: a Vite React app with `npm run dev`, `npm run build`, and `npm test`.
- Produces: `App` React component exported from `src/App.tsx`.

- [ ] **Step 1: Create package and config files**

Create `package.json`:

```json
{
  "name": "icu-scheduler",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "vite --host 127.0.0.1",
    "build": "tsc -b && vite build",
    "test": "vitest run",
    "test:watch": "vitest"
  },
  "dependencies": {
    "@dnd-kit/core": "^6.1.0",
    "@vitejs/plugin-react": "^4.3.1",
    "vite": "^5.4.0",
    "react": "^18.3.1",
    "react-dom": "^18.3.1",
    "xlsx": "^0.18.5"
  },
  "devDependencies": {
    "@testing-library/jest-dom": "^6.4.8",
    "@testing-library/react": "^16.0.0",
    "@testing-library/user-event": "^14.5.2",
    "@types/react": "^18.3.3",
    "@types/react-dom": "^18.3.0",
    "jsdom": "^24.1.1",
    "typescript": "^5.5.4",
    "vitest": "^2.0.5"
  }
}
```

Create the config files with standard Vite React TypeScript settings and Vitest jsdom setup.

- [ ] **Step 2: Install dependencies**

Run: `npm install`

Expected: `node_modules` and `package-lock.json` are created without dependency errors.

- [ ] **Step 3: Add minimal app**

Create `src/App.tsx`:

```tsx
export default function App() {
  return (
    <main className="app-shell">
      <h1>ICU 排班系统</h1>
      <p>第一版排班页面</p>
    </main>
  );
}
```

Create `src/main.tsx` to render `<App />`, and create `src/App.css` with basic full-page layout.

- [ ] **Step 4: Add smoke test**

Create `src/App.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import App from "./App";

it("renders the scheduler title", () => {
  render(<App />);
  expect(screen.getByText("ICU 排班系统")).toBeInTheDocument();
});
```

- [ ] **Step 5: Verify scaffold**

Run: `npm test`

Expected: one passing test.

Run: `npm run build`

Expected: TypeScript and Vite build succeed.

---

### Task 2: Scheduling Types and Rule Engine

**Files:**
- Create: `src/domain/types.ts`
- Create: `src/domain/sampleData.ts`
- Create: `src/domain/rules.ts`
- Create: `src/domain/rules.test.ts`

**Interfaces:**
- Produces: `createEmptySchedule(): WeeklySchedule`
- Produces: `getDoctorCounts(schedule, doctorId): DoctorCounts`
- Produces: `getDoctorDayStatus(schedule, doctorId, day): DoctorDayStatus`
- Produces: `validateSchedule(schedule, doctors, options): ScheduleIssue[]`

- [ ] **Step 1: Write rule tests**

Create `src/domain/rules.test.ts` with tests covering:

```ts
import {
  createEmptySchedule,
  getDoctorCounts,
  getDoctorDayStatus,
  validateSchedule
} from "./rules";
import type { Doctor } from "./types";

const doctors: Doctor[] = [
  { id: "a", name: "王医生", kind: "normal", unavailableDays: [] },
  { id: "b", name: "钟医生", kind: "dayOnly", targetDayShifts: 2, unavailableDays: [] }
];

it("creates an empty week with seven days and four positions per day", () => {
  const schedule = createEmptySchedule();
  expect(schedule.days).toHaveLength(7);
  expect(schedule.days[0].assignments).toEqual({ day1: null, day2: null, night1: null, night2: null });
});

it("counts day, night, and total shifts", () => {
  const schedule = createEmptySchedule();
  schedule.days[0].assignments.day1 = "a";
  schedule.days[1].assignments.night2 = "a";
  expect(getDoctorCounts(schedule, "a")).toEqual({ day: 1, night: 1, total: 2 });
});

it("derives 出 after a night shift", () => {
  const schedule = createEmptySchedule();
  schedule.days[1].assignments.night1 = "a";
  expect(getDoctorDayStatus(schedule, "a", 2)).toBe("offAfterNight");
});

it("reports missing positions and rule violations", () => {
  const schedule = createEmptySchedule();
  schedule.days[0].assignments.day1 = "b";
  schedule.days[0].assignments.night1 = "b";
  const issues = validateSchedule(schedule, doctors, { requireFilledPositions: true });
  expect(issues.some((issue) => issue.type === "missingPosition")).toBe(true);
  expect(issues.some((issue) => issue.type === "sameDayMultipleAssignments")).toBe(true);
  expect(issues.some((issue) => issue.type === "dayOnlyDoctorOnNight")).toBe(true);
});
```

- [ ] **Step 2: Run tests to verify failure**

Run: `npm test -- src/domain/rules.test.ts`

Expected: fail because domain files do not exist.

- [ ] **Step 3: Implement types**

Create `src/domain/types.ts`:

```ts
export type DayIndex = 0 | 1 | 2 | 3 | 4 | 5 | 6;
export type DoctorKind = "normal" | "dayOnly";
export type ShiftKey = "day1" | "day2" | "night1" | "night2";
export type DoctorDayStatus = ShiftKey | "offAfterNight" | "rest";

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
}

export interface WeeklySchedule {
  days: DaySchedule[];
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
  | "dayOnlyTargetNotMet";

export interface ScheduleIssue {
  type: ScheduleIssueType;
  message: string;
  doctorId?: string;
  dayIndex?: DayIndex;
  shiftKey?: ShiftKey;
}
```

- [ ] **Step 4: Implement rules**

Create `src/domain/rules.ts` with pure functions that satisfy the tests. Use constants:

```ts
export const shiftLabels = {
  day1: "白1",
  day2: "白2",
  night1: "夜1",
  night2: "夜2"
} as const;

export const dayLabels = ["周一", "周二", "周三", "周四", "周五", "周六", "周日"] as const;
```

Validation must allow manual violations but return issues for every violation.

- [ ] **Step 5: Add sample data**

Create `src/domain/sampleData.ts` with 10 example doctors, including one `dayOnly` doctor named `钟医生` with `targetDayShifts: 2`.

- [ ] **Step 6: Verify**

Run: `npm test -- src/domain/rules.test.ts`

Expected: all rule tests pass.

---

### Task 3: Automatic Scheduler

**Files:**
- Create: `src/domain/scheduler.ts`
- Create: `src/domain/scheduler.test.ts`

**Interfaces:**
- Consumes: `Doctor`, `WeeklySchedule`, `validateSchedule`, `createEmptySchedule`.
- Produces: `generateSchedule(doctors: Doctor[]): SchedulerResult`
- Produces: `SchedulerResult = { ok: true; schedule: WeeklySchedule } | { ok: false; issues: ScheduleIssue[]; message: string }`

- [ ] **Step 1: Write scheduler tests**

Create tests for:

```ts
import { generateSchedule } from "./scheduler";
import { validateSchedule } from "./rules";
import type { Doctor } from "./types";

function makeDoctors(): Doctor[] {
  return [
    { id: "d1", name: "医生1", kind: "normal", unavailableDays: [] },
    { id: "d2", name: "医生2", kind: "normal", unavailableDays: [] },
    { id: "d3", name: "医生3", kind: "normal", unavailableDays: [] },
    { id: "d4", name: "医生4", kind: "normal", unavailableDays: [] },
    { id: "d5", name: "医生5", kind: "normal", unavailableDays: [] },
    { id: "d6", name: "医生6", kind: "normal", unavailableDays: [] },
    { id: "d7", name: "医生7", kind: "normal", unavailableDays: [] },
    { id: "d8", name: "医生8", kind: "normal", unavailableDays: [] },
    { id: "d9", name: "医生9", kind: "normal", unavailableDays: [] },
    { id: "zhong", name: "钟医生", kind: "dayOnly", targetDayShifts: 2, unavailableDays: [] }
  ];
}

it("generates a legal schedule for ten available doctors", () => {
  const result = generateSchedule(makeDoctors());
  expect(result.ok).toBe(true);
  if (!result.ok) return;
  expect(validateSchedule(result.schedule, makeDoctors(), { requireFilledPositions: true })).toEqual([]);
});

it("returns failure when capacity is not enough", () => {
  const result = generateSchedule(makeDoctors().slice(0, 6));
  expect(result.ok).toBe(false);
});

it("does not assign night shifts to day-only doctors", () => {
  const doctors = makeDoctors();
  const result = generateSchedule(doctors);
  expect(result.ok).toBe(true);
  if (!result.ok) return;
  const zhongNightCount = result.schedule.days.filter((day) =>
    day.assignments.night1 === "zhong" || day.assignments.night2 === "zhong"
  ).length;
  expect(zhongNightCount).toBe(0);
});
```

- [ ] **Step 2: Run tests to verify failure**

Run: `npm test -- src/domain/scheduler.test.ts`

Expected: fail because scheduler does not exist.

- [ ] **Step 3: Implement scheduler**

Implement deterministic backtracking:

- Build the 28 positions in order, with night shifts before day shifts for harder constraints.
- For each position, list candidate doctors who are available that day, not already assigned that day, not blocked by previous-night recovery, and within type and count limits.
- Sort candidates by fewer total shifts, fewer same-kind shifts, and stable name order.
- After all positions are filled, verify day-only doctors meet `targetDayShifts`.
- Return the first valid schedule.

Keep the function pure and deterministic.

- [ ] **Step 4: Verify**

Run: `npm test -- src/domain/scheduler.test.ts src/domain/rules.test.ts`

Expected: all tests pass.

---

### Task 4: Persistence and Excel Export

**Files:**
- Create: `src/domain/storage.ts`
- Create: `src/domain/storage.test.ts`
- Create: `src/domain/exportExcel.ts`
- Create: `src/domain/exportExcel.test.ts`

**Interfaces:**
- Produces: `loadAppState(): AppState`
- Produces: `saveAppState(state: AppState): void`
- Produces: `buildWorkbook(state: AppState, issues: ScheduleIssue[]): XLSX.WorkBook`
- Produces: `exportWorkbook(state: AppState, issues: ScheduleIssue[]): void`

- [ ] **Step 1: Define AppState in `types.ts`**

Add:

```ts
export interface AppState {
  doctors: Doctor[];
  schedule: WeeklySchedule;
}
```

- [ ] **Step 2: Write storage tests**

Tests must confirm:

- missing localStorage returns sample data and empty schedule.
- saved state loads back with the same doctors and assignments.

- [ ] **Step 3: Implement storage**

Use key `icu-scheduler-state-v1`. Validate parsed JSON shape enough to avoid crashing; if invalid, return default state.

- [ ] **Step 4: Write Excel tests**

Test `buildWorkbook` creates:

- sheet named `按日期查看`
- sheet named `按医生查看`
- sheet named `问题列表` when issues are non-empty

- [ ] **Step 5: Implement Excel export**

Use `xlsx` utilities:

- `XLSX.utils.book_new()`
- `XLSX.utils.json_to_sheet()`
- `XLSX.utils.book_append_sheet()`
- `XLSX.writeFile(workbook, "ICU排班.xlsx")`

Use `getDoctorDayStatus` to fill the doctor view.

- [ ] **Step 6: Verify**

Run: `npm test -- src/domain/storage.test.ts src/domain/exportExcel.test.ts`

Expected: all tests pass.

---

### Task 5: Main UI and Manual Scheduling

**Files:**
- Modify: `src/App.tsx`
- Modify: `src/App.css`
- Create: `src/components/DoctorPanel.tsx`
- Create: `src/components/ScheduleGrid.tsx`
- Create: `src/components/IssuePanel.tsx`
- Create: `src/components/Toolbar.tsx`
- Modify: `src/App.test.tsx`

**Interfaces:**
- Consumes: `AppState`, `validateSchedule`, `generateSchedule`, storage helpers, export helpers.
- Produces: user-facing weekly scheduler UI.

- [ ] **Step 1: Expand UI smoke tests**

Update `src/App.test.tsx` to assert:

- title `ICU 排班系统` is visible.
- button `自动排班` is visible.
- button `导出 Excel` is visible.
- rows `白1`, `白2`, `夜1`, `夜2` are visible.
- doctor `钟医生` is visible.

- [ ] **Step 2: Run tests to verify failure**

Run: `npm test -- src/App.test.tsx`

Expected: fail because components are not implemented.

- [ ] **Step 3: Build components**

Implement:

- `DoctorPanel`: list doctors, show counts, unavailable-day checkboxes, and day-only target selector for `钟医生`.
- `ScheduleGrid`: render seven columns and four shift rows; support selecting a doctor by click and assigning by clicking a cell first, then add drag/drop through `@dnd-kit/core`.
- `IssuePanel`: render issue messages or `当前没有发现问题`.
- `Toolbar`: new week, automatic schedule, clear schedule, export Excel.

Keep manual assignment permissive: assign the selected or dragged doctor even if it creates violations.

- [ ] **Step 4: Wire App state**

`App.tsx` should:

- load initial state from storage.
- save state when doctors or schedule change.
- recompute issues with `validateSchedule(..., { requireFilledPositions: true })`.
- call `generateSchedule` for automatic scheduling.
- show scheduler failure message when automatic scheduling fails.
- call `exportWorkbook` after warning if issues remain.

- [ ] **Step 5: Style clear visual states**

In `App.css` implement:

- three-column desktop layout: doctors, schedule grid, issues.
- compact full-width stacking for narrow screens.
- red styling for issue cells and over-limit doctor stats.
- restrained medical/work-tool palette with no decorative hero section.

- [ ] **Step 6: Verify**

Run: `npm test -- src/App.test.tsx`

Expected: UI smoke tests pass.

Run: `npm run build`

Expected: production build succeeds.

---

### Task 6: End-to-End Manual QA

**Files:**
- Modify only files needed to fix bugs found during QA.

**Interfaces:**
- Consumes: complete app.
- Produces: verified first version ready for local use.

- [ ] **Step 1: Start dev server**

Run: `npm run dev`

Expected: Vite reports a local URL, usually `http://127.0.0.1:5173/`.

- [ ] **Step 2: Browser verification**

Open the local URL and verify:

- initial doctors render.
- unavailable checkboxes update issue results.
- automatic schedule fills all 28 positions for sample doctors.
- dragging or clicking can change a position.
- manually creating an invalid schedule turns issue list red.
- 夜班后第二天 appears as 出 in doctor view/export data.
- export downloads an `.xlsx` file.

- [ ] **Step 3: Final verification commands**

Run:

```powershell
npm test
npm run build
```

Expected: both commands pass.

- [ ] **Step 4: Report result**

Final report must include:

- local dev URL.
- verification commands run.
- any remaining limitations from the first-version scope.

