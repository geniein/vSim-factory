import React, { useEffect, useRef, useState } from 'react';
import { 
  Wrench, Activity, Clock, AlertCircle, Database, 
  Info, Play, Pause, TrendingUp, Settings
} from 'lucide-react';

interface Asset {
  id: string;
  name: string;
  criticality: 'A' | 'B' | 'C';
  status: 'RUNNING' | 'MAINTENANCE' | 'FAULT';
  wearRate: number; // 0 ~ 100%
  temperature: number; // °C
  vibration: number; // G
  lastMaintenance: string;
  nextPmDday: number; // D-Day count
  sparePartStatus: 'IN_STOCK' | 'OUT_OF_STOCK';
}

interface WorkOrder {
  id: string;
  assetName: string;
  type: 'PREVENTIVE' | 'CORRECTIVE' | 'CALIBRATION';
  priority: 'CRITICAL' | 'HIGH' | 'MEDIUM';
  engineer: string;
  status: 'OPEN' | 'IN_PROGRESS' | 'CLOSED';
  scheduleDate: string;
}

export const CmmsDashboard: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isRunning, setIsRunning] = useState(true);

  // CMMS KPI Telemetry States
  const [mtbfHours, setMtbfHours] = useState(342.5);
  const [activeWoCount, setActiveWoCount] = useState(2);
  const [scheduledPmCount] = useState(6);
  const [oeePercent, setOeePercent] = useState(91.8);

  // Active study center tab
  const [activeLearnTab, setActiveLearnTab] = useState<'intro' | 'strategies' | 'oee' | 'vibration'>('intro');

  // Asset Health Master Registry
  const [assets, setAssets] = useState<Asset[]>([
    { id: 'AST-FDR-01', name: 'Main Feeding Gearbox', criticality: 'A', status: 'RUNNING', wearRate: 42, temperature: 48.5, vibration: 1.2, lastMaintenance: '2026-05-10', nextPmDday: 12, sparePartStatus: 'IN_STOCK' },
    { id: 'AST-CNC-02', name: 'High-Speed CNC Spindle', criticality: 'A', status: 'RUNNING', wearRate: 78, temperature: 68.2, vibration: 2.8, lastMaintenance: '2026-04-22', nextPmDday: 2, sparePartStatus: 'IN_STOCK' },
    { id: 'AST-MRG-03', name: 'Overhead Marriage Hoist', criticality: 'A', status: 'RUNNING', wearRate: 24, temperature: 38.0, vibration: 0.8, lastMaintenance: '2026-05-18', nextPmDday: 20, sparePartStatus: 'IN_STOCK' },
    { id: 'AST-QCS-04', name: 'AI Laser Vision Scanner', criticality: 'B', status: 'RUNNING', wearRate: 89, temperature: 55.4, vibration: 3.5, lastMaintenance: '2026-03-05', nextPmDday: 1, sparePartStatus: 'IN_STOCK' },
    { id: 'AST-CNV-05', name: 'Coaxial Conveyor Motor', criticality: 'C', status: 'RUNNING', wearRate: 51, temperature: 42.1, vibration: 1.4, lastMaintenance: '2026-05-01', nextPmDday: 15, sparePartStatus: 'OUT_OF_STOCK' }
  ]);

  // CMMS Work Orders Queue
  const [workOrders, setWorkOrders] = useState<WorkOrder[]>([
    { id: 'WO-2026-402', assetName: 'High-Speed CNC Spindle', type: 'PREVENTIVE', priority: 'HIGH', engineer: 'K. J. Kim', status: 'IN_PROGRESS', scheduleDate: '2026-05-30' },
    { id: 'WO-2026-403', assetName: 'AI Laser Vision Scanner', type: 'PREVENTIVE', priority: 'CRITICAL', engineer: 'M. S. Park', status: 'OPEN', scheduleDate: '2026-05-29' },
    { id: 'WO-2026-404', assetName: 'Coaxial Conveyor Motor', type: 'CALIBRATION', priority: 'MEDIUM', engineer: 'H. T. Lee', status: 'CLOSED', scheduleDate: '2026-05-25' },
    { id: 'WO-2026-405', assetName: 'Main Feeding Gearbox', type: 'PREVENTIVE', priority: 'MEDIUM', engineer: 'J. W. Choi', status: 'OPEN', scheduleDate: '2026-06-09' }
  ]);

  // Trigger simulated telemetry shifts
  useEffect(() => {
    if (!isRunning) return;

    const interval = setInterval(() => {
      // 1. Wear rates increase slightly over time
      setAssets(prev => prev.map(asset => {
        let newWear = asset.wearRate;
        let newStatus = asset.status;
        
        if (asset.status === 'RUNNING') {
          newWear = Math.min(100, asset.wearRate + +(Math.random() * 0.4).toFixed(2));
          if (newWear >= 95) {
            newStatus = 'FAULT';
          }
        }

        // Randomize physical temperature & vibration slightly
        const tempShift = +(Math.random() * 2 - 1).toFixed(1);
        const vibShift = +(Math.random() * 0.4 - 0.2).toFixed(2);

        return {
          ...asset,
          wearRate: newWear,
          status: newStatus,
          temperature: +(Math.max(30, Math.min(95, asset.temperature + tempShift))).toFixed(1),
          vibration: +(Math.max(0.1, Math.min(7.0, asset.vibration + vibShift))).toFixed(2)
        };
      }));

      // Fluctuate MTBF and OEE
      setMtbfHours(prev => +(prev + (Math.random() * 0.4 - 0.2)).toFixed(1));
      setOeePercent(+(91 + Math.random() * 2).toFixed(1));

      // Work Orders simulation
      if (Math.random() < 0.2) {
        setWorkOrders(prev => {
          // Push a new mock preventative work order occasionally
          const newId = 406 + Math.floor(Math.random() * 90);
          const next = [...prev];
          if (next.length > 4) {
            next.pop();
          }
          return [
            {
              id: `WO-2026-${newId}`,
              assetName: 'Coaxial Conveyor Motor',
              type: 'PREVENTIVE',
              priority: 'MEDIUM',
              engineer: 'H. T. Lee',
              status: 'OPEN',
              scheduleDate: '2026-06-12'
            },
            ...next
          ];
        });
      }

      // Count open and in progress work orders
      const activeCount = workOrders.filter(w => w.status !== 'CLOSED').length;
      setActiveWoCount(activeCount);

    }, 3000);

    return () => clearInterval(interval);
  }, [isRunning, workOrders]);

  // CMMS Mechanical Simulation (Canvas)
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

    // Mechanical components configuration
    interface MachinePart {
      name: string;
      x: number;
      y: number;
      val: number; // anim state
      dir: number;
    }

    const parts: MachinePart[] = [
      { name: 'AST-FDR-01', x: 80, y: 150, val: 0, dir: 1 }, // Feeder Gear
      { name: 'AST-CNC-02', x: 230, y: 150, val: 0, dir: 1 }, // CNC drill
      { name: 'AST-MRG-03', x: 380, y: 150, val: 0, dir: 1 }, // Hoist lift
      { name: 'AST-QCS-04', x: 530, y: 150, val: 0, dir: 1 }  // Laser sweep
    ];

    let globalTimer = 0;

    const render = () => {
      ctx.clearRect(0, 0, width, height);
      globalTimer++;

      // 1. Grid Background
      ctx.strokeStyle = 'rgba(132, 204, 22, 0.015)';
      ctx.lineWidth = 1;
      const spacing = 30;
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

      // 2. Draw Factory Platform Rails
      ctx.strokeStyle = '#1e293b';
      ctx.lineWidth = 8;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(25, 230);
      ctx.lineTo(575, 230);
      ctx.stroke();

      // 3. Draw and Animate 4 Critical Mechanical Assets
      parts.forEach((p, idx) => {
        ctx.save();
        ctx.translate(p.x, p.y);

        // Machinery Steel Housing block
        ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
        ctx.strokeStyle = '#475569';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.roundRect(-42, -50, 84, 100, 8);
        ctx.fill();
        ctx.stroke();

        // Mechanical Sub-components animation drawing
        if (idx === 0) {
          // 1. FEEDER GEARBOX
          if (isRunning) {
            p.val += 0.04;
          }
          ctx.save();
          ctx.translate(0, 0);
          ctx.rotate(p.val);
          
          // Gear Outer Ring
          ctx.strokeStyle = '#84cc16';
          ctx.lineWidth = 3.5;
          ctx.beginPath();
          ctx.arc(0, 0, 20, 0, Math.PI * 2);
          ctx.stroke();

          // Gear Teeth
          ctx.fillStyle = '#84cc16';
          for (let i = 0; i < 8; i++) {
            ctx.save();
            ctx.rotate((i * Math.PI) / 4);
            ctx.fillRect(-4, -25, 8, 8);
            ctx.restore();
          }
          
          // Gear core disc
          ctx.fillStyle = '#334155';
          ctx.beginPath();
          ctx.arc(0, 0, 10, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();

        } else if (idx === 1) {
          // 2. HIGH SPEED CNC SPINDLE (Drill shaft piston movement)
          if (isRunning) {
            p.val += 0.15 * p.dir;
            if (p.val > 25 || p.val < -10) {
              p.dir *= -1;
            }
          }

          // Drill Guide Shaft
          ctx.fillStyle = '#475569';
          ctx.fillRect(-6, -42, 12, 50);

          // Drill Chuck & Moving bit
          ctx.save();
          ctx.translate(0, p.val);
          ctx.fillStyle = '#84cc16';
          ctx.fillRect(-10, 0, 20, 10);
          
          // Drill point tip
          ctx.fillStyle = '#94a3b8';
          ctx.beginPath();
          ctx.moveTo(-4, 10);
          ctx.lineTo(4, 10);
          ctx.lineTo(0, 30);
          ctx.closePath();
          ctx.fill();
          ctx.restore();

        } else if (idx === 2) {
          // 3. OVERHEAD MARRIAGE HOIST (Hoist pulleys and hook lifting)
          if (isRunning) {
            p.val += 0.04 * p.dir;
            if (p.val > 1.2 || p.val < 0.1) {
              p.dir *= -1;
            }
          }
          
          const liftOffset = p.val * -15; // vertical offset

          // Hoist cable reels
          ctx.fillStyle = '#334155';
          ctx.beginPath();
          ctx.arc(-18, -32, 6, 0, Math.PI * 2);
          ctx.arc(18, -32, 6, 0, Math.PI * 2);
          ctx.fill();

          // Cable wires
          ctx.strokeStyle = '#94a3b8';
          ctx.lineWidth = 1.2;
          ctx.beginPath();
          ctx.moveTo(-18, -32);
          ctx.lineTo(-18, 15 + liftOffset);
          ctx.moveTo(18, -32);
          ctx.lineTo(18, 15 + liftOffset);
          ctx.stroke();

          // Lifting platform hook
          ctx.save();
          ctx.translate(0, liftOffset);
          ctx.fillStyle = '#84cc16';
          ctx.fillRect(-22, 12, 44, 6);
          ctx.fillStyle = '#d97706'; // load hook
          ctx.beginPath();
          ctx.arc(0, 23, 4, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();

        } else if (idx === 3) {
          // 4. AI LASER SCANNER (Laser range finder sweeping light)
          if (isRunning) {
            p.val += 0.08 * p.dir;
            if (p.val > 24 || p.val < -24) {
              p.dir *= -1;
            }
          }

          // Scanner housing mount
          ctx.fillStyle = '#334155';
          ctx.fillRect(-15, -42, 30, 12);

          // Sweeping optic head
          ctx.save();
          ctx.translate(0, -22);
          ctx.fillStyle = '#475569';
          ctx.beginPath();
          ctx.arc(0, 0, 10, 0, Math.PI * 2);
          ctx.fill();
          
          // Laser beam direction lines (Flat Lidar cone)
          ctx.strokeStyle = 'rgba(132, 204, 22, 0.4)';
          ctx.lineWidth = 1.2;
          ctx.beginPath();
          ctx.moveTo(0, 0);
          ctx.lineTo(p.val - 25, 60);
          ctx.moveTo(0, 0);
          ctx.lineTo(p.val + 25, 60);
          ctx.stroke();
          
          // Glowing light on floor
          ctx.fillStyle = 'rgba(132, 204, 22, 0.15)';
          ctx.beginPath();
          ctx.ellipse(p.val, 60, 18, 4, 0, 0, Math.PI * 2);
          ctx.fill();
          
          ctx.restore();
        }

        // Hardware details labels
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 9px Outfit';
        ctx.textAlign = 'center';
        ctx.fillText(p.name.substring(4), 0, -60);

        ctx.fillStyle = 'var(--text-secondary)';
        ctx.font = '8px Outfit';
        ctx.fillText(idx === 0 ? 'Gearbox Feeder' : idx === 1 ? 'Spindle CNC' : idx === 2 ? 'Marriage Lift' : 'Vision Scanner', 0, 62);

        ctx.restore();
      });

      // Drawing warning indicators on Canvas if wear rates are critical (e.g. >80%)
      // QC scanner (idx 3) starts at 89% and spikes alarm
      if (globalTimer % 60 < 30) {
        ctx.save();
        ctx.fillStyle = 'rgba(239, 68, 68, 0.25)';
        ctx.beginPath();
        ctx.arc(530, 150, 48, 0, Math.PI * 2);
        ctx.fill();

        ctx.strokeStyle = '#ef4444';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(530, 150, 48, 0, Math.PI * 2);
        ctx.stroke();

        // Wear rate alarm tag
        ctx.fillStyle = '#ef4444';
        ctx.font = 'bold 8px JetBrains Mono';
        ctx.fillText('CRITICAL WEAR (>85%)', 530, 80);
        ctx.restore();
      }

      // Mechanical sound signal HUD
      ctx.fillStyle = 'rgba(132, 204, 22, 0.4)';
      ctx.font = '8px JetBrains Mono';
      ctx.fillText(`CMMS_PREDICTIVE_MAINT_ALGORITHM_READY`, 30, 25);

      animationFrameId = requestAnimationFrame(render);
    };

    render();

    return () => {
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener('resize', handleResize);
    };
  }, [isRunning]);

  return (
    <div className="cmms-dashboard-container">
      {/* Top Telemetry Grid */}
      <div className="cmms-telemetry-grid">
        <div className="glass-panel cmms-kpi-card">
          <div className="kpi-header">
            <Clock size={14} className="text-neon-lime" />
            <span>MTBF (평균 고장 간격)</span>
          </div>
          <div className="kpi-value text-neon-lime">
            {mtbfHours} <span className="kpi-unit">Hrs</span>
          </div>
          <div className="kpi-desc">설계 신뢰 한계 목표: &gt;300 Hrs</div>
        </div>

        <div className="glass-panel cmms-kpi-card">
          <div className="kpi-header">
            <Activity size={14} className="text-neon-lime" />
            <span>ASSET OEE (종합 설비 효율)</span>
          </div>
          <div className="kpi-value text-neon-lime">
            {oeePercent}%
          </div>
          <div className="kpi-desc">가동률, 성능, 양품률 연산 산출</div>
        </div>

        <div className="glass-panel cmms-kpi-card">
          <div className="kpi-header">
            <Wrench size={14} style={{ color: '#a855f7' }} />
            <span>ACTIVE WORK ORDERS</span>
          </div>
          <div className="kpi-value" style={{ color: '#a855f7' }}>
            {activeWoCount} <span className="kpi-unit">Orders</span>
          </div>
          <div className="kpi-desc">예방 보전 1건, 긴급 스캔 보정 1건</div>
        </div>

        <div className="glass-panel cmms-kpi-card">
          <div className="kpi-header">
            <AlertCircle size={14} className="text-neon-amber" />
            <span>UPCOMING PREVENTIVE PM</span>
          </div>
          <div className="kpi-value text-neon-amber">
            {scheduledPmCount} <span className="kpi-unit">Tasks</span>
          </div>
          <div className="kpi-desc">가장 임박한 보전: D-1일 (Vision Scanner)</div>
        </div>
      </div>

      {/* Main Grid: Telemetry Platform Drawing & Critical Asset Health Status */}
      <div className="cmms-center-grid">
        {/* Canvas Equipment Platform */}
        <div className="glass-panel cmms-canvas-panel">
          <div className="mimic-header">
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Settings size={18} className="text-neon-lime" />
              <h3>CRITICAL PRODUCTION LINE ASSET DIAGNOSTIC (실시간 4대 생산 설비 헬스 맵)</h3>
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
          <div className="cmms-canvas-wrapper">
            <canvas ref={canvasRef} className="cmms-canvas" />
          </div>
        </div>

        {/* Real-time Detailed Wear Sensors Grid */}
        <div className="glass-panel asset-health-panel">
          <div className="mimic-header">
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <TrendingUp size={16} className="text-neon-lime" />
              <h3>PREDICTIVE WEAR DIAGNOSTICS (실시간 예지 진동/온도 센서 상세)</h3>
            </div>
          </div>
          <div className="asset-cards-scroll">
            {assets.map(asset => {
              let wearColor = '#84cc16'; // Lime
              if (asset.wearRate > 80) wearColor = '#ef4444'; // Red
              else if (asset.wearRate > 50) wearColor = '#f59e0b'; // Amber

              return (
                <div key={asset.id} className="asset-card-item font-mono-tech">
                  <div className="asset-card-header">
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span className="asset-id-badge">{asset.id}</span>
                      <span className="asset-crit-badge" style={{ borderColor: asset.criticality === 'A' ? '#ef4444' : '#38bdf8', color: asset.criticality === 'A' ? '#ef4444' : '#38bdf8' }}>Grade {asset.criticality}</span>
                    </div>
                    <span className={`asset-status-badge ${asset.status.toLowerCase()}`}>{asset.status}</span>
                  </div>

                  <div className="asset-card-body">
                    {/* Wear Rate Progress Bar */}
                    <div className="wear-progress-wrapper">
                      <div className="wear-label">
                        <span>기계 마모율 (Wear Rate):</span>
                        <strong style={{ color: wearColor }}>{asset.wearRate.toFixed(1)}%</strong>
                      </div>
                      <div className="wear-bar-container">
                        <div className="wear-bar-fill" style={{ width: `${asset.wearRate}%`, backgroundColor: wearColor }} />
                      </div>
                    </div>

                    <div className="sensor-metrics-row">
                      <div className="sensor-box">
                        <span className="sensor-lbl">Core Temp</span>
                        <strong className="sensor-val" style={{ color: asset.temperature > 65 ? '#ef4444' : '#ffffff' }}>{asset.temperature}°C</strong>
                      </div>
                      <div className="sensor-box">
                        <span className="sensor-lbl">Vibration</span>
                        <strong className="sensor-val" style={{ color: asset.vibration > 3.0 ? '#f59e0b' : '#ffffff' }}>{asset.vibration} G</strong>
                      </div>
                      <div className="sensor-box">
                        <span className="sensor-lbl">PM D-Day</span>
                        <strong className="sensor-val" style={{ color: asset.nextPmDday <= 2 ? '#ef4444' : '#84cc16' }}>D-{asset.nextPmDday}</strong>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Bottom CMMS Dispatch Table */}
      <div className="glass-panel cmms-bottom-panel">
        <div className="panel-title" style={{ fontSize: '0.9rem', color: '#fff' }}>
          <Database size={15} className="text-neon-lime" />
          <span>CMMS ACTIVE WORK ORDER SCHEDULER (보전 작업 오더 지시서 중앙 DB)</span>
        </div>
        <div className="cmms-table-wrapper">
          <table className="cmms-table font-mono-tech">
            <thead>
              <tr>
                <th>WO NUMBER</th>
                <th>ASSET NAME</th>
                <th>MAINTENANCE TYPE</th>
                <th>PRIORITY</th>
                <th>ASSIGNED ENGINEER</th>
                <th>WO STATUS</th>
                <th>SCHEDULED DATE</th>
              </tr>
            </thead>
            <tbody>
              {workOrders.map((wo, idx) => (
                <tr key={idx} className={wo.status.toLowerCase()}>
                  <td className="wo-id">{wo.id}</td>
                  <td style={{ color: '#ffffff', fontWeight: '600' }}>{wo.assetName}</td>
                  <td>
                    <span className={`maint-badge ${wo.type.toLowerCase()}`}>
                      {wo.type}
                    </span>
                  </td>
                  <td>
                    <span className={`pri-badge ${wo.priority.toLowerCase()}`}>
                      {wo.priority}
                    </span>
                  </td>
                  <td>{wo.engineer}</td>
                  <td>
                    <span className={`wo-status-badge ${wo.status.toLowerCase()}`}>
                      {wo.status}
                    </span>
                  </td>
                  <td style={{ color: '#94a3b8' }}>{wo.scheduleDate}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* CMMS Learn Center */}
      <div className="glass-panel cmms-explain-panel">
        <div className="explain-tabs">
          <button 
            className={`explain-tab ${activeLearnTab === 'intro' ? 'active' : ''}`}
            onClick={() => setActiveLearnTab('intro')}
          >
            CMMS 란?
          </button>
          <button 
            className={`explain-tab ${activeLearnTab === 'strategies' ? 'active' : ''}`}
            onClick={() => setActiveLearnTab('strategies')}
          >
            예방보전 vs 예지보전
          </button>
          <button 
            className={`explain-tab ${activeLearnTab === 'oee' ? 'active' : ''}`}
            onClick={() => setActiveLearnTab('oee')}
          >
            설비종합효율 (OEE) 관리
          </button>
          <button 
            className={`explain-tab ${activeLearnTab === 'vibration' ? 'active' : ''}`}
            onClick={() => setActiveLearnTab('vibration')}
          >
            진동 및 FFT 모니터링
          </button>
        </div>

        <div className="explain-content" style={{ fontSize: '0.88rem', lineHeight: '1.6' }}>
          {activeLearnTab === 'intro' && (
            <div className="explain-tab-body">
              <h4>
                <Info size={16} className="text-neon-lime inline-icon" />
                CMMS (설비 보전 관리 시스템) 란 무엇인가?
              </h4>
              <p>
                CMMS는 **공장 내부 설비 자산의 전체 수명 주기(Lifecycle)를 관리하고, 예방 정비 스케줄을 처리하며, 자재 예비 부품 재고와 고장 조치 작업 지시서(Work Order) 발행 등을 통합 관리하는 정보 시스템**입니다.
              </p>
              <p>
                안정적인 의장 생산 라인(Takt Time)을 사수하기 위해선 개별 설비의 갑작스러운 정지(Line Stop)를 사전에 방지하는 일이 핵심입니다. 
                CMMS는 기계의 모터, 기어, 체결 실린더 등의 온도 및 진동 데이터를 ERP/SCADA로부터 이관받아 마모 한계를 계산하고, 고장 발생 전에 담당 엔지니어에게 **"AST-CNC-02 Spindle 장비의 마모율이 78%에 도달했으니 내일 정기 가동 정지 시간에 구리스 주입 및 필터 세척 예방 보전을 수행하라"**는 지시를 내립니다.
              </p>
            </div>
          )}

          {activeLearnTab === 'strategies' && (
            <div className="explain-tab-body">
              <h4>보전 관리의 3단계 발전: BM - PM - PdM</h4>
              <p>
                스마트 팩토리의 기계 보전 기법은 예산과 고도화 수준에 따라 다음과 같이 분류됩니다.
              </p>
              <ul>
                <li><strong>사후 보전 (BM: Breakdown Maintenance)</strong>: 설비가 고장이 나 멈췄을 때 비로소 엔지니어가 수리하는 소극적 방법입니다. 복구 비용이 크고 생산 차질(Line Down)을 피할 수 없습니다.</li>
                <li><strong>예방 보전 (PM: Preventive Maintenance)</strong>: 고장이 나지 않았더라도 일정한 주기(예: 30일, 3만 사이클) 마다 소모품을 정기 교체하는 계획적 기법입니다. (CMMS 작업 지시서의 핵심 영역).</li>
                <li><strong>예지 보전 (PdM: Predictive Maintenance)</strong>: 설비에 IoT 센서(가속도, 열화상 센서 등)를 탑재하여 기계의 진동 파형 변화와 내부 온도 과열 징후를 머신러닝으로 분석, **고장이 일어날 시기를 사전에 정밀 예측**하여 필요한 부분만 정비하는 최첨단 스마트 보전 기법입니다.</li>
              </ul>
            </div>
          )}

          {activeLearnTab === 'oee' && (
            <div className="explain-tab-body">
              <h4>스마트 팩토리 보전 지표의 왕: 설비종합효율 (OEE) 계산법</h4>
              <p>
                **OEE (Overall Equipment Effectiveness, 설비 종합 효율)**는 제조 설비가 본래 가지고 있는 성능 대비 얼마나 양호한 품질을 시간 지연 없이 생산하고 있는지 나타내는 궁극의 CMMS 모니터링 지표입니다.
              </p>
              <p>
                <strong>OEE = 가동률(Availability) × 성능효율(Performance) × 양품률(Quality)</strong>
              </p>
              <ul>
                <li><strong>가동률</strong>: 고장 정지나 자재 대기 등의 비가동 시간을 뺀 실제 가동 비율 (고장 정지가 적을수록 상승).</li>
                <li><strong>성능효율</strong>: 장비 마모나 미세 마찰 등으로 인해 속도가 저하되는 성능 손실을 계산 (기어/베어링 관리에 정비례).</li>
                <li><strong>양품률</strong>: 초기 스타트업 불량이나 가공 치수 오차로 폐기되는 불량 비율 (정교한 캘리브레이션 유지 시 상승).</li>
              </ul>
            </div>
          )}

          {activeLearnTab === 'vibration' && (
            <div className="explain-tab-body">
              <h4>기계 예지 보전의 무기: 진동 주파수 분석 (FFT)</h4>
              <p>
                회전 기계(모터, 펌프, 스핀들)의 고장은 거의 항상 **비정상적인 미세 진동의 감지**에서 시작됩니다.
              </p>
              <p>
                기계 내부의 베어링이 긁히거나 기어 치아가 마모되면, 기어 접촉 시 발생하는 마찰 진동 주파수가 변합니다. 
                CMMS는 가속도 진동 센서로부터 들어오는 가공되지 않은 실시간 물리 진동(Time Domain) 데이터를 **FFT (Fast Fourier Transform, 고속 푸리에 변환)** 연산 처리하여 주파수 영역(Frequency Domain)으로 전환합니다. 
                이를 통해 특정 주파수 대역에서 튀는 피크(Peak) 진동 에너지를 짚어냄으로써 **"베어링 구슬이 손상되었다"** 혹은 **"구동 샤프트 축이 미세하게 정렬 불량(Misalignment)이다"**를 뜯어보지 않고 정밀 분석해 냅니다.
              </p>
            </div>
          )}
        </div>
      </div>

      <style>{`
        .cmms-dashboard-container {
          display: flex;
          flex-direction: column;
          gap: 1.5rem;
          width: 100%;
          animation: fadeIn 0.8s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }

        .cmms-telemetry-grid {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 1.25rem;
        }

        @media (max-width: 1024px) {
          .cmms-telemetry-grid {
            grid-template-columns: repeat(2, 1fr);
          }
        }

        @media (max-width: 640px) {
          .cmms-telemetry-grid {
            grid-template-columns: 1fr;
          }
        }

        .cmms-kpi-card {
          padding: 1.25rem;
          display: flex;
          flex-direction: column;
          gap: 0.5rem;
        }

        .cmms-center-grid {
          display: grid;
          grid-template-columns: 1.25fr 0.75fr;
          gap: 1.5rem;
        }

        @media (max-width: 1100px) {
          .cmms-center-grid {
            grid-template-columns: 1fr;
          }
        }

        .cmms-canvas-panel, .asset-health-panel {
          padding: 1.5rem;
          display: flex;
          flex-direction: column;
          gap: 1.25rem;
          height: 400px;
        }

        .cmms-canvas-wrapper {
          flex: 1;
          background: rgba(4, 6, 14, 0.85);
          border-radius: 12px;
          border: 1px solid rgba(255, 255, 255, 0.05);
          box-shadow: inset 0 4px 24px rgba(0, 0, 0, 0.9);
          overflow: hidden;
          position: relative;
        }

        .cmms-canvas {
          width: 100%;
          height: 100%;
          display: block;
        }

        .asset-cards-scroll {
          flex: 1;
          display: flex;
          flex-direction: column;
          gap: 0.65rem;
          overflow-y: auto;
          padding-right: 0.25rem;
        }

        .asset-card-item {
          background: rgba(255, 255, 255, 0.02);
          border: 1px solid rgba(255, 255, 255, 0.04);
          border-radius: 8px;
          padding: 0.75rem 1rem;
          display: flex;
          flex-direction: column;
          gap: 0.5rem;
          transition: all 0.2s;
        }

        .asset-card-item:hover {
          background: rgba(132, 204, 22, 0.03);
          border-color: rgba(132, 204, 22, 0.15);
        }

        .asset-card-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          border-bottom: 1px solid rgba(255, 255, 255, 0.03);
          padding-bottom: 0.35rem;
        }

        .asset-id-badge {
          font-weight: 800;
          color: #ffffff;
          font-size: 0.75rem;
        }

        .asset-crit-badge {
          font-size: 0.6rem;
          border: 1px solid rgba(255,255,255,0.15);
          padding: 1px 4px;
          border-radius: 3px;
          font-weight: 700;
        }

        .asset-status-badge {
          font-size: 0.65rem;
          font-weight: 800;
          padding: 1.5px 5px;
          border-radius: 4px;
          letter-spacing: 0.3px;
          text-transform: uppercase;
        }

        .asset-status-badge.running {
          background: rgba(132, 204, 22, 0.12);
          color: #84cc16;
          border: 1px solid rgba(132, 204, 22, 0.25);
        }

        .asset-status-badge.maintenance {
          background: rgba(168, 85, 247, 0.12);
          color: #a855f7;
          border: 1px solid rgba(168, 85, 247, 0.25);
        }

        .asset-status-badge.fault {
          background: rgba(239, 68, 68, 0.12);
          color: #ef4444;
          border: 1px solid rgba(239, 68, 68, 0.25);
        }

        .asset-card-body {
          display: flex;
          flex-direction: column;
          gap: 0.5rem;
          font-size: 0.72rem;
        }

        .wear-progress-wrapper {
          display: flex;
          flex-direction: column;
          gap: 4px;
        }

        .wear-label {
          display: flex;
          justify-content: space-between;
          color: var(--text-muted);
        }

        .wear-bar-container {
          height: 6px;
          background: rgba(255,255,255,0.04);
          border-radius: 4px;
          overflow: hidden;
        }

        .wear-bar-fill {
          height: 100%;
          border-radius: 4px;
          transition: width 0.5s ease;
        }

        .sensor-metrics-row {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 0.5rem;
          margin-top: 2px;
        }

        .sensor-box {
          background: rgba(255,255,255,0.01);
          border: 1px solid rgba(255,255,255,0.03);
          border-radius: 4px;
          padding: 4px;
          display: flex;
          flex-direction: column;
          align-items: center;
        }

        .sensor-lbl {
          font-size: 0.58rem;
          color: var(--text-muted);
          margin-bottom: 2px;
          text-transform: uppercase;
        }

        .sensor-val {
          font-size: 0.75rem;
        }

        .cmms-bottom-panel {
          padding: 1.25rem;
          display: flex;
          flex-direction: column;
          gap: 1rem;
          height: 330px;
        }

        .cmms-table-wrapper {
          flex: 1;
          overflow-y: auto;
          border: 1px solid rgba(255, 255, 255, 0.04);
          border-radius: 8px;
          background: rgba(4, 6, 14, 0.5);
        }

        .cmms-table {
          width: 100%;
          border-collapse: collapse;
          text-align: left;
          font-size: 0.72rem;
        }

        .cmms-table th, .cmms-table td {
          padding: 0.6rem 0.8rem;
          border-bottom: 1px solid rgba(255, 255, 255, 0.03);
        }

        .cmms-table th {
          background: rgba(13, 20, 38, 0.75);
          color: var(--text-secondary);
          font-weight: 600;
          font-size: 0.7rem;
          letter-spacing: 0.5px;
          text-transform: uppercase;
        }

        .cmms-table tr:hover {
          background: rgba(255, 255, 255, 0.015);
        }

        .cmms-table .wo-id {
          color: #84cc16;
          font-weight: 700;
        }

        .maint-badge {
          font-size: 0.6rem;
          font-weight: 800;
          padding: 1.5px 4px;
          border-radius: 3px;
          letter-spacing: 0.2px;
        }

        .maint-badge.preventive {
          background: rgba(132, 204, 22, 0.15);
          color: #84cc16;
          border: 1px solid rgba(132, 204, 22, 0.3);
        }

        .maint-badge.corrective {
          background: rgba(239, 68, 68, 0.15);
          color: #ef4444;
          border: 1px solid rgba(239, 68, 68, 0.3);
        }

        .maint-badge.calibration {
          background: rgba(56, 189, 248, 0.15);
          color: #38bdf8;
          border: 1px solid rgba(56, 189, 248, 0.3);
        }

        .pri-badge {
          font-size: 0.6rem;
          font-weight: 800;
          padding: 1.5px 4px;
          border-radius: 3px;
        }

        .pri-badge.critical {
          background: rgba(239, 68, 68, 0.2);
          color: #f87171;
          border: 1px solid rgba(239, 68, 68, 0.45);
          animation: pulse-glow 1.5s infinite ease-in-out;
        }

        .pri-badge.high {
          background: rgba(245, 158, 11, 0.15);
          color: #f59e0b;
          border: 1px solid rgba(245, 158, 11, 0.3);
        }

        .pri-badge.medium {
          background: rgba(56, 189, 248, 0.15);
          color: #38bdf8;
          border: 1px solid rgba(56, 189, 248, 0.3);
        }

        .wo-status-badge {
          font-size: 0.62rem;
          font-weight: 700;
          padding: 1.5px 4px;
          border-radius: 3px;
          text-transform: uppercase;
        }

        .wo-status-badge.open {
          background: rgba(239, 68, 68, 0.12);
          color: #f87171;
          border: 1px solid rgba(239, 68, 68, 0.25);
        }

        .wo-status-badge.in_progress {
          background: rgba(245, 158, 11, 0.12);
          color: #fbbf24;
          border: 1px solid rgba(245, 158, 11, 0.25);
        }

        .wo-status-badge.closed {
          background: rgba(16, 185, 129, 0.12);
          color: #34d399;
          border: 1px solid rgba(16, 185, 129, 0.25);
        }

        .cmms-explain-panel {
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
          background: rgba(132, 204, 22, 0.05);
          color: var(--text-primary);
          border-color: rgba(132, 204, 22, 0.25);
        }

        .explain-tab.active {
          background: rgba(132, 204, 22, 0.12);
          color: #84cc16;
          border-color: rgba(132, 204, 22, 0.4);
          font-weight: 600;
          box-shadow: 0 0 10px rgba(132, 204, 22, 0.15);
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
