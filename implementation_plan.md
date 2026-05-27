# Implementation Plan - Dynamic Mode E2E Conveyor Linkage & Rendering Fixes

This document outlines the changes to resolve:
1. **Raw Material Spawn Rendering Error**: Cargo items in the Raw Chassis Warehouse (Stage #1) not displaying visually before the conveyor starts moving.
2. **Linkage Discontinuity & Cargo Disappearance at Stage #2 (S7)**: Cargo items instantly disappearing when transferred to the 2nd stage, and the automatic scan/trigger sequence failing to link sequentially to subsequent stages.

## User Review Required

> [!IMPORTANT]
> **No Breaking Changes**: These updates only affect dynamic mode operations and rendering logic, ensuring the original fixed-mode remains robust and completely unaffected.

## Proposed Changes

### 1. C++ PLC Runtime Logic

#### [MODIFY] [assembly_logic.cpp](file:///home/ingenie/vPLC-runtime/src/logic/assembly_logic.cpp)
- **Problem**: The `has_chassis` trigger condition strictly required `__MW2 == 1 && has_scanned_serial`. Due to the asynchronous nature of network register writes, S7/Modbus write timing gaps might cause `__MW2 == 1` to be processed before the serial registers (`__MW10~14`) are fully synchronized to the DLL, causing the trigger to be ignored.
- **Fix**: Simplify the trigger condition to start the sequence whenever `__MW2 == 1` is written, decoupled from the instantaneous check of the serial registers.

---

### 2. Frontend React Visualization

#### [MODIFY] [SimulatorCanvas.tsx](file:///home/ingenie/vSim-factory/src/components/SimulatorCanvas.tsx)
- **Problem**: The filter `if (!isRunningPlc && pos === 0) return null;` caused cargos to be invisible when `conveyor_run === false` and `pos === 0`, causing (a) Raw Chassis not showing in the warehouse while waiting, and (b) cargo instantly disappearing when hitting subsequent stages before their conveyors started moving.
- **Fix**: Remove the filter entirely. A cargo will render as long as it has a valid, non-empty serial number, enabling realistic stationary visual feedback.

---

### 3. Backend MES Gateway

#### [MODIFY] [plc-gateway.cjs](file:///home/ingenie/vSim-factory/server/plc-gateway.cjs)
- **Problem**: Removing the UI filter might cause "ghost duplicate cargos" if completed stages keep holding their previous serial number after handoff.
- **Fix**: During sequential MES handovers (`runDynamicProcessBridge`), explicitly clear the serial register of the completed predecessor PLC (set to `"          "` / `""`) as soon as the baton is successfully transferred to the next stage.
- **Completion Handoff**: Cleanly wipe the serial of the final stage upon its completion to reflect delivery.

---

## Verification Plan

### Automated & Manual Verification
1. **Rebuild C++ PLC Runtime**: Recompile the dynamic logic library (`make` or CMake build).
2. **Start Services**: Run MES Gateway (`task-723` already running or restarted) and vPLC processes.
3. **E2E Visual Flow**: Click "vPLC ON", then manually trigger "원자재 투입" (Material Provision).
4. **Linkage Continuity**: Observe the cargo spawned visually inside the Raw Chassis Warehouse, and trace its uninterrupted, smooth flow sequentially from Stage #1 Modbus ➔ Stage #2 S7 ➔ Stage #3 MC ➔ XGT, verifying zero cargo disappearances.

