import React from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
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
  expect(screen.getByDisplayValue("钟医生")).toBeInTheDocument();
});

it("allows editing doctor names", async () => {
  const user = userEvent.setup();
  render(<App />);

  const nameInput = screen.getByDisplayValue("王医生");
  await user.clear(nameInput);
  await user.type(nameInput, "孙医生");

  expect(screen.getByDisplayValue("孙医生")).toBeInTheDocument();
  expect(screen.queryByDisplayValue("王医生")).not.toBeInTheDocument();
});
