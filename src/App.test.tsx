import React from "react";
import { render, screen } from "@testing-library/react";
import App from "./App";

it("renders the scheduler title", () => {
  render(<App />);
  expect(screen.getByText("ICU 排班系统")).toBeInTheDocument();
});
