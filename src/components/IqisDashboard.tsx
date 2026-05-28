import React, { useEffect, useRef, useState } from 'react';
import { 
  ShieldCheck, Database, Play, Pause, Activity, ClipboardCheck, 
  CheckCircle, AlertOctagon, TrendingUp, Info, BarChart
} from 'lucide-react';

interface QaInspection {
  orderId: string;
  carType: string;
  gapSpec: string;
  measuredGap: string;
  paintDust: number;
  brakeForce: string;
  result: 'PASS' | 'REJECT';
  timestamp: string;
}

export const IqisDashboard: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isRunning, setIsRunning] = useState(true);
  
  // Quality telemetry stats
  const [fpyYield, setFpyYield] = useState(98.85); // First Pass Yield %
  const [cpkIndex, setCpkIndex] = useState(1.65); // Process Capability Index Cpk
  const [inspectedToday, setInspectedToday] = useState(384);
  const [rejectedToday, setRejectedToday] = useState(4);
  
  // Tab trigger for explanation card
  const [activeLearnTab, setActiveLearnTab] = useState<'intro' | 'spc' | 'flush' | 'paint'>('intro');

  // SPC Data points for X-Bar Control Chart
  const [spcPoints, setSpcPoints] = useState<number[]>([
    0.38, 0.42, 0.41, 0.37, 0.45, 0.39, 0.43, 0.40, 0.36, 0.44, 
    0.38, 0.41, 0.40, 0.42, 0.37, 0.45, 0.39, 0.40, 0.42, 0.38
  ]);

  // Live Inspection DB queue
  const [inspectionLogs, setInspectionLogs] = useState<QaInspection[]>([
    { orderId: 'ORD-2026-090', carType: 'EV6 GT Line', gapSpec: '0.40 ± 0.15mm', measuredGap: '0.42 mm', paintDust: 0, brakeForce: '98%', result: 'PASS', timestamp: '21:20:10' },
    { orderId: 'ORD-2026-089', carType: 'Genesis GV80', gapSpec: '0.40 ± 0.15mm', measuredGap: '0.38 mm', paintDust: 1, brakeForce: '97%', result: 'PASS', timestamp: '21:18:05' },
    { orderId: 'ORD-2026-088', carType: 'EV9 Grand', gapSpec: '0.40 ± 0.15mm', measuredGap: '0.58 mm', paintDust: 0, brakeForce: '99%', result: 'REJECT', timestamp: '21:16:32' },
    { orderId: 'ORD-2026-087', carType: 'K8 Hybrid', gapSpec: '0.40 ± 0.15mm', measuredGap: '0.41 mm', paintDust: 2, brakeForce: '96%', result: 'PASS', timestamp: '21:14:15' },
    { orderId: 'ORD-2026-086', carType: 'Genesis G90', gapSpec: '0.40 ± 0.15mm', measuredGap: '0.39 mm', paintDust: 0, brakeForce: '98%', result: 'PASS', timestamp: '21:11:02' }
  ]);

  // Pareto Chart defect counts
  const defects = [
    { type: 'Paint Dust (도장 티끌)', count: 24, percent: 38 },
    { type: 'Gap/Flush Error (단차 불량)', count: 18, percent: 28 },
    { type: 'Screw Under-torque (볼트 체결 부족)', count: 11, percent: 17 },
    { type: 'Connector Loose (커넥터 접촉 불량)', count: 7, percent: 11 },
    { type: 'Wheel Misalignment (정렬 오차)', count: 4, percent: 6 }
  ];

  // Dynamic telemetry shifts
  useEffect(() => {
    if (!isRunning) return;

    const interval = setInterval(() => {
      // Fluctuate Cpk and Yield
      setCpkIndex(+(1.55 + Math.random() * 0.18).toFixed(2));
      setFpyYield(+(98.4 + Math.random() * 0.5).toFixed(2));

      // Append new SPC chart coordinate
      setSpcPoints(prev => {
        const nextVal = +(0.34 + Math.random() * 0.13).toFixed(2);
        return [...prev.slice(1), nextVal];
      });

      // Shift inspection logs
      if (Math.random() < 0.45) {
        const carTypes = ['EV9 Grand', 'Genesis GV80', 'K8 Hybrid', 'EV6 GT Line', 'Genesis G90'];
        const randomCar = carTypes[Math.floor(Math.random() * carTypes.length)];
        
        // Form random measurements
        const isNg = Math.random() < 0.05; // 5% defect rate
        const gapVal = isNg 
          ? +(0.56 + Math.random() * 0.1).toFixed(2) 
          : +(0.34 + Math.random() * 0.12).toFixed(2);
        const dustCount = isNg && Math.random() > 0.5 ? Math.floor(Math.random() * 3 + 4) : Math.floor(Math.random() * 3);
        const force = `${95 + Math.floor(Math.random() * 5)}%`;

        const now = new Date();
        const timeStr = `${now.getHours().toString().padStart(2,'0')}:${now.getMinutes().toString().padStart(2,'0')}:${now.getSeconds().toString().padStart(2,'0')}`;
        
        const newIdNum = 100 + Math.floor(Math.random() * 900);
        const newLog: QaInspection = {
          orderId: `ORD-2026-${newIdNum}`,
          carType: randomCar,
          gapSpec: '0.40 ± 0.15mm',
          measuredGap: `${gapVal} mm`,
          paintDust: dustCount,
          brakeForce: force,
          result: isNg || dustCount > 3 ? 'REJECT' : 'PASS',
          timestamp: timeStr
        };

        if (newLog.result === 'REJECT') {
          setRejectedToday(r => r + 1);
        }
        setInspectedToday(i => i + 1);
        setInspectionLogs(prev => [newLog, ...prev.slice(0, 6)]);
      }
    }, 3000);

    return () => clearInterval(interval);
  }, [isRunning]);

  // Canvas drawing loop for 3 QA Inspection Gates
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationFrameId: number;
    let width = (canvas.width = canvas.offsetWidth);
    let height = (canvas.height = canvas.offsetHeight);

    const handleResize = () => {
      if (!canvas) return;
      width = canvas.width = canvas.offsetWidth;
      height = canvas.height = canvas.offsetHeight;
    };

    window.addEventListener('resize', handleResize);

    // Node coordinate structure
    interface QaGate {
      name: string;
      desc: string;
      x: number;
      y: number;
      sensorY: number;
      sensorDir: number;
      type: 'gap' | 'paint' | 'end';
    }

    const gates: QaGate[] = [
      { name: '1. Vision Gap & Flush', desc: '단차/틈새 레이저 스캔', x: 100, y: 220, sensorY: 0, sensorDir: 1, type: 'gap' },
      { name: '2. Paint AI Scanner', desc: '도막 & 티끌 정밀 검사', x: 300, y: 220, sensorY: 0, sensorDir: 1, type: 'paint' },
      { name: '3. End-of-Line Tester', desc: '얼라인먼트 & 제동력 시험', x: 500, y: 220, sensorY: 0, sensorDir: 1, type: 'end' }
    ];

    const dbNode = { x: 300, y: 60, label: 'IQIS QUALITY DATABASE' };

    interface QualityPacket {
      fromX: number;
      fromY: number;
      progress: number;
      color: string;
      size: number;
    }

    const packets: QualityPacket[] = [];
    let drawTimer = 0;

    // Conveyor rail helper
    const drawConveyor = (ctx: CanvasRenderingContext2D) => {
      ctx.save();
      ctx.strokeStyle = '#1e293b';
      ctx.lineWidth = 14;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(20, 220);
      ctx.lineTo(580, 220);
      ctx.stroke();

      ctx.strokeStyle = '#475569';
      ctx.lineWidth = 4;
      ctx.setLineDash([10, 15]);
      ctx.lineDashOffset = isRunning ? -drawTimer * 1.5 : 0;
      ctx.beginPath();
      ctx.moveTo(20, 220);
      ctx.lineTo(580, 220);
      ctx.stroke();
      ctx.restore();
    };

    // Draw stylized inspection gate
    const drawInspectionGate = (ctx: CanvasRenderingContext2D, gate: QaGate) => {
      ctx.save();
      ctx.translate(gate.x, gate.y);

      // Gate Frame
      ctx.strokeStyle = 'rgba(239, 68, 68, 0.2)';
      ctx.lineWidth = 2;
      ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
      ctx.beginPath();
      ctx.roundRect(-42, -50, 84, 100, 8);
      ctx.fill();
      ctx.stroke();

      // Top/Bottom sensor mounts
      ctx.fillStyle = '#475569';
      ctx.fillRect(-30, -50, 60, 8);
      ctx.fillRect(-30, 42, 60, 8);

      // Linear scanning laser sweep motion
      if (isRunning) {
        gate.sensorY += 1.8 * gate.sensorDir;
        if (gate.sensorY > 38 || gate.sensorY < -38) {
          gate.sensorDir *= -1;
        }
      }

      // Draw custom visual beams per gate type
      if (gate.type === 'gap') {
        // Vertical double Lidar scanning laser lines (flat, no flickering)
        ctx.strokeStyle = 'rgba(239, 68, 68, 0.7)';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(-18, -42);
        ctx.lineTo(-18, 42);
        ctx.moveTo(18, -42);
        ctx.lineTo(18, 42);
        ctx.stroke();

        // Laser beam dot
        ctx.fillStyle = '#ef4444';
        ctx.beginPath();
        ctx.arc(-18, gate.sensorY, 4, 0, Math.PI*2);
        ctx.arc(18, gate.sensorY, 4, 0, Math.PI*2);
        ctx.fill();
      } else if (gate.type === 'paint') {
        // Multi-line optical sweeping scanner green beams
        ctx.strokeStyle = 'rgba(16, 185, 129, 0.35)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        for (let i = -3; i <= 3; i++) {
          ctx.moveTo(i * 8, -42);
          ctx.lineTo(i * 8, 42);
        }
        ctx.stroke();

        // AI vision box outline
        ctx.strokeStyle = '#10b981';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.roundRect(-22, gate.sensorY - 8, 44, 16, 3);
        ctx.stroke();
      } else if (gate.type === 'end') {
        // Alignment testing guides
        ctx.strokeStyle = 'rgba(56, 189, 248, 0.5)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        // Left wheel guide roller
        ctx.roundRect(-26, -18, 10, 36, 2);
        // Right wheel guide roller
        ctx.roundRect(16, -18, 10, 36, 2);
        ctx.stroke();

        // Testing pulse line
        ctx.fillStyle = '#38bdf8';
        ctx.beginPath();
        ctx.arc(0, gate.sensorY, 3.5, 0, Math.PI*2);
        ctx.fill();
      }

      // Title & Labels
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 9px Outfit';
      ctx.textAlign = 'center';
      ctx.fillText(gate.name, 0, -60);
      
      ctx.fillStyle = 'var(--text-secondary)';
      ctx.font = '8px Outfit';
      ctx.fillText(gate.desc, 0, 62);

      ctx.restore();
    };

    // Main render loop
    const render = () => {
      ctx.clearRect(0, 0, width, height);

      // Grid background
      ctx.strokeStyle = 'rgba(239, 68, 68, 0.015)';
      ctx.lineWidth = 1;
      const spacing = 35;
      for (let x = 0; x < width; x += spacing) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, height);
        ctx.stroke();
      }
      for (let y = 0; y < height; y += spacing) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(width, y);
        ctx.stroke();
      }

      drawTimer++;

      // Draw pathways from QA gates up to the Database cylinder
      ctx.strokeStyle = 'rgba(239, 68, 68, 0.08)';
      ctx.lineWidth = 2.5;
      gates.forEach(gate => {
        ctx.beginPath();
        ctx.moveTo(gate.x, gate.y - 50);
        ctx.lineTo(gate.x, dbNode.y + 20);
        ctx.lineTo(dbNode.x, dbNode.y + 20);
        ctx.stroke();
      });

      // Draw Conveyor belt rails
      drawConveyor(ctx);

      // Periodically trigger quality packet releases
      if (isRunning && drawTimer % 55 === 0) {
        gates.forEach((gate, idx) => {
          const colors = ['#ef4444', '#10b981', '#38bdf8'];
          packets.push({
            fromX: gate.x,
            fromY: gate.y - 50,
            progress: 0,
            color: colors[idx],
            size: 3.0
          });
        });
      }

      // Render packets flowing upwards into Quality DB
      packets.forEach(p => {
        if (isRunning) {
          p.progress += 0.008;
        }

        // Pathway interpolation: linear straight up, then bent towards db center
        const targetY = dbNode.y + 20;
        let px = p.fromX;
        let py = p.fromY;

        const verticalProgress = (p.fromY - targetY) * p.progress;
        py = p.fromY - verticalProgress;
        
        // After reaching horizontal bar, slide towards DB center
        if (py <= targetY) {
          py = targetY;
          const horizontalFactor = (p.progress - 0.5) * 2; // 0 to 1 horizontal slide
          if (horizontalFactor > 0) {
            px = p.fromX + (dbNode.x - p.fromX) * horizontalFactor;
          }
        }

        ctx.save();
        ctx.fillStyle = p.color;
        ctx.shadowBlur = 6;
        ctx.shadowColor = p.color;
        ctx.beginPath();
        ctx.arc(px, py, p.size, 0, Math.PI*2);
        ctx.fill();
        ctx.restore();
      });

      // Filter finished packets
      for (let i = packets.length - 1; i >= 0; i--) {
        if (packets[i].progress >= 1.0) {
          packets.splice(i, 1);
        }
      }

      // Draw IQIS Quality Database Cylinder
      ctx.save();
      ctx.translate(dbNode.x, dbNode.y);
      ctx.fillStyle = 'rgba(15, 23, 42, 0.9)';
      ctx.strokeStyle = '#ef4444';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.roundRect(-40, -25, 80, 50, 4);
      ctx.fill();
      ctx.stroke();

      // DB discs outlines
      ctx.strokeStyle = 'rgba(239, 68, 68, 0.4)';
      ctx.lineWidth = 1.5;
      for (let i = 0; i < 3; i++) {
        const dy = -16 + i * 15;
        ctx.beginPath();
        ctx.ellipse(0, dy, 30, 5, 0, 0, Math.PI * 2);
        ctx.stroke();
      }
      
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 8.5px Outfit';
      ctx.textAlign = 'center';
      ctx.fillText(dbNode.label, 0, 38);
      ctx.restore();

      // Draw Gates
      gates.forEach(gate => drawInspectionGate(ctx, gate));

      animationFrameId = requestAnimationFrame(render);
    };

    render();

    return () => {
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener('resize', handleResize);
    };
  }, [isRunning]);

  // SPC stats helper (calculates average)
  const spcAvg = +(spcPoints.reduce((a,b)=>a+b, 0) / spcPoints.length).toFixed(3);

  return (
    <div className="iqis-dashboard-container">
      {/* Top Level Telemetry Widgets */}
      <div className="iqis-telemetry-grid">
        <div className="glass-panel iqis-kpi-card">
          <div className="kpi-header">
            <CheckCircle size={14} className="text-neon-green" />
            <span>FIRST PASS YIELD (FPY)</span>
          </div>
          <div className="kpi-value text-neon-green">
            {fpyYield}%
          </div>
          <div className="kpi-desc">공정 직행율 관리 한계: &gt;98.0%</div>
        </div>

        <div className="glass-panel iqis-kpi-card">
          <div className="kpi-header">
            <TrendingUp size={14} className="text-neon-crimson" />
            <span>PROCESS CAPABILITY INDEX (C<sub>pk</sub>)</span>
          </div>
          <div className="kpi-value text-neon-crimson">
            {cpkIndex}
          </div>
          <div className="kpi-desc">Cpk 등급: 우수 (1.33 ~ 1.67)</div>
        </div>

        <div className="glass-panel iqis-kpi-card">
          <div className="kpi-header">
            <ClipboardCheck size={14} style={{ color: '#38bdf8' }} />
            <span>INSPECTED TODAY</span>
          </div>
          <div className="kpi-value" style={{ color: '#38bdf8' }}>
            {inspectedToday} <span className="kpi-unit">Cars</span>
          </div>
          <div className="kpi-desc">대비 불량률: +{((rejectedToday/inspectedToday)*100).toFixed(2)}%</div>
        </div>

        <div className="glass-panel iqis-kpi-card">
          <div className="kpi-header">
            <AlertOctagon size={14} className="text-neon-amber" />
            <span>DEFECTS (NG) TODAY</span>
          </div>
          <div className="kpi-value text-neon-amber">
            {rejectedToday} <span className="kpi-unit">Units</span>
          </div>
          <div className="kpi-desc">수정 보수 처리(Rework) 진행 완료</div>
        </div>
      </div>

      {/* Canvas Gate Map and SPC X-Bar Chart Grid */}
      <div className="iqis-center-grid">
        {/* Quality Gates Canvas */}
        <div className="glass-panel iqis-canvas-panel">
          <div className="mimic-header">
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <ShieldCheck size={18} className="text-neon-crimson" />
              <h3>INTEGRATED QUALITY GATEWAY INSPECTION (실시간 품질 게이트 계측 맵)</h3>
            </div>
            <button 
              onClick={() => setIsRunning(!isRunning)} 
              className={`speed-btn ${isRunning ? 'active' : ''}`}
              style={{ fontSize: '0.75rem', padding: '0.3rem 0.6rem', display: 'flex', alignItems: 'center', gap: '4px' }}
            >
              {isRunning ? <Pause size={12} /> : <Play size={12} fill="currentColor" />}
              {isRunning ? '정지' : '가동'}
            </button>
          </div>
          <div className="iqis-canvas-wrapper">
            <canvas ref={canvasRef} className="iqis-canvas" />
          </div>
        </div>

        {/* SPC X-Bar Control Chart */}
        <div className="glass-panel spc-control-panel">
          <div className="mimic-header">
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Activity size={17} className="text-neon-blue" />
              <h3>SPC REAL-TIME GAP CHART (통계적 공정 관리 X-Bar 관리도)</h3>
            </div>
            <div className="font-mono-tech spc-hud-indicator">
              <span>GAP AVG: <strong style={{ color: '#38bdf8' }}>{spcAvg}mm</strong></span>
            </div>
          </div>
          <div className="spc-chart-wrapper">
            {/* Real-time styled SVG line chart for SPC */}
            <svg className="spc-svg" viewBox="0 0 400 240">
              {/* Grid Lines */}
              <line x1="40" y1="40" x2="380" y2="40" stroke="rgba(239, 68, 68, 0.3)" strokeDasharray="3, 3" /> {/* UCL */}
              <line x1="40" y1="120" x2="380" y2="120" stroke="rgba(56, 189, 248, 0.25)" /> {/* Target */}
              <line x1="40" y1="200" x2="380" y2="200" stroke="rgba(239, 68, 68, 0.3)" strokeDasharray="3, 3" /> {/* LCL */}

              {/* Labels */}
              <text x="35" y="44" fill="#ef4444" fontSize="8" textAnchor="end" fontFamily="JetBrains Mono">UCL (0.55)</text>
              <text x="35" y="124" fill="#38bdf8" fontSize="8" textAnchor="end" fontFamily="JetBrains Mono">TRG (0.40)</text>
              <text x="35" y="204" fill="#ef4444" fontSize="8" textAnchor="end" fontFamily="JetBrains Mono">LCL (0.25)</text>

              {/* SPC Line Drawing */}
              <polyline
                fill="none"
                stroke="#38bdf8"
                strokeWidth="2"
                points={spcPoints.map((val, idx) => {
                  const x = 50 + idx * 16.5;
                  // Map gap values (0.25 to 0.55) to SVG height (200 to 40)
                  const factor = (val - 0.25) / 0.30;
                  const y = 200 - factor * 160;
                  return `${x},${y}`;
                }).join(' ')}
              />

              {/* Points */}
              {spcPoints.map((val, idx) => {
                const x = 50 + idx * 16.5;
                const factor = (val - 0.25) / 0.30;
                const y = 200 - factor * 160;
                const isOut = val > 0.55 || val < 0.25;
                return (
                  <circle
                    key={idx}
                    cx={x}
                    cy={y}
                    r={isOut ? "4.5" : "3"}
                    fill={isOut ? "#ef4444" : "#ffffff"}
                    stroke={isOut ? "#ffffff" : "#38bdf8"}
                    strokeWidth="1"
                  />
                );
              })}
            </svg>
          </div>
        </div>
      </div>

      {/* Bottom Grid: Defect Pareto Analysis & Relational Database Table */}
      <div className="iqis-bottom-grid">
        {/* Quality Defect Pareto Bar Chart */}
        <div className="glass-panel pareto-panel">
          <div className="panel-title" style={{ fontSize: '0.9rem', color: '#fff' }}>
            <BarChart size={15} className="text-neon-crimson" />
            <span>QUALITY DEFECT ANALYSIS (공정별 5대 품질 불량 분석)</span>
          </div>
          <div className="pareto-chart-list">
            {defects.map((defect, idx) => (
              <div key={idx} className="pareto-bar-row">
                <div className="pareto-label font-mono-tech">{defect.type}</div>
                <div className="pareto-bar-container">
                  <div 
                    className="pareto-bar-fill" 
                    style={{ 
                      width: `${defect.percent}%`,
                      background: `linear-gradient(90deg, rgba(239, 68, 68, 0.4) 0%, rgba(239, 68, 68, 0.8) 100%)`
                    }} 
                  />
                </div>
                <div className="pareto-count font-mono-tech">
                  {defect.count}건 <span className="pareto-percent">({defect.percent}%)</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Quality database logs */}
        <div className="glass-panel qa-db-panel">
          <div className="panel-title" style={{ fontSize: '0.9rem', color: '#fff' }}>
            <Database size={15} className="text-neon-green" />
            <span>REAL-TIME INSPECTION DB LOG (통합 품질 감시 원격 데이터베이스)</span>
          </div>
          <div className="qa-db-table-wrapper">
            <table className="qa-table font-mono-tech">
              <thead>
                <tr>
                  <th>ORDER ID</th>
                  <th>VEHICLE</th>
                  <th>GAP GAP (SPEC)</th>
                  <th>PAINT DUST</th>
                  <th>BRAKE FORCE</th>
                  <th>DECISION</th>
                  <th>TIME</th>
                </tr>
              </thead>
              <tbody>
                {inspectionLogs.map((log, idx) => (
                  <tr key={idx} className={log.result.toLowerCase()}>
                    <td className="order-id">{log.orderId}</td>
                    <td className="car-type">{log.carType}</td>
                    <td className="gap-val">{log.measuredGap} <span className="spec-val">({log.gapSpec})</span></td>
                    <td className={log.paintDust > 3 ? 'text-red font-bold' : ''}>{log.paintDust} Pts</td>
                    <td>{log.brakeForce}</td>
                    <td>
                      <span className={`decision-badge ${log.result.toLowerCase()}`}>
                        {log.result}
                      </span>
                    </td>
                    <td className="time-col">{log.timestamp}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* IQIS Learn Center */}
      <div className="glass-panel iqis-explain-panel">
        <div className="explain-tabs">
          <button 
            className={`explain-tab ${activeLearnTab === 'intro' ? 'active' : ''}`}
            onClick={() => setActiveLearnTab('intro')}
          >
            IQIS란 무엇인가?
          </button>
          <button 
            className={`explain-tab ${activeLearnTab === 'spc' ? 'active' : ''}`}
            onClick={() => setActiveLearnTab('spc')}
          >
            통계적 품질 관리 (SPC) & CPK
          </button>
          <button 
            className={`explain-tab ${activeLearnTab === 'flush' ? 'active' : ''}`}
            onClick={() => setActiveLearnTab('flush')}
          >
            단차/틈새 (Gap & Flush) 관리
          </button>
          <button 
            className={`explain-tab ${activeLearnTab === 'paint' ? 'active' : ''}`}
            onClick={() => setActiveLearnTab('paint')}
          >
            도장 품질 비전 검사 원리
          </button>
        </div>

        <div className="explain-content" style={{ fontSize: '0.88rem', lineHeight: '1.6' }}>
          {activeLearnTab === 'intro' && (
            <div className="explain-tab-body">
              <h4>
                <Info size={16} className="text-neon-crimson inline-icon" />
                IQIS (Integrated Quality Information System, 통합 품질 정보 시스템)란 무엇인가?
              </h4>
              <p>
                IQIS는 **공장의 원자재 투입부터 완성차가 품질 게이트를 통과하여 최종 출하될 때까지 발생하는 모든 품질 검사 정보를 실시간으로 통합 수집, 분석, 통제하는 스마트 팩토리 품질 특화 관리 시스템**입니다.
              </p>
              <p>
                SCADA가 설비 기계의 동작을 감시하고, MES가 제조 공정의 실행 스케줄을 처리한다면, **IQIS는 제품 그 자체의 품질 규격 적합성**을 통제합니다. 
                차체 조립 후의 틈새 치수, 도막의 두께 균일도, 전자 제어 유닛(ECU)의 전기적 신호 무결성, 그리고 라인 엔드에서의 최종 제동력 테스트 결과를 MES 데이터와 동기화하여 수집함으로써, 
                불량이 발견되면 즉시 MES로 우회 라인 이송(Rework)을 명령하고 조립 설비의 공정 능력 한계를 경고합니다.
              </p>
            </div>
          )}

          {activeLearnTab === 'spc' && (
            <div className="explain-tab-body">
              <h4>통계적 품질 관리 (SPC) 및 공정 능력 지수 (Cpk)의 중요성</h4>
              <p>
                <strong>SPC (Statistical Process Control, 통계적 공정 제어)</strong>는 생산 과정 중 취득되는 계측 데이터의 변동을 수학적 확률 통계로 분석하여 공정의 안정 상태를 감시하는 기법입니다.
              </p>
              <ul>
                <li><strong>관리도 (Control Chart)</strong>: 목표치(TRG)를 중심으로 공정의 미세 흔들림이 통계적 한계선인 UCL(관리상한선)과 LCL(관리하한선) 내에 모여있는지 모니터링합니다. 관리선 외곽으로 튀는 포인트가 감지되면 장비 마모나 센서 에러의 징후로 판단하여 **예방 정비**를 실행합니다.</li>
                <li><strong>Cpk (Process Capability Index, 공정 능력 지수)</strong>: 설비가 제품을 설계 규격 한계 내에서 균일하게 생산할 수 있는 능력을 수치화한 것입니다. **Cpk가 1.33 이상**이면 공정 능력이 '우수'한 수준으로 판단하며, **1.67 이상**은 초정밀 제조가 가능한 극도의 안정 상태를 뜻합니다.</li>
              </ul>
            </div>
          )}

          {activeLearnTab === 'flush' && (
            <div className="explain-tab-body">
              <h4>자동차 외관 품질의 척도: 단차 및 틈새 (Gap & Flush) 보증</h4>
              <p>
                자동차 조립 품질을 한눈에 판단하는 척도는 바로 외관의 **단차(Gap - 부품 간의 틈 폭)**와 ** flush(평평도/면 일치 정도 - 두 부품 간의 높낮이 편차)**입니다.
              </p>
              <p>
                문짝(Door)과 차체(Body), 또는 본닛(Hood)과 펜더(Fender) 결합 부위에 틈새가 너무 벌어지거나 어긋나면 차량 운행 시 심각한 풍절음(Wind noise)이 실내로 유입되고 고속 주행 시 누수 및 공기 저항 오차가 발생합니다. 
                IQIS는 조립 완료된 차체에 다관절 로봇에 부착된 **3D 레이저 Lidar 센서 게이트**를 활용하여 미크론(㎛) 단위의 치수 변위를 실시간 스캔하여, 관리 기준값인 `0.40 ± 0.15mm`를 벗어나면 불량(NG) 판정을 내립니다.
              </p>
            </div>
          )}

          {activeLearnTab === 'paint' && (
            <div className="explain-tab-body">
              <h4>도장 품질 검출 기술과 초고속 AI 비전 스캐너</h4>
              <p>
                도장(Paint) 공정은 먼지(Dust) 한 톨이나 미세한 이물질만 묻어도 표면에 돌기가 발생하여 심미성에 지대한 손상을 입힙니다.
              </p>
              <p>
                과거에는 숙련공이 형광등 불빛 아래에서 육안으로 차체 표면을 만져가며 미세 티끌을 검출했으나, 현재 IQIS는 **초고속 LED 패턴 프로젝션 스캐너**와 **인공지능 비전 신경망(AI Vision Neural Network)**을 결합하여 가동합니다. 
                빛을 가로 줄무늬 패턴으로 차체 표면에 투사한 뒤 줄무늬의 굴절과 왜곡 현상을 고해상도 카메라로 분석하여, 0.1mm 이하의 초미세 티끌(Dust Pt) 위치를 3D 좌표로 정확하게 찾아내어 관제 DB에 로깅하고 보수 작업자 로봇에게 전송합니다.
              </p>
            </div>
          )}
        </div>
      </div>

      <style>{`
        .iqis-dashboard-container {
          display: flex;
          flex-direction: column;
          gap: 1.5rem;
          width: 100%;
          animation: fadeIn 0.8s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }

        .iqis-telemetry-grid {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 1.25rem;
        }

        @media (max-width: 1024px) {
          .iqis-telemetry-grid {
            grid-template-columns: repeat(2, 1fr);
          }
        }

        @media (max-width: 640px) {
          .iqis-telemetry-grid {
            grid-template-columns: 1fr;
          }
        }

        .iqis-kpi-card {
          padding: 1.25rem;
          display: flex;
          flex-direction: column;
          gap: 0.5rem;
        }

        .iqis-center-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 1.5rem;
        }

        @media (max-width: 1100px) {
          .iqis-center-grid {
            grid-template-columns: 1fr;
          }
        }

        .iqis-canvas-panel, .spc-control-panel {
          padding: 1.5rem;
          display: flex;
          flex-direction: column;
          gap: 1.25rem;
          height: 380px;
        }

        .iqis-canvas-wrapper, .spc-chart-wrapper {
          flex: 1;
          background: rgba(4, 6, 14, 0.85);
          border-radius: 12px;
          border: 1px solid rgba(255, 255, 255, 0.05);
          box-shadow: inset 0 4px 24px rgba(0, 0, 0, 0.9);
          overflow: hidden;
          position: relative;
        }

        .iqis-canvas {
          width: 100%;
          height: 100%;
          display: block;
        }

        .spc-svg {
          width: 100%;
          height: 100%;
          display: block;
        }

        .spc-hud-indicator {
          font-size: 0.78rem;
          color: var(--text-secondary);
        }

        .iqis-bottom-grid {
          display: grid;
          grid-template-columns: 420px 1fr;
          gap: 1.5rem;
        }

        @media (max-width: 1200px) {
          .iqis-bottom-grid {
            grid-template-columns: 1fr;
          }
        }

        .pareto-panel, .qa-db-panel {
          padding: 1.25rem;
          display: flex;
          flex-direction: column;
          gap: 1rem;
          height: 330px;
        }

        .pareto-chart-list {
          display: flex;
          flex-direction: column;
          gap: 0.75rem;
          flex: 1;
          justify-content: center;
        }

        .pareto-bar-row {
          display: grid;
          grid-template-columns: 140px 1fr 70px;
          align-items: center;
          gap: 0.75rem;
          font-size: 0.72rem;
        }

        .pareto-label {
          color: var(--text-secondary);
          text-overflow: ellipsis;
          overflow: hidden;
          white-space: nowrap;
        }

        .pareto-bar-container {
          height: 10px;
          background: rgba(255,255,255,0.04);
          border-radius: 4px;
          overflow: hidden;
        }

        .pareto-bar-fill {
          height: 100%;
          border-radius: 4px;
          transition: width 0.8s cubic-bezier(0.25, 0.8, 0.25, 1);
        }

        .pareto-count {
          color: #ffffff;
          font-weight: 700;
          text-align: right;
        }

        .pareto-percent {
          font-size: 0.65rem;
          color: var(--text-muted);
          font-weight: 400;
        }

        .qa-db-table-wrapper {
          flex: 1;
          overflow-y: auto;
          border: 1px solid rgba(255, 255, 255, 0.04);
          border-radius: 8px;
          background: rgba(4, 6, 14, 0.5);
        }

        .qa-table {
          width: 100%;
          border-collapse: collapse;
          text-align: left;
          font-size: 0.72rem;
        }

        .qa-table th, .qa-table td {
          padding: 0.6rem 0.8rem;
          border-bottom: 1px solid rgba(255, 255, 255, 0.03);
        }

        .qa-table th {
          background: rgba(13, 20, 38, 0.75);
          color: var(--text-secondary);
          font-weight: 600;
          font-size: 0.7rem;
          letter-spacing: 0.5px;
          text-transform: uppercase;
        }

        .qa-table tr:hover {
          background: rgba(255, 255, 255, 0.015);
        }

        .qa-table .order-id {
          color: var(--color-cyber-blue);
          font-weight: 700;
        }

        .qa-table .car-type {
          color: #ffffff;
          font-weight: 600;
        }

        .qa-table .gap-val {
          color: var(--color-cyber-purple);
          font-weight: 600;
        }

        .spec-val {
          font-size: 0.62rem;
          color: var(--text-muted);
          font-weight: 400;
        }

        .decision-badge {
          font-size: 0.65rem;
          font-weight: 800;
          padding: 1.5px 5px;
          border-radius: 4px;
          letter-spacing: 0.5px;
        }

        .decision-badge.pass {
          background: rgba(16, 185, 129, 0.15);
          color: var(--color-active-green);
          border: 1px solid rgba(16, 185, 129, 0.3);
        }

        .decision-badge.reject {
          background: rgba(239, 68, 68, 0.15);
          color: var(--color-error-crimson);
          border: 1px solid rgba(239, 68, 68, 0.3);
        }

        .qa-table .time-col {
          color: var(--text-muted);
        }

        .iqis-explain-panel {
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
          background: rgba(239, 68, 68, 0.05);
          color: var(--text-primary);
          border-color: rgba(239, 68, 68, 0.25);
        }

        .explain-tab.active {
          background: rgba(239, 68, 68, 0.12);
          color: var(--color-error-crimson);
          border-color: rgba(239, 68, 68, 0.4);
          font-weight: 600;
          box-shadow: 0 0 10px rgba(239, 68, 68, 0.15);
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
