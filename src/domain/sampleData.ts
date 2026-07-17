import type { Doctor } from "./types";

export const sampleDoctors: Doctor[] = [
  { id: "a", name: "王医生", kind: "normal", unavailableDays: [] },
  { id: "b", name: "李医生", kind: "normal", unavailableDays: [] },
  { id: "c", name: "张医生", kind: "normal", unavailableDays: [] },
  { id: "d", name: "赵医生", kind: "normal", unavailableDays: [] },
  { id: "e", name: "陈医生", kind: "normal", unavailableDays: [] },
  { id: "f", name: "刘医生", kind: "normal", unavailableDays: [] },
  { id: "g", name: "杨医生", kind: "normal", unavailableDays: [] },
  { id: "h", name: "黄医生", kind: "normal", unavailableDays: [] },
  { id: "i", name: "周医生", kind: "normal", unavailableDays: [] },
  { id: "j", name: "吴医生", kind: "normal", unavailableDays: [] },
  { id: "k", name: "孙医生", kind: "normal", unavailableDays: [] },
  { id: "l", name: "马医生", kind: "normal", unavailableDays: [] },
  { id: "m", name: "朱医生", kind: "normal", unavailableDays: [] },
  { id: "zhong", name: "钟医生", kind: "dayOnly", targetDayShifts: 2, unavailableDays: [] }
];
