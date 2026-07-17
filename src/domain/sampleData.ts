import type { DayIndex, Doctor } from "./types";

const def = {
  unavailableDayShifts: [] as DayIndex[],
  unavailableNightShifts: [] as DayIndex[],
  preference: "auto" as const
};

export const sampleDoctors: Doctor[] = [
  { id: "a", name: "王医生", kind: "normal", unavailableDays: [], ...def },
  { id: "b", name: "李医生", kind: "normal", unavailableDays: [], ...def },
  { id: "c", name: "张医生", kind: "normal", unavailableDays: [], ...def },
  { id: "d", name: "赵医生", kind: "normal", unavailableDays: [], ...def },
  { id: "e", name: "陈医生", kind: "normal", unavailableDays: [], ...def },
  { id: "f", name: "刘医生", kind: "normal", unavailableDays: [], ...def },
  { id: "g", name: "杨医生", kind: "normal", unavailableDays: [], ...def },
  { id: "h", name: "黄医生", kind: "normal", unavailableDays: [], ...def },
  { id: "i", name: "周医生", kind: "normal", unavailableDays: [], ...def },
  { id: "j", name: "吴医生", kind: "normal", unavailableDays: [], ...def },
  { id: "k", name: "孙医生", kind: "normal", unavailableDays: [], ...def },
  { id: "l", name: "马医生", kind: "normal", unavailableDays: [], ...def },
  { id: "m", name: "朱医生", kind: "normal", unavailableDays: [], ...def },
  { id: "zhong", name: "钟医生", kind: "dayOnly", targetDayShifts: 2, unavailableDays: [], ...def },
  { id: "midnight", name: "郑医生", kind: "nightOnly", unavailableDays: [], ...def }
];
