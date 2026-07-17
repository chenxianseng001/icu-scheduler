import React from "react";
import { render, screen } from "@testing-library/react";
import App from "./App";

it("renders the scheduler title", () => {
  render(<App />);
  expect(screen.getByText("ICU 排班系统")).toBeInTheDocument();
});

it("renders the main scheduler controls and grid", () => {
  render(<App />);

  expect(screen.getByRole("button", { name: "自动排班" })).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "导出 Excel" })).toBeInTheDocument();
  expect(screen.getByText("白1")).toBeInTheDocument();
  expect(screen.getByText("白2")).toBeInTheDocument();
  expect(screen.getByText("夜1")).toBeInTheDocument();
  expect(screen.getByText("夜2")).toBeInTheDocument();
  expect(screen.getByText("钟医生")).toBeInTheDocument();
});
