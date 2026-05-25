# Task Tracking - PLC Gateway Bridge & Multi-Item Simulation UI

Track the implementation progress of the high-fidelity multi-PLC simulation UI and the robust timer-based gateway auto-reset mechanism.

## 🏁 Phase 1: Gateway Bridge Optimization
- [x] Refactor Snap7 node-snap7 translation callbacks (`setTranslationCB`, `addItems`).
- [x] Implement 1-second auto-reset (setTimeout) for Feeder ➔ CNC S7 trigger handovers.
- [x] Implement 1-second auto-reset for CNC ➔ QC MC protocol trigger handovers.
- [x] Implement 1-second auto-reset for QC ➔ Sorter XGT protocol trigger handovers.
- [x] Implement auto-rollback to 0 for Modbus websocket write commands on Feeder Chassis Present (%MW2).

## 🖥️ Phase 2: Frontend Simulation & Control Interface
- [x] Add "원자재 투입" (Feed Material) Purple Button & Package Icon in `Header.tsx`.
- [x] Implement `feedMaterial` callback in `useSimulation.ts` with dual modes (HIL / Standalone).
- [x] Re-architect visualizer engine (`activeItems`) to render individual cargos per PLC phase (`ITEM-FEEDER`, `ITEM-CNC-WORK`, `ITEM-QC-CHECK`, etc.).
- [x] Revamp CNC and QC machine statuses to respect hardware error flags and live signals.

## 🧪 Phase 3: Integrity & Build Verification
- [x] Verify local production build with strict TypeScript configuration (`npm run build`).
- [ ] Conduct end-to-end integration tests using active emulator and physical PLCs.
