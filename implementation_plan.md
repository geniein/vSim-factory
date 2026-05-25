# Implementation Plan - PLC Gateway Bridge & Multi-Item Simulation UI

This document details the implementation design and updates for enhancing the visual fidelity of multi-PLC simulation and establishing high-reliability automatic trigger resets on the gateway bridge.

## 🎯 Goals & Objectives

1. **High-Fidelity Multi-Item Visualization**: Display separate visual Cargo representations representing each unique stage (Feeder, CNC, QC, Sorter) instead of a single merged object.
2. **Reliable Gateway Triggering**: Replace unstable position-based trigger reset logic in the PLC gateway bridge with a reliable timer-based auto-reset structure.
3. **Manual material provisioning**: Allow operators to manually inject a chassis in both Standalone (emulated) and HIL (live) modes via a new dedicated UI button.

---

## 🛠️ Architectural & Code Changes

### 1. Frontend: Control Header & Simulation Engine

#### [src/components/Header.tsx](file:///Users/in-youngjin/Documents/personal/vSim-factory/src/components/Header.tsx)
- Equipment dashboard **"원자재 투입" (Feed Material)** action button added with a distinct Cyber-Purple color scheme.
- Prop `onFeedMaterial` integrated to invoke backend trigger calls.

#### [src/hooks/useSimulation.ts](file:///Users/in-youngjin/Documents/personal/vSim-factory/src/hooks/useSimulation.ts)
- Added `feedMaterial()` callback to support dual operating modes:
  - **Emulated Mode**: Spawns standalone Cargo items dynamically.
  - **Live HIL Mode**: Writes `1` to the Feeder PLC Modbus address `%MW2` to force a presence signal.
- Re-architected `activeItems` mapper to track separate cargo states for Feeder, CNC, QC, and Sorter according to actual individual PLC indicators (`conveyor_run`, `pos`, `laser_on`, etc.).
- Machine status mappings (`m1`, `m2`) adjusted to properly utilize error flags and individual block statuses.

---

### 2. Backend: PLC Gateway Bridge

#### [server/plc-gateway.cjs](file:///Users/in-youngjin/Documents/personal/vSim-factory/server/plc-gateway.cjs)
- Refactored Snap7 tag mapping with `setTranslationCB()` and `addItems()` to achieve proper library integration.
- Introduced reliable **1-second timeout auto-resets** for PLC-to-PLC handover triggers inside the `runProcessBridge` master loop:
  - **Feeder ➔ CNC**: Pulse `DB1.INT4 (%MW2)` to `1` then revert to `0` after 1,000ms.
  - **CNC ➔ QC**: Write `1` to MC socket D2 then revert to `0` after 1,000ms.
  - **QC ➔ Sorter**: Write `1` to XGT `%MW2` then revert to `0` after 1,000ms.
- Websocket handler for manual injection Modbus writes on address 2 now automatically schedules a rollback to `0` after 1 second.

---

## 🧪 Verification Plan

### Manual Verification
- Launch the gateway server (`node server/plc-gateway.cjs`).
- Start the frontend application using `npm run dev`.
- Turn on simulator power, click the "가동" (Run) button, and click **"원자재 투입"** to verify manual chassis provisioning.
- Observe realistic concurrent visual item transits across all 4 machine zones.

### Build Verification
- Execute `npm run build` to ensure complete TypeScript compile safety.
