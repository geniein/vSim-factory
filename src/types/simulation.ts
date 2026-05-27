export type ItemStatus =
  | 'spawned'
  | 'conveyor1'
  | 'processing'
  | 'conveyor2'
  | 'inspecting'
  | 'conveyor3'
  | 'completed'
  | 'defective';

export type MachineStatus = 'idle' | 'processing' | 'blocked' | 'error';

export interface Item {
  id: string;
  serialNo?: string;
  spawnTime: number;
  status: ItemStatus;
  progress: number; // 0 to 1
  quality: 'unknown' | 'good' | 'defective';
  x: number;
  y: number;
  history: { status: ItemStatus; time: number }[];
}

export interface Machine {
  id: string;
  name: string;
  status: MachineStatus;
  currentItemId: string | null;
  processedCount: number;
  totalBusyTime: number; // cumulative milliseconds spent processing
}

export interface SimulationSettings {
  spawnRate: number; // seconds between item spawns
  conveyorSpeed: number; // speed multiplier (e.g. 1x, 2x, 5x)
  processingTime: number; // seconds a machine takes to process one item
  defectRate: number; // probability (0-100) of item being defective
  systemSpeed: number; // speed factor (0.5x, 1x, 2x, 4x) for simulation clock
  plcMode: 'emulated' | 'runtime' | 'dynamic'; // 'emulated' for browser-only, 'runtime' for vPLC C++, 'dynamic' for dynamic N-stage vPLC
}

export interface LogMessage {
  id: string;
  timestamp: string;
  type: 'info' | 'success' | 'warning' | 'error';
  message: string;
}

export interface SimulationStats {
  totalSpawned: number;
  totalCompleted: number;
  totalDefective: number;
  totalProcessed: number;
  oee: number; // Overall Equipment Effectiveness
  bottleneck: string; // descriptive name of bottleneck
  uptime: number; // cumulative simulation time in seconds
  logs: LogMessage[];
  plcConnections?: { feeder: boolean; cnc: boolean; qc: boolean; sorter: boolean };
  plcLatency?: { feeder: number; cnc: number; qc: number; sorter: number };
}

export interface PlcData {
  feeder: {
    conveyor_run: boolean;
    error: boolean;
    pos?: number;
    speed?: number;
    completed?: number;
    serial?: string;
  };
  cnc: {
    conveyor_run: boolean;
    lift_down: boolean;
    clamp_on: boolean;
    rotate_right: boolean;
    speed: number;
    pos: number;
    completed: number;
    error: boolean;
    serial?: string;
  };
  qc: {
    conveyor_run: boolean;
    laser_on: boolean;
    rotate_right: boolean;
    completed: number;
    error: boolean;
    pos?: number;
    speed?: number;
    serial?: string;
  };
  sorter: {
    conveyor_run: boolean;
    completed: number;
    speed: number;
    error: boolean;
    pos?: number;
    serial?: string;
  };
}
