import React, { useMemo } from 'react';
import { Activity, Package, Trash2, Cpu } from 'lucide-react';
import type { Item, Machine, SimulationSettings, PlcData } from '../types/simulation';
import { PATH_COORDINATES } from '../hooks/useSimulation';

interface SimulatorCanvasProps {
  items: Item[];
  machines: Machine[];
  settings: SimulationSettings;
  isRunning: boolean;
  plcData: PlcData;
  plcConnections: { feeder: boolean; cnc: boolean; qc: boolean; sorter: boolean };
  dynamicStageCount?: number;
  dynamicPlcsData?: any[];
}

export const SimulatorCanvas: React.FC<SimulatorCanvasProps> = ({
  items,
  machines,
  settings,
  isRunning,
  plcData,
  plcConnections,
  dynamicStageCount = 8,
  dynamicPlcsData = []
}) => {
  const m1 = useMemo(() => machines.find((m) => m.id === 'm1'), [machines]);
  const m2 = useMemo(() => machines.find((m) => m.id === 'm2'), [machines]);

  const isDynamicMode = settings.plcMode === 'dynamic';

  // Protocol mapper helper
  const getProtocolInfo = (idx: number) => {
    const mod = (idx + 1) % 4;
    if (mod === 1) return { protocol: 'modbus', color: 'var(--color-active-green)', label: 'Modbus TCP' };
    if (mod === 2) return { protocol: 's7', color: 'var(--color-cyber-blue)', label: 'Siemens S7' };
    if (mod === 3) return { protocol: 'mc', color: 'var(--color-cyber-purple)', label: 'MELSEC MC' };
    return { protocol: 'xgt', color: '#22d3ee', label: 'LS Electric XGT' };
  };

  const getProtocolColor = (proto: string) => {
    switch (proto) {
      case 'modbus': return 'var(--color-active-green)';
      case 's7': return 'var(--color-cyber-blue)';
      case 'mc': return 'var(--color-cyber-purple)';
      case 'xgt': return '#22d3ee';
      default: return 'var(--text-muted)';
    }
  };

  // Serpentine coordinates generator: wrapping 5 machines per row (columns 0 to 4)
  const getStageCoords = (idx: number) => {
    const row = Math.floor(idx / 5);
    const col = idx % 5;
    const y = 55 + row * 95;
    const isEvenRow = row % 2 === 0;
    const x = isEvenRow ? (80 + col * 170) : (760 - col * 170);
    return { x, y, row, col, isEvenRow };
  };

  const plcsToDraw = useMemo(() => {
    if (!isDynamicMode) return [];
    return Array.from({ length: dynamicStageCount }, (_, idx) => {
      const socketPlc = dynamicPlcsData?.[idx];
      const protoInfo = getProtocolInfo(idx);
      return {
        idx: idx + 1,
        protocol: socketPlc?.protocol || protoInfo.protocol,
        color: getProtocolColor(socketPlc?.protocol || protoInfo.protocol),
        label: socketPlc?.protocol?.toUpperCase() || protoInfo.label,
        port: socketPlc?.port || (protoInfo.protocol === 'modbus' ? 5030 + idx * 10 : protoInfo.protocol === 's7' ? 1040 + idx * 10 : protoInfo.protocol === 'mc' ? 5041 + idx * 10 : 2044 + idx * 10),
        online: socketPlc?.online ?? false,
        data: socketPlc?.data || { conveyor_run: false, pos: 0, completed: 0, speed: 0, error: false }
      };
    });
  }, [isDynamicMode, dynamicStageCount, dynamicPlcsData]);

  // Dynamic animation speed calculations based on settings
  const conveyorAnimDuration = useMemo(() => {
    if (!isRunning) return '0s';
    return `${1.5 / settings.conveyorSpeed}s`;
  }, [settings.conveyorSpeed, isRunning]);

  // Helper to extract current PLC states (either live from vPLC runtime or simulated from browser)
  const displayPlc = useMemo(() => {
    const isLive = settings.plcMode === 'runtime';
    
    // 1. Feeder (PLC #1)
    const feederConn = isLive ? plcConnections.feeder : isRunning;
    const feederRun = isLive 
      ? plcData.feeder.conveyor_run 
      : (isRunning && items.some(i => i.status === 'conveyor1'));
    const feederErr = isLive ? plcData.feeder.error : false;

    // 2. CNC (PLC #2)
    const cncConn = isLive ? plcConnections.cnc : isRunning;
    const activeCncItem = items.find(i => i.status === 'conveyor1' || i.status === 'conveyor2' || i.status === 'processing');
    const cncPos = isLive 
      ? plcData.cnc.pos 
      : (activeCncItem 
          ? Math.round(activeCncItem.status === 'processing' ? 500 : activeCncItem.progress * 1000) 
          : 0);
    const cncSpeed = isLive ? plcData.cnc.speed : Math.round(settings.conveyorSpeed * 150);
    const cncRun = isLive ? plcData.cnc.conveyor_run : (isRunning && !m1?.status.includes('blocked'));
    const cncLift = isLive ? plcData.cnc.lift_down : (m1?.status === 'processing');
    const cncClamp = isLive ? plcData.cnc.clamp_on : (m1?.status === 'processing' || m1?.status === 'blocked');
    const cncCompleted = isLive ? plcData.cnc.completed : (m1?.processedCount || 0);

    // 3. QC (PLC #3)
    const qcConn = isLive ? plcConnections.qc : isRunning;
    const qcLaser = isLive ? plcData.qc.laser_on : (m2?.status === 'processing');
    const qcCompleted = isLive ? plcData.qc.completed : (m2?.processedCount || 0);

    // 4. Sorter (PLC #4)
    const sorterConn = isLive ? plcConnections.sorter : isRunning;
    const sorterCompleted = isLive ? plcData.sorter.completed : (items.filter(i => i.status === 'completed').length + (m2?.processedCount || 0));
    const sorterSpeed = isLive ? plcData.sorter.speed : Math.round(settings.conveyorSpeed * 150);
    const sorterExit = isLive ? (plcData.sorter.completed > 0) : (items.some(i => i.status === 'conveyor3' && i.progress > 0.8));

    return {
      feeder: { online: feederConn, run: feederRun, err: feederErr, serial: isLive ? (plcData.feeder as any).serial : "" },
      cnc: { online: cncConn, pos: cncPos, speed: cncSpeed, run: cncRun, lift: cncLift, clamp: cncClamp, completed: cncCompleted, serial: isLive ? (plcData.cnc as any).serial : "" },
      qc: { online: qcConn, laser: qcLaser, completed: qcCompleted, serial: isLive ? (plcData.qc as any).serial : "" },
      sorter: { online: sorterConn, completed: sorterCompleted, speed: sorterSpeed, exit: sorterExit, serial: isLive ? (plcData.sorter as any).serial : "" }
    };
  }, [settings.plcMode, isRunning, items, machines, plcData, plcConnections, m1, m2]);

  return (
    <div className="glass-panel canvas-panel">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2 className="panel-title" style={{ borderBottom: 'none', paddingBottom: 0 }}>
          <Activity size={18} style={{ color: 'var(--color-active-green)' }} />
          실시간 생산라인 시각화 모니터
        </h2>
        <span
          className="font-mono-tech"
          style={{ fontSize: '0.75rem', background: 'rgba(255,255,255,0.03)', padding: '0.25rem 0.5rem', borderRadius: '4px', border: '1px solid rgba(255,255,255,0.05)' }}
        >
          {isDynamicMode ? `ACTIVE STAGES: ${dynamicStageCount}개` : `ACTIVE CARGO: ${items.length}개`}
        </span>
      </div>

      <div className="canvas-container">
        <svg
          viewBox="0 0 850 400"
          width="100%"
          height="100%"
          style={{ display: 'block', userSelect: 'none' }}
        >
          {/* Neon glow filters definition */}
          <defs>
            <filter id="glow-blue-filter" x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="5" result="blur" />
              <feComposite in="SourceGraphic" in2="blur" operator="over" />
            </filter>
            <filter id="glow-green-filter" x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="5" result="blur" />
              <feComposite in="SourceGraphic" in2="blur" operator="over" />
            </filter>
            <filter id="glow-amber-filter" x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="5" result="blur" />
              <feComposite in="SourceGraphic" in2="blur" operator="over" />
            </filter>
            <filter id="glow-crimson-filter" x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="5" result="blur" />
              <feComposite in="SourceGraphic" in2="blur" operator="over" />
            </filter>
            <filter id="glow-purple-filter" x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="5" result="blur" />
              <feComposite in="SourceGraphic" in2="blur" operator="over" />
            </filter>
            <filter id="glow-cyan-filter" x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="5" result="blur" />
              <feComposite in="SourceGraphic" in2="blur" operator="over" />
            </filter>
            <filter id="laser-filter" x="-10%" y="-30%" width="120%" height="160%">
              <feGaussianBlur stdDeviation="3" result="blur" />
              <feComposite in="SourceGraphic" in2="blur" operator="over" />
            </filter>

            {/* CSS styles inside SVG for animated dotted conveyor belts */}
            <style>
              {`
                @keyframes flow-left-to-right {
                  from { stroke-dashoffset: 24; }
                  to { stroke-dashoffset: 0; }
                }
                .svg-conveyor {
                  stroke-dasharray: 8, 8;
                  animation: flow-left-to-right ${conveyorAnimDuration} infinite linear;
                }
                @keyframes laser-scan {
                  0%, 100% { transform: translateY(0px); }
                  50% { transform: translateY(60px); }
                }
                .laser-scanner {
                  animation: laser-scan 1.2s infinite ease-in-out;
                }
              `}
            </style>
          </defs>

          {/* If dynamic mode, render the serpentine track and dynamic cargo */}
          {isDynamicMode ? (
            <>
              {/* Conveyor belts background and foreground */}
              <g>
                {plcsToDraw.map((plc, idx) => {
                  const pt1 = getStageCoords(idx);
                  if (idx === dynamicStageCount - 1) {
                    const ptExit = { x: pt1.isEvenRow ? pt1.x + 60 : pt1.x - 60, y: pt1.y };
                    return (
                      <g key={`conv-exit`}>
                        <line
                          x1={pt1.x}
                          y1={pt1.y}
                          x2={ptExit.x}
                          y2={ptExit.y}
                          stroke="rgba(30, 41, 59, 0.9)"
                          strokeWidth="10"
                          strokeLinecap="round"
                        />
                        <line
                          x1={pt1.x}
                          y1={pt1.y}
                          x2={ptExit.x}
                          y2={ptExit.y}
                          stroke={plc.color}
                          strokeWidth="2"
                          strokeLinecap="round"
                          opacity="0.6"
                          className="svg-conveyor"
                        />
                      </g>
                    );
                  }

                  const pt2 = getStageCoords(idx + 1);
                  return (
                    <g key={`conv-${idx}`}>
                      <line
                        x1={pt1.x}
                        y1={pt1.y}
                        x2={pt2.x}
                        y2={pt2.y}
                        stroke="rgba(30, 41, 59, 0.9)"
                        strokeWidth="10"
                        strokeLinecap="round"
                      />
                      <line
                        x1={pt1.x}
                        y1={pt1.y}
                        x2={pt2.x}
                        y2={pt2.y}
                        stroke={plc.color}
                        strokeWidth="2"
                        strokeLinecap="round"
                        opacity="0.6"
                        className="svg-conveyor"
                      />
                    </g>
                  );
                })}
              </g>

              {/* Warehouse portal exit at conveyor end */}
              {(() => {
                const pt = getStageCoords(dynamicStageCount - 1);
                const ptExit = { x: pt.isEvenRow ? pt.x + 60 : pt.x - 60, y: pt.y };
                return (
                  <g transform={`translate(${ptExit.x - 16}, ${ptExit.y - 16})`}>
                    <rect
                      width="32"
                      height="32"
                      rx="6"
                      fill="rgba(16, 185, 129, 0.05)"
                      stroke="var(--color-active-green)"
                      strokeWidth="1.5"
                      filter="url(#glow-green-filter)"
                    />
                    <Package x="8" y="5" size={16} style={{ color: 'var(--color-active-green)' }} />
                    <text x="16" y="27" fill="var(--color-active-green)" fontSize="6" fontWeight="bold" textAnchor="middle">OUT</text>
                  </g>
                );
              })()}

              {/* Stations */}
              {plcsToDraw.map((plc, idx) => {
                const pt = getStageCoords(idx);
                const isOnline = plc.online;
                const hasError = plc.data.error;
                const isRunningPlc = plc.data.conveyor_run;
                
                let filterId = 'none';
                if (isOnline) {
                  if (plc.protocol === 'modbus') filterId = 'url(#glow-green-filter)';
                  else if (plc.protocol === 's7') filterId = 'url(#glow-blue-filter)';
                  else if (plc.protocol === 'mc') filterId = 'url(#glow-purple-filter)';
                  else if (plc.protocol === 'xgt') filterId = 'url(#glow-cyan-filter)';
                }
                if (hasError) filterId = 'url(#glow-crimson-filter)';

                return (
                  <g key={`station-${idx}`} transform={`translate(${pt.x}, ${pt.y})`}>
                    <circle
                      cx="0"
                      cy="0"
                      r="20"
                      fill="rgba(15, 23, 42, 0.95)"
                      stroke={hasError ? 'var(--color-error-crimson)' : isOnline ? plc.color : 'var(--text-muted)'}
                      strokeWidth="2"
                      filter={filterId}
                      style={{ transition: 'all 0.3s' }}
                    />

                    {isRunningPlc && isOnline && (
                      <g className="rotate-anim-fast">
                        <circle cx="0" cy="0" r="14" fill="none" stroke={plc.color} strokeWidth="1.5" strokeDasharray="5,3" opacity="0.6" />
                      </g>
                    )}

                    <circle
                      cx="0"
                      cy="0"
                      r="4"
                      fill={hasError ? 'var(--color-error-crimson)' : isOnline ? plc.color : 'var(--text-muted)'}
                    />

                    <text
                      x="0"
                      y="-7"
                      fill="var(--text-primary)"
                      fontSize="6.5"
                      fontWeight="bold"
                      textAnchor="middle"
                    >
                      {plc.protocol === 'modbus' ? 'MB' : plc.protocol === 's7' ? 'S7' : plc.protocol === 'mc' ? 'MC' : 'XG'}
                    </text>

                    <text
                      x="0"
                      y="12"
                      fill="var(--text-secondary)"
                      fontSize="7"
                      fontWeight="500"
                      textAnchor="middle"
                      className="font-mono-tech"
                    >
                      #{String(plc.idx).padStart(2, '0')}
                    </text>

                    <g transform="translate(0, 26)">
                      <rect
                        x="-20"
                        y="-5"
                        width="40"
                        height="10"
                        rx="3"
                        fill="#0f172a"
                        stroke={isOnline ? 'rgba(255,255,255,0.08)' : 'rgba(239,68,68,0.15)'}
                        strokeWidth="1"
                      />
                      <text
                        x="0"
                        y="2.5"
                        fill={isOnline ? plc.color : 'var(--color-error-crimson)'}
                        fontSize="6"
                        fontWeight="bold"
                        textAnchor="middle"
                        className="font-mono-tech"
                      >
                        {isOnline ? `${plc.data.completed} EA` : 'OFFLINE'}
                      </text>
                    </g>
                  </g>
                );
              })}

              {/* Glowing Cargo boxes gliding along conveyor segments */}
              {plcsToDraw.map((plc, idx) => {
                if (!plc.online) return null;
                
                const isRunningPlc = plc.data.conveyor_run;
                const pos = plc.data.pos || 0;
                
                if (!isRunningPlc && pos === 0) return null;
                
                const p = pos / 1000;
                const pt1 = getStageCoords(idx);
                
                let pt2;
                if (idx === dynamicStageCount - 1) {
                  pt2 = { x: pt1.isEvenRow ? pt1.x + 60 : pt1.x - 60, y: pt1.y };
                } else {
                  pt2 = getStageCoords(idx + 1);
                }
                
                const x = pt1.x + (pt2.x - pt1.x) * p;
                const y = pt1.y + (pt2.y - pt1.y) * p;
                
                let glowFilter = 'url(#glow-blue-filter)';
                if (plc.protocol === 'modbus') glowFilter = 'url(#glow-green-filter)';
                else if (plc.protocol === 's7') glowFilter = 'url(#glow-blue-filter)';
                else if (plc.protocol === 'mc') glowFilter = 'url(#glow-purple-filter)';
                else if (plc.protocol === 'xgt') glowFilter = 'url(#glow-cyan-filter)';

                return (
                  <g key={`cargo-${idx}`} transform={`translate(${x - 9}, ${y - 9})`} style={{ transition: 'transform 0.03s linear' }}>
                    <rect
                      width="18"
                      height="18"
                      rx="4"
                      fill="rgba(11, 15, 25, 0.95)"
                      stroke={plc.color}
                      strokeWidth="1.5"
                      filter={glowFilter}
                    />
                    <line x1="3" y1="9" x2="15" y2="9" stroke="rgba(255,255,255,0.15)" strokeWidth="0.75" />
                    <line x1="9" y1="3" x2="9" y2="15" stroke="rgba(255,255,255,0.15)" strokeWidth="0.75" />
                    <text
                      x="9"
                      y="11.5"
                      fill="var(--text-primary)"
                      fontSize="5"
                      fontWeight="bold"
                      textAnchor="middle"
                      className="font-mono-tech"
                    >
                      {plc.protocol === 'modbus' ? 'M' : plc.protocol === 's7' ? 'S' : plc.protocol === 'mc' ? 'C' : 'X'}
                    </text>
                    {plc.data.serial && plc.data.serial.trim() !== "" && (
                      <text
                        x="9"
                        y="-4"
                        fill={plc.color}
                        fontSize="6"
                        fontWeight="bold"
                        textAnchor="middle"
                        className="font-mono-tech"
                        opacity="0.95"
                      >
                        {plc.data.serial}
                      </text>
                    )}
                  </g>
                );
              })}
            </>
          ) : (
            // ==============================================================
            // FIXED 4-STAGE ORIGINAL LAYOUT RENDER (Untouched & Fully Compatible)
            // ==============================================================
            <>
              {/* BACKGROUND LAYOUT SCHEMATIC GRID */}
              <g stroke="rgba(255,255,255,0.015)" strokeWidth="1">
                <line x1="0" y1="100" x2="850" y2="100" />
                <line x1="0" y1="200" x2="850" y2="200" />
                <line x1="0" y1="300" x2="850" y2="300" />
                <line x1="150" y1="0" x2="150" y2="400" />
                <line x1="400" y1="0" x2="400" y2="400" />
                <line x1="650" y1="0" x2="650" y2="400" />
              </g>

              {/* Conveyor Belt 1 (Raw inputs to CNC) */}
              <g>
                <line
                  x1={PATH_COORDINATES.spawn.x}
                  y1={PATH_COORDINATES.spawn.y}
                  x2={PATH_COORDINATES.machineEntrance.x}
                  y2={PATH_COORDINATES.machineEntrance.y}
                  stroke="rgba(30, 41, 59, 0.9)"
                  strokeWidth="10"
                  strokeLinecap="round"
                />
                <line
                  x1={PATH_COORDINATES.spawn.x}
                  y1={PATH_COORDINATES.spawn.y}
                  x2={PATH_COORDINATES.machineEntrance.x}
                  y2={PATH_COORDINATES.machineEntrance.y}
                  stroke="var(--color-cyber-blue)"
                  strokeWidth="2"
                  strokeLinecap="round"
                  opacity="0.6"
                  className="svg-conveyor"
                />
              </g>

              {/* Conveyor Belt 2 (CNC to QC) */}
              <g>
                <line
                  x1={PATH_COORDINATES.machineExit.x}
                  y1={PATH_COORDINATES.machineExit.y}
                  x2={PATH_COORDINATES.inspectEntrance.x}
                  y2={PATH_COORDINATES.inspectEntrance.y}
                  stroke="rgba(30, 41, 59, 0.9)"
                  strokeWidth="10"
                  strokeLinecap="round"
                />
                <line
                  x1={PATH_COORDINATES.machineExit.x}
                  y1={PATH_COORDINATES.machineExit.y}
                  x2={PATH_COORDINATES.inspectEntrance.x}
                  y2={PATH_COORDINATES.inspectEntrance.y}
                  stroke="var(--color-cyber-purple)"
                  strokeWidth="2"
                  strokeLinecap="round"
                  opacity="0.6"
                  className="svg-conveyor"
                />
              </g>

              {/* Conveyor Belt 3 (QC to Warehouse - GOOD) */}
              <g>
                <path
                  d={`M ${PATH_COORDINATES.inspectExit.x} ${PATH_COORDINATES.inspectExit.y} L 650 200 L ${PATH_COORDINATES.warehouse.x} ${PATH_COORDINATES.warehouse.y}`}
                  fill="none"
                  stroke="rgba(30, 41, 59, 0.9)"
                  strokeWidth="10"
                  strokeLinecap="round"
                />
                <path
                  d={`M ${PATH_COORDINATES.inspectExit.x} ${PATH_COORDINATES.inspectExit.y} L 650 200 L ${PATH_COORDINATES.warehouse.x} ${PATH_COORDINATES.warehouse.y}`}
                  fill="none"
                  stroke="var(--color-active-green)"
                  strokeWidth="2"
                  strokeLinecap="round"
                  opacity="0.6"
                  className="svg-conveyor"
                />
              </g>

              {/* Conveyor Belt 4 (QC to Scrapyard - DEFECTIVE) */}
              <g>
                <path
                  d={`M ${PATH_COORDINATES.inspectExit.x} ${PATH_COORDINATES.inspectExit.y} L 650 200 L ${PATH_COORDINATES.scrapyard.x} ${PATH_COORDINATES.scrapyard.y}`}
                  fill="none"
                  stroke="rgba(30, 41, 59, 0.9)"
                  strokeWidth="10"
                  strokeLinecap="round"
                />
                <path
                  d={`M ${PATH_COORDINATES.inspectExit.x} ${PATH_COORDINATES.inspectExit.y} L 650 200 L ${PATH_COORDINATES.scrapyard.x} ${PATH_COORDINATES.scrapyard.y}`}
                  fill="none"
                  stroke="var(--color-error-crimson)"
                  strokeWidth="2"
                  strokeLinecap="round"
                  opacity="0.6"
                  className="svg-conveyor"
                />
              </g>

              {/* STATION 1: SPAWNER / ITEM INPUT */}
              <g transform={`translate(${PATH_COORDINATES.spawn.x - 25}, ${PATH_COORDINATES.spawn.y - 25})`}>
                <rect
                  width="50"
                  height="50"
                  rx="10"
                  fill="#1e293b"
                  stroke="var(--color-cyber-blue)"
                  strokeWidth="2"
                  filter="url(#glow-blue-filter)"
                />
                <circle
                  cx="25"
                  cy="25"
                  r="4"
                  fill="var(--color-cyber-blue)"
                  className="pulse-indicator"
                />
                <text x="25" y="44" fill="var(--text-secondary)" fontSize="7" textAnchor="middle" fontWeight="bold">INPUT</text>
                <rect x="18" y="10" width="14" height="14" rx="2" fill="none" stroke="var(--text-secondary)" strokeWidth="1.5" />
              </g>

              {/* STATION 2: CNC PRECISION MACHINE (M1) */}
              {m1 && (
                <g transform="translate(230, 140)">
                  <rect
                    width="100"
                    height="120"
                    rx="12"
                    fill="rgba(15, 23, 42, 0.9)"
                    stroke={
                      m1.status === 'blocked'
                        ? 'var(--color-error-crimson)'
                        : m1.status === 'processing'
                        ? 'var(--color-cyber-blue)'
                        : 'var(--text-muted)'
                    }
                    strokeWidth="2"
                    style={{ transition: 'all 0.3s' }}
                    filter={
                      m1.status === 'blocked'
                        ? 'url(#glow-crimson-filter)'
                        : m1.status === 'processing'
                        ? 'url(#glow-blue-filter)'
                        : 'none'
                    }
                  />
                  <rect x="10" y="25" width="80" height="70" rx="6" fill="#04060e" />

                  {m1.status === 'processing' && (
                    <g>
                      <g transform="translate(50, 45)" className="rotate-anim-fast">
                        <circle cx="0" cy="0" r="14" fill="none" stroke="rgba(56, 189, 248, 0.4)" strokeWidth="2" strokeDasharray="6,4" />
                        <circle cx="0" cy="0" r="6" fill="var(--color-cyber-blue)" />
                      </g>
                      <line x1="50" y1="25" x2="50" y2="80" stroke="var(--color-cyber-blue)" strokeWidth="1.5" opacity="0.85" filter="url(#laser-filter)" />
                      <line x1="20" y1="60" x2="80" y2="60" stroke="var(--color-cyber-blue)" strokeWidth="0.5" opacity="0.4" />
                    </g>
                  )}

                  {m1.status === 'blocked' && (
                    <g transform="translate(50, 50)">
                      <circle cx="0" cy="0" r="18" fill="rgba(239, 68, 68, 0.15)" stroke="var(--color-error-crimson)" strokeWidth="1.5" className="pulse-indicator" />
                      <path d="M-5,4 L5,4 L0,-6 Z" fill="var(--color-error-crimson)" />
                      <text x="0" y="16" fill="var(--color-error-crimson)" fontSize="7" textAnchor="middle" fontWeight="bold">BLOCKED</text>
                    </g>
                  )}

                  {m1.status === 'idle' && (
                    <text x="50" y="60" fill="var(--text-muted)" fontSize="9" textAnchor="middle">STANDBY</text>
                  )}

                  <text x="50" y="15" fill="var(--text-primary)" fontSize="8" fontWeight="600" textAnchor="middle">CNC 가공기</text>
                  <Cpu x="42" y="102" size={15} style={{ color: m1.status === 'processing' ? 'var(--color-cyber-blue)' : 'var(--text-muted)' }} />
                </g>
              )}

              {/* STATION 3: QC VISION INSPECTION STATION (M2) */}
              {m2 && (
                <g transform="translate(470, 140)">
                  <rect
                    width="100"
                    height="120"
                    rx="12"
                    fill="rgba(15, 23, 42, 0.9)"
                    stroke={m2.status === 'processing' ? 'var(--color-cyber-purple)' : 'var(--text-muted)'}
                    strokeWidth="2"
                    style={{ transition: 'all 0.3s' }}
                    filter={m2.status === 'processing' ? 'url(#glow-purple-filter)' : 'none'}
                  />
                  <rect x="10" y="25" width="80" height="70" rx="6" fill="#04060e" />

                  {m2.status === 'processing' && (
                    <g>
                      <g className="laser-scanner">
                        <line
                          x1="10"
                          y1="30"
                          x2="90"
                          y2="30"
                          stroke="var(--color-cyber-purple)"
                          strokeWidth="2.5"
                          filter="url(#laser-filter)"
                        />
                        <rect x="10" y="30" width="80" height="15" fill="linear-gradient(rgba(168,85,247,0.15), transparent)" opacity="0.3" />
                      </g>
                    </g>
                  )}

                  {m2.status === 'idle' && (
                    <text x="50" y="60" fill="var(--text-muted)" fontSize="9" textAnchor="middle">READY</text>
                  )}

                  <text x="50" y="15" fill="var(--text-primary)" fontSize="8" fontWeight="600" textAnchor="middle">QC 비전검사기</text>
                  {m2.currentItemId && (
                    <text x="50" y="85" fill="var(--color-cyber-purple)" fontSize="8" fontWeight="bold" textAnchor="middle" className="font-mono-tech">
                      SCANNING
                    </text>
                  )}
                </g>
              )}

              {/* STATION 4: WAREHOUSE / COMPLETED CARGO STORAGE */}
              <g transform={`translate(${PATH_COORDINATES.warehouse.x - 30}, ${PATH_COORDINATES.warehouse.y - 35})`}>
                <rect
                  width="70"
                  height="70"
                  rx="12"
                  fill="rgba(16, 185, 129, 0.05)"
                  stroke="var(--color-active-green)"
                  strokeWidth="2"
                  filter="url(#glow-green-filter)"
                />
                <Package x="23" y="12" size={24} style={{ color: 'var(--color-active-green)' }} />
                <text x="35" y="52" fill="var(--color-active-green)" fontSize="8" fontWeight="bold" textAnchor="middle">양품 보관고</text>
                <text x="35" y="62" fill="var(--text-secondary)" fontSize="7" textAnchor="middle">WAREHOUSE</text>
              </g>

              {/* STATION 5: SCRAP YARD / DEFECTIVE CONTAINER */}
              <g transform={`translate(${PATH_COORDINATES.scrapyard.x - 30}, ${PATH_COORDINATES.scrapyard.y - 35})`}>
                <rect
                  width="70"
                  height="70"
                  rx="12"
                  fill="rgba(239, 68, 68, 0.05)"
                  stroke="var(--color-error-crimson)"
                  strokeWidth="2"
                  filter="url(#glow-crimson-filter)"
                />
                <Trash2 x="23" y="12" size={24} style={{ color: 'var(--color-error-crimson)' }} />
                <text x="35" y="52" fill="var(--color-error-crimson)" fontSize="8" fontWeight="bold" textAnchor="middle">폐기물 처리장</text>
                <text x="35" y="62" fill="var(--text-secondary)" fontSize="7" textAnchor="middle">SCRAP HEAP</text>
              </g>

              {/* FLOATING ACTIVE CARGO ITEMS */}
              {items.map((item) => {
                let filterId = 'url(#glow-blue-filter)';
                let borderColor = 'var(--color-cyber-blue)';
                
                if (item.status === 'inspecting' || item.status === 'processing') {
                  filterId = 'url(#glow-amber-filter)';
                  borderColor = 'var(--color-warning-amber)';
                } else if (item.status === 'defective' || item.quality === 'defective') {
                  filterId = 'url(#glow-crimson-filter)';
                  borderColor = 'var(--color-error-crimson)';
                } else if (item.status === 'conveyor3' || item.quality === 'good') {
                  filterId = 'url(#glow-green-filter)';
                  borderColor = 'var(--color-active-green)';
                }

                return (
                  <g
                    key={item.id}
                    transform={`translate(${item.x - 13}, ${item.y - 13})`}
                    style={{ transition: 'transform 0.03s linear' }}
                  >
                    <rect
                      width="26"
                      height="26"
                      rx="6"
                      fill="rgba(11, 15, 25, 0.95)"
                      stroke={borderColor}
                      strokeWidth="2"
                      filter={filterId}
                    />
                    <line x1="5" y1="13" x2="21" y2="13" stroke="rgba(255,255,255,0.15)" strokeWidth="1" />
                    <line x1="13" y1="5" x2="13" y2="21" stroke="rgba(255,255,255,0.15)" strokeWidth="1" />
                    <text
                      x="13"
                      y="16"
                      fill="var(--text-primary)"
                      fontSize="6.5"
                      fontWeight="bold"
                      textAnchor="middle"
                      className="font-mono-tech"
                    >
                      {item.id.split('-')[1]}
                    </text>
                    {item.serialNo && item.serialNo.trim() !== "" && (
                      <text
                        x="13"
                        y="-6"
                        fill={borderColor}
                        fontSize="6.5"
                        fontWeight="bold"
                        textAnchor="middle"
                        className="font-mono-tech"
                        opacity="0.95"
                      >
                        {item.serialNo}
                      </text>
                    )}
                  </g>
                );
              })}
            </>
          )}
        </svg>
      </div>

      {/* ============================================================== */}
      {/* CYBER HUD TERMINALS: LIVE PLC REGISTER PANELS */}
      {/* ============================================================== */}
      {isDynamicMode ? (
        <div className="plc-hud-grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '0.75rem' }}>
          {plcsToDraw.map((plc) => (
            <div
              key={`hud-${plc.idx}`}
              className={`plc-hud-card ${plc.online ? 'online' : 'offline'}`}
              style={{ '--glow-color': plc.color } as React.CSSProperties}
            >
              <div className="plc-hud-header">
                <span className="plc-hud-title font-mono-tech" style={{ fontSize: '0.72rem' }}>
                  PLC_{String(plc.idx).padStart(2, '0')} [{plc.label.split(' ')[0]}]
                </span>
                <span className={`plc-hud-status-dot ${plc.online ? 'active' : 'inactive'}`} />
              </div>
              <div className="plc-hud-body font-mono-tech" style={{ fontSize: '0.7rem', padding: '0.25rem 0' }}>
                <div className="plc-hud-row">
                  <span className="plc-hud-label" style={{ fontSize: '0.65rem' }}>PORT</span>
                  <span className="plc-hud-value" style={{ color: plc.color }}>{plc.port}</span>
                </div>
                <div className="plc-hud-row">
                  <span className="plc-hud-label" style={{ fontSize: '0.65rem' }}>POSITION</span>
                  <span className="plc-hud-value text-blue">{plc.data.pos} mm</span>
                </div>
                <div className="plc-hud-row">
                  <span className="plc-hud-label" style={{ fontSize: '0.65rem' }}>CONVEYOR</span>
                  <span className={`plc-hud-value ${plc.data.conveyor_run ? 'text-green' : 'text-muted'}`}>
                    {plc.data.conveyor_run ? "RUNNING" : "STOPPED"}
                  </span>
                </div>
                <div className="plc-hud-row">
                  <span className="plc-hud-label" style={{ fontSize: '0.65rem' }}>COMPLETED</span>
                  <span className="plc-hud-value text-purple">{plc.data.completed} ea</span>
                </div>
                {plc.data.serial && (
                  <div className="plc-hud-row" style={{ marginTop: '2px', borderTop: '1px dashed rgba(255,255,255,0.06)', paddingTop: '2px' }}>
                    <span className="plc-hud-label" style={{ fontSize: '0.65rem' }}>SERIAL NO</span>
                    <span className="plc-hud-value" style={{ color: plc.color, fontWeight: 'bold' }}>{(plc.data as any).serial || "          "}</span>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="plc-hud-grid">
          {/* PLC #1 Spawner/Feeder HUD */}
          <div className={`plc-hud-card ${displayPlc.feeder.online ? 'online' : 'offline'}`} style={{ '--glow-color': 'var(--color-cyber-blue)' } as React.CSSProperties}>
            <div className="plc-hud-header">
              <span className="plc-hud-title font-mono-tech">PLC_01 [Modbus TCP]</span>
              <span className={`plc-hud-status-dot ${displayPlc.feeder.online ? 'active' : 'inactive'}`} />
            </div>
            <div className="plc-hud-body font-mono-tech">
              <div className="plc-hud-row">
                <span className="plc-hud-label">STATUS</span>
                <span className={`plc-hud-value ${displayPlc.feeder.online ? 'text-green' : 'text-red'}`}>
                  {displayPlc.feeder.online ? "ONLINE" : "OFFLINE"}
                </span>
              </div>
              <div className="plc-hud-row">
                <span className="plc-hud-label">%QX0.0 (Feed Conv)</span>
                <span className={`plc-hud-value ${displayPlc.feeder.run ? 'text-green' : 'text-muted'}`}>
                  {displayPlc.feeder.run ? "RUN" : "STOP"}
                </span>
              </div>
              <div className="plc-hud-row">
                <span className="plc-hud-label">%IX0.2 (Part Sens)</span>
                <span className={`plc-hud-value ${displayPlc.feeder.run ? 'text-green' : 'text-muted'}`}>
                  {displayPlc.feeder.run ? "ACTIVE" : "EMPTY"}
                </span>
              </div>
              <div className="plc-hud-row">
                <span className="plc-hud-label">%QX0.6 (Alarm LED)</span>
                <span className={`plc-hud-value ${displayPlc.feeder.err ? 'text-red' : 'text-green'}`}>
                  {displayPlc.feeder.err ? "WARN" : "SAFE"}
                </span>
              </div>
              <div className="plc-hud-row" style={{ marginTop: '2px', borderTop: '1px dashed rgba(255,255,255,0.06)', paddingTop: '2px' }}>
                <span className="plc-hud-label">MES SERIAL</span>
                <span className="plc-hud-value text-blue" style={{ fontWeight: 'bold' }}>{(displayPlc.feeder as any).serial || "          "}</span>
              </div>
            </div>
          </div>

          {/* PLC #2 CNC HUD */}
          <div className={`plc-hud-card ${displayPlc.cnc.online ? 'online' : 'offline'}`} style={{ '--glow-color': 'var(--color-cyber-blue)' } as React.CSSProperties}>
            <div className="plc-hud-header">
              <span className="plc-hud-title font-mono-tech">PLC_02 [Siemens S7]</span>
              <span className={`plc-hud-status-dot ${displayPlc.cnc.online ? 'active' : 'inactive'}`} />
            </div>
            <div className="plc-hud-body font-mono-tech">
              <div className="plc-hud-row">
                <span className="plc-hud-label">%IW0 (Position)</span>
                <span className="plc-hud-value text-blue">{displayPlc.cnc.pos} mm</span>
              </div>
              <div className="plc-hud-row">
                <span className="plc-hud-label">%MW1 (Speed)</span>
                <span className="plc-hud-value text-amber">{displayPlc.cnc.speed} mm/s</span>
              </div>
              <div className="plc-hud-row">
                <span className="plc-hud-label">%QX0.1 (Robot arm)</span>
                <span className="plc-hud-value">
                  <span className={displayPlc.cnc.lift ? 'text-amber' : 'text-muted'}>{displayPlc.cnc.lift ? "L_DN" : "L_UP"}</span>
                  {' | '}
                  <span className={displayPlc.cnc.clamp ? 'text-green' : 'text-muted'}>{displayPlc.cnc.clamp ? "CLMP" : "OPEN"}</span>
                </span>
              </div>
              <div className="plc-hud-row">
                <span className="plc-hud-label">%MW0 (Completed)</span>
                <span className="plc-hud-value text-blue">{displayPlc.cnc.completed} ea</span>
              </div>
              <div className="plc-hud-row" style={{ marginTop: '2px', borderTop: '1px dashed rgba(255,255,255,0.06)', paddingTop: '2px' }}>
                <span className="plc-hud-label">MES SERIAL</span>
                <span className="plc-hud-value text-blue" style={{ fontWeight: 'bold' }}>{(displayPlc.cnc as any).serial || "          "}</span>
              </div>
            </div>
          </div>

          {/* PLC #3 QC HUD */}
          <div className={`plc-hud-card ${displayPlc.qc.online ? 'online' : 'offline'}`} style={{ '--glow-color': 'var(--color-cyber-purple)' } as React.CSSProperties}>
            <div className="plc-hud-header">
              <span className="plc-hud-title font-mono-tech">PLC_03 [MELSEC MC]</span>
              <span className={`plc-hud-status-dot ${displayPlc.qc.online ? 'active' : 'inactive'}`} />
            </div>
            <div className="plc-hud-body font-mono-tech">
              <div className="plc-hud-row">
                <span className="plc-hud-label">STATUS</span>
                <span className={`plc-hud-value ${displayPlc.qc.online ? 'text-green' : 'text-red'}`}>
                  {displayPlc.qc.online ? "ONLINE" : "OFFLINE"}
                </span>
              </div>
              <div className="plc-hud-row">
                <span className="plc-hud-label">%QX0.3 (Laser sweep)</span>
                <span className={`plc-hud-value ${displayPlc.qc.laser ? 'text-green' : 'text-muted'}`}>
                  {displayPlc.qc.laser ? "EMITTING" : "STANDBY"}
                </span>
              </div>
              <div className="plc-hud-row">
                <span className="plc-hud-label">%IX0.5 (Vision scan)</span>
                <span className={`plc-hud-value ${displayPlc.qc.laser ? 'text-purple' : 'text-muted'}`}>
                  {displayPlc.qc.laser ? "SCANNING" : "WAIT"}
                </span>
              </div>
              <div className="plc-hud-row">
                <span className="plc-hud-label">D0000 (Checked)</span>
                <span className="plc-hud-value text-purple">{displayPlc.qc.completed} ea</span>
              </div>
              <div className="plc-hud-row" style={{ marginTop: '2px', borderTop: '1px dashed rgba(255,255,255,0.06)', paddingTop: '2px' }}>
                <span className="plc-hud-label">MES SERIAL</span>
                <span className="plc-hud-value text-purple" style={{ fontWeight: 'bold' }}>{(displayPlc.qc as any).serial || "          "}</span>
              </div>
            </div>
          </div>

          {/* PLC #4 Sorter HUD */}
          <div className={`plc-hud-card ${displayPlc.sorter.online ? 'online' : 'offline'}`} style={{ '--glow-color': 'var(--color-active-green)' } as React.CSSProperties}>
            <div className="plc-hud-header">
              <span className="plc-hud-title font-mono-tech">PLC_04 [LS-XGT FEnet]</span>
              <span className={`plc-hud-status-dot ${displayPlc.sorter.online ? 'active' : 'inactive'}`} />
            </div>
            <div className="plc-hud-body font-mono-tech">
              <div className="plc-hud-row">
                <span className="plc-hud-label">%MW0 (Total Out)</span>
                <span className="plc-hud-value text-green">{displayPlc.sorter.completed} ea</span>
              </div>
              <div className="plc-hud-row">
                <span className="plc-hud-label">%MW1 (Speed)</span>
                <span className="plc-hud-value text-blue">{displayPlc.sorter.speed} mm/s</span>
              </div>
              <div className="plc-hud-row">
                <span className="plc-hud-label">%PX4 (Exit Gate)</span>
                <span className={`plc-hud-value ${displayPlc.sorter.exit ? 'text-green' : 'text-muted'}`}>
                  {displayPlc.sorter.exit ? "PASS" : "BLOCK"}
                </span>
              </div>
              <div className="plc-hud-row">
                <span className="plc-hud-label">%QX0.6 (Alarm LED)</span>
                <span className="plc-hud-value text-green">SAFE</span>
              </div>
              <div className="plc-hud-row" style={{ marginTop: '2px', borderTop: '1px dashed rgba(255,255,255,0.06)', paddingTop: '2px' }}>
                <span className="plc-hud-label">MES SERIAL</span>
                <span className="plc-hud-value text-green" style={{ fontWeight: 'bold' }}>{(displayPlc.sorter as any).serial || "          "}</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Visual map indicators legend */}
      <div style={{ display: 'flex', justifyContent: 'center', gap: '1.5rem', fontSize: '0.75rem', color: 'var(--text-secondary)', background: 'rgba(255,255,255,0.02)', padding: '0.5rem', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.04)' }}>
        {isDynamicMode ? (
          <>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
              <span style={{ width: '10px', height: '10px', borderRadius: '3px', background: 'var(--color-active-green)', display: 'inline-block' }} />
              <span>Modbus TCP (그린)</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
              <span style={{ width: '10px', height: '10px', borderRadius: '3px', background: 'var(--color-cyber-blue)', display: 'inline-block' }} />
              <span>Siemens S7 (블루)</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
              <span style={{ width: '10px', height: '10px', borderRadius: '3px', background: 'var(--color-cyber-purple)', display: 'inline-block' }} />
              <span>MELSEC MC (퍼플)</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
              <span style={{ width: '10px', height: '10px', borderRadius: '3px', background: '#22d3ee', display: 'inline-block' }} />
              <span>LS Electric XGT (시안)</span>
            </div>
          </>
        ) : (
          <>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
              <span style={{ width: '10px', height: '10px', borderRadius: '3px', background: 'var(--color-cyber-blue)', display: 'inline-block' }} />
              <span>가공대기 / 양품이동</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
              <span style={{ width: '10px', height: '10px', borderRadius: '3px', background: 'var(--color-warning-amber)', display: 'inline-block' }} />
              <span>가공중 / 검사 대기</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
              <span style={{ width: '10px', height: '10px', borderRadius: '3px', background: 'var(--color-error-crimson)', display: 'inline-block' }} />
              <span>불량품 (폐기 처리)</span>
            </div>
          </>
        )}
      </div>
    </div>
  );
};
