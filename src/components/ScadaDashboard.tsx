import React, { useEffect, useRef, useState } from 'react';
import { 
  Server, Cpu, Play, Pause, Activity, AlertTriangle, CheckCircle, 
  Zap, Info, Clock, Sliders, ShieldAlert, RotateCcw, ZapOff,
  Flame, Droplet, Gauge, Wind, Box
} from 'lucide-react';

interface Alarm {
  id: string;
  time: string;
  stage: string;
  level: 'info' | 'warning' | 'error';
  message: string;
}

const generateSerialNo = () => {
  const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const l1 = letters[Math.floor(Math.random() * 26)];
  const l2 = letters[Math.floor(Math.random() * 26)];
  const l3 = letters[Math.floor(Math.random() * 26)];
  const num = Math.floor(100000 + Math.random() * 900000);
  return `${l1}${l2}${l3} ${num}`;
};

export const ScadaDashboard: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  
  // Real-time states for the SCADA telemetry
  const [isRunning, setIsRunning] = useState(true);
  const [isEStop, setIsEStop] = useState(false); // Emergency Stop active
  const [interlockBypass, setInterlockBypass] = useState(false); // Interlock bypass override
  const [speedMultiplier, setSpeedMultiplier] = useState(1);
  const [activeExplainTab, setActiveExplainTab] = useState<'intro' | 'control' | 'features' | 'marriage' | 'door'>('intro');

  // Sub-System selection: 'assembly' | 'welding' | 'paint' | 'utility'
  const [activeSystem, setActiveSystem] = useState<'assembly' | 'welding' | 'paint' | 'utility'>('assembly');

  // --- 1. Assembly Shop States ---
  const [powerConsumption, setPowerConsumption] = useState(142.5); // kW
  const [conveyorRpm, setConveyorRpm] = useState(1450); // Setpoint RPM control
  const [ftqRate] = useState(98.4); // First Time Quality %
  const [actualCount, setActualCount] = useState(104);
  const [targetCount, setTargetCount] = useState(120);

  // --- 2. Welding & Press States ---
  const [pressPressureSet, setPressPressureSet] = useState(210); // Bar setpoint
  const [pressPressureActual, setPressPressureActual] = useState(208.5); // Bar actual
  const [weldCurrentSet, setWeldCurrentSet] = useState(120); // A setpoint
  const [weldCurrentActual, setWeldCurrentActual] = useState(119.8); // A actual
  const [weldCount, setWeldCount] = useState(420);
  const [torchTemp, setTorchTemp] = useState(850); // °C

  // --- 3. Paint & Drying Oven States ---
  const [ovenTempSet, setOvenTempSet] = useState(110); // °C setpoint
  const [ovenTempActual, setOvenTempActual] = useState(109.5); // °C actual
  const [nozzlePressureSet, setNozzlePressureSet] = useState(4.5); // Bar setpoint
  const [nozzlePressureActual, setNozzlePressureActual] = useState(4.48); // Bar actual
  const [ventFanSpeed, setVentFanSpeed] = useState<'OFF' | 'LOW' | 'MED' | 'HIGH'>('MED');
  const [airflowRate, setAirflowRate] = useState(4500); // m3/h
  const [paintCount, setPaintCount] = useState(315);

  // --- 4. Power & Utility States ---
  const [compressorPressureSet, setCompressorPressureSet] = useState(6.0); // Bar setpoint
  const [compressorPressureActual, setCompressorPressureActual] = useState(5.95); // Bar actual
  const [coolingValveOpen, setCoolingValveOpen] = useState(75); // % open
  const [coolingFlowActual, setCoolingFlowActual] = useState(180.2); // L/min
  const [gridPowerDemand, setGridPowerDemand] = useState(1420); // kW (Total Factory)
  const [breakerTripped, setBreakerTripped] = useState(false);
  const [isRestoringPower, setIsRestoringPower] = useState(false);
  const [powerRestoreLogs, setPowerRestoreLogs] = useState<string[]>([]);
  const [restoreProgress, setRestoreProgress] = useState(0);

  // --- Alarm Logs State ---
  const [alarms, setAlarms] = useState<Alarm[]>([
    { id: '1', time: '21:01:10', stage: 'Chassis Marriage', level: 'info', message: 'Engine carrier hoist alignment calibration complete' },
    { id: '2', time: '21:02:15', stage: 'Interior Trim', level: 'warning', message: 'Torque tool #3 ethernet connection latency high (120ms)' },
    { id: '3', time: '21:04:45', stage: 'Door Off', level: 'info', message: 'Door storage buffer loader stack at 45% capacity' }
  ]);

  // Master PLC register status (RUN / STOP) for all 4 subsystems
  const [plcStatus, setPlcStatus] = useState<Record<string, 'RUN' | 'STOP'>>({
    // Assembly Shop Nodes
    'Feeder_VPLC': 'RUN',
    'DoorOff_VPLC': 'RUN',
    'Trim_VPLC': 'RUN',
    'Marriage_VPLC': 'RUN',
    'Glassing_VPLC': 'RUN',
    'DoorOn_VPLC': 'RUN',
    'Inspection_VPLC': 'RUN',
    // Welding & Press Nodes
    'Press_Hydraulic_VPLC': 'RUN',
    'Weld_Robot_A_VPLC': 'RUN',
    'Weld_Robot_B_VPLC': 'RUN',
    'Arc_Gas_Safety_VPLC': 'RUN',
    'Weld_QA_Scanner_VPLC': 'RUN',
    // Paint Shop & Oven Nodes
    'Oven_Heater_VPLC': 'RUN',
    'Air_Circulation_VPLC': 'RUN',
    'Paint_Sprayer_VPLC': 'RUN',
    'Conveyor_Pnt_VPLC': 'RUN',
    'Bake_Timer_VPLC': 'RUN',
    // Utility & Pneumatics Nodes
    'Air_Compressor_VPLC': 'RUN',
    'Cool_Water_Pump_VPLC': 'RUN',
    'Power_Grid_VPLC': 'RUN',
    'Exhaust_Scrubber_VPLC': 'RUN'
  });

  const isInterlocked = Object.values(plcStatus).includes('STOP') && !interlockBypass;
  const lineStopped = isEStop || isInterlocked || breakerTripped;

  // Toggle single VPLC state
  const handlePlcToggle = (node: string) => {
    if (breakerTripped) return;
    setPlcStatus(prev => {
      const current = prev[node];
      const next = current === 'RUN' ? 'STOP' : 'RUN';
      
      const now = new Date();
      const timeStr = `${now.getHours().toString().padStart(2,'0')}:${now.getMinutes().toString().padStart(2,'0')}:${now.getSeconds().toString().padStart(2,'0')}`;
      
      setAlarms(logs => [
        {
          id: Date.now().toString(),
          time: timeStr,
          stage: node.replace('_VPLC', ''),
          level: next === 'STOP' ? 'warning' : 'info',
          message: `Remote HMI Command: Force-switched ${node} to ${next}`
        },
        ...logs.slice(0, 8)
      ]);

      return {
        ...prev,
        [node]: next
      };
    });
  };

  // Reset E-Stop & all VPLC stops
  const handleSystemReset = () => {
    if (breakerTripped) return;
    setIsEStop(false);
    setPlcStatus(prev => {
      const refreshed: Record<string, 'RUN' | 'STOP'> = {};
      Object.keys(prev).forEach(key => {
        refreshed[key] = 'RUN';
      });
      return refreshed;
    });

    const now = new Date();
    const timeStr = `${now.getHours().toString().padStart(2,'0')}:${now.getMinutes().toString().padStart(2,'0')}:${now.getSeconds().toString().padStart(2,'0')}`;
    setAlarms(logs => [
      {
        id: Date.now().toString(),
        time: timeStr,
        stage: 'SCADA Master',
        level: 'info',
        message: 'Master system reset signal broadcasted: E-Stop and VPLCs restored to RUN'
      },
      ...logs.slice(0, 8)
    ]);
  };

  // Trigger grid failure
  const handleGridTrip = () => {
    setBreakerTripped(true);
    setPlcStatus(prev => {
      const stoppedPlc: Record<string, 'RUN' | 'STOP'> = {};
      Object.keys(prev).forEach(k => {
        stoppedPlc[k] = 'STOP';
      });
      return stoppedPlc;
    });

    const now = new Date();
    const timeStr = `${now.getHours().toString().padStart(2,'0')}:${now.getMinutes().toString().padStart(2,'0')}:${now.getSeconds().toString().padStart(2,'0')}`;
    setAlarms(prev => [
      {
        id: Date.now().toString(),
        time: timeStr,
        stage: 'Power Grid',
        level: 'error',
        message: '!!! CRITICAL EMERGENCY: High-Voltage VCB Circuit Breaker Overcurrent Trip !!!'
      },
      ...prev.slice(0, 8)
    ]);
  };

  // Recover power grid
  const handleRecoverPower = () => {
    setIsRestoringPower(true);
    setRestoreProgress(0);
    setPowerRestoreLogs(['[21:43:01] Initiating breaker closing command...']);

    let progress = 0;
    const interval = setInterval(() => {
      progress += 20;
      setRestoreProgress(progress);
      
      if (progress === 20) {
        setPowerRestoreLogs(prev => [...prev, '[21:43:02] [Grid] Spring charged. Synchronizing with utility grid phase angle...']);
      } else if (progress === 40) {
        setPowerRestoreLogs(prev => [...prev, '[21:43:03] [Grid] Phase lock matched (60.02 Hz). Closing VCB main contacts... CLOSED!']);
      } else if (progress === 60) {
        setPowerRestoreLogs(prev => [...prev, '[21:43:04] [Utility] Energizing Main Transformer. Voltage: 380V. Load stabilizing...']);
      } else if (progress === 80) {
        setPowerRestoreLogs(prev => [...prev, '[21:43:05] [Pneumatics] Energizing compressors & cooling loops... OK.']);
      } else if (progress === 100) {
        setPowerRestoreLogs(prev => [...prev, '[21:43:06] [PLC] Sending VPLC Modbus cluster reboot... VPLC Nodes ONLINE!']);
        clearInterval(interval);
        
        setTimeout(() => {
          setBreakerTripped(false);
          setIsRestoringPower(false);
          setPlcStatus(prev => {
            const restoredPlc: Record<string, 'RUN' | 'STOP'> = {};
            Object.keys(prev).forEach(k => {
              restoredPlc[k] = 'RUN';
            });
            return restoredPlc;
          });
          
          const now = new Date();
          const timeStr = `${now.getHours().toString().padStart(2,'0')}:${now.getMinutes().toString().padStart(2,'0')}:${now.getSeconds().toString().padStart(2,'0')}`;
          setAlarms(prev => [
            {
              id: Date.now().toString(),
              time: timeStr,
              stage: 'Power Grid',
              level: 'info',
              message: 'Grid power restored successfully. All VPLC nodes resumed to RUN.'
            },
            ...prev.slice(0, 8)
          ]);
        }, 800);
      }
    }, 700);
  };

  // Trigger simulated random changes and control loop behaviors
  useEffect(() => {
    if (!isRunning || breakerTripped) {
      if (breakerTripped) {
        setPowerConsumption(0);
        setPressPressureActual(0);
        setWeldCurrentActual(0);
        setTorchTemp(25);
        setOvenTempActual(prev => Math.max(25, +(prev - 2).toFixed(1)));
        setNozzlePressureActual(0);
        setAirflowRate(prev => Math.max(0, +(prev * 0.7).toFixed(0)));
        setCompressorPressureActual(prev => Math.max(0, +(prev * 0.9).toFixed(2)));
        setCoolingFlowActual(0);
      }
      return;
    }

    const interval = setInterval(() => {
      // 1. Assembly Shop Fluctuations
      if (lineStopped) {
        setPowerConsumption(0);
      } else {
        const activeAssemblyPlcCount = Object.keys(plcStatus)
          .filter(k => k.endsWith('_VPLC') && !k.startsWith('Press') && !k.startsWith('Weld') && !k.startsWith('Oven') && !k.startsWith('Air_Comp') && !k.startsWith('Cool_W') && !k.startsWith('Power'))
          .filter(k => plcStatus[k] === 'RUN').length;
        
        const basePower = (conveyorRpm / 1450) * 100 * speedMultiplier;
        const plcPower = activeAssemblyPlcCount * 6;
        setPowerConsumption(+(basePower + plcPower + Math.random() * 4 - 2).toFixed(1));
      }

      // 2. Stamping & Welding Fluctuations
      if (plcStatus['Press_Hydraulic_VPLC'] === 'RUN' && !lineStopped) {
        setPressPressureActual(+(pressPressureSet + (Math.random() * 3 - 1.5)).toFixed(1));
        if (Math.random() < 0.12) {
          setWeldCount(prev => prev + 1);
        }
      } else {
        setPressPressureActual(0);
      }

      if ((plcStatus['Weld_Robot_A_VPLC'] === 'RUN' || plcStatus['Weld_Robot_B_VPLC'] === 'RUN') && !lineStopped) {
        setWeldCurrentActual(+(weldCurrentSet + (Math.random() * 4 - 2)).toFixed(1));
        setTorchTemp(+(800 + Math.random() * 80).toFixed(0));
      } else {
        setWeldCurrentActual(0);
        setTorchTemp(25);
      }

      // 3. Paint Shop & Oven Fluctuations
      if (plcStatus['Oven_Heater_VPLC'] === 'RUN') {
        setOvenTempActual(prev => {
          const diff = ovenTempSet - prev;
          return +(prev + diff * 0.15 + (Math.random() * 0.8 - 0.4)).toFixed(1);
        });
      } else {
        setOvenTempActual(prev => Math.max(25, +(prev - (prev - 25) * 0.05).toFixed(1)));
      }

      if (plcStatus['Paint_Sprayer_VPLC'] === 'RUN' && !lineStopped) {
        setNozzlePressureActual(+(nozzlePressureSet + (Math.random() * 0.1 - 0.05)).toFixed(2));
        if (Math.random() < 0.08) {
          setPaintCount(prev => prev + 1);
        }
      } else {
        setNozzlePressureActual(0);
      }

      if (plcStatus['Air_Circulation_VPLC'] === 'RUN') {
        const targetAirflow = ventFanSpeed === 'HIGH' ? 6000 : ventFanSpeed === 'MED' ? 4500 : ventFanSpeed === 'LOW' ? 2200 : 0;
        setAirflowRate(prev => {
          const diff = targetAirflow - prev;
          return +(prev + diff * 0.25).toFixed(0);
        });
      } else {
        setAirflowRate(prev => Math.max(0, +(prev * 0.75).toFixed(0)));
      }

      // 4. Utility & Pneumatic Fluctuations
      if (plcStatus['Air_Compressor_VPLC'] === 'RUN') {
        setCompressorPressureActual(prev => {
          const diff = compressorPressureSet - prev;
          return +(prev + diff * 0.2 + (Math.random() * 0.08 - 0.04)).toFixed(2);
        });
      } else {
        setCompressorPressureActual(prev => Math.max(0, +(prev * 0.94).toFixed(2))); // Leakage bleed down
      }

      if (plcStatus['Cool_Water_Pump_VPLC'] === 'RUN') {
        const targetFlow = coolingValveOpen * 2.4;
        setCoolingFlowActual(prev => {
          const diff = targetFlow - prev;
          return +(prev + diff * 0.3 + (Math.random() * 1.5 - 0.75)).toFixed(1);
        });
      } else {
        setCoolingFlowActual(0);
      }

      const activePlcCount = Object.values(plcStatus).filter(status => status === 'RUN').length;
      const computedUtilityLoad = activePlcCount * 65 + (compressorPressureActual * 18) + (coolingFlowActual * 1.2) + (ovenTempActual * 2.2);
      setGridPowerDemand(+(450 + computedUtilityLoad + Math.random() * 12 - 6).toFixed(0));

      // Assembly main counter
      if (plcStatus['Inspection_VPLC'] === 'RUN' && !lineStopped && Math.random() < 0.12) {
        setActualCount(prev => {
          if (prev >= targetCount) {
            setTargetCount(t => t + 20);
          }
          return prev + 1;
        });

        const now = new Date();
        const timeStr = `${now.getHours().toString().padStart(2,'0')}:${now.getMinutes().toString().padStart(2,'0')}:${now.getSeconds().toString().padStart(2,'0')}`;
        setAlarms(prev => [
          {
            id: Date.now().toString(),
            time: timeStr,
            stage: 'Assembly QC',
            level: 'info',
            message: `Vehicle frame passed quality gate 3 (Roll-out check)`
          },
          ...prev.slice(0, 8)
        ]);
      }

      // --- Trigger Custom Alarm Warnings based on setpoints ---
      const now = new Date();
      const timeStr = `${now.getHours().toString().padStart(2,'0')}:${now.getMinutes().toString().padStart(2,'0')}:${now.getSeconds().toString().padStart(2,'0')}`;

      // A. Oven temperature high warning
      if (ovenTempActual > 132) {
        if (!alarms.some(a => a.message.includes('Oven temperature high'))) {
          setAlarms(prev => [
            { id: Date.now().toString(), time: timeStr, stage: 'Paint Oven', level: 'warning', message: `Oven temperature high (${ovenTempActual}°C). Stoved chassis paint scorching risk!` },
            ...prev.slice(0, 8)
          ]);
        }
      }

      // B. Sprayer active with no ventilation
      if (plcStatus['Paint_Sprayer_VPLC'] === 'RUN' && ventFanSpeed === 'OFF') {
        if (!alarms.some(a => a.message.includes('ventilation fan OFF'))) {
          setAlarms(prev => [
            { id: Date.now().toString(), time: timeStr, stage: 'Paint Booth', level: 'error', message: `CRITICAL: Sprayer running with ventilation fan OFF! Toxic VOC gas buildup risk!` },
            ...prev.slice(0, 8)
          ]);
        }
      }

      // C. Air pressure dangerously low
      if (compressorPressureActual < 4.4 && plcStatus['Air_Compressor_VPLC'] === 'STOP') {
        if (!alarms.some(a => a.message.includes('Air header pressure low'))) {
          setAlarms(prev => [
            { id: Date.now().toString(), time: timeStr, stage: 'Pneumatics', level: 'warning', message: `Air header pressure low (${compressorPressureActual} Bar). Clamping force degraded.` },
            ...prev.slice(0, 8)
          ]);
        }
      }

      // D. Cooling flow zero while welding
      if ((plcStatus['Weld_Robot_A_VPLC'] === 'RUN' || plcStatus['Weld_Robot_B_VPLC'] === 'RUN') && coolingFlowActual < 10) {
        if (!alarms.some(a => a.message.includes('Cooling flow near zero'))) {
          setAlarms(prev => [
            { id: Date.now().toString(), time: timeStr, stage: 'Weld Cell', level: 'error', message: `CRITICAL: Cooling flow near zero! Welding transformer cooling jacket overheating risk!` },
            ...prev.slice(0, 8)
          ]);
        }
      }

    }, 3000);

    return () => clearInterval(interval);
  }, [isRunning, actualCount, targetCount, lineStopped, conveyorRpm, speedMultiplier, activeSystem, plcStatus, pressPressureSet, weldCurrentSet, ovenTempSet, nozzlePressureSet, ventFanSpeed, compressorPressureSet, coolingValveOpen, breakerTripped, alarms]);

  // Canvas drawing effect for all 4 sub-systems
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationFrameId: number;
    let localActiveStage = 0; 
    let width = (canvas.width = canvas.offsetWidth);
    let height = (canvas.height = canvas.offsetHeight);

    const handleResize = () => {
      if (!canvas) return;
      width = canvas.width = canvas.offsetWidth;
      height = canvas.height = canvas.offsetHeight;
    };

    window.addEventListener('resize', handleResize);

    // Assembly Stages setup
    interface AssemblyStage {
      name: string;
      desc: string;
      x: number;
      y: number;
      robotAngle: number;
      robotDirection: number;
      status: 'idle' | 'processing' | 'error';
    }

    const stages: AssemblyStage[] = [
      { name: '1. Body Ingest', desc: '차체 입고', x: 80, y: 150, robotAngle: 0, robotDirection: 1, status: 'processing' },
      { name: '2. Door Off', desc: '도어 탈거 및 서브 라인 이송', x: 230, y: 150, robotAngle: 0, robotDirection: 1, status: 'processing' },
      { name: '3. Interior Trim', desc: '의장/내장 실내 조립', x: 380, y: 150, robotAngle: 0, robotDirection: 1, status: 'processing' },
      { name: '4. Chassis Marriage', desc: '샤시/엔진 하부 도킹', x: 530, y: 150, robotAngle: 0, robotDirection: 1, status: 'processing' },
      { name: '5. Glassing', desc: '전/후면 유리 장착', x: 530, y: 320, robotAngle: 0, robotDirection: -1, status: 'processing' },
      { name: '6. Door On', desc: '도어 장착 및 배선 복원', x: 380, y: 320, robotAngle: 0, robotDirection: -1, status: 'processing' },
      { name: '7. Fluid Fill & Test', desc: '유액 주입 및 전기 검사', x: 230, y: 320, robotAngle: 0, robotDirection: -1, status: 'processing' },
      { name: '8. Roll-out & QC', desc: '최종 검사 및 검사 완료', x: 80, y: 320, robotAngle: 0, robotDirection: -1, status: 'processing' },
    ];

    // Vehicles on the conveyor belt
    interface Vehicle {
      id: number;
      x: number;
      y: number;
      stageIdx: number;
      progress: number;
      hasDoors: boolean;
      hasEngine: boolean;
      hasGlass: boolean;
      color: string;
      serialNo: string;
    }

    const vehicles: Vehicle[] = [
      { id: 1, x: 0, y: 0, stageIdx: 0, progress: 0.1, hasDoors: true, hasEngine: false, hasGlass: false, color: '#38bdf8', serialNo: generateSerialNo() },
      { id: 2, x: 0, y: 0, stageIdx: 2, progress: 0.3, hasDoors: false, hasEngine: false, hasGlass: false, color: '#ec4899', serialNo: generateSerialNo() },
      { id: 3, x: 0, y: 0, stageIdx: 4, progress: 0.2, hasDoors: false, hasEngine: true, hasGlass: true, color: '#10b981', serialNo: generateSerialNo() },
      { id: 4, x: 0, y: 0, stageIdx: 6, progress: 0.8, hasDoors: true, hasEngine: true, hasGlass: true, color: '#f97316', serialNo: generateSerialNo() },
    ];

    let conveyorOffset = 0;
    let marriageLiftY = 0; 
    let marriageProgress = 0;

    // Welding & Press local positions
    let pressYOffset = 0;
    let weldArmAngle1 = 0;
    let weldArmAngle2 = 0;
    let weldProgress = 0;

    // Paint shop local positions
    let sprayX = 100;
    let sprayDirection = 1;
    let paintCoverage = 0;
    let fanAngle = 0;

    // Utility local values
    let compMotorAngle = 0;
    let pumpImpellerAngle = 0;
    let pipeFlowOffset = 0;

    const drawRobotArm = (ctx: CanvasRenderingContext2D, rx: number, ry: number, angle: number, isWorking: boolean, activeColor: string) => {
      ctx.save();
      ctx.translate(rx, ry);
      
      ctx.fillStyle = 'rgba(71, 85, 105, 0.95)';
      ctx.beginPath();
      ctx.rect(-22, -6, 44, 12);
      ctx.fill();
      ctx.strokeStyle = '#94a3b8';
      ctx.lineWidth = 1.5;
      ctx.stroke();

      ctx.fillStyle = 'rgba(148, 163, 184, 1)';
      ctx.beginPath();
      ctx.arc(0, -6, 12, 0, Math.PI * 2);
      ctx.fill();

      ctx.rotate(angle);
      ctx.lineWidth = 10;
      ctx.strokeStyle = '#334155';
      ctx.beginPath();
      ctx.moveTo(0, -6);
      ctx.lineTo(0, -45);
      ctx.stroke();

      ctx.fillStyle = '#94a3b8';
      ctx.beginPath();
      ctx.arc(0, -45, 7, 0, Math.PI * 2);
      ctx.fill();

      ctx.rotate(angle * 0.7);
      ctx.lineWidth = 6;
      ctx.strokeStyle = '#475569';
      ctx.beginPath();
      ctx.moveTo(0, -45);
      ctx.lineTo(0, -85);
      ctx.stroke();

      const tx = 0;
      const ty = -85;
      ctx.fillStyle = isWorking ? activeColor : '#64748b';
      ctx.beginPath();
      ctx.arc(tx, ty, 6, 0, Math.PI * 2);
      ctx.fill();

      if (isWorking) {
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(tx, ty, 9, 0, Math.PI * 2);
        ctx.stroke();
      }

      ctx.restore();
    };

    const drawCarOutline = (ctx: CanvasRenderingContext2D, cx: number, cy: number, hasDoors: boolean, hasEngine: boolean, hasGlass: boolean, color: string, stageIdx: number, progress: number, forceAlpha = 1.0) => {
      ctx.save();
      ctx.translate(cx, cy);
      ctx.globalAlpha = forceAlpha;

      if (stageIdx === 0) {
        ctx.globalAlpha = Math.min(1.0, progress * 1.5) * forceAlpha;
      } else if (stageIdx === 7) {
        ctx.globalAlpha = Math.max(0, 1 - progress) * forceAlpha;
      }

      ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
      ctx.beginPath();
      ctx.ellipse(0, 20, 44, 8, 0, 0, Math.PI * 2);
      ctx.fill();

      ctx.lineWidth = 4;
      ctx.strokeStyle = '#475569';
      ctx.beginPath();
      ctx.moveTo(-42, 10);
      ctx.lineTo(42, 10);
      ctx.stroke();

      ctx.fillStyle = '#0f172a';
      ctx.strokeStyle = '#94a3b8';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.arc(-26, 10, 9, 0, Math.PI * 2);
      ctx.arc(26, 10, 9, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      
      ctx.fillStyle = '#64748b';
      ctx.beginPath();
      ctx.arc(-26, 10, 4, 0, Math.PI * 2);
      ctx.arc(26, 10, 4, 0, Math.PI * 2);
      ctx.fill();

      let showEngine = hasEngine;
      let engineAlpha = 1.0;
      if (stageIdx === 3) {
        showEngine = progress >= 0.5;
        engineAlpha = showEngine ? 1.0 : 0.0;
      } else if (stageIdx < 3) {
        showEngine = false;
      }

      if (showEngine) {
        ctx.save();
        ctx.globalAlpha = ctx.globalAlpha * engineAlpha;
        ctx.fillStyle = '#ef4444';
        ctx.beginPath();
        ctx.roundRect(-34, 0, 14, 10, 2);
        ctx.fill();
        ctx.strokeStyle = '#b91c1c';
        ctx.lineWidth = 1.5;
        ctx.stroke();
        ctx.restore();
      }

      ctx.fillStyle = 'rgba(15, 23, 42, 0.95)';
      ctx.strokeStyle = color;
      ctx.lineWidth = 3.5;
      ctx.beginPath();
      
      ctx.moveTo(-44, 8);
      ctx.lineTo(-44, -2);
      ctx.lineTo(-32, -8);
      ctx.lineTo(-16, -22);
      ctx.lineTo(10, -22);
      ctx.lineTo(26, -8);
      ctx.lineTo(44, -2);
      ctx.lineTo(44, 8);
      ctx.lineTo(36, 8);
      ctx.arc(26, 8, 11, 0, Math.PI, true);
      ctx.lineTo(-16, 8);
      ctx.arc(-26, 8, 11, 0, Math.PI, true);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      let showInnerVisual = !hasDoors;
      let innerVisualAlpha = 1.0;
      
      if (stageIdx === 1) {
        showInnerVisual = true;
        innerVisualAlpha = progress;
      } else if (stageIdx === 5) {
        showInnerVisual = true;
        innerVisualAlpha = 1 - progress;
      }

      if (showInnerVisual) {
        ctx.save();
        ctx.globalAlpha = ctx.globalAlpha * innerVisualAlpha;
        ctx.strokeStyle = 'rgba(234, 179, 8, 0.65)';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(-12, -18);
        ctx.lineTo(18, -18);
        ctx.lineTo(18, 6);
        ctx.lineTo(-12, 6);
        ctx.closePath();
        ctx.stroke();

        ctx.fillStyle = '#64748b';
        ctx.beginPath();
        ctx.rect(8, -12, 8, 15);
        ctx.fill();
        ctx.restore();
      }

      let showDoors = hasDoors;
      let doorsAlpha = 1.0;
      
      if (stageIdx === 1) {
        showDoors = true;
        doorsAlpha = Math.max(0, 1 - progress);
      } else if (stageIdx === 5) {
        showDoors = true;
        doorsAlpha = progress;
      } else if (stageIdx > 1 && stageIdx < 5) {
        showDoors = false;
      }

      if (showDoors) {
        ctx.save();
        ctx.globalAlpha = ctx.globalAlpha * doorsAlpha;
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(4, -19);
        ctx.lineTo(21, -8);
        ctx.lineTo(18, 8);
        ctx.lineTo(4, 8);
        ctx.closePath();
        ctx.stroke();

        ctx.beginPath();
        ctx.moveTo(-12, -19);
        ctx.lineTo(2, -19);
        ctx.lineTo(2, 8);
        ctx.lineTo(-10, 8);
        ctx.closePath();
        ctx.stroke();
        ctx.restore();
      }

      let showGlass = hasGlass;
      let glassAlpha = 1.0;
      
      if (stageIdx === 4) {
        showGlass = true;
        glassAlpha = progress;
      } else if (stageIdx < 4) {
        showGlass = false;
      }

      if (showGlass) {
        ctx.save();
        ctx.globalAlpha = ctx.globalAlpha * glassAlpha;
        ctx.fillStyle = 'rgba(56, 189, 248, 0.45)';
        ctx.beginPath();
        ctx.moveTo(10, -20);
        ctx.lineTo(24, -8);
        ctx.lineTo(12, -8);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
      }

      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(0, -32, 4, 0, Math.PI * 2);
      ctx.fill();

      ctx.restore();
    };

    const drawConveyorBelt = (ctx: CanvasRenderingContext2D) => {
      ctx.save();
      ctx.strokeStyle = '#1e293b';
      ctx.lineWidth = 22;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      
      ctx.beginPath();
      ctx.moveTo(30, 150);
      ctx.lineTo(580, 150);
      ctx.arc(580, 235, 85, -Math.PI/2, Math.PI/2);
      ctx.lineTo(30, 320);
      ctx.stroke();

      ctx.strokeStyle = '#475569';
      ctx.lineWidth = 5;
      ctx.setLineDash([12, 18]);
      ctx.lineDashOffset = -conveyorOffset;
      ctx.beginPath();
      ctx.moveTo(30, 150);
      ctx.lineTo(580, 150);
      ctx.arc(580, 235, 85, -Math.PI/2, Math.PI/2);
      ctx.lineTo(30, 320);
      ctx.stroke();

      ctx.setLineDash([]);
      ctx.restore();
    };

    const render = () => {
      ctx.clearRect(0, 0, width, height);

      // Draw technical grid background
      ctx.strokeStyle = 'rgba(56, 189, 248, 0.015)';
      ctx.lineWidth = 1;
      const step = 30;
      for (let x = 0; x < width; x += step) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, height);
        ctx.stroke();
      }
      for (let y = 0; y < height; y += step) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(width, y);
        ctx.stroke();
      }

      // Decide color scheme base on system status
      let drawingAlpha = 1.0;
      if (breakerTripped) {
        drawingAlpha = 0.35;
      }

      ctx.save();
      ctx.globalAlpha = drawingAlpha;

      if (activeSystem === 'assembly') {
        // --- 1. Assembly Shop Mimic ---
        if (isRunning && !lineStopped) {
          conveyorOffset += 1.2 * speedMultiplier * (conveyorRpm / 1450);
        }

        drawConveyorBelt(ctx);

        stages.forEach((stage, idx) => {
          const isCurrentActive = localActiveStage === idx;
          const plcNames = [
            'Feeder_VPLC', 'DoorOff_VPLC', 'Trim_VPLC', 'Marriage_VPLC',
            'Glassing_VPLC', 'DoorOn_VPLC', 'Inspection_VPLC', 'Inspection_VPLC'
          ];
          const correspondingPlc = plcNames[idx];
          const isPlcStopped = plcStatus[correspondingPlc] === 'STOP';

          const color = isPlcStopped
            ? '#ef4444'
            : isCurrentActive 
              ? (idx === 3 && marriageProgress > 0.1 ? '#a855f7' : '#10b981')
              : '#334155';

          ctx.save();
          ctx.fillStyle = 'rgba(15, 23, 42, 0.8)';
          ctx.strokeStyle = color;
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.roundRect(stage.x - 45, stage.y - 25, 90, 50, 6);
          ctx.fill();
          ctx.stroke();
          ctx.restore();

          ctx.fillStyle = '#f8fafc';
          ctx.font = 'bold 9.5px Outfit';
          ctx.textAlign = 'center';
          ctx.fillText(stage.name, stage.x, stage.y - 32);
          
          ctx.fillStyle = '#94a3b8';
          ctx.font = '8px Outfit';
          ctx.fillText(stage.desc, stage.x, stage.y + 40);

          if (isRunning && !lineStopped && !isPlcStopped) {
            stage.robotAngle = Math.sin(Date.now() * 0.0025 * speedMultiplier + idx) * 0.75;
          }

          const isArmWorking = isCurrentActive && !lineStopped && !isPlcStopped;
          if (idx === 1) {
            drawRobotArm(ctx, stage.x - 25, stage.y - 20, stage.robotAngle, isArmWorking, '#38bdf8');
          } else if (idx === 2) {
            drawRobotArm(ctx, stage.x, stage.y - 22, stage.robotAngle, isArmWorking, '#a855f7');
          } else if (idx === 4) {
            drawRobotArm(ctx, stage.x - 20, stage.y + 22, stage.robotAngle, isArmWorking, '#10b981');
          } else if (idx === 5) {
            drawRobotArm(ctx, stage.x, stage.y + 22, stage.robotAngle, isArmWorking, '#f59e0b');
          }

          if (idx === 3) {
            if (isRunning && !lineStopped && plcStatus['Marriage_VPLC'] !== 'STOP') {
              marriageProgress = (Date.now() * 0.001) % 6;
              if (marriageProgress < 2) {
                marriageLiftY = (marriageProgress / 2) * -34;
              } else if (marriageProgress < 4) {
                marriageLiftY = -34;
              } else {
                marriageLiftY = -34 + ((marriageProgress - 4) / 2) * 34;
              }
            }

            ctx.save();
            ctx.translate(stage.x, stage.y);
            ctx.strokeStyle = '#475569';
            ctx.lineWidth = 3;
            ctx.beginPath();
            ctx.moveTo(-25, 20);
            ctx.lineTo(-25, 20 + marriageLiftY);
            ctx.moveTo(25, 20);
            ctx.lineTo(25, 20 + marriageLiftY);
            ctx.stroke();

            ctx.fillStyle = '#64748b';
            ctx.beginPath();
            ctx.roundRect(-30, 20 + marriageLiftY, 60, 5, 2);
            ctx.fill();

            if (marriageProgress < 3.5) {
              ctx.fillStyle = '#ef4444';
              ctx.beginPath();
              ctx.rect(-8, 14 + marriageLiftY, 16, 6);
              ctx.fill();
            }
            ctx.restore();
          }

          if (isCurrentActive) {
            ctx.beginPath();
            ctx.arc(stage.x + 35, stage.y - 15, 3.5, 0, Math.PI * 2);
            ctx.fillStyle = color;
            ctx.fill();
          }
        });

        vehicles.forEach(veh => {
          if (isRunning && !lineStopped) {
            const plcNames = [
              'Feeder_VPLC', 'DoorOff_VPLC', 'Trim_VPLC', 'Marriage_VPLC',
              'Glassing_VPLC', 'DoorOn_VPLC', 'Inspection_VPLC', 'Inspection_VPLC'
            ];
            const currPlc = plcNames[veh.stageIdx];
            const isPlcStopped = plcStatus[currPlc] === 'STOP';

            if (!isPlcStopped) {
              veh.progress += 0.004 * speedMultiplier * (conveyorRpm / 1450);
              if (veh.progress >= 1.0) {
                veh.progress = 0;
                veh.stageIdx = (veh.stageIdx + 1) % stages.length;
                
                if (veh.stageIdx === 1) {
                  veh.hasDoors = false;
                } else if (veh.stageIdx === 3) {
                  veh.hasEngine = true;
                } else if (veh.stageIdx === 4) {
                  veh.hasGlass = true;
                } else if (veh.stageIdx === 5) {
                  veh.hasDoors = true;
                } else if (veh.stageIdx === 0) {
                  veh.hasDoors = true;
                  veh.hasEngine = false;
                  veh.hasGlass = false;
                  veh.color = ['#38bdf8', '#ec4899', '#10b981', '#f97316'][Math.floor(Math.random() * 4)];
                  veh.serialNo = generateSerialNo();
                }
              }
            }
          }

          const currentStage = stages[veh.stageIdx];
          const nextStageIdx = (veh.stageIdx + 1) % stages.length;
          const nextStage = stages[nextStageIdx];

          let vx = currentStage.x;
          let vy = currentStage.y;

          if (veh.stageIdx === 3) {
            const startAngle = -Math.PI / 2;
            const endAngle = Math.PI / 2;
            const currAngle = startAngle + (endAngle - startAngle) * veh.progress;
            vx = 580 + Math.cos(currAngle) * 85;
            vy = 235 + Math.sin(currAngle) * 85;
          } else if (veh.stageIdx === 7) {
            vx = currentStage.x;
            vy = currentStage.y - (currentStage.y - nextStage.y) * veh.progress;
          } else {
            vx = currentStage.x + (nextStage.x - currentStage.x) * veh.progress;
            vy = currentStage.y + (nextStage.y - currentStage.y) * veh.progress;
          }

          if (veh.progress < 0.25) {
            localActiveStage = veh.stageIdx;
          }

          drawCarOutline(ctx, vx, vy, veh.hasDoors, veh.hasEngine, veh.hasGlass, veh.color, veh.stageIdx, veh.progress);
          
          // Draw Serial Number HUD badge above vehicle
          ctx.save();
          ctx.fillStyle = 'rgba(15, 23, 42, 0.75)';
          ctx.strokeStyle = veh.color;
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.roundRect(vx - 28, vy - 42, 56, 12, 3);
          ctx.fill();
          ctx.stroke();

          ctx.fillStyle = '#ffffff';
          ctx.font = 'bold 7px JetBrains Mono';
          ctx.textAlign = 'center';
          ctx.fillText(veh.serialNo, vx, vy - 34);
          ctx.restore();
        });

      } else if (activeSystem === 'welding') {
        // --- 2. Welding & Press Mimic ---
        
        // Horizontal conveyor feed line for stamping
        ctx.save();
        ctx.strokeStyle = '#1e293b';
        ctx.lineWidth = 14;
        ctx.beginPath();
        ctx.moveTo(30, 290);
        ctx.lineTo(600, 290);
        ctx.stroke();

        ctx.strokeStyle = '#475569';
        ctx.lineWidth = 4;
        ctx.setLineDash([8, 12]);
        if (isRunning && !lineStopped) {
          pipeFlowOffset += 1.5 * speedMultiplier;
        }
        ctx.lineDashOffset = -pipeFlowOffset;
        ctx.beginPath();
        ctx.moveTo(30, 290);
        ctx.lineTo(600, 290);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.restore();

        // 2A. LEFT SIDE: Hydraulic Stamping Press
        const isPressRun = plcStatus['Press_Hydraulic_VPLC'] === 'RUN' && !lineStopped;
        if (isPressRun) {
          weldProgress = (Date.now() * 0.0015 * speedMultiplier) % Math.PI;
          pressYOffset = Math.abs(Math.sin(weldProgress)) * 55;
        }

        // Draw Press frame structure
        ctx.fillStyle = '#1e293b';
        ctx.strokeStyle = plcStatus['Press_Hydraulic_VPLC'] === 'STOP' ? '#ef4444' : '#64748b';
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.roundRect(60, 90, 160, 220, 8);
        ctx.fill();
        ctx.stroke();

        // Press inner cavity
        ctx.fillStyle = '#090d16';
        ctx.fillRect(80, 130, 120, 150);

        // Cylinder rod
        ctx.fillStyle = '#94a3b8';
        ctx.fillRect(135, 100, 10, 40 + pressYOffset);

        // Heavy Press Head (Sliding block)
        ctx.fillStyle = '#475569';
        ctx.strokeStyle = '#cbd5e1';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.roundRect(90, 120 + pressYOffset, 100, 30, 3);
        ctx.fill();
        ctx.stroke();

        // Die base & workpiece metal plate
        ctx.fillStyle = '#334155';
        ctx.fillRect(95, 275, 90, 10);

        // Glowing metal being stamped
        let metalGlowAlpha = 0;
        if (pressYOffset > 45) {
          metalGlowAlpha = (pressYOffset - 45) / 10;
        }
        ctx.save();
        ctx.globalAlpha = metalGlowAlpha;
        ctx.fillStyle = 'rgba(249, 115, 22, 0.9)'; // Neon orange
        ctx.fillRect(100, 270, 80, 5);
        ctx.restore();

        // Stamping shockwave ring (Impact)
        if (pressYOffset > 52 && isPressRun) {
          ctx.strokeStyle = `rgba(253, 224, 71, ${1 - (pressYOffset - 52) / 3})`;
          ctx.lineWidth = 2.5;
          ctx.beginPath();
          ctx.ellipse(140, 270, 45, 12, 0, 0, Math.PI * 2);
          ctx.stroke();
        }

        // Stamping HUD Text
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 9px Outfit';
        ctx.fillText('HYDRAULIC PRESS SHOP', 140, 82);
        
        ctx.fillStyle = plcStatus['Press_Hydraulic_VPLC'] === 'STOP' ? '#ef4444' : '#10b981';
        ctx.font = '7.5px JetBrains Mono';
        ctx.fillText(`FORCE: ${isPressRun ? (pressPressureActual * 1.05).toFixed(1) : '0.0'} TON`, 140, 115);

        // 2B. RIGHT SIDE: Dual Robotic Welding Cell
        const isRobotARun = plcStatus['Weld_Robot_A_VPLC'] === 'RUN' && !lineStopped;
        const isRobotBRun = plcStatus['Weld_Robot_B_VPLC'] === 'RUN' && !lineStopped;

        if (isRunning && !lineStopped) {
          weldArmAngle1 = Math.sin(Date.now() * 0.0018 * speedMultiplier) * 0.45 - 0.25;
          weldArmAngle2 = -Math.sin(Date.now() * 0.0022 * speedMultiplier + 0.8) * 0.45 + 0.25;
        }

        // Draw central welding work station jig
        ctx.fillStyle = '#1e293b';
        ctx.strokeStyle = '#475569';
        ctx.beginPath();
        ctx.roundRect(370, 200, 160, 95, 6);
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = '#090d16';
        ctx.fillRect(380, 210, 140, 60);

        // Car chassis steel panel sitting on fixture
        ctx.strokeStyle = '#94a3b8';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(395, 240);
        ctx.lineTo(505, 240);
        ctx.lineTo(515, 260);
        ctx.lineTo(385, 260);
        ctx.closePath();
        ctx.stroke();

        // Weld Robot A base (Left)
        ctx.fillStyle = '#334155';
        ctx.fillRect(330, 260, 30, 40);
        // Weld Robot B base (Right)
        ctx.fillStyle = '#334155';
        ctx.fillRect(540, 260, 30, 40);

        // Draw Robot Arms
        drawRobotArm(ctx, 345, 260, weldArmAngle1, isRobotARun, '#38bdf8');
        drawRobotArm(ctx, 555, 260, weldArmAngle2, isRobotBRun, '#ec4899');

        // Weld sparks / Breathing Neon Arc Light (Flicker-free, safe gradient ring)
        if (isRobotARun && Math.abs(weldArmAngle1 + 0.25) < 0.2) {
          ctx.save();
          const gradient = ctx.createRadialGradient(420, 240, 2, 420, 240, 18);
          gradient.addColorStop(0, '#ffffff');
          gradient.addColorStop(0.3, 'rgba(56, 189, 248, 0.7)');
          gradient.addColorStop(1, 'rgba(56, 189, 248, 0)');
          ctx.fillStyle = gradient;
          ctx.beginPath();
          ctx.arc(420, 240, 18, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();
        }

        if (isRobotBRun && Math.abs(weldArmAngle2 - 0.25) < 0.2) {
          ctx.save();
          const gradient = ctx.createRadialGradient(480, 245, 2, 480, 245, 18);
          gradient.addColorStop(0, '#ffffff');
          gradient.addColorStop(0.3, 'rgba(236, 72, 153, 0.7)');
          gradient.addColorStop(1, 'rgba(236, 72, 153, 0)');
          ctx.fillStyle = gradient;
          ctx.beginPath();
          ctx.arc(480, 245, 18, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();
        }

        // Weld Cell HUD Text
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 9px Outfit';
        ctx.fillText('TWIN ROBOTIC WELDING CELL', 450, 82);

        ctx.fillStyle = '#f8fafc';
        ctx.font = '8px Outfit';
        ctx.fillText('Weld Arc Status: ACTIVE & MONITORING', 450, 192);

      } else if (activeSystem === 'paint') {
        // --- 3. Paint Shop & Oven Mimic ---

        // Conveyor Line moving chassis
        ctx.save();
        ctx.strokeStyle = '#1e293b';
        ctx.lineWidth = 14;
        ctx.beginPath();
        ctx.moveTo(30, 280);
        ctx.lineTo(600, 280);
        ctx.stroke();
        ctx.restore();

        // 3A. LEFT HALF: Automated Spray Paint Booth (x: 50 to 300)
        ctx.fillStyle = 'rgba(15, 23, 42, 0.7)';
        ctx.strokeStyle = '#38bdf8';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.roundRect(50, 90, 230, 230, 6);
        ctx.fill();
        ctx.stroke();

        // Spray linear rail
        ctx.fillStyle = '#475569';
        ctx.fillRect(70, 120, 190, 8);

        // Spray gantry moving back & forth
        const isSprayerRun = plcStatus['Paint_Sprayer_VPLC'] === 'RUN' && !lineStopped;
        if (isSprayerRun && isRunning) {
          sprayX += 2.2 * sprayDirection * speedMultiplier;
          if (sprayX > 220) {
            sprayDirection = -1;
          } else if (sprayX < 100) {
            sprayDirection = 1;
          }
        }

        ctx.fillStyle = '#94a3b8';
        ctx.fillRect(sprayX, 115, 25, 18);

        // Spray Nozzle tip & spray pattern
        ctx.fillStyle = '#cbd5e1';
        ctx.fillRect(sprayX + 10, 133, 5, 8);

        if (isSprayerRun) {
          ctx.save();
          const gradient = ctx.createLinearGradient(sprayX + 12, 141, sprayX + 12, 230);
          gradient.addColorStop(0, 'rgba(56, 189, 248, 0.5)');
          gradient.addColorStop(1, 'rgba(236, 72, 153, 0)');
          ctx.fillStyle = gradient;
          ctx.beginPath();
          ctx.moveTo(sprayX + 12, 141);
          ctx.lineTo(sprayX - 25, 230);
          ctx.lineTo(sprayX + 50, 230);
          ctx.closePath();
          ctx.fill();
          ctx.restore();
        }

        // Car chassis inside booth
        ctx.save();
        // Body color turns slowly into neon pink while spraying!
        let computedPaintColor = '#475569'; // unpainted base
        if (isSprayerRun) {
          paintCoverage = (Date.now() * 0.0001) % 1.0;
          computedPaintColor = `hsl(328, 86%, ${40 + paintCoverage * 15}%)`;
        }
        drawCarOutline(ctx, 160, 240, true, false, false, computedPaintColor, 4, 0.5, 0.95);
        ctx.restore();

        // Exhaust Fan rotation
        const isFanRun = plcStatus['Air_Circulation_VPLC'] === 'RUN' && ventFanSpeed !== 'OFF' && !breakerTripped;
        if (isFanRun) {
          const fanSpd = ventFanSpeed === 'HIGH' ? 0.35 : ventFanSpeed === 'MED' ? 0.2 : 0.08;
          fanAngle += fanSpd * speedMultiplier;
        }

        // Draw Fan graphic
        ctx.save();
        ctx.translate(240, 150);
        ctx.strokeStyle = '#475569';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(0, 0, 16, 0, Math.PI * 2);
        ctx.stroke();
        
        ctx.rotate(fanAngle);
        ctx.fillStyle = '#64748b';
        for (let i = 0; i < 3; i++) {
          ctx.rotate((Math.PI * 2) / 3);
          ctx.beginPath();
          ctx.moveTo(0, 0);
          ctx.ellipse(0, -8, 5, 8, 0, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.restore();

        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 8.5px Outfit';
        ctx.fillText('PAINT BOOTH', 165, 82);

        // 3B. RIGHT HALF: Drying & Curing Oven Chamber (x: 320 to 580)
        ctx.fillStyle = 'rgba(15, 23, 42, 0.8)';
        ctx.strokeStyle = plcStatus['Oven_Heater_VPLC'] === 'STOP' ? '#64748b' : '#f43f5e';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.roundRect(320, 90, 250, 230, 6);
        ctx.fill();
        ctx.stroke();

        // IR Heater panel strips (top & bottom)
        const isHeaterRun = plcStatus['Oven_Heater_VPLC'] === 'RUN' && !lineStopped;
        const coilColor = isHeaterRun 
          ? `rgba(239, 68, 68, ${0.4 + Math.sin(Date.now() * 0.0035) * 0.35})` 
          : 'rgba(51, 65, 85, 0.8)';

        ctx.fillStyle = coilColor;
        ctx.fillRect(340, 105, 210, 12);
        ctx.fillRect(340, 243, 210, 12);

        // Heat wave vectors floating upward
        if (isHeaterRun && isRunning) {
          ctx.save();
          ctx.strokeStyle = 'rgba(239, 68, 68, 0.25)';
          ctx.lineWidth = 1.5;
          ctx.setLineDash([5, 8]);
          const waveOffset = (Date.now() * 0.04) % 140;
          for (let wx = 360; wx <= 530; wx += 40) {
            ctx.beginPath();
            ctx.moveTo(wx, 235 - waveOffset);
            ctx.bezierCurveTo(wx + 5, 215 - waveOffset, wx - 5, 195 - waveOffset, wx, 175 - waveOffset);
            ctx.stroke();
          }
          ctx.restore();
        }

        // Car chassis baking inside oven
        ctx.save();
        drawCarOutline(ctx, 440, 205, true, true, true, '#be123c', 4, 0.8, 0.95);
        ctx.restore();

        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 8.5px Outfit';
        ctx.fillText('DRYING OVEN (IR CURE)', 445, 82);

        ctx.fillStyle = isHeaterRun ? '#ef4444' : '#64748b';
        ctx.font = 'bold 8px JetBrains Mono';
        ctx.fillText(`TEMP: ${ovenTempActual.toFixed(1)} °C`, 445, 130);

      } else if (activeSystem === 'utility') {
        // --- 4. Power & Utility Mimic (P&ID Loop Diagram) ---

        // 4A. MAIN AIR COMPRESSOR UNIT (Top Left: x: 50 to 280)
        ctx.fillStyle = 'rgba(15, 23, 42, 0.8)';
        ctx.strokeStyle = plcStatus['Air_Compressor_VPLC'] === 'STOP' ? '#ef4444' : '#10b981';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.roundRect(50, 90, 220, 110, 6);
        ctx.fill();
        ctx.stroke();

        // Compressor schematic circles (Belt Pulley drive)
        const isCompRun = plcStatus['Air_Compressor_VPLC'] === 'RUN' && !breakerTripped;
        if (isCompRun && isRunning) {
          compMotorAngle += 0.12 * speedMultiplier;
        }

        // Motor pulley
        ctx.save();
        ctx.translate(90, 140);
        ctx.rotate(compMotorAngle);
        ctx.strokeStyle = '#94a3b8';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(0, 0, 14, 0, Math.PI * 2);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(-14, 0); ctx.lineTo(14, 0);
        ctx.moveTo(0, -14); ctx.lineTo(0, 14);
        ctx.stroke();
        ctx.restore();

        // Compressor Cylinder / Receiver Tank
        ctx.fillStyle = '#334155';
        ctx.strokeStyle = '#cbd5e1';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.roundRect(170, 110, 80, 60, 4);
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = 'rgba(56, 189, 248, 0.15)';
        ctx.fillRect(170, 140, 80, 30);

        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 8.5px Outfit';
        ctx.fillText('AIR COMPRESSOR UNIT', 160, 82);

        // Pipe connecting compressor to main header
        ctx.save();
        ctx.strokeStyle = isCompRun ? '#38bdf8' : '#334155';
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.moveTo(250, 140);
        ctx.lineTo(340, 140);
        ctx.lineTo(340, 240);
        ctx.stroke();
        ctx.restore();

        // 4B. COOLING WATER PUMP (Bottom Left: x: 50 to 280)
        ctx.fillStyle = 'rgba(15, 23, 42, 0.8)';
        ctx.strokeStyle = plcStatus['Cool_Water_Pump_VPLC'] === 'STOP' ? '#ef4444' : '#10b981';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.roundRect(50, 210, 220, 110, 6);
        ctx.fill();
        ctx.stroke();

        // Centrifugal pump impeller rotation
        const isPumpRun = plcStatus['Cool_Water_Pump_VPLC'] === 'RUN' && !breakerTripped;
        if (isPumpRun && isRunning) {
          pumpImpellerAngle += 0.08 * (coolingValveOpen / 100) * speedMultiplier;
        }

        ctx.save();
        ctx.translate(110, 265);
        ctx.rotate(pumpImpellerAngle);
        ctx.strokeStyle = '#3b82f6';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(0, 0, 16, 0, Math.PI * 2);
        ctx.stroke();
        // Impeller blades
        for(let i=0; i<6; i++) {
          ctx.rotate(Math.PI / 3);
          ctx.beginPath();
          ctx.moveTo(0,0);
          ctx.lineTo(0, -14);
          ctx.stroke();
        }
        ctx.restore();

        // Water reservoir tank
        ctx.fillStyle = '#1e293b';
        ctx.fillRect(170, 230, 80, 70);
        
        ctx.fillStyle = 'rgba(59, 130, 246, 0.45)'; // Water level fill
        const fillH = 70 * (coolingValveOpen / 120);
        ctx.fillRect(170, 300 - fillH, 80, fillH);

        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 8.5px Outfit';
        ctx.fillText('COOLING WATER PUMP', 160, 204);

        // Pipe loop
        ctx.save();
        ctx.strokeStyle = isPumpRun ? '#3b82f6' : '#334155';
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.moveTo(250, 265);
        ctx.lineTo(440, 265);
        ctx.stroke();
        ctx.restore();

        // 4C. HIGH-VOLTAGE SUBSTATION BREAKER BOX (Right Side: x: 300 to 580)
        ctx.fillStyle = 'rgba(15, 23, 42, 0.8)';
        ctx.strokeStyle = breakerTripped ? '#ef4444' : '#eab308';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.roundRect(290, 90, 280, 230, 6);
        ctx.fill();
        ctx.stroke();

        // Grid Busbar lines (Red, Yellow, Blue lines)
        ctx.lineWidth = 3;
        ctx.strokeStyle = breakerTripped ? '#475569' : '#ef4444'; // Phase L1
        ctx.beginPath(); ctx.moveTo(310, 180); ctx.lineTo(390, 180); ctx.stroke();
        ctx.strokeStyle = breakerTripped ? '#475569' : '#eab308'; // Phase L2
        ctx.beginPath(); ctx.moveTo(310, 190); ctx.lineTo(390, 190); ctx.stroke();
        ctx.strokeStyle = breakerTripped ? '#475569' : '#2563eb'; // Phase L3
        ctx.beginPath(); ctx.moveTo(310, 200); ctx.lineTo(390, 200); ctx.stroke();

        // Massive circuit breaker contacts
        ctx.fillStyle = breakerTripped ? '#ef4444' : '#10b981';
        ctx.fillRect(390, 170, 14, 40);

        // Diagonal switch contact blade
        ctx.strokeStyle = '#cbd5e1';
        ctx.lineWidth = 3.5;
        ctx.beginPath();
        if (breakerTripped) {
          // Open contact (tilted up, broken circuit)
          ctx.moveTo(404, 185);
          ctx.lineTo(425, 145);
        } else {
          // Closed contact (horizontal bridge)
          ctx.moveTo(404, 185);
          ctx.lineTo(440, 185);
        }
        ctx.stroke();

        // Busbars continuing after breaker
        ctx.lineWidth = 3;
        ctx.strokeStyle = breakerTripped ? '#475569' : '#ef4444';
        ctx.beginPath(); ctx.moveTo(440, 180); ctx.lineTo(550, 180); ctx.stroke();
        ctx.strokeStyle = breakerTripped ? '#475569' : '#eab308';
        ctx.beginPath(); ctx.moveTo(440, 190); ctx.lineTo(550, 190); ctx.stroke();
        ctx.strokeStyle = breakerTripped ? '#475569' : '#2563eb';
        ctx.beginPath(); ctx.moveTo(440, 200); ctx.lineTo(550, 200); ctx.stroke();

        // Substation electrical transformer graphic
        ctx.fillStyle = '#334155';
        ctx.strokeStyle = '#cbd5e1';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.roundRect(470, 220, 60, 60, 4);
        ctx.fill();
        ctx.stroke();

        // Concentric coil circles
        ctx.strokeStyle = '#eab308';
        ctx.lineWidth = 2.5;
        ctx.beginPath(); ctx.arc(492, 250, 12, 0, Math.PI * 2); ctx.stroke();
        ctx.beginPath(); ctx.arc(508, 250, 12, 0, Math.PI * 2); ctx.stroke();

        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 9px Outfit';
        ctx.fillText('HIGH-VOLTAGE TRANSITION CELL', 430, 82);

        // Flashing lightning bolts over grid
        if (!breakerTripped && isRunning && Math.random() < 0.1) {
          ctx.fillStyle = '#eab308';
          ctx.beginPath();
          ctx.moveTo(480, 120);
          ctx.lineTo(495, 135);
          ctx.lineTo(490, 138);
          ctx.lineTo(505, 155);
          ctx.lineTo(495, 142);
          ctx.lineTo(500, 138);
          ctx.closePath();
          ctx.fill();
        }
      }

      ctx.restore(); // Restore alpha level back to default

      // --- E-Stop or Safety Interlock warning border over the entire canvas ---
      if (isEStop) {
        ctx.save();
        ctx.strokeStyle = `rgba(239, 68, 68, ${0.2 + Math.abs(Math.sin(Date.now() * 0.005)) * 0.5})`;
        ctx.lineWidth = 6;
        ctx.strokeRect(3, 3, width - 6, height - 6);

        ctx.fillStyle = 'rgba(239, 68, 68, 0.05)';
        ctx.fillRect(0, 0, width, height);

        ctx.fillStyle = '#ef4444';
        ctx.font = 'bold 12px JetBrains Mono';
        ctx.textAlign = 'center';
        ctx.fillText('!!! EMERGENCY LINE STOP ACTIVATED !!!', width / 2, 45);
        ctx.restore();
      } else if (isInterlocked) {
        ctx.save();
        ctx.strokeStyle = `rgba(245, 158, 11, ${0.2 + Math.abs(Math.sin(Date.now() * 0.005)) * 0.5})`;
        ctx.lineWidth = 6;
        ctx.strokeRect(3, 3, width - 6, height - 6);

        ctx.fillStyle = 'rgba(245, 158, 11, 0.03)';
        ctx.fillRect(0, 0, width, height);

        ctx.fillStyle = '#f59e0b';
        ctx.font = 'bold 11px JetBrains Mono';
        ctx.textAlign = 'center';
        ctx.fillText('!!! SAFETY INTERLOCK HOLD IN PROCESS (VPLC SHUTDOWN DETECTED) !!!', width / 2, 45);
        ctx.restore();
      } else if (breakerTripped) {
        ctx.save();
        ctx.strokeStyle = `rgba(239, 68, 68, ${0.2 + Math.abs(Math.sin(Date.now() * 0.005)) * 0.6})`;
        ctx.lineWidth = 6;
        ctx.strokeRect(3, 3, width - 6, height - 6);

        ctx.fillStyle = 'rgba(239, 68, 68, 0.12)';
        ctx.fillRect(0, 0, width, height);

        ctx.fillStyle = '#f87171';
        ctx.font = 'bold 13px JetBrains Mono';
        ctx.textAlign = 'center';
        ctx.fillText('!!! UTILITY HIGH-VOLTAGE BREAKER OVERLOAD TRIP (NO POWER) !!!', width / 2, 45);
        ctx.restore();
      }

      // Ambient Factory sound HUD label
      ctx.fillStyle = lineStopped ? '#ef4444' : 'rgba(16, 185, 129, 0.4)';
      ctx.font = '8px JetBrains Mono';
      ctx.fillText(breakerTripped ? 'SCADA_GRID_BREAKER_TRIPPED_OFFLINE' : lineStopped ? 'SCADA_CONVEYOR_SHUTDOWN_HALT' : 'SCADA_CONVEYOR_HEARTBEAT_OK', 30, 25);

      animationFrameId = requestAnimationFrame(render);
    };

    render();

    return () => {
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener('resize', handleResize);
    };
  }, [isRunning, speedMultiplier, activeSystem, plcStatus, conveyorRpm, interlockBypass, isEStop, pressPressureSet, weldCurrentSet, ovenTempSet, nozzlePressureSet, ventFanSpeed, compressorPressureSet, coolingValveOpen, breakerTripped]);

  // Generate random Hex Register bytes
  const getHexRegisterVal = (offset: number) => {
    if (breakerTripped) return '0x00000000';
    const cycle = Math.floor(Date.now() / 3000) + offset;
    const byte1 = (cycle % 256).toString(16).toUpperCase().padStart(2, '0');
    const byte2 = ((cycle * 7) % 256).toString(16).toUpperCase().padStart(2, '0');
    const byte3 = ((cycle * 13) % 256).toString(16).toUpperCase().padStart(2, '0');
    const byte4 = ((cycle * 23) % 256).toString(16).toUpperCase().padStart(2, '0');
    return `0x${byte1}${byte2}${byte3}${byte4}`;
  };

  // Generate binary coil indicators
  const getBitRegisterVal = (offset: number) => {
    if (breakerTripped) {
      return Array(16).fill(0).map((_, i) => (
        <span key={i} style={{ color: '#334155', marginLeft: '3px', fontSize: '0.65rem' }}>0</span>
      ));
    }
    const cycle = Math.floor(Date.now() / 4000) + offset;
    const bits = [];
    for(let i=0; i<16; i++) {
      bits.push(((cycle >> i) & 1));
    }
    return bits.map((b, i) => (
      <span 
        key={i} 
        style={{ 
          color: b ? '#10b981' : '#334155', 
          fontWeight: b ? 'bold' : 'normal',
          marginLeft: '3px',
          fontSize: '0.65rem'
        }}
      >
        {b}
      </span>
    ));
  };

  // Filter VPLC nodes based on active tab view
  const getFilteredPlcList = () => {
    const nodes = Object.entries(plcStatus);
    if (activeSystem === 'assembly') {
      return nodes.filter(([k]) => k.endsWith('_VPLC') && !k.startsWith('Press') && !k.startsWith('Weld') && !k.startsWith('Oven') && !k.startsWith('Air_Comp') && !k.startsWith('Cool_W') && !k.startsWith('Power') && !k.startsWith('Exhaust') && !k.startsWith('Paint') && !k.startsWith('Conveyor_P') && !k.startsWith('Bake') && !k.startsWith('Air_Circ'));
    } else if (activeSystem === 'welding') {
      return nodes.filter(([k]) => k.startsWith('Press') || k.startsWith('Weld') || k.startsWith('Arc_Gas'));
    } else if (activeSystem === 'paint') {
      return nodes.filter(([k]) => k.startsWith('Oven') || k.startsWith('Air_Circ') || k.startsWith('Paint_S') || k.startsWith('Conveyor_P') || k.startsWith('Bake'));
    } else {
      return nodes.filter(([k]) => k.startsWith('Air_Comp') || k.startsWith('Cool_W') || k.startsWith('Power') || k.startsWith('Exhaust_S'));
    }
  };

  return (
    <div className="scada-dashboard-container">
      {/* 4 Multi-Equipment Selection Sub-Tabs */}
      <div className="scada-system-selector-tabs font-mono-tech">
        <button 
          className={`system-tab assembly-tab ${activeSystem === 'assembly' ? 'active' : ''}`}
          onClick={() => setActiveSystem('assembly')}
        >
          <Server size={14} />
          <span>의장 조립 라인 (Assembly)</span>
        </button>
        <button 
          className={`system-tab welding-tab ${activeSystem === 'welding' ? 'active' : ''}`}
          onClick={() => setActiveSystem('welding')}
        >
          <Flame size={14} />
          <span>로봇 용접 & 프레스 (Welding)</span>
        </button>
        <button 
          className={`system-tab paint-tab ${activeSystem === 'paint' ? 'active' : ''}`}
          onClick={() => setActiveSystem('paint')}
        >
          <Droplet size={14} />
          <span>도장 & 건조 오븐 (Paint/Oven)</span>
        </button>
        <button 
          className={`system-tab utility-tab ${activeSystem === 'utility' ? 'active' : ''}`}
          onClick={() => setActiveSystem('utility')}
        >
          <Cpu size={14} />
          <span>동력 유틸리티 (Piping/Power)</span>
        </button>
      </div>

      {/* Top Telemetry Grid (Changes Dynamically based on activeSystem) */}
      <div className="scada-telemetry-grid">
        {activeSystem === 'assembly' && (
          <>
            <div className="glass-panel telemetry-card assembly-glow">
              <div className="telemetry-header">
                <Zap size={14} className="text-neon-blue" />
                <span>MAIN LINE POWER</span>
              </div>
              <div className="telemetry-value text-neon-blue">
                {breakerTripped ? 'ERR' : powerConsumption} <span className="telemetry-unit">kW</span>
              </div>
              <div className="telemetry-footer">
                <span>Voltage: 380V Tri-Phase</span>
              </div>
            </div>

            <div className="glass-panel telemetry-card assembly-glow">
              <div className="telemetry-header">
                <Activity size={14} className="text-neon-purple" />
                <span>CONVEYOR MOTOR</span>
              </div>
              <div className="telemetry-value text-neon-purple">
                {lineStopped ? '0' : conveyorRpm} <span className="telemetry-unit">RPM</span>
              </div>
              <div className="telemetry-footer">
                <span>Gear ratio: 1:40 (Coaxial)</span>
              </div>
            </div>

            <div className="glass-panel telemetry-card assembly-glow">
              <div className="telemetry-header">
                <CheckCircle size={14} className="text-neon-green" />
                <span>LINE FIRST TIME QUALITY</span>
              </div>
              <div className="telemetry-value text-neon-green">
                {breakerTripped ? '0.0' : ftqRate}%
              </div>
              <div className="telemetry-footer">
                <span>QA Limit: &gt;97.5%</span>
              </div>
            </div>

            <div className="glass-panel telemetry-card assembly-glow">
              <div className="telemetry-header">
                <Clock size={14} className="text-neon-amber" />
                <span>PRODUCTION COUNT</span>
              </div>
              <div className="telemetry-value text-neon-amber">
                {actualCount} <span className="telemetry-divider">/</span> {targetCount}
              </div>
              <div className="telemetry-footer">
                <span>OEE Availability: {breakerTripped ? '0' : '94.2'}%</span>
              </div>
            </div>
          </>
        )}

        {activeSystem === 'welding' && (
          <>
            <div className="glass-panel telemetry-card welding-glow">
              <div className="telemetry-header">
                <Gauge size={14} className="text-neon-orange" />
                <span>HYDRAULIC PRESS FORCE</span>
              </div>
              <div className="telemetry-value text-neon-orange">
                {breakerTripped ? 'ERR' : plcStatus['Press_Hydraulic_VPLC'] === 'STOP' ? '0.0' : (pressPressureActual * 1.05).toFixed(1)} <span className="telemetry-unit">Tons</span>
              </div>
              <div className="telemetry-footer">
                <span>Oil Temp: {breakerTripped ? '25.0' : '48.6'} °C</span>
              </div>
            </div>

            <div className="glass-panel telemetry-card welding-glow">
              <div className="telemetry-header">
                <Zap size={14} className="text-neon-amber" />
                <span>WELD ARC CURRENT</span>
              </div>
              <div className="telemetry-value text-neon-amber">
                {breakerTripped ? 'ERR' : weldCurrentActual} <span className="telemetry-unit">A</span>
              </div>
              <div className="telemetry-footer">
                <span>Target Setpoint: {weldCurrentSet} A</span>
              </div>
            </div>

            <div className="glass-panel telemetry-card welding-glow">
              <div className="telemetry-header">
                <Flame size={14} className="text-neon-red" />
                <span>WELD TORCH TEMP</span>
              </div>
              <div className="telemetry-value text-neon-red">
                {breakerTripped ? '25' : torchTemp} <span className="telemetry-unit">°C</span>
              </div>
              <div className="telemetry-footer">
                <span>Upper Safety Limit: 1100°C</span>
              </div>
            </div>

            <div className="glass-panel telemetry-card welding-glow">
              <div className="telemetry-header">
                <Box size={14} className="text-neon-blue" />
                <span>STAMPED & WELDED PARTS</span>
              </div>
              <div className="telemetry-value text-neon-blue">
                {weldCount} <span className="telemetry-unit">EA</span>
              </div>
              <div className="telemetry-footer">
                <span>Weld Yield Rate: {breakerTripped ? '0.0' : '99.8'}%</span>
              </div>
            </div>
          </>
        )}

        {activeSystem === 'paint' && (
          <>
            <div className="glass-panel telemetry-card paint-glow">
              <div className="telemetry-header">
                <Flame size={14} className="text-neon-red" />
                <span>DRYING OVEN TEMP</span>
              </div>
              <div className="telemetry-value text-neon-red">
                {breakerTripped ? '25.0' : ovenTempActual.toFixed(1)} <span className="telemetry-unit">°C</span>
              </div>
              <div className="telemetry-footer">
                <span>Setpoint Target: {ovenTempSet}°C</span>
              </div>
            </div>

            <div className="glass-panel telemetry-card paint-glow">
              <div className="telemetry-header">
                <Wind size={14} className="text-neon-cyan" />
                <span>BOOTH AIRFLOW RATE</span>
              </div>
              <div className="telemetry-value text-neon-cyan">
                {breakerTripped ? '0' : airflowRate} <span className="telemetry-unit">m³/h</span>
              </div>
              <div className="telemetry-footer">
                <span>Exhaust Fan Speed: {ventFanSpeed}</span>
              </div>
            </div>

            <div className="glass-panel telemetry-card paint-glow">
              <div className="telemetry-header">
                <Gauge size={14} className="text-neon-blue" />
                <span>NOZZLE ATOMIZING</span>
              </div>
              <div className="telemetry-value text-neon-blue">
                {breakerTripped ? 'ERR' : nozzlePressureActual.toFixed(2)} <span className="telemetry-unit">Bar</span>
              </div>
              <div className="telemetry-footer">
                <span>Paint Viscosity: 18.5 cPs</span>
              </div>
            </div>

            <div className="glass-panel telemetry-card paint-glow">
              <div className="telemetry-header">
                <CheckCircle size={14} className="text-neon-green" />
                <span>PAINTED CHASSIS COILS</span>
              </div>
              <div className="telemetry-value text-neon-green">
                {paintCount} <span className="telemetry-unit">EA</span>
              </div>
              <div className="telemetry-footer">
                <span>Cure Thickness: 120 μm</span>
              </div>
            </div>
          </>
        )}

        {activeSystem === 'utility' && (
          <>
            <div className="glass-panel telemetry-card utility-glow">
              <div className="telemetry-header">
                <Gauge size={14} className="text-neon-cyan" />
                <span>AIR HEADER PRESSURE</span>
              </div>
              <div className="telemetry-value text-neon-cyan">
                {breakerTripped ? '0.00' : compressorPressureActual.toFixed(2)} <span className="telemetry-unit">Bar</span>
              </div>
              <div className="telemetry-footer">
                <span>Compressor Target: {compressorPressureSet} Bar</span>
              </div>
            </div>

            <div className="glass-panel telemetry-card utility-glow">
              <div className="telemetry-header">
                <Droplet size={14} className="text-neon-blue" />
                <span>COOLING LOOP FLOW</span>
              </div>
              <div className="telemetry-value text-neon-blue">
                {breakerTripped ? '0.0' : coolingFlowActual.toFixed(1)} <span className="telemetry-unit">L/min</span>
              </div>
              <div className="telemetry-footer">
                <span>Valve Opening: {coolingValveOpen}%</span>
              </div>
            </div>

            <div className="glass-panel telemetry-card utility-glow">
              <div className="telemetry-header">
                <Zap size={14} className="text-neon-amber" />
                <span>TOTAL GRID DEMAND</span>
              </div>
              <div className="telemetry-value text-neon-amber">
                {breakerTripped ? '0' : gridPowerDemand} <span className="telemetry-unit">kW</span>
              </div>
              <div className="telemetry-footer">
                <span>Transformer Load: {(gridPowerDemand/2000*100).toFixed(1)}%</span>
              </div>
            </div>

            <div className="glass-panel telemetry-card utility-glow">
              <div className="telemetry-header">
                <Activity size={14} className="text-neon-green" />
                <span>GRID FREQUENCY</span>
              </div>
              <div className="telemetry-value text-neon-green">
                {breakerTripped ? '0.00' : '60.02'} <span className="telemetry-unit">Hz</span>
              </div>
              <div className="telemetry-footer">
                <span>Power Quality Factor: 0.99</span>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Interactive HMI Controller Console panel (Real-Time Control Panel) */}
      <div className="glass-panel scada-hmi-console font-mono-tech">
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <Sliders size={18} className="text-neon-green" />
          <h4 style={{ margin: 0, fontSize: '0.92rem', color: '#fff', fontWeight: 700 }}>
            SCADA HMI REMOTE CONTROL CONSOLE (원격 설비 제어반 - {activeSystem.toUpperCase()})
          </h4>
        </div>
        
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1.25rem', alignItems: 'center', width: '100%' }}>
          {/* Subsystem specific control parameters (Left block) */}
          <div className="subsystem-control-block">
            {activeSystem === 'assembly' && (
              <div className="hmi-control-group">
                <div className="slider-wrapper">
                  <span className="control-label">컨베이어 속도 (Setpoint):</span>
                  <input 
                    type="range" min="1000" max="2200" step="50" 
                    value={conveyorRpm} 
                    disabled={lineStopped}
                    onChange={(e) => setConveyorRpm(Number(e.target.value))}
                    className="hmi-slider"
                  />
                  <strong className="control-val">{lineStopped ? '0' : conveyorRpm} RPM</strong>
                </div>

                <button 
                  onClick={() => {
                    setInterlockBypass(!interlockBypass);
                    const now = new Date();
                    const timeStr = `${now.getHours().toString().padStart(2,'0')}:${now.getMinutes().toString().padStart(2,'0')}:${now.getSeconds().toString().padStart(2,'0')}`;
                    setAlarms(logs => [
                      {
                        id: Date.now().toString(),
                        time: timeStr,
                        stage: 'Safety Guard',
                        level: !interlockBypass ? 'warning' : 'info',
                        message: `User Override: Safety Interlock Bypass forced to ${!interlockBypass ? 'ENABLED (인터록 해제)' : 'DISABLED (인터록 복구)'}`
                      },
                      ...logs.slice(0, 8)
                    ]);
                  }}
                  className={`speed-btn ${interlockBypass ? 'active' : ''}`}
                  disabled={breakerTripped}
                  style={{ borderColor: interlockBypass ? '#f59e0b' : 'rgba(255,255,255,0.1)', color: interlockBypass ? '#f59e0b' : '#94a3b8' }}
                >
                  <ShieldAlert size={12} />
                  인터록 바이패스: {interlockBypass ? 'ON' : 'OFF'}
                </button>
              </div>
            )}

            {activeSystem === 'welding' && (
              <div className="hmi-control-group">
                <div className="slider-wrapper">
                  <span className="control-label">프레스 유압 타겟:</span>
                  <input 
                    type="range" min="150" max="300" step="10" 
                    value={pressPressureSet} 
                    disabled={plcStatus['Press_Hydraulic_VPLC'] === 'STOP' || lineStopped}
                    onChange={(e) => setPressPressureSet(Number(e.target.value))}
                    className="hmi-slider orange-slider"
                  />
                  <strong className="control-val orange-text">{pressPressureSet} Bar</strong>
                </div>

                <div className="slider-wrapper">
                  <span className="control-label">아크 용접 전류:</span>
                  <input 
                    type="range" min="80" max="150" step="5" 
                    value={weldCurrentSet} 
                    disabled={lineStopped}
                    onChange={(e) => setWeldCurrentSet(Number(e.target.value))}
                    className="hmi-slider orange-slider"
                  />
                  <strong className="control-val orange-text">{weldCurrentSet} A</strong>
                </div>
              </div>
            )}

            {activeSystem === 'paint' && (
              <div className="hmi-control-group">
                <div className="slider-wrapper">
                  <span className="control-label">IR 건조 오븐 타겟:</span>
                  <input 
                    type="range" min="80" max="140" step="5" 
                    value={ovenTempSet} 
                    disabled={plcStatus['Oven_Heater_VPLC'] === 'STOP' || breakerTripped}
                    onChange={(e) => setOvenTempSet(Number(e.target.value))}
                    className="hmi-slider red-slider"
                  />
                  <strong className="control-val red-text">{ovenTempSet} °C</strong>
                </div>

                <div className="slider-wrapper">
                  <span className="control-label">스프레이 노즐 공압:</span>
                  <input 
                    type="range" min="3.0" max="6.0" step="0.1" 
                    value={nozzlePressureSet} 
                    disabled={plcStatus['Paint_Sprayer_VPLC'] === 'STOP' || lineStopped}
                    onChange={(e) => setNozzlePressureSet(Number(e.target.value))}
                    className="hmi-slider red-slider"
                  />
                  <strong className="control-val red-text">{nozzlePressureSet.toFixed(1)} Bar</strong>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>배기 환풍기 속도:</span>
                  <div style={{ display: 'flex', gap: '2px', background: 'rgba(255,255,255,0.02)', padding: '2px', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.05)' }}>
                    {(['OFF', 'LOW', 'MED', 'HIGH'] as const).map(speed => (
                      <button
                        key={speed}
                        onClick={() => {
                          setVentFanSpeed(speed);
                          const now = new Date();
                          const timeStr = `${now.getHours().toString().padStart(2,'0')}:${now.getMinutes().toString().padStart(2,'0')}:${now.getSeconds().toString().padStart(2,'0')}`;
                          setAlarms(logs => [
                            { id: Date.now().toString(), time: timeStr, stage: 'Exhaust Fan', level: 'info', message: `Ventilation speed adjusted to ${speed}` },
                            ...logs.slice(0, 8)
                          ]);
                        }}
                        className={`speed-btn ${ventFanSpeed === speed ? 'active' : ''}`}
                        disabled={breakerTripped || plcStatus['Air_Circulation_VPLC'] === 'STOP'}
                        style={{ padding: '2px 5px', fontSize: '0.65rem' }}
                      >
                        {speed}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {activeSystem === 'utility' && (
              <div className="hmi-control-group">
                <div className="slider-wrapper">
                  <span className="control-label">에어 컴프레셔 압력:</span>
                  <input 
                    type="range" min="4.0" max="7.5" step="0.1" 
                    value={compressorPressureSet} 
                    disabled={plcStatus['Air_Compressor_VPLC'] === 'STOP' || breakerTripped}
                    onChange={(e) => setCompressorPressureSet(Number(e.target.value))}
                    className="hmi-slider yellow-slider"
                  />
                  <strong className="control-val yellow-text">{compressorPressureSet.toFixed(1)} Bar</strong>
                </div>

                <div className="slider-wrapper">
                  <span className="control-label">냉각수 유량 조절:</span>
                  <input 
                    type="range" min="0" max="100" step="5" 
                    value={coolingValveOpen} 
                    disabled={plcStatus['Cool_Water_Pump_VPLC'] === 'STOP' || breakerTripped}
                    onChange={(e) => setCoolingValveOpen(Number(e.target.value))}
                    className="hmi-slider yellow-slider"
                  />
                  <strong className="control-val yellow-text">개도 {coolingValveOpen}%</strong>
                </div>

                <button 
                  onClick={handleGridTrip}
                  className="speed-btn"
                  disabled={breakerTripped}
                  style={{ 
                    borderColor: '#f59e0b', 
                    background: 'rgba(245, 158, 11, 0.12)', 
                    color: '#f59e0b',
                    fontWeight: 700 
                  }}
                >
                  ⚡ 그리드 고전압 차단기 Trip 유발 테스트
                </button>
              </div>
            )}
          </div>

          {/* Master Global System Controls (Right block) */}
          <div className="master-global-controls">
            <button 
              onClick={handleSystemReset}
              className="speed-btn reset-btn"
              disabled={breakerTripped}
            >
              <RotateCcw size={12} />
              시스템 전체 리셋 (RESET)
            </button>

            <button 
              onClick={() => {
                const nextState = !isEStop;
                setIsEStop(nextState);
                const now = new Date();
                const timeStr = `${now.getHours().toString().padStart(2,'0')}:${now.getMinutes().toString().padStart(2,'0')}:${now.getSeconds().toString().padStart(2,'0')}`;
                setAlarms(logs => [
                  {
                    id: Date.now().toString(),
                    time: timeStr,
                    stage: 'E-Stop HMI',
                    level: nextState ? 'error' : 'info',
                    message: nextState 
                      ? '!!! CRITICAL EMERGENCY STOP ACTUATED BY OPERATOR !!!' 
                      : 'Emergency line stop released: System pending reset'
                  },
                  ...logs.slice(0, 8)
                ]);
              }}
              className={`speed-btn estop-btn ${isEStop ? 'active' : ''}`}
              disabled={breakerTripped}
            >
              <ZapOff size={12} fill={isEStop ? 'currentColor' : 'none'} />
              비상 정지 (E-STOP)
            </button>
          </div>
        </div>
      </div>

      {/* Center Row: Canvas SCADA Mimic View */}
      <div className="glass-panel scada-mimic-panel">
        <div className="mimic-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Server size={18} className="text-neon-green" />
            <h3 style={{ textTransform: 'uppercase' }}>
              {activeSystem === 'assembly' && 'TRIM & ASSEMBLY SHOP SCADA MIMIC (차량 의장 공정 모니터)'}
              {activeSystem === 'welding' && 'ROBOTIC PRESS & WELD CELL SCADA MIMIC (압착 및 로봇 용접 공정)'}
              {activeSystem === 'paint' && 'PAINT SPRAY & BAKE CURE SCADA MIMIC (자동 도장 및 건조 가마 공정)'}
              {activeSystem === 'utility' && 'UTILITY PIPING & ELECTRICAL POWER P&ID MIMIC (동력/유압 계통도)'}
            </h3>
          </div>
          <div className="mimic-controls">
            <div style={{ display: 'flex', gap: '4px' }}>
              <button 
                onClick={() => setIsRunning(!isRunning)} 
                className={`speed-btn ${isRunning ? 'active' : ''}`}
                style={{ fontSize: '0.75rem', padding: '0.3rem 0.6rem', display: 'flex', alignItems: 'center', gap: '4px' }}
                disabled={breakerTripped}
              >
                {isRunning ? <Pause size={12} /> : <Play size={12} fill="currentColor" />}
                {isRunning ? '시뮬 정지' : '시뮬 가동'}
              </button>
            </div>
            
            <div style={{ display: 'flex', alignItems: 'center', gap: '2px', background: 'rgba(255,255,255,0.02)', padding: '2px', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.05)' }}>
              {[1, 2, 4].map(speed => (
                <button
                  key={speed}
                  onClick={() => setSpeedMultiplier(speed)}
                  className={`speed-btn ${speedMultiplier === speed ? 'active' : ''}`}
                  style={{ padding: '2px 6px', fontSize: '0.7rem' }}
                  disabled={breakerTripped}
                >
                  {speed}x
                </button>
              ))}
            </div>
          </div>
        </div>
        
        <div className="mimic-canvas-wrapper" style={{ position: 'relative' }}>
          <canvas ref={canvasRef} className="mimic-canvas" />

          {/* Glitchy power blackout restoration screen on Trip */}
          {breakerTripped && (
            <div className="breaker-tripped-overlay font-mono-tech">
              <div className="overlay-box glass-panel">
                <AlertTriangle size={36} className="text-neon-amber" style={{ marginBottom: '0.8rem', animation: 'pulse-glow 1s infinite' }} />
                <h3 style={{ color: '#ef4444', fontWeight: 800, margin: '0 0 0.5rem 0', fontSize: '1.2rem' }}>
                  !!! UTILITY PRIMARY POWER LOSS (TRIPPED) !!!
                </h3>
                <p style={{ fontSize: '0.78rem', color: '#94a3b8', maxWidth: '420px', margin: '0 auto 1.25rem auto', lineHeight: 1.5 }}>
                  공장 변전 배전 계통 22.9kV 차단기가 오버헤드 과부하로 차단(TRIP)되었습니다. 
                  Modbus-TCP 필드버스 인터페이스 두절 상태입니다. 
                  우측 수동 브레이커 복구 명령을 입력하십시오.
                </p>

                {isRestoringPower ? (
                  <div style={{ width: '100%', maxWidth: '360px', margin: '0 auto' }}>
                    <div style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', height: '12px', borderRadius: '6px', overflow: 'hidden', marginBottom: '0.75rem' }}>
                      <div style={{ width: `${restoreProgress}%`, height: '100%', background: 'linear-gradient(90deg, #38bdf8, #10b981)', transition: 'width 0.3s ease' }} />
                    </div>
                    <div className="restore-logs font-mono-tech">
                      {powerRestoreLogs.map((log, i) => (
                        <div key={i} style={{ color: log.includes('[Grid]') || log.includes('[PLC]') ? '#10b981' : '#38bdf8', fontSize: '0.65rem' }}>
                          {log}
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div style={{ display: 'flex', gap: '0.8rem', justifyContent: 'center' }}>
                    <button 
                      className="speed-btn"
                      onClick={() => setActiveSystem('utility')}
                      style={{ padding: '0.45rem 0.9rem', borderColor: '#f59e0b', color: '#f59e0b' }}
                    >
                      유틸리티 판넬 바로가기
                    </button>
                    <button 
                      onClick={handleRecoverPower}
                      style={{ 
                        background: 'rgba(16, 185, 129, 0.15)', 
                        borderColor: '#10b981', 
                        color: '#10b981',
                        padding: '0.45rem 0.9rem',
                        fontWeight: 'bold',
                        borderRadius: '6px',
                        border: '1px solid',
                        cursor: 'pointer',
                        fontSize: '0.75rem',
                        boxShadow: '0 0 12px rgba(16, 185, 129, 0.2)'
                      }}
                    >
                      ⚡ 수동 배전반 복구 (VCB CLOSE)
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Bottom Grid: Alarm Logger & VPLC Registers */}
      <div className="scada-bottom-grid">
        {/* Real-time Industrial Alarm Logger */}
        <div className="glass-panel scada-logger-panel">
          <div className="panel-title" style={{ fontSize: '0.9rem', color: '#fff' }}>
            <AlertTriangle size={15} className="text-neon-amber" />
            <span>SCADA INDUSTRIAL ALARM LOG (실시간 관제 알람 감시망)</span>
          </div>
          <div className="alarm-log-list">
            {alarms.map(alarm => (
              <div key={alarm.id} className={`alarm-entry-row ${alarm.level}`}>
                <span className="alarm-time">{alarm.time}</span>
                <span className="alarm-tag">{alarm.stage}</span>
                <span className="alarm-message">{alarm.message}</span>
              </div>
            ))}
          </div>
        </div>

        {/* C++ vPLC Register Watcher (Interactive switches) */}
        <div className="glass-panel plc-registers-panel">
          <div className="panel-title" style={{ fontSize: '0.9rem', color: '#fff' }}>
            <Cpu size={15} className="text-neon-blue" />
            <span>VPLC MODBUS-TCP COILS VIEW (Modbus 필드버스 원격 토글 제어)</span>
          </div>
          <div className="plc-register-table-wrapper">
            <table className="plc-register-table font-mono-tech">
              <thead>
                <tr>
                  <th>PLC NODE ID</th>
                  <th>REMOTE SWITCH (제어)</th>
                  <th>WORD REGISTER (Hex)</th>
                  <th>BIT COILS (0-15)</th>
                </tr>
              </thead>
              <tbody>
                {getFilteredPlcList().map(([node, status], idx) => (
                  <tr key={node} className={status === 'STOP' ? 'tr-fault-bg' : ''}>
                    <td className="node-name" style={{ color: status === 'STOP' ? '#f87171' : '#ffffff' }}>{node}</td>
                    <td>
                      <button 
                        onClick={() => handlePlcToggle(node)}
                        className={`plc-badge-status ${status.toLowerCase()}`}
                        disabled={breakerTripped}
                        style={{ border: '1px solid transparent', cursor: 'pointer', outline: 'none', transition: 'all 0.2s', padding: '2px 7px' }}
                      >
                        {status} ⚙
                      </button>
                    </td>
                    <td className="register-val" style={{ color: status === 'STOP' ? '#64748b' : '#38bdf8' }}>
                      {status === 'STOP' ? '0x00000000' : getHexRegisterVal(idx * 17)}
                    </td>
                    <td className="bit-coils">
                      {status === 'STOP' ? Array(16).fill(0).map((_,i)=><span key={i} style={{color:'#334155',marginLeft:'3px',fontSize:'0.65rem'}}>0</span>) : getBitRegisterVal(idx * 11)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Interactive Explanation & SCADA Study Center */}
      <div className="glass-panel scada-explain-panel">
        <div className="explain-tabs">
          <button 
            className={`explain-tab ${activeExplainTab === 'intro' ? 'active' : ''}`}
            onClick={() => setActiveExplainTab('intro')}
          >
            SCADA 양방향 제어란?
          </button>
          <button 
            className={`explain-tab ${activeExplainTab === 'control' ? 'active' : ''}`}
            onClick={() => setActiveExplainTab('control')}
          >
            SCADA 제어반 & 인터록 루프
          </button>
          <button 
            className={`explain-tab ${activeExplainTab === 'features' ? 'active' : ''}`}
            onClick={() => setActiveExplainTab('features')}
          >
            차량 의장 공정 특징
          </button>
          <button 
            className={`explain-tab ${activeExplainTab === 'marriage' ? 'active' : ''}`}
            onClick={() => setActiveExplainTab('marriage')}
          >
            샤시 결합 (Chassis Marriage)
          </button>
          <button 
            className={`explain-tab ${activeExplainTab === 'door' ? 'active' : ''}`}
            onClick={() => setActiveExplainTab('door')}
          >
            도어 탈거 & 재장착
          </button>
        </div>

        <div className="explain-content">
          {activeExplainTab === 'intro' && (
            <div className="explain-tab-body">
              <h4>
                <Info size={16} className="text-neon-blue inline-icon" />
                SCADA 원격 제어반(Supervisory Control)의 설계 목적과 기능 설명
              </h4>
              <p>
                SCADA(Supervisory Control and Data Acquisition)는 단순히 현장의 센서값을 '보여주는' 모니터링 시스템을 넘어, 
                중앙 관제실(Control Center)의 HMI 컴퓨터 콘솔을 조작하여 **원격에서 필드 장비를 실시간 제어(Supervisory Control)**하는 고성능 양방향 공학 체계입니다.
              </p>
              <p>
                공장의 작업 지표와 계측 데이터는 실시간 Modbus-TCP, OPC-UA 등의 산업 프로토콜을 통과하여 
                VPLC(Virtual PLC)의 Word Register 및 Bit Coils 형태로 취득되며, 역으로 사용자가 제어반에서 타겟 속도(RPM), 유압 한계값(Bar), 
                건조 온도(°C), 또는 밸브 개도율(%) 슬라이더를 튜닝하면 **실시간으로 필드 PLC 메모리 값에 오버라이트(Write)되어 설비 주행 물리 속도와 전력량이 동기 조절**됩니다.
              </p>
            </div>
          )}

          {activeExplainTab === 'control' && (
            <div className="explain-tab-body">
              <h4>SCADA 시스템의 핵심 기능: 원격 폐루프 제어 및 안전 인터록 (Interlock)</h4>
              <p>
                SCADA는 완벽한 폐루프 감시 통제를 완수하기 위해 산업 표준 하드와이어드 안전망과 소프트웨어 인터록 알고리즘을 이식받았습니다.
              </p>
              <ul>
                <li><strong>목표치 제어 (Setpoint Control)</strong>: 컨베이어 RPM 속도, 프레스 한계 기압, 가마 가열 전류 슬라이더처럼 원격에서 제어 목표 수치를 설정하면 필드 PLC 내부의 워드 주소(Register)로 명령어가 하달되어 실시간 가동 에너지가 요동치게 됩니다.</li>
                <li><strong>하드와이어드 안전망 및 비상 정지 (Emergency E-Stop)</strong>: 현장의 설비나 작업자 안전을 보장하기 위한 궁극의 강제 릴레이 차단 스위치입니다. E-Stop 작동 시 모든 모터 및 유압 밸브의 하류 전압을 일제히 단선(Hardwired Isolation)시킵니다.</li>
                <li><strong>소프트웨어 인터록 (Safety Interlocks)</strong>: 특정 설비 VPLC가 정지(STOP)된 상황에서 이송 라인이 계속 구동되면 설비와 차체가 연달아 추돌하는 대형 충돌 재해가 발생합니다. 이를 사전 방지하기 위해 SCADA 소프트웨어 단에서 안전 연동 조건(Interlock)을 발동하여 상부 컨베이어와 이전 공정 이송 progress를 일제히 동결(Hold)시킵니다.</li>
              </ul>
            </div>
          )}

          {activeExplainTab === 'features' && (
            <div className="explain-tab-body">
              <h4>차량 생산 의장공장(Assembly Trim/Chassis Shop)에서의 SCADA 적용</h4>
              <p>
                차량 생산 라인은 크게 <strong>프레스(Press) → 차체(Body) → 도장(Paint) → 의장(Assembly)</strong> 공정으로 구성됩니다. 
                이 중 **의장공장**은 완성된 빈 철판 차체에 엔진, 변속기, 시트, 전선(Wire Harness), 유리, 대시보드 등 수천 개의 정밀 의장 부품을 조립하는 최종 공정입니다.
              </p>
              <ul>
                <li><strong>혼류 생산 제어 (Mixed-Model Production)</strong>: 동일 라인에서 세단, SUV, 하이브리드, 전기차 등을 동시에 생산할 때, 각 사양에 맞춰 부품 지시 레지스터(Modbus/EtherNetIP)를 PLC로 정확히 전송하여 조립 오류를 원천 차단합니다.</li>
                <li><strong>체결 이력 기록 (Torque Logging)</strong>: 브레이크나 서스펜션 등 안전 직결 부품을 고정하는 너트/볼트 조임기(Nutrunner)의 체결 토크 값을 SCADA가 취득하여 MES/ERP 데이터베이스에 저장(추적성 보증)합니다.</li>
              </ul>
            </div>
          )}

          {activeExplainTab === 'marriage' && (
            <div className="explain-tab-body">
              <h4>의장 공장의 꽃: 샤시 결합 (Chassis Marriage / 파워트레인 도킹)</h4>
              <p>
                <strong>샤시 도킹(Chassis Marriage)</strong>은 위에서 컨베이어를 타고 이동하는 차체(Body) 하부에, 아래에서 무인 이송 차(AGV)나 파워트레인 전용 팔레트를 타고 올라오는 
                엔진, 변속기, 구동축, 현가장치(Suspension) 등 <strong>핵심 구동 모듈을 한 번에 들어올려 볼트로 체결하는 결합 공정</strong>입니다.
              </p>
              <p>
                이 공정에서 SCADA 시스템은 **컨베이어의 전송 위치(Enocder Pulse)**와 **하부 서브 호이스트의 승강 높이/위치(Laser Distance Sensor)** 정보를 실시간으로 읽어와 
                1mm의 오차도 없도록 **상호 동기 제어(Interlock/Synchronization)**를 실행합니다. 센서의 위치 편차가 나면 SCADA 화면에 즉시 적색 알람이 켜지고 라인이 자동으로 정지됩니다.
              </p>
            </div>
          )}

          {activeExplainTab === 'door' && (
            <div className="explain-tab-body">
              <h4>생산 효율 극대화의 비결: 도어 탈거 및 재장착 (Door-off & Door-on System)</h4>
              <p>
                의장공장에 도장까지 끝마친 완성된 차량 바디가 처음 진입하면, 가장 먼저 <strong>도어(문짝)를 통째로 떼어내는 Door-Off 공정</strong>을 거칩니다. 
                그 이유는 도어가 차체에 달려있는 채로 실내 의장 작업(와이어 하네스 배선, 대시보드 삽입, 천장 마감재 조립)을 진행하면, 문짝에 가로막혀 작업자의 승하차 동작이 매우 불편하고 작업 효율이 떨어지며 도어 도장면에 스크래치가 발생할 위험이 크기 때문입니다.
              </p>
              <p>
                떼어낸 도어는 <strong>도어 전용 서브 조립 라인</strong>으로 우회시켜 도어 유리창, 모터, 스피커, 트림 가죽 등을 독립적으로 장착합니다. 
                그 후 메인 라인의 마지막 부분인 <strong>Door-On 공정</strong>에서 차체 사양과 도어 사양을 SCADA 데이터베이스로 정확하게 매칭(Bar-code/RFID 리딩)시켜, 제 짝의 도어를 완벽하게 다시 결합하고 도어 커넥터를 삽입합니다.
              </p>
            </div>
          )}
        </div>
      </div>

      <style>{`
        .scada-dashboard-container {
          display: flex;
          flex-direction: column;
          gap: 1.5rem;
          width: 100%;
          animation: fadeIn 0.8s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }

        /* 4 Multi-Equipment Selection Sub-Tabs Styling */
        .scada-system-selector-tabs {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 0.75rem;
          width: 100%;
        }

        .system-tab {
          background: rgba(15, 23, 42, 0.65);
          border: 1px solid rgba(255, 255, 255, 0.05);
          color: var(--text-secondary);
          padding: 0.85rem 1.25rem;
          border-radius: 10px;
          font-size: 0.82rem;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1);
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
        }

        .system-tab:hover {
          background: rgba(255, 255, 255, 0.04);
          color: var(--text-primary);
          border-color: rgba(255, 255, 255, 0.15);
        }

        /* Sub-tab unique active glows */
        .system-tab.assembly-tab.active {
          background: rgba(16, 185, 129, 0.12);
          color: #10b981;
          border-color: rgba(16, 185, 129, 0.4);
          box-shadow: 0 0 15px rgba(16, 185, 129, 0.12);
        }

        .system-tab.welding-tab.active {
          background: rgba(249, 115, 22, 0.12);
          color: #f97316;
          border-color: rgba(249, 115, 22, 0.4);
          box-shadow: 0 0 15px rgba(249, 115, 22, 0.12);
        }

        .system-tab.paint-tab.active {
          background: rgba(56, 189, 248, 0.12);
          color: #38bdf8;
          border-color: rgba(56, 189, 248, 0.4);
          box-shadow: 0 0 15px rgba(56, 189, 248, 0.12);
        }

        .system-tab.utility-tab.active {
          background: rgba(245, 158, 11, 0.12);
          color: #f59e0b;
          border-color: rgba(245, 158, 11, 0.4);
          box-shadow: 0 0 15px rgba(245, 158, 11, 0.12);
        }

        .scada-telemetry-grid {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 1.25rem;
        }

        @media (max-width: 1024px) {
          .scada-telemetry-grid {
            grid-template-columns: repeat(2, 1fr);
          }
        }

        @media (max-width: 640px) {
          .scada-telemetry-grid {
            grid-template-columns: 1fr;
          }
        }

        .telemetry-card {
          padding: 1.25rem;
          display: flex;
          flex-direction: column;
          gap: 0.5rem;
          transition: border-color 0.4s ease, box-shadow 0.4s ease;
        }

        /* Glow effects for active system telemetry */
        .assembly-glow { border-color: rgba(56, 189, 248, 0.12); }
        .welding-glow { border-color: rgba(249, 115, 22, 0.12); }
        .paint-glow { border-color: rgba(244, 63, 94, 0.12); }
        .utility-glow { border-color: rgba(245, 158, 11, 0.12); }

        .telemetry-header {
          display: flex;
          align-items: center;
          gap: 0.45rem;
          font-size: 0.72rem;
          font-weight: 700;
          color: var(--text-secondary);
          letter-spacing: 0.05em;
        }

        .telemetry-value {
          font-size: 1.7rem;
          font-weight: 800;
          font-family: 'JetBrains Mono', monospace;
        }

        .telemetry-unit {
          font-size: 0.85rem;
          color: var(--text-secondary);
          font-weight: 400;
        }

        .telemetry-divider {
          color: var(--text-muted);
          font-size: 1.1rem;
          font-weight: 300;
        }

        .telemetry-footer {
          font-size: 0.7rem;
          color: var(--text-muted);
          border-top: 1px solid rgba(255,255,255,0.04);
          padding-top: 0.35rem;
          margin-top: 0.25rem;
        }

        /* Remote Control Console Styling */
        .scada-hmi-console {
          padding: 1.25rem;
          margin-bottom: 0.25rem;
          display: flex;
          flex-direction: column;
          gap: 1.25rem;
          border: 1px solid rgba(16,185,129,0.15);
        }

        .subsystem-control-block {
          display: flex;
          flex: 1;
          flex-wrap: wrap;
          gap: 1.5rem;
          align-items: center;
        }

        .hmi-control-group {
          display: flex;
          flex-wrap: wrap;
          gap: 1.5rem;
          align-items: center;
        }

        .slider-wrapper {
          display: flex;
          align-items: center;
          gap: 10px;
          background: rgba(255,255,255,0.015);
          border: 1px solid rgba(255,255,255,0.04);
          padding: 0.4rem 0.8rem;
          border-radius: 8px;
        }

        .control-label {
          font-size: 0.72rem;
          color: var(--text-secondary);
        }

        .hmi-slider {
          width: 105px;
          height: 4px;
          accent-color: #10b981;
          cursor: pointer;
        }

        .hmi-slider.orange-slider { accent-color: #f97316; }
        .hmi-slider.red-slider { accent-color: #f43f5e; }
        .hmi-slider.yellow-slider { accent-color: #f59e0b; }

        .control-val {
          color: #10b981;
          font-size: 0.78rem;
          width: 60px;
          display: inline-block;
          text-align: right;
        }

        .control-val.orange-text { color: #f97316; }
        .control-val.red-text { color: #f43f5e; }
        .control-val.yellow-text { color: #f59e0b; }

        .master-global-controls {
          display: flex;
          gap: 0.75rem;
          align-items: center;
          margin-left: auto;
        }

        .reset-btn {
          font-size: 0.75rem; 
          padding: 0.55rem 0.95rem; 
          borderColor: rgba(16, 185, 129, 0.4); 
          background: rgba(16, 185, 129, 0.05);
          color: #10b981;
          display: flex; 
          align-items: center; 
          gap: 4px;
        }

        .estop-btn {
          font-size: 0.75rem; 
          fontWeight: 800;
          padding: 0.55rem 1.15rem; 
          borderColor: #ef4444; 
          background: rgba(239, 68, 68, 0.12);
          color: #f87171;
          display: flex; 
          align-items: center; 
          gap: 5px;
        }

        .estop-btn.active {
          background: #ef4444;
          color: #ffffff;
        }

        .scada-mimic-panel {
          padding: 1.5rem;
          display: flex;
          flex-direction: column;
          gap: 1.25rem;
        }

        .mimic-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          border-bottom: 1px solid rgba(255, 255, 255, 0.08);
          padding-bottom: 0.75rem;
        }

        .mimic-header h3 {
          font-size: 0.98rem;
          font-weight: 700;
          color: var(--text-primary);
          margin: 0;
          letter-spacing: 0.03em;
        }

        .mimic-controls {
          display: flex;
          align-items: center;
          gap: 0.75rem;
        }

        .mimic-canvas-wrapper {
          width: 100%;
          height: 410px;
          background: rgba(4, 6, 14, 0.88);
          border-radius: 12px;
          border: 1px solid rgba(255, 255, 255, 0.05);
          box-shadow: inset 0 4px 24px rgba(0, 0, 0, 0.9);
          overflow: hidden;
        }

        .mimic-canvas {
          width: 100%;
          height: 100%;
          display: block;
        }

        /* Power Blackout Overlays */
        .breaker-tripped-overlay {
          position: absolute;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          background: rgba(2, 4, 10, 0.88);
          backdrop-filter: blur(4px);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 15;
          animation: fadeIn 0.4s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }

        .overlay-box {
          background: rgba(13, 20, 38, 0.95);
          border: 1px solid rgba(239, 68, 68, 0.35);
          padding: 2.25rem;
          border-radius: 14px;
          text-align: center;
          box-shadow: 0 10px 40px rgba(0, 0, 0, 0.8), 0 0 25px rgba(239, 68, 68, 0.08);
          width: 90%;
          max-width: 520px;
        }

        .restore-logs {
          text-align: left;
          background: #03050b;
          padding: 0.8rem;
          border-radius: 8px;
          border: 1px solid rgba(56, 189, 248, 0.15);
          height: 95px;
          overflow-y: auto;
          font-family: 'JetBrains Mono', monospace;
          display: flex;
          flex-direction: column;
          gap: 3px;
        }

        .scada-bottom-grid {
          display: grid;
          grid-template-columns: 430px 1fr;
          gap: 1.5rem;
        }

        @media (max-width: 1100px) {
          .scada-bottom-grid {
            grid-template-columns: 1fr;
          }
        }

        .scada-logger-panel {
          padding: 1.25rem;
          display: flex;
          flex-direction: column;
          gap: 1rem;
          height: 330px;
        }

        .alarm-log-list {
          flex: 1;
          overflow-y: auto;
          display: flex;
          flex-direction: column;
          gap: 0.45rem;
          font-family: 'JetBrains Mono', monospace;
          font-size: 0.72rem;
          padding-right: 0.25rem;
        }

        .alarm-entry-row {
          display: flex;
          padding: 0.4rem 0.5rem;
          border-radius: 6px;
          gap: 0.5rem;
          border-left: 3px solid transparent;
          background: rgba(255, 255, 255, 0.01);
          line-height: 1.35;
        }

        .alarm-entry-row.info {
          border-left-color: var(--color-cyber-blue);
          background: rgba(56, 189, 248, 0.03);
        }

        .alarm-entry-row.warning {
          border-left-color: var(--color-warning-amber);
          background: rgba(245, 158, 11, 0.03);
          color: #fde047;
        }

        .alarm-entry-row.error {
          border-left-color: var(--color-error-crimson);
          background: rgba(239, 68, 68, 0.05);
          color: #fca5a5;
        }

        .alarm-time {
          color: var(--text-muted);
          flex-shrink: 0;
        }

        .alarm-tag {
          font-weight: 700;
          color: var(--text-primary);
          flex-shrink: 0;
          background: rgba(255, 255, 255, 0.05);
          padding: 0 4px;
          border-radius: 4px;
          font-size: 0.65rem;
        }

        .alarm-message {
          word-break: break-all;
        }

        .plc-registers-panel {
          padding: 1.25rem;
          display: flex;
          flex-direction: column;
          gap: 1rem;
          height: 330px;
        }

        .plc-register-table-wrapper {
          flex: 1;
          overflow-y: auto;
          border: 1px solid rgba(255, 255, 255, 0.04);
          border-radius: 8px;
          background: rgba(4, 6, 14, 0.5);
        }

        .plc-register-table {
          width: 100%;
          border-collapse: collapse;
          text-align: left;
          font-size: 0.72rem;
        }

        .plc-register-table th, .plc-register-table td {
          padding: 0.6rem 0.8rem;
          border-bottom: 1px solid rgba(255, 255, 255, 0.03);
        }

        .plc-register-table th {
          background: rgba(13, 20, 38, 0.75);
          color: var(--text-secondary);
          font-weight: 600;
          font-size: 0.7rem;
          letter-spacing: 0.5px;
          text-transform: uppercase;
        }

        .plc-register-table tr:hover {
          background: rgba(255, 255, 255, 0.015);
        }

        .plc-register-table .node-name {
          color: var(--text-primary);
          font-weight: 600;
        }

        .plc-badge-status {
          font-size: 0.65rem;
          font-weight: 700;
          padding: 1.5px 5px;
          border-radius: 4px;
          letter-spacing: 0.5px;
        }

        .plc-badge-status.run {
          background: rgba(16, 185, 129, 0.15);
          color: var(--color-active-green);
          border: 1px solid rgba(16, 185, 129, 0.3);
        }

        .plc-badge-status.stop {
          background: rgba(239, 68, 68, 0.15);
          color: var(--color-error-crimson);
          border: 1px solid rgba(239, 68, 68, 0.3);
        }

        .plc-register-table .register-val {
          color: var(--color-cyber-blue);
          font-weight: 600;
        }

        .plc-register-table .bit-coils {
          letter-spacing: 1px;
        }

        .scada-explain-panel {
          padding: 1.5rem;
          display: flex;
          flex-direction: column;
          gap: 1.25rem;
        }

        .explain-tabs {
          display: flex;
          flex-wrap: wrap;
          gap: 0.5rem;
          border-bottom: 1px solid rgba(255, 255, 255, 0.08);
          padding-bottom: 0.75rem;
        }

        .explain-tab {
          background: rgba(255, 255, 255, 0.03);
          border: 1px solid rgba(255, 255, 255, 0.06);
          color: var(--text-secondary);
          padding: 0.5rem 1rem;
          border-radius: 8px;
          font-size: 0.85rem;
          cursor: pointer;
          transition: all 0.25s ease;
          font-weight: 500;
        }

        .explain-tab:hover {
          background: rgba(56, 189, 248, 0.05);
          color: var(--text-primary);
          border-color: rgba(56, 189, 248, 0.25);
        }

        .explain-tab.active {
          background: rgba(56, 189, 248, 0.12);
          color: var(--color-cyber-blue);
          border-color: rgba(56, 189, 248, 0.4);
          font-weight: 600;
          box-shadow: 0 0 10px rgba(56, 189, 248, 0.1);
        }

        .explain-content {
          min-height: 150px;
        }

        .explain-tab-body {
          animation: slideDown 0.3s ease-out forwards;
        }

        @keyframes slideDown {
          from { opacity: 0; transform: translateY(5px); }
          to { opacity: 1; transform: translateY(0); }
        }

        .explain-tab-body h4 {
          font-size: 1.05rem;
          margin: 0 0 0.85rem 0;
          color: var(--text-primary);
          display: flex;
          align-items: center;
          gap: 0.4rem;
        }

        .explain-tab-body p {
          font-size: 0.88rem;
          line-height: 1.6;
          color: var(--text-secondary);
          margin: 0 0 1rem 0;
        }

        .explain-tab-body ul {
          margin: 0 0 1rem 0;
          padding-left: 1.25rem;
          font-size: 0.88rem;
          line-height: 1.6;
          color: var(--text-secondary);
          display: flex;
          flex-direction: column;
          gap: 0.5rem;
        }

        .inline-icon {
          flex-shrink: 0;
        }
      `}</style>
    </div>
  );
};
