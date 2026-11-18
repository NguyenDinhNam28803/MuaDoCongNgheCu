import { describe, expect, it } from "vitest";
import type { DeviceStatus } from "@/generated/prisma/enums";
import { InspectionGateError, InvalidTransitionError } from "./errors";
import {
  DEVICE_TRANSITIONS,
  assertInspectionGate,
  assertTransition,
  canTransition,
  requiresInspectionGate,
} from "./state-machine";

const ALL: DeviceStatus[] = [
  "INTAKE",
  "INSPECTING",
  "REFURBISHING",
  "LISTED",
  "RESERVED",
  "SOLD",
  "RETURNED",
  "REJECTED",
];

describe("DEVICE_TRANSITIONS", () => {
  it("covers all 8 statuses", () => {
    expect(Object.keys(DEVICE_TRANSITIONS).sort()).toEqual([...ALL].sort());
  });

  it("only reaches LISTED from INSPECTING, REFURBISHING or RESERVED (expired hold)", () => {
    const into = ALL.filter((s) => canTransition(s, "LISTED"));
    expect(into.sort()).toEqual(["INSPECTING", "REFURBISHING", "RESERVED"]);
  });

  it("REJECTED is terminal", () => {
    expect(DEVICE_TRANSITIONS.REJECTED).toHaveLength(0);
  });

  it("a returned device must be re-inspected", () => {
    expect(DEVICE_TRANSITIONS.RETURNED).toEqual(["INSPECTING"]);
  });

  it("allows buying back a sold device (SOLD → INTAKE) but never a rejected one", () => {
    expect(canTransition("SOLD", "INTAKE")).toBe(true);
    expect(canTransition("REJECTED", "INTAKE")).toBe(false);
  });

  it("allows counter sale LISTED → SOLD", () => {
    expect(canTransition("LISTED", "SOLD")).toBe(true);
  });

  it("rejects skipping inspection", () => {
    expect(() => assertTransition("INTAKE", "LISTED")).toThrow(InvalidTransitionError);
    expect(() => assertTransition("RETURNED", "LISTED")).toThrow(InvalidTransitionError);
  });
});

describe("inspection gate", () => {
  it("applies when going on-shelf", () => {
    expect(requiresInspectionGate("INSPECTING", "LISTED")).toBe(true);
    expect(requiresInspectionGate("INSPECTING", "REFURBISHING")).toBe(true);
    expect(requiresInspectionGate("REFURBISHING", "LISTED")).toBe(true);
    expect(requiresInspectionGate("INSPECTING", "REJECTED")).toBe(false);
    expect(requiresInspectionGate("RESERVED", "LISTED")).toBe(false);
  });

  const ok = { passed: true, accountLocked: false, dataWiped: true };

  it("passes a clean report", () => {
    expect(() => assertInspectionGate(ok)).not.toThrow();
  });

  it.each([
    ["no report", null],
    ["account locked", { ...ok, accountLocked: true }],
    ["data not wiped", { ...ok, dataWiped: false }],
    ["failed", { ...ok, passed: false }],
  ])("blocks %s", (_, report) => {
    expect(() => assertInspectionGate(report)).toThrow(InspectionGateError);
  });
});
