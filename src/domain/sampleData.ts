import type { DayIndex, Doctor } from "./types";

const def = {
  unavailableDayShifts: [] as DayIndex[],
  unavailableNightShifts: [] as DayIndex[],
  preference: "auto" as const
};

export const sampleDoctors: Doctor[] = [
  { id: "hu", name: "胡医生", kind: "normal", unavailableDays: [], ...def },
  { id: "luo", name: "罗医生", kind: "normal", unavailableDays: [], ...def },
  { id: "xue", name: "薛医生", kind: "normal", unavailableDays: [], ...def },
  { id: "zhao", name: "赵医生", kind: "normal", unavailableDays: [], ...def },
  { id: "yuan", name: "袁医生", kind: "normal", unavailableDays: [], ...def },
  { id: "tuo", name: "庹医生", kind: "normal", unavailableDays: [], ...def },
  { id: "liu", name: "刘医生", kind: "normal", unavailableDays: [], ...def },
  { id: "qu", name: "瞿医生", kind: "normal", unavailableDays: [], ...def },
  { id: "yin", name: "尹医生", kind: "normal", unavailableDays: [], ...def },
  { id: "zhu", name: "朱医生", kind: "normal", unavailableDays: [], ...def },
  { id: "zhong", name: "钟医生", kind: "dayOnly", targetDayShifts: 2, unavailableDays: [], ...def },
  { id: "yang", name: "杨医生", kind: "nightOnly", targetNightShifts: 2, unavailableDays: [], ...def }
];
