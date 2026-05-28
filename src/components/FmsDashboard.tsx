import React, { useEffect, useRef, useState } from 'react';
import { 
  Truck, Navigation, Activity, BatteryCharging, Battery, 
  Database, AlertTriangle, Cpu, Info, Play, Pause
} from 'lucide-react';

interface AgvInfo {
  id: string;
  type: 'AGV' | 'AMR';
  status: 'RUNNING' | 'STANDBY' | 'CHARGING' | 'BLOCKED';
  battery: number;
  speed: number; // m/s
  location: string;
  destination: string;
  payload: string;
  efficiency: number;
}

interface Mission {
  id: string;
  source: string;
  dest: string;
  part: string;
  priority: 'HIGH' | 'MEDIUM' | 'LOW';
  status: 'QUEUED' | 'ASSIGNED' | 'TRANSFERRING' | 'COMPLETED';
  assignedAgv: string;
}

export const FmsDashboard: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isRunning, setIsRunning] = useState(true);

  // FMS Telemetry States
  const [activeAgvs, setActiveAgvs] = useState(4);
  const [fleetUtilization, setFleetUtilization] = useState(88.5);
  const [completedMissions, setCompletedMissions] = useState(112);
  const [warningCount, setWarningCount] = useState(0);

  // Active study tab
  const [activeTab, setActiveTab] = useState<'intro' | 'routing' | 'traffic' | 'agv-amr'>('intro');

  // AGV Live Stats State (synchronized smoothly)
  const [agvList, setAgvList] = useState<AgvInfo[]>([
    { id: 'AGV-01', type: 'AGV', status: 'RUNNING', battery: 84, speed: 1.2, location: 'Node-03 (Press)', destination: 'Node-06 (Body)', payload: 'Side Outer Panel', efficiency: 95 },
    { id: 'AGV-02', type: 'AGV', status: 'RUNNING', battery: 67, speed: 1.0, location: 'Node-08 (Assembly)', destination: 'Node-10 (QC)', payload: 'EV Main Battery Case', efficiency: 92 },
    { id: 'AGV-03', type: 'AMR', status: 'CHARGING', battery: 92, speed: 0.0, location: 'Node-05 (Charge)', destination: 'None', payload: 'None', efficiency: 98 },
    { id: 'AGV-04', type: 'AMR', status: 'STANDBY', battery: 78, speed: 0.0, location: 'Node-01 (Warehouse)', destination: 'None', payload: 'None', efficiency: 94 },
    { id: 'AGV-05', type: 'AGV', status: 'BLOCKED', battery: 52, speed: 0.0, location: 'Node-06 (Body)', destination: 'Node-08 (Assembly)', payload: 'Door Module Box', efficiency: 76 }
  ]);

  // Dispatch Mission Queue
  const [missionQueue, setMissionQueue] = useState<Mission[]>([
    { id: 'MSN-902', source: 'Raw Warehouse A', dest: 'Press Line 1', part: 'Steel Coil Plate', priority: 'HIGH', status: 'TRANSFERRING', assignedAgv: 'AGV-01' },
    { id: 'MSN-903', source: 'Battery Sub-Line', dest: 'Trim Marriage Gate', part: 'Cell Module Pack', priority: 'HIGH', status: 'TRANSFERRING', assignedAgv: 'AGV-02' },
    { id: 'MSN-904', source: 'Injection molding B', dest: 'Bumper Assembly', part: 'Front Bumper Guard', priority: 'MEDIUM', status: 'ASSIGNED', assignedAgv: 'AGV-04' },
    { id: 'MSN-905', source: 'Warehouse B', dest: 'Final Paint Inspection', part: 'AI Laser Vision Head', priority: 'LOW', status: 'QUEUED', assignedAgv: 'None' },
    { id: 'MSN-906', source: 'EOL Test Station', dest: 'Outbound Warehouse', part: 'Genesis G90 (Assembled)', priority: 'MEDIUM', status: 'QUEUED', assignedAgv: 'None' }
  ]);

  // Telemetry fluctuation simulator
  useEffect(() => {
    if (!isRunning) return;

    const interval = setInterval(() => {
      // 1. Mission Completion increments
      if (Math.random() < 0.25) {
        setCompletedMissions(prev => prev + 1);
        
        // Push a new random mission
        const sources = ['Raw Warehouse A', 'Warehouse B', 'Battery Sub-Line', 'Seat Assembly A'];
        const dests = ['Press Line 1', 'Trim Marriage Gate', 'Bumper Assembly', 'Final Assembly Ring'];
        const parts = ['Cockpit module', 'Alloy Wheels Set', 'Panoramic Sunroof Frame', 'EV Motor Assembly'];
        const priorities: ('HIGH'|'MEDIUM'|'LOW')[] = ['HIGH', 'MEDIUM', 'LOW'];

        const randomSource = sources[Math.floor(Math.random() * sources.length)];
        const randomDest = dests[Math.floor(Math.random() * dests.length)];
        const randomPart = parts[Math.floor(Math.random() * parts.length)];
        const randomPriority = priorities[Math.floor(Math.random() * priorities.length)];
        
        const msnId = 907 + Math.floor(Math.random() * 90);
        
        setMissionQueue(prev => {
          const next = [...prev];
          // Remove completed if too long
          if (next.length > 5) {
            next.pop();
          }
          return [
            {
              id: `MSN-${msnId}`,
              source: randomSource,
              dest: randomDest,
              part: randomPart,
              priority: randomPriority,
              status: 'QUEUED',
              assignedAgv: 'None'
            },
            ...next
          ];
        });
      }

      // 2. Battery Drain & Charging simulator
      setAgvList(prev => prev.map(agv => {
        if (agv.status === 'RUNNING') {
          const newBat = Math.max(10, agv.battery - (Math.random() > 0.7 ? 1 : 0));
          return {
            ...agv,
            battery: newBat,
            status: newBat < 15 ? 'CHARGING' : 'RUNNING',
            location: newBat < 15 ? 'Node-05 (Charge)' : agv.location,
            payload: newBat < 15 ? 'None' : agv.payload
          };
        } else if (agv.status === 'CHARGING') {
          const newBat = Math.min(100, agv.battery + 2);
          return {
            ...agv,
            battery: newBat,
            status: newBat === 100 ? 'STANDBY' : 'CHARGING',
            location: newBat === 100 ? 'Node-01 (Warehouse)' : agv.location
          };
        } else if (agv.status === 'STANDBY' && Math.random() < 0.3) {
          // Send standby to running
          return {
            ...agv,
            status: 'RUNNING',
            speed: 1.1,
            payload: 'Engine Control Unit Box',
            destination: 'Node-08 (Assembly)'
          };
        }
        return agv;
      }));

      // Fluctuate utilization
      setFleetUtilization(+(82 + Math.random() * 12).toFixed(1));

      // Fluctuate active AGVs count
      const activeCount = agvList.filter(a => a.status === 'RUNNING' || a.status === 'BLOCKED').length;
      setActiveAgvs(activeCount);

      // Fluctuate warnings
      setWarningCount(agvList.filter(a => a.status === 'BLOCKED' || a.battery < 20).length);

    }, 3000);

    return () => clearInterval(interval);
  }, [isRunning, agvList]);

  // ACS Canvas Graphics Engine
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

    // Map Nodes Definition
    interface LogisticsNode {
      id: string;
      name: string;
      x: number;
      y: number;
      type: 'warehouse' | 'station' | 'charge' | 'intersection' | 'buffer';
    }

    const nodes: LogisticsNode[] = [
      { id: 'N1', name: 'Raw Warehouse A', x: 80, y: 70, type: 'warehouse' },
      { id: 'N2', name: 'Intermediate Storage', x: 260, y: 70, type: 'buffer' },
      { id: 'N3', name: 'Press & Trim Line', x: 440, y: 70, type: 'station' },
      
      { id: 'N4', name: 'Intersection West', x: 80, y: 170, type: 'intersection' },
      { id: 'N5', name: 'ACS Charging Dock', x: 260, y: 170, type: 'charge' },
      { id: 'N6', name: 'Intersection East', x: 440, y: 170, type: 'intersection' },
      
      { id: 'N7', name: 'Chassis Marriage', x: 80, y: 270, type: 'station' },
      { id: 'N8', name: 'Final Assembly', x: 260, y: 270, type: 'station' },
      { id: 'N9', name: 'Outbound Warehouse', x: 440, y: 270, type: 'warehouse' }
    ];

    // Connections (Bidirectional paths)
    const paths = [
      ['N1', 'N2'], ['N2', 'N3'],
      ['N1', 'N4'], ['N2', 'N5'], ['N3', 'N6'],
      ['N4', 'N5'], ['N5', 'N6'],
      ['N4', 'N7'], ['N5', 'N8'], ['N6', 'N9'],
      ['N7', 'N8'], ['N8', 'N9']
    ];

    // Simulative AGVs on Canvas
    interface AgvGraphics {
      id: string;
      color: string;
      x: number;
      y: number;
      targetNodeIdx: number;
      pathNodeSequence: string[];
      currentPathPos: number; // 0 to 1
      speed: number;
      battery: number;
      blockedTimer: number;
      isBlocked: boolean;
      loadStatus: 'empty' | 'loaded';
    }

    const canvasAgvs: AgvGraphics[] = [
      { id: 'AGV-01', color: '#06b6d4', x: 80, y: 70, targetNodeIdx: 1, pathNodeSequence: ['N1', 'N2', 'N3', 'N6', 'N5'], currentPathPos: 0, speed: 0.007, battery: 84, blockedTimer: 0, isBlocked: false, loadStatus: 'loaded' },
      { id: 'AGV-02', color: '#a855f7', x: 260, y: 270, targetNodeIdx: 1, pathNodeSequence: ['N8', 'N9', 'N6', 'N3'], currentPathPos: 0, speed: 0.006, battery: 67, blockedTimer: 0, isBlocked: false, loadStatus: 'loaded' },
      { id: 'AGV-03', color: '#10b981', x: 260, y: 170, targetNodeIdx: 0, pathNodeSequence: ['N5'], currentPathPos: 0, speed: 0.0, battery: 92, blockedTimer: 0, isBlocked: false, loadStatus: 'empty' },
      { id: 'AGV-04', color: '#38bdf8', x: 80, y: 170, targetNodeIdx: 1, pathNodeSequence: ['N4', 'N7', 'N8'], currentPathPos: 0, speed: 0.008, battery: 78, blockedTimer: 0, isBlocked: false, loadStatus: 'empty' },
      { id: 'AGV-05', color: '#ef4444', x: 440, y: 170, targetNodeIdx: 1, pathNodeSequence: ['N6', 'N5'], currentPathPos: 0, speed: 0.005, battery: 52, blockedTimer: 0, isBlocked: true, loadStatus: 'loaded' } // Blocked AGV
    ];

    let timer = 0;

    // Helper to find Node Coordinates
    const getNodeCoord = (id: string) => {
      const node = nodes.find(n => n.id === id);
      return node ? { x: node.x, y: node.y } : { x: 0, y: 0 };
    };

    // Render loop
    const render = () => {
      ctx.clearRect(0, 0, width, height);
      timer++;

      // 1. Draw Grid Lines background (Cyber aesthetics)
      ctx.strokeStyle = 'rgba(6, 182, 212, 0.015)';
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

      // 2. Draw Logistics Paths (Guide tracks)
      ctx.strokeStyle = '#1e293b';
      ctx.lineWidth = 10;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      paths.forEach(p => {
        const from = getNodeCoord(p[0]);
        const to = getNodeCoord(p[1]);
        ctx.beginPath();
        ctx.moveTo(from.x, from.y);
        ctx.lineTo(to.x, to.y);
        ctx.stroke();
      });

      // Interactive Induction wire style lines inside paths
      ctx.strokeStyle = '#334155';
      ctx.lineWidth = 2;
      paths.forEach(p => {
        const from = getNodeCoord(p[0]);
        const to = getNodeCoord(p[1]);
        ctx.beginPath();
        ctx.moveTo(from.x, from.y);
        ctx.lineTo(to.x, to.y);
        ctx.stroke();
      });

      // Draw active segment occupancy glows (ACS Zone Booking / Semaphore)
      // Visualizing segment lock
      canvasAgvs.forEach(agv => {
        if (agv.pathNodeSequence.length > 1 && !agv.isBlocked && isRunning) {
          const fromNodeId = agv.pathNodeSequence[0];
          const toNodeId = agv.pathNodeSequence[1];
          const from = getNodeCoord(fromNodeId);
          const to = getNodeCoord(toNodeId);

          ctx.save();
          ctx.strokeStyle = `${agv.color}25`; // translucent glow
          ctx.lineWidth = 8;
          ctx.beginPath();
          ctx.moveTo(from.x, from.y);
          ctx.lineTo(to.x, to.y);
          ctx.stroke();
          ctx.restore();
        }
      });

      // 3. Draw Nodes (Stations, Storage, Charging)
      nodes.forEach(n => {
        ctx.save();
        ctx.translate(n.x, n.y);

        // Outer glow/ring based on node type
        let nodeColor = '#475569';
        
        if (n.type === 'warehouse') {
          nodeColor = '#38bdf8';
        } else if (n.type === 'station') {
          nodeColor = '#a855f7';
        } else if (n.type === 'charge') {
          nodeColor = '#10b981';
        } else if (n.type === 'intersection') {
          nodeColor = '#f59e0b';
        }

        ctx.strokeStyle = nodeColor;
        ctx.lineWidth = 2;
        ctx.fillStyle = '#0f172a';
        ctx.beginPath();
        
        if (n.type === 'warehouse') {
          ctx.roundRect(-10, -10, 20, 20, 3);
        } else if (n.type === 'station') {
          // Polygon
          ctx.arc(0, 0, 9, 0, Math.PI * 2);
        } else if (n.type === 'charge') {
          // Diamond / Charging port symbol
          ctx.moveTo(0, -10);
          ctx.lineTo(10, 0);
          ctx.lineTo(0, 10);
          ctx.lineTo(-10, 0);
          ctx.closePath();
        } else {
          ctx.arc(0, 0, 6, 0, Math.PI * 2);
        }
        
        ctx.fill();
        ctx.stroke();

        // Node Label
        ctx.fillStyle = '#94a3b8';
        ctx.font = '7.5px JetBrains Mono';
        ctx.textAlign = 'center';
        ctx.fillText(n.id, 0, 3);

        ctx.fillStyle = '#f1f5f9';
        ctx.font = 'bold 8.5px Outfit';
        ctx.textAlign = 'center';
        ctx.fillText(n.name, 0, -15);

        ctx.restore();
      });

      // 4. Update and Draw AGVs
      canvasAgvs.forEach(agv => {
        if (isRunning) {
          // ACS Collision Avoidance Simulation logic (Traffic control check)
          let closeToAnother = false;
          
          canvasAgvs.forEach(other => {
            if (other.id === agv.id) return;
            const dist = Math.hypot(other.x - agv.x, other.y - agv.y);
            // If another AGV is right in front (within 40px)
            if (dist < 42 && agv.pathNodeSequence.length > 1) {
              closeToAnother = true;
            }
          });

          // Blocked or Close Traffic Control halts speed
          if (agv.isBlocked || closeToAnother) {
            agv.speed = 0;
            // Simulated flashing hazard indicator
            if (timer % 30 < 15) {
              ctx.save();
              ctx.strokeStyle = '#ef4444';
              ctx.lineWidth = 1.5;
              ctx.beginPath();
              ctx.arc(agv.x, agv.y, 16, 0, Math.PI*2);
              ctx.stroke();
              
              ctx.fillStyle = 'rgba(239, 68, 68, 0.1)';
              ctx.beginPath();
              ctx.arc(agv.x, agv.y, 16, 0, Math.PI*2);
              ctx.fill();
              ctx.restore();
            }
          } else {
            // Restore speed
            agv.speed = agv.id === 'AGV-01' ? 0.007 : agv.id === 'AGV-04' ? 0.008 : 0.006;
          }

          // Path Travelling
          if (agv.pathNodeSequence.length > 1 && agv.speed > 0) {
            agv.currentPathPos += agv.speed;
            
            const currNode = getNodeCoord(agv.pathNodeSequence[0]);
            const nextNode = getNodeCoord(agv.pathNodeSequence[1]);

            // Interpolate position
            agv.x = currNode.x + (nextNode.x - currNode.x) * agv.currentPathPos;
            agv.y = currNode.y + (nextNode.y - currNode.y) * agv.currentPathPos;

            // Arrive at next node
            if (agv.currentPathPos >= 1.0) {
              agv.currentPathPos = 0;
              agv.pathNodeSequence.shift(); // remove current node from sequence

              // Loop missions mock: if finished all paths, refill path queue
              if (agv.pathNodeSequence.length === 1) {
                if (agv.id === 'AGV-01') {
                  agv.pathNodeSequence = ['N5', 'N8', 'N7', 'N4', 'N1'];
                  agv.loadStatus = 'empty';
                } else if (agv.id === 'AGV-02') {
                  agv.pathNodeSequence = ['N3', 'N2', 'N5', 'N8', 'N9'];
                  agv.loadStatus = 'empty';
                } else if (agv.id === 'AGV-04') {
                  agv.pathNodeSequence = ['N8', 'N5', 'N6', 'N9'];
                  agv.loadStatus = 'loaded';
                }
              }
            }
          }
        }

        // Draw AGV physical box representation
        ctx.save();
        ctx.translate(agv.x, agv.y);

        // Body Shadow
        ctx.fillStyle = 'rgba(0,0,0,0.5)';
        ctx.fillRect(-12, -9, 24, 18);

        // AGV Main Chassis
        ctx.fillStyle = agv.isBlocked ? '#ef4444' : '#0f172a';
        ctx.strokeStyle = agv.isBlocked ? '#f87171' : agv.color;
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.roundRect(-10, -8, 20, 16, 4);
        ctx.fill();
        ctx.stroke();

        // Wheels
        ctx.fillStyle = '#475569';
        ctx.fillRect(-9, -10, 5, 2);
        ctx.fillRect(4, -10, 5, 2);
        ctx.fillRect(-9, 8, 5, 2);
        ctx.fillRect(4, 8, 5, 2);

        // LIDAR Scanner Head (Lidar beam line)
        ctx.fillStyle = '#f59e0b';
        ctx.beginPath();
        ctx.arc(0, 0, 3.5, 0, Math.PI * 2);
        ctx.fill();

        // Sensor sweeping laser flat cone
        if (isRunning && agv.speed > 0) {
          const angle = Math.atan2(
            agv.pathNodeSequence.length > 1 ? getNodeCoord(agv.pathNodeSequence[1]).y - agv.y : 0,
            agv.pathNodeSequence.length > 1 ? getNodeCoord(agv.pathNodeSequence[1]).x - agv.x : 1
          );

          ctx.save();
          ctx.rotate(angle);
          ctx.strokeStyle = 'rgba(6, 182, 212, 0.25)';
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(3, 0);
          ctx.lineTo(25, -10);
          ctx.moveTo(3, 0);
          ctx.lineTo(25, 10);
          ctx.stroke();
          ctx.restore();
        }

        // AGV Label
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 7px Outfit';
        ctx.textAlign = 'center';
        ctx.fillText(agv.id.substring(4), 0, -11);

        // Draw Load box on top of AGV if loaded
        if (agv.loadStatus === 'loaded') {
          ctx.fillStyle = '#f59e0b';
          ctx.strokeStyle = '#d97706';
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.roundRect(-5, -5, 10, 10, 1.5);
          ctx.fill();
          ctx.stroke();
          
          // Technical box lines
          ctx.strokeStyle = 'rgba(255,255,255,0.4)';
          ctx.beginPath();
          ctx.moveTo(-3, -3);
          ctx.lineTo(3, 3);
          ctx.moveTo(3, -3);
          ctx.lineTo(-3, 3);
          ctx.stroke();
        }

        ctx.restore();
      });

      // Draw telemetry summary box on Canvas
      ctx.fillStyle = 'rgba(15, 23, 42, 0.7)';
      ctx.strokeStyle = 'rgba(6, 182, 212, 0.2)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.roundRect(15, 310, 200, 32, 6);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = '#06b6d4';
      ctx.font = 'bold 8px Outfit';
      ctx.fillText('ACS SAFETY STATUS: ALL ZONE SCAN ACTIVE', 25, 323);
      ctx.fillStyle = '#94a3b8';
      ctx.font = '7.5px JetBrains Mono';
      ctx.fillText(`LASER RANGE: 3000mm | FREQ: 25Hz`, 25, 334);

      animationFrameId = requestAnimationFrame(render);
    };

    render();

    return () => {
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener('resize', handleResize);
    };
  }, [isRunning]);

  return (
    <div className="fms-dashboard-container">
      {/* Top Telemetry Widgets */}
      <div className="fms-telemetry-grid">
        <div className="glass-panel fms-kpi-card">
          <div className="kpi-header">
            <Truck size={14} className="text-neon-cyan" />
            <span>ACTIVE AGV / AMR FLEET</span>
          </div>
          <div className="kpi-value text-neon-cyan">
            {activeAgvs} <span className="kpi-unit">/ 5 Units</span>
          </div>
          <div className="kpi-desc">가용 AGV 운용 상태: 정상</div>
        </div>

        <div className="glass-panel fms-kpi-card">
          <div className="kpi-header">
            <Activity size={14} style={{ color: '#a855f7' }} />
            <span>FLEET UTILIZATION (가동률)</span>
          </div>
          <div className="kpi-value" style={{ color: '#a855f7' }}>
            {fleetUtilization}%
          </div>
          <div className="kpi-desc">누적 완료 미션: {completedMissions}건</div>
        </div>

        <div className="glass-panel fms-kpi-card">
          <div className="kpi-header">
            <BatteryCharging size={14} className="text-neon-green" />
            <span>BATTERY STATUS</span>
          </div>
          <div className="kpi-value text-neon-green">
            1 <span className="kpi-unit">Charging</span>
          </div>
          <div className="kpi-desc">평균 잔량: 73.8% (정상 교대)</div>
        </div>

        <div className="glass-panel fms-kpi-card">
          <div className="kpi-header">
            <AlertTriangle size={14} className={warningCount > 0 ? 'text-neon-amber' : 'text-neon-cyan'} />
            <span>ACS LOGISTICS BLOCKED</span>
          </div>
          <div className={`kpi-value ${warningCount > 0 ? 'text-neon-amber' : 'text-neon-cyan'}`}>
            {warningCount} <span className="kpi-unit">Warnings</span>
          </div>
          <div className="kpi-desc">교차로 신호 대기 및 장애물 회피</div>
        </div>
      </div>

      {/* Main Grid: Logistics Map Canvas & Live Status Grid */}
      <div className="fms-center-grid">
        {/* Logistics Map Canvas */}
        <div className="glass-panel fms-canvas-panel">
          <div className="mimic-header">
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Navigation size={17} className="text-neon-cyan" />
              <h3>ACS AGV/AMR TRAFFIC CONTROL MAP (실시간 군집 주행 관제 맵)</h3>
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
          <div className="fms-canvas-wrapper">
            <canvas ref={canvasRef} className="fms-canvas" />
          </div>
        </div>

        {/* Live AGV Fleet Grid */}
        <div className="glass-panel agv-list-panel">
          <div className="mimic-header">
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Cpu size={16} className="text-neon-cyan" />
              <h3>FLEET TELEMETRY STATUS (AGV 실시간 정밀 상태 모니터링)</h3>
            </div>
          </div>
          <div className="agv-cards-scroll">
            {agvList.map(agv => {
              let statusClass = 'status-standby';
              let statusText = '대기';
              if (agv.status === 'RUNNING') {
                statusClass = 'status-running';
                statusText = '주행 중';
              } else if (agv.status === 'CHARGING') {
                statusClass = 'status-charging';
                statusText = '급속 충전';
              } else if (agv.status === 'BLOCKED') {
                statusClass = 'status-blocked';
                statusText = '일시 정지';
              }

              return (
                <div key={agv.id} className="agv-card-item font-mono-tech">
                  <div className="agv-card-header">
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span className="agv-id-badge">{agv.id}</span>
                      <span className="agv-type-badge">{agv.type}</span>
                    </div>
                    <span className={`agv-status-badge ${statusClass}`}>{statusText}</span>
                  </div>

                  <div className="agv-card-body">
                    <div className="agv-metric-row">
                      <span>현재 노드:</span>
                      <strong className="text-white">{agv.location}</strong>
                    </div>
                    <div className="agv-metric-row">
                      <span>목적 노드:</span>
                      <strong className="text-white">{agv.destination}</strong>
                    </div>
                    <div className="agv-metric-row">
                      <span>적재물품:</span>
                      <strong style={{ color: agv.payload === 'None' ? '#64748b' : '#f59e0b' }}>{agv.payload}</strong>
                    </div>
                    
                    <div className="agv-card-footer">
                      <div className="footer-metric">
                        <Battery size={12} style={{ marginRight: '3px' }} />
                        <span style={{ color: agv.battery < 20 ? '#ef4444' : '#10b981' }}>{agv.battery}%</span>
                      </div>
                      <div className="footer-metric">
                        <Activity size={12} style={{ marginRight: '3px' }} />
                        <span>{agv.speed} m/s</span>
                      </div>
                      <div className="footer-metric">
                        <span>효율:</span>
                        <strong style={{ color: '#06b6d4' }}>{agv.efficiency}%</strong>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Bottom Mission Dispatch Table */}
      <div className="glass-panel fms-bottom-panel">
        <div className="panel-title" style={{ fontSize: '0.9rem', color: '#fff' }}>
          <Database size={15} className="text-neon-cyan" />
          <span>FMS REAL-TIME MISSION DISPATCH QUEUE (실시간 중앙 배차 지시 큐)</span>
        </div>
        <div className="fms-table-wrapper">
          <table className="fms-table font-mono-tech">
            <thead>
              <tr>
                <th>MISSION ID</th>
                <th>FROM (출발지)</th>
                <th>TO (목적지)</th>
                <th>LOGISTICS PART (운송 물품)</th>
                <th>PRIORITY</th>
                <th>STATUS</th>
                <th>ASSIGNED UNIT</th>
              </tr>
            </thead>
            <tbody>
              {missionQueue.map((msn, idx) => (
                <tr key={idx} className={msn.status.toLowerCase()}>
                  <td className="msn-id">{msn.id}</td>
                  <td>{msn.source}</td>
                  <td>{msn.dest}</td>
                  <td style={{ color: '#f59e0b', fontWeight: '600' }}>{msn.part}</td>
                  <td>
                    <span className={`priority-badge ${msn.priority.toLowerCase()}`}>
                      {msn.priority}
                    </span>
                  </td>
                  <td>
                    <span className={`status-badge ${msn.status.toLowerCase()}`}>
                      {msn.status}
                    </span>
                  </td>
                  <td style={{ color: '#06b6d4', fontWeight: '700' }}>{msn.assignedAgv}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Study Center */}
      <div className="glass-panel fms-explain-panel">
        <div className="explain-tabs">
          <button 
            className={`explain-tab ${activeTab === 'intro' ? 'active' : ''}`}
            onClick={() => setActiveTab('intro')}
          >
            FMS & ACS란?
          </button>
          <button 
            className={`explain-tab ${activeTab === 'routing' ? 'active' : ''}`}
            onClick={() => setActiveTab('routing')}
          >
            AGV 주행 & 경로 탐색
          </button>
          <button 
            className={`explain-tab ${activeTab === 'traffic' ? 'active' : ''}`}
            onClick={() => setActiveTab('traffic')}
          >
            교차로 교통 제어 (Traffic Control)
          </button>
          <button 
            className={`explain-tab ${activeTab === 'agv-amr' ? 'active' : ''}`}
            onClick={() => setActiveTab('agv-amr')}
          >
            AGV와 AMR의 차이점
          </button>
        </div>

        <div className="explain-content" style={{ fontSize: '0.88rem', lineHeight: '1.6' }}>
          {activeTab === 'intro' && (
            <div className="explain-tab-body">
              <h4>
                <Info size={16} className="text-neon-cyan inline-icon" />
                FMS (Fleet Management System)와 ACS (AGV Control System)의 차이와 조화
              </h4>
              <p>
                스마트 팩토리의 무인 물류 자동화는 **FMS**와 **ACS**라는 두 핵심 제어 소프트웨어의 조화로 완성됩니다.
              </p>
              <ul>
                <li>
                  <strong>FMS (Fleet Management System, 군관리 시스템)</strong>: 상위 시스템인 MES로부터 자재 운송 호출을 받아 **"어떤 자재를 어떤 AGV에게 배차할 것인가(Mission Dispatching)"**를 조율하는 중앙 브레인입니다. 각 AGV의 현재 위치, 배터리 잔량, 적재 상태를 판단해 최적의 차량에게 일감을 부여합니다.
                </li>
                <li>
                  <strong>ACS (AGV Control System, AGV 제어 시스템)</strong>: FMS가 업무를 지정하면, **"해당 AGV가 안전하게 타겟 노드까지 장애물을 회피해 주행할 수 있도록 경로를 설계하고 실시간 트래픽을 제정(Routing & Traffic Control)"**하는 정밀 구동 소프트웨어입니다.
                </li>
              </ul>
            </div>
          )}

          {activeTab === 'routing' && (
            <div className="explain-tab-body">
              <h4>무인 물류 로봇의 경로 탐색 알고리즘과 주행 제어</h4>
              <p>
                AGV/AMR은 공장 바닥의 격자 맵(Grid Map)이나 마커 지형(Feature Map) 내에서 목적지까지 부드럽게 주행하기 위해 다양한 그래프 탐색 알고리즘을 사용합니다.
              </p>
              <ul>
                <li><strong>다익스트라(Dijkstra) 알고리즘</strong>: 모든 경로 상의 가중치(거리, 작업 정체 구역 등)를 기반으로 출발 노드에서 도착 노드까지의 절대 최단 경로를 산출하는 가장 대표적인 무인 물류 주행 알고리즘입니다.</li>
                <li><strong>A* (A-Star) 알고리즘</strong>: 목적지까지의 직선 궤적에 대한 휴리스틱(Heuristic) 거리 예측을 추가하여, 다익스트라 대비 경로 연산 속도를 기하급수적으로 단축시킵니다. 정적 장애물이 빈번히 교체되는 AMR 공정 물류에 특히 유리합니다.</li>
              </ul>
            </div>
          )}

          {activeTab === 'traffic' && (
            <div className="explain-tab-body">
              <h4>교차로 충돌 제어 (Traffic Control)의 소프트웨어 구현 원리</h4>
              <p>
                좁은 공장 주행로에 수십 대의 AGV가 주행할 때, 가장 빈번하게 마주치는 이슈가 교차로 병목 현상과 정면/측면 충돌입니다. ACS는 이를 제어하기 위해 다음 기술들을 적용합니다.
              </p>
              <ul>
                <li><strong>구역 예약제 (Zone Booking / Semaphores)</strong>: 주행 궤적 상의 세그먼트(Segment)를 하나의 **임계 구역(Critical Section)**으로 취급하여, 하나의 AGV가 해당 도로 섹터를 예약하면 다른 차량은 들어오지 못하고 정지선(Hold line)에서 세마포어 신호를 대기하게 만듭니다. (위의 캔버스 맵에서 활성 주행선에 칠해지는 반투명 색상 영역이 바로 예약 구역입니다.)</li>
                <li><strong>스핀락(Spinlock) 회피 및 대기큐</strong>: 교차로에 여러 차량이 정면 접근 시, 차량 우선순위(적재 차량 최우선, 배터리 부족 차량 차순위)에 따라 통행 우선권을 발부하여 교착 상태(Deadlock)에 빠지지 않도록 흐름을 재설정합니다.</li>
              </ul>
            </div>
          )}

          {activeTab === 'agv-amr' && (
            <div className="explain-tab-body">
              <h4>AGV와 AMR의 차이점과 공장 내 역할 분담</h4>
              <p>
                공장 내 무인 이동체는 유도 방식에 따라 AGV와 AMR로 크게 구분됩니다.
              </p>
              <table className="explain-table">
                <thead>
                  <tr>
                    <th>특성</th>
                    <th>AGV (Automated Guided Vehicle)</th>
                    <th>AMR (Autonomous Mobile Robot)</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td><strong>경로 유도 방식</strong></td>
                    <td>자기 테이프, 페인트 마크, QR 코드 바닥 부착식</td>
                    <td>LiDAR 스캐닝을 통한 3D SLAM 지도 맵 자율 주행</td>
                  </tr>
                  <tr>
                    <td><strong>장애물 조우 시</strong></td>
                    <td>경로 위 장애물 감지 시 충돌 방지를 위해 즉시 정지</td>
                    <td>장애물을 스스로 감지하고 측면으로 우회하여 자율 이동</td>
                  </tr>
                  <tr>
                    <td><strong>주요 적용 공정</strong></td>
                    <td>반복적이고 자재가 무거운 메인 조립 컨베이어 이송</td>
                    <td>조립 셀 간의 경량 자재 공급 및 고도 가변적 물류</td>
                  </tr>
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      <style>{`
        .fms-dashboard-container {
          display: flex;
          flex-direction: column;
          gap: 1.5rem;
          width: 100%;
          animation: fadeIn 0.8s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }

        .fms-telemetry-grid {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 1.25rem;
        }

        @media (max-width: 1024px) {
          .fms-telemetry-grid {
            grid-template-columns: repeat(2, 1fr);
          }
        }

        @media (max-width: 640px) {
          .fms-telemetry-grid {
            grid-template-columns: 1fr;
          }
        }

        .fms-kpi-card {
          padding: 1.25rem;
          display: flex;
          flex-direction: column;
          gap: 0.5rem;
        }

        .fms-center-grid {
          display: grid;
          grid-template-columns: 1.2fr 0.8fr;
          gap: 1.5rem;
        }

        @media (max-width: 1100px) {
          .fms-center-grid {
            grid-template-columns: 1fr;
          }
        }

        .fms-canvas-panel, .agv-list-panel {
          padding: 1.5rem;
          display: flex;
          flex-direction: column;
          gap: 1.25rem;
          height: 400px;
        }

        .fms-canvas-wrapper {
          flex: 1;
          background: rgba(4, 6, 14, 0.85);
          border-radius: 12px;
          border: 1px solid rgba(255, 255, 255, 0.05);
          box-shadow: inset 0 4px 24px rgba(0, 0, 0, 0.9);
          overflow: hidden;
          position: relative;
        }

        .fms-canvas {
          width: 100%;
          height: 100%;
          display: block;
        }

        .agv-cards-scroll {
          flex: 1;
          display: flex;
          flex-direction: column;
          gap: 0.65rem;
          overflow-y: auto;
          padding-right: 0.25rem;
        }

        .agv-card-item {
          background: rgba(255, 255, 255, 0.02);
          border: 1px solid rgba(255, 255, 255, 0.04);
          border-radius: 8px;
          padding: 0.75rem 1rem;
          display: flex;
          flex-direction: column;
          gap: 0.5rem;
          transition: all 0.2s;
        }

        .agv-card-item:hover {
          background: rgba(6, 182, 212, 0.03);
          border-color: rgba(6, 182, 212, 0.15);
        }

        .agv-card-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          border-bottom: 1px solid rgba(255, 255, 255, 0.03);
          padding-bottom: 0.35rem;
        }

        .agv-id-badge {
          font-weight: 800;
          color: #ffffff;
          font-size: 0.78rem;
        }

        .agv-type-badge {
          font-size: 0.62rem;
          color: #06b6d4;
          background: rgba(6, 182, 212, 0.1);
          border: 1px solid rgba(6, 182, 212, 0.2);
          padding: 1px 4px;
          border-radius: 3px;
          font-weight: 700;
        }

        .agv-status-badge {
          font-size: 0.65rem;
          font-weight: 800;
          padding: 1.5px 5px;
          border-radius: 4px;
          letter-spacing: 0.3px;
        }

        .agv-status-badge.status-running {
          background: rgba(6, 182, 212, 0.12);
          color: #06b6d4;
          border: 1px solid rgba(6, 182, 212, 0.25);
        }

        .agv-status-badge.status-standby {
          background: rgba(148, 163, 184, 0.12);
          color: #94a3b8;
          border: 1px solid rgba(148, 163, 184, 0.25);
        }

        .agv-status-badge.status-charging {
          background: rgba(16, 185, 129, 0.12);
          color: #10b981;
          border: 1px solid rgba(16, 185, 129, 0.25);
        }

        .agv-status-badge.status-blocked {
          background: rgba(239, 68, 68, 0.12);
          color: #ef4444;
          border: 1px solid rgba(239, 68, 68, 0.25);
        }

        .agv-card-body {
          display: flex;
          flex-direction: column;
          gap: 0.25rem;
          font-size: 0.72rem;
        }

        .agv-metric-row {
          display: flex;
          justify-content: space-between;
          color: var(--text-muted);
        }

        .agv-card-footer {
          display: flex;
          justify-content: space-between;
          border-top: 1px solid rgba(255, 255, 255, 0.03);
          padding-top: 0.35rem;
          margin-top: 0.25rem;
          color: var(--text-secondary);
        }

        .footer-metric {
          display: flex;
          align-items: center;
        }

        .fms-bottom-panel {
          padding: 1.25rem;
          display: flex;
          flex-direction: column;
          gap: 1rem;
          height: 330px;
        }

        .fms-table-wrapper {
          flex: 1;
          overflow-y: auto;
          border: 1px solid rgba(255, 255, 255, 0.04);
          border-radius: 8px;
          background: rgba(4, 6, 14, 0.5);
        }

        .fms-table {
          width: 100%;
          border-collapse: collapse;
          text-align: left;
          font-size: 0.72rem;
        }

        .fms-table th, .fms-table td {
          padding: 0.6rem 0.8rem;
          border-bottom: 1px solid rgba(255, 255, 255, 0.03);
        }

        .fms-table th {
          background: rgba(13, 20, 38, 0.75);
          color: var(--text-secondary);
          font-weight: 600;
          font-size: 0.7rem;
          letter-spacing: 0.5px;
          text-transform: uppercase;
        }

        .fms-table tr:hover {
          background: rgba(255, 255, 255, 0.015);
        }

        .fms-table .msn-id {
          color: #06b6d4;
          font-weight: 700;
        }

        .priority-badge {
          font-size: 0.6rem;
          font-weight: 800;
          padding: 1.5px 4px;
          border-radius: 3px;
        }

        .priority-badge.high {
          background: rgba(239, 68, 68, 0.15);
          color: #ef4444;
          border: 1px solid rgba(239, 68, 68, 0.3);
        }

        .priority-badge.medium {
          background: rgba(245, 158, 11, 0.15);
          color: #f59e0b;
          border: 1px solid rgba(245, 158, 11, 0.3);
        }

        .priority-badge.low {
          background: rgba(56, 189, 248, 0.15);
          color: #38bdf8;
          border: 1px solid rgba(56, 189, 248, 0.3);
        }

        .status-badge {
          font-size: 0.62rem;
          font-weight: 700;
          padding: 1.5px 4px;
          border-radius: 3px;
        }

        .status-badge.queued {
          background: rgba(148, 163, 184, 0.15);
          color: #94a3b8;
        }

        .status-badge.assigned {
          background: rgba(168, 85, 247, 0.15);
          color: #a855f7;
        }

        .status-badge.transferring {
          background: rgba(6, 182, 212, 0.15);
          color: #06b6d4;
        }

        .status-badge.completed {
          background: rgba(16, 185, 129, 0.15);
          color: #10b981;
        }

        .fms-explain-panel {
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
          background: rgba(6, 182, 212, 0.05);
          color: var(--text-primary);
          border-color: rgba(6, 182, 212, 0.25);
        }

        .explain-tab.active {
          background: rgba(6, 182, 212, 0.12);
          color: #06b6d4;
          border-color: rgba(6, 182, 212, 0.4);
          font-weight: 600;
          box-shadow: 0 0 10px rgba(6, 182, 212, 0.15);
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

        .explain-table {
          width: 100%;
          border-collapse: collapse;
          margin-top: 0.75rem;
          font-size: 0.78rem;
          text-align: left;
        }

        .explain-table th, .explain-table td {
          padding: 0.5rem 0.75rem;
          border: 1px solid rgba(255,255,255,0.05);
        }

        .explain-table th {
          background: rgba(255,255,255,0.02);
          color: #ffffff;
        }
      `}</style>
    </div>
  );
};
