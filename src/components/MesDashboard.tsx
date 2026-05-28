import React, { useEffect, useRef, useState } from 'react';
import { 
  Database, Server, Play, Pause, ClipboardList, 
  Layers, CheckCircle2, TrendingUp, Info, ArrowRightLeft
} from 'lucide-react';

interface EaiLog {
  ifId: string;
  interfaceName: string;
  middleware: 'ActiveMQ' | 'SAP PO' | 'Oracle ESB';
  payload: string;
  status: 'SUCCESS' | 'WARNING';
  timestamp: string;
}

interface MesOrder {
  orderId: string;
  carType: string;
  color: string;
  wheel: string;
  sunroof: boolean;
  status: 'Pending' | 'WIP' | 'Completed';
  progress: number; // 0 to 100
}

interface TraceLog {
  vin: string;
  stage: string;
  parameter: string;
  value: string;
  status: 'OK' | 'NG';
  timestamp: string;
}

export const MesDashboard: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isRunning, setIsRunning] = useState(true);
  const [uphRate, setUphRate] = useState(42.5); // Units Per Hour
  const [yieldRate, setYieldRate] = useState(98.8); // Yield %
  const [wipCount] = useState(14); // Work-In-Progress items
  const [totalCompleted, setTotalCompleted] = useState(384);
  const [activeLearnTab, setActiveLearnTab] = useState<'intro' | 'flows' | 'eai' | 'trace' | 'matching'>('intro');

  // Real-time EAI Interface Log State
  const [eaiLogs, setEaiLogs] = useState<EaiLog[]>([
    { ifId: 'IF_ERP_MES_091', interfaceName: 'PROD_ORDER_RCV', middleware: 'SAP PO', payload: '{"vin":"VIN-8012A","model":"Genesis GV80","color":"Carbon Grey"}', status: 'SUCCESS', timestamp: '21:30:15' },
    { ifId: 'IF_ERP_MES_091', interfaceName: 'PROD_ORDER_RCV', middleware: 'SAP PO', payload: '{"vin":"VIN-8013B","model":"EV9 Grand","color":"Pearl White"}', status: 'SUCCESS', timestamp: '21:28:42' },
    { ifId: 'IF_ERP_MES_091', interfaceName: 'PROD_ORDER_RCV', middleware: 'SAP PO', payload: '{"vin":"VIN-8014C","model":"K8 Hybrid","color":"Gravity Blue"}', status: 'SUCCESS', timestamp: '21:25:10' }
  ]);

  // Real-time dynamic MES Order Queue
  const [orders, setOrders] = useState<MesOrder[]>([
    { orderId: 'ORD-2026-091', carType: 'EV9 Grand', color: 'Aurora Black', wheel: '21" Alloy', sunroof: true, status: 'WIP', progress: 65 },
    { orderId: 'ORD-2026-092', carType: 'Genesis GV80', color: 'Snow White', wheel: '20" Chrome', sunroof: true, status: 'WIP', progress: 15 },
    { orderId: 'ORD-2026-093', carType: 'K8 Hybrid', color: 'Interstellar Gray', wheel: '19" Alloy', sunroof: false, status: 'Pending', progress: 0 },
    { orderId: 'ORD-2026-094', carType: 'EV6 GT Line', color: 'Runway Red', wheel: '20" Carbon', sunroof: true, status: 'Pending', progress: 0 },
    { orderId: 'ORD-2026-095', carType: 'Genesis G90', color: 'Tasman Blue', wheel: '20" Chrome', sunroof: false, status: 'Pending', progress: 0 },
    { orderId: 'ORD-2026-090', carType: 'EV6 GT Line', color: 'Snow White', wheel: '19" Alloy', sunroof: true, status: 'Completed', progress: 100 }
  ]);

  // Traceability Database real-time logs
  const [traceDb, setTraceDb] = useState<TraceLog[]>([
    { vin: 'VIN-9XF2388A1', stage: 'Chassis Marriage', parameter: 'Bolt #3 Torque', value: '145.2 Nm', status: 'OK', timestamp: '21:14:22' },
    { vin: 'VIN-9XF2388A1', stage: 'Fluid Fill', parameter: 'Coolant Volume', value: '6.45 Liters', status: 'OK', timestamp: '21:13:05' },
    { vin: 'VIN-7YC1129B2', stage: 'QA Inspection', parameter: 'Vision Seal Gap', value: '0.45 mm', status: 'OK', timestamp: '21:11:45' },
    { vin: 'VIN-7YC1129B2', stage: 'Exterior Glass', parameter: 'Adhesive Pressure', value: '5.2 bar', status: 'OK', timestamp: '21:09:50' },
    { vin: 'VIN-4HD0021D8', stage: 'Interior Trim', parameter: 'Harness Continuity', value: '0.02 Ohm', status: 'OK', timestamp: '21:07:12' }
  ]);

  // Trigger real-time order scheduling and DB log injection
  useEffect(() => {
    if (!isRunning) return;

    const interval = setInterval(() => {
      // Fluctuate production metrics slightly
      setUphRate(prev => +(prev + (Math.random() * 0.8 - 0.4)).toFixed(1));
      setYieldRate(+(98.5 + Math.random() * 0.5).toFixed(2));

      // Advance progress of the orders currently in WIP
      setOrders(prevOrders => {
        let orderFinished = false;
        let finishedIndex = -1;

        const updated = prevOrders.map((ord, idx) => {
          if (ord.status === 'WIP') {
            const nextProgress = ord.progress + Math.floor(Math.random() * 8 + 4);
            if (nextProgress >= 100) {
              orderFinished = true;
              finishedIndex = idx;
              return { ...ord, status: 'Completed' as const, progress: 100 };
            }
            return { ...ord, progress: nextProgress };
          }
          return ord;
        });

        // If an order finished, shift queues!
        if (orderFinished && finishedIndex !== -1) {
          const finishedOrder = updated[finishedIndex];
          setTotalCompleted(c => c + 1);

          // Add a brand new pending order to keep queue alive
          const carTypes = ['EV9 Grand', 'Genesis GV80', 'K8 Hybrid', 'EV6 GT Line', 'Genesis G90'];
          const colors = ['Aurora Black', 'Snow White', 'Interstellar Gray', 'Runway Red', 'Tasman Blue'];
          const wheels = ['19" Alloy', '20" Chrome', '20" Carbon', '21" Alloy'];
          const newIdNum = 100 + Math.floor(Math.random() * 900);
          
          const newOrder: MesOrder = {
            orderId: `ORD-2026-${newIdNum}`,
            carType: carTypes[Math.floor(Math.random() * carTypes.length)],
            color: colors[Math.floor(Math.random() * colors.length)],
            wheel: wheels[Math.floor(Math.random() * wheels.length)],
            sunroof: Math.random() > 0.4,
            status: 'Pending',
            progress: 0
          };

          // Filter out the completed ones if there are too many and insert the new one
          const filtered = updated.filter(o => o.orderId !== finishedOrder.orderId);
          
          // Move one Pending to WIP to keep production line occupied
          let wipsCount = filtered.filter(o => o.status === 'WIP').length;
          const nextWithWip = filtered.map(o => {
            if (o.status === 'Pending' && wipsCount < 2) {
              wipsCount++;
              return { ...o, status: 'WIP' as const, progress: 5 };
            }
            return o;
          });

          // Insert finished order at the very bottom as history record
          // Insert new pending order at the top of pending
          return [newOrder, ...nextWithWip.filter(o => o.status !== 'Completed'), { ...finishedOrder, status: 'Completed' as const }];
        }

        return updated;
      });

      // Inject a new Traceability Database log occasionally
      if (Math.random() < 0.4) {
        const stages = ['Chassis Marriage', 'Interior Trim', 'Exterior Glassing', 'QA Inspection', 'Fluid Fill'];
        const params = {
          'Chassis Marriage': ['Bolt #1 Torque', 'Bolt #2 Torque', 'Carrier Docking Height'],
          'Interior Trim': ['Harness Continuity', 'Dash Panel Align', 'Seat Fix Torque'],
          'Exterior Glassing': ['Adhesive Pressure', 'Suction Seal Integrity', 'Primer Viscosity'],
          'QA Inspection': ['Vision Seal Gap', 'Lidar Arch Clearance', 'Paint Thickness'],
          'Fluid Fill': ['Coolant Volume', 'Brake Fluid Density', 'Fuel Line Pressure']
        };

        const randomStage = stages[Math.floor(Math.random() * stages.length)];
        const randomParam = params[randomStage as keyof typeof params][Math.floor(Math.random() * 3)];
        
        // Generate torque or measurement values
        let val = '';
        let isNg = false;
        if (randomParam.includes('Torque')) {
          const torque = (135 + Math.random() * 20).toFixed(1);
          val = `${torque} Nm`;
          isNg = parseFloat(torque) < 138 || parseFloat(torque) > 153;
        } else if (randomParam.includes('Volume') || randomParam.includes('Liters')) {
          val = `${(6.0 + Math.random() * 0.8).toFixed(2)} Liters`;
        } else if (randomParam.includes('Pressure') || randomParam.includes('bar')) {
          val = `${(5.0 + Math.random() * 0.5).toFixed(1)} bar`;
        } else if (randomParam.includes('Gap') || randomParam.includes('mm') || randomParam.includes('Thickness')) {
          const gap = (0.3 + Math.random() * 0.3).toFixed(2);
          val = `${gap} mm`;
          isNg = parseFloat(gap) > 0.55;
        } else {
          val = Math.random() > 0.05 ? '0.01 Ohm' : '0.15 Ohm';
          isNg = val === '0.15 Ohm';
        }

        const now = new Date();
        const timeStr = `${now.getHours().toString().padStart(2,'0')}:${now.getMinutes().toString().padStart(2,'0')}:${now.getSeconds().toString().padStart(2,'0')}`;
        
        const newVinNum = 1000 + Math.floor(Math.random() * 8999);
        const newLog: TraceLog = {
          vin: `VIN-${newVinNum}XF7B`,
          stage: randomStage,
          parameter: randomParam,
          value: val,
          status: isNg ? 'NG' : 'OK',
          timestamp: timeStr
        };

        setTraceDb(prev => [newLog, ...prev.slice(0, 7)]);
      }

      // Inject a new EAI Interface log
      if (Math.random() < 0.5) {
        const carModels = ['EV9 Grand', 'Genesis GV80', 'K8 Hybrid', 'EV6 GT Line', 'Genesis G90'];
        const selectedModel = carModels[Math.floor(Math.random() * carModels.length)];
        const colorsList = ['Carbon Grey', 'Pearl White', 'Gravity Blue', 'Aurora Black', 'Sunset Red'];
        const selectedColor = colorsList[Math.floor(Math.random() * colorsList.length)];
        
        const now = new Date();
        const timeStr = `${now.getHours().toString().padStart(2,'0')}:${now.getMinutes().toString().padStart(2,'0')}:${now.getSeconds().toString().padStart(2,'0')}`;
        
        const randIdNum = 1000 + Math.floor(Math.random() * 8999);
        const ifIdNum = 100 + Math.floor(Math.random() * 900);
        
        const newEaiLog: EaiLog = {
          ifId: `IF_ERP_MES_${ifIdNum}`,
          interfaceName: 'PROD_ORDER_RCV',
          middleware: 'SAP PO',
          payload: `{"vin":"VIN-${randIdNum}X","model":"${selectedModel}","color":"${selectedColor}"}`,
          status: 'SUCCESS',
          timestamp: timeStr
        };

        setEaiLogs(prev => [newEaiLog, ...prev.slice(0, 4)]);
      }

    }, 3500);

    return () => clearInterval(interval);
  }, [isRunning, totalCompleted]);

  // Canvas MES Data Flow and Cyber Factory Mimic
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

    // Node connections for fiber data pathways
    interface NodePoint {
      x: number;
      y: number;
      label: string;
      iconType: 'erp' | 'eai' | 'mes' | 'assembly' | 'qa' | 'storage' | 'db';
    }

    const nodes: Record<string, NodePoint> = {
      erp: { x: 60, y: 70, label: 'ERP 오더 계획', iconType: 'erp' },
      eai: { x: 200, y: 70, label: 'EAI 연동 버스', iconType: 'eai' },
      mes: { x: 340, y: 160, label: 'MES 생산 서버', iconType: 'mes' },
      assembly: { x: 100, y: 280, label: '의장 조립 (Trim Assembly)', iconType: 'assembly' },
      qa: { x: 300, y: 280, label: '품질 비전 (QA Inspection)', iconType: 'qa' },
      storage: { x: 500, y: 280, label: '자동 창고 (WIP Storage)', iconType: 'storage' },
      db: { x: 520, y: 70, label: '추적성 DB (Trace DB)', iconType: 'db' }
    };

    // Data packets flowing on the connections
    interface Packet {
      from: keyof typeof nodes;
      to: keyof typeof nodes;
      progress: number; // 0 to 1
      speed: number;
      color: string;
      size: number;
    }

    const packets: Packet[] = [];

    // Periodic packet generator
    let packetTimer = 0;

    // Helper for rendering futuristic server racks
    const drawServerRack = (ctx: CanvasRenderingContext2D, sx: number, sy: number, label: string, color: string) => {
      ctx.save();
      ctx.translate(sx, sy);

      // Server casing
      ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
      ctx.strokeStyle = color;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.roundRect(-40, -30, 80, 60, 8);
      ctx.fill();
      ctx.stroke();

      // Draw slots
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
      ctx.lineWidth = 1.5;
      for (let i = 0; i < 4; i++) {
        const sySlot = -20 + i * 13;
        ctx.beginPath();
        ctx.rect(-34, sySlot, 68, 8);
        ctx.fillStyle = 'rgba(7, 10, 19, 0.7)';
        ctx.fill();
        ctx.stroke();

        // Led indicators on server slots
        ctx.fillStyle = (Date.now() % 800 > i * 150) ? color : '#334155';
        ctx.beginPath();
        ctx.arc(-26, sySlot + 4, 2, 0, Math.PI*2);
        ctx.fill();

        ctx.fillStyle = (Date.now() % 600 > i * 100) ? 'rgba(16,185,129,0.7)' : '#334155';
        ctx.beginPath();
        ctx.arc(-20, sySlot + 4, 2, 0, Math.PI*2);
        ctx.fill();
      }

      // Label text
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 9px Outfit';
      ctx.textAlign = 'center';
      ctx.fillText(label, 0, 42);

      ctx.restore();
    };

    // Helper for rendering shop floor active stations
    const drawStationNode = (ctx: CanvasRenderingContext2D, sx: number, sy: number, label: string, activeColor: string, type: string) => {
      ctx.save();
      ctx.translate(sx, sy);

      // Foundation outline
      ctx.fillStyle = 'rgba(15, 23, 42, 0.8)';
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.roundRect(-45, -25, 90, 50, 6);
      ctx.fill();
      ctx.stroke();

      // Custom inside icons per type
      if (type === 'assembly') {
        // Tiny conveyor & arm outline
        ctx.strokeStyle = '#475569';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(-30, 10);
        ctx.lineTo(30, 10);
        ctx.stroke();

        // Tiny robotic arm
        const rot = Math.sin(Date.now() * 0.002) * 0.3;
        ctx.save();
        ctx.translate(-5, 8);
        ctx.rotate(rot - Math.PI/3);
        ctx.strokeStyle = activeColor;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(0, -15);
        ctx.lineTo(10, -15);
        ctx.stroke();
        ctx.restore();
      } else if (type === 'qa') {
        // Vision scanner dome with vertical scanning laser beam!
        ctx.fillStyle = 'rgba(56, 189, 248, 0.08)';
        ctx.beginPath();
        ctx.moveTo(-15, 15);
        ctx.lineTo(15, 15);
        ctx.lineTo(0, -15);
        ctx.closePath();
        ctx.fill();

        // Laser beam scanner top
        ctx.fillStyle = activeColor;
        ctx.beginPath();
        ctx.arc(0, -12, 4, 0, Math.PI*2);
        ctx.fill();

        // Scanning beam pulse
        ctx.strokeStyle = (Date.now() % 500 > 250) ? activeColor : 'transparent';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(0, -12);
        ctx.lineTo(-12, 14);
        ctx.moveTo(0, -12);
        ctx.lineTo(12, 14);
        ctx.stroke();
      } else if (type === 'storage') {
        // Draw storage rack matrix
        ctx.fillStyle = '#334155';
        for (let r = 0; r < 3; r++) {
          for (let c = 0; c < 3; c++) {
            ctx.beginPath();
            ctx.roundRect(-22 + c * 15, -16 + r * 11, 10, 7, 1);
            ctx.fillStyle = (r+c) % 2 === (Math.floor(Date.now() / 2000) % 2) ? activeColor : 'rgba(255,255,255,0.05)';
            ctx.fill();
          }
        }
      }

      // Title
      ctx.fillStyle = 'var(--text-secondary)';
      ctx.font = 'bold 8.5px Outfit';
      ctx.textAlign = 'center';
      ctx.fillText(label, 0, 38);

      ctx.restore();
    };

    // Draw fiber line connections
    const drawPathway = (ctx: CanvasRenderingContext2D, from: NodePoint, to: NodePoint, active: boolean) => {
      ctx.save();
      ctx.strokeStyle = active ? 'rgba(251, 191, 36, 0.15)' : 'rgba(255, 255, 255, 0.03)';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(from.x, from.y);
      // Nice orthogonal bent lines for tech circuitry look!
      const midY = (from.y + to.y) / 2;
      ctx.lineTo(from.x, midY);
      ctx.lineTo(to.x, midY);
      ctx.lineTo(to.x, to.y);
      ctx.stroke();
      ctx.restore();
    };

    // Draw single packet travel
    const drawPacket = (ctx: CanvasRenderingContext2D, from: NodePoint, to: NodePoint, progress: number, size: number, color: string) => {
      ctx.save();
      const midY = (from.y + to.y) / 2;
      let px = 0;
      let py = 0;

      // Compute coordinate along orthogonal path
      // 0.0 to 0.33: vertical 1
      // 0.33 to 0.66: horizontal
      // 0.66 to 1.0: vertical 2
      if (progress < 0.33) {
        const factor = progress / 0.33;
        px = from.x;
        py = from.y + (midY - from.y) * factor;
      } else if (progress < 0.66) {
        const factor = (progress - 0.33) / 0.33;
        px = from.x + (to.x - from.x) * factor;
        py = midY;
      } else {
        const factor = (progress - 0.66) / 0.34;
        px = to.x;
        py = midY + (to.y - midY) * factor;
      }

      // Packet body with bright neon glow
      ctx.fillStyle = color;
      ctx.shadowBlur = 8;
      ctx.shadowColor = color;
      ctx.beginPath();
      ctx.arc(px, py, size, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    };

    // Main animation loop
    const render = () => {
      ctx.clearRect(0, 0, width, height);

      // Grid background
      ctx.strokeStyle = 'rgba(251, 191, 36, 0.015)';
      ctx.lineWidth = 1;
      const step = 40;
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

      // Draw all pathways between nodes
      drawPathway(ctx, nodes.erp, nodes.eai, isRunning);
      drawPathway(ctx, nodes.eai, nodes.mes, isRunning);
      drawPathway(ctx, nodes.mes, nodes.assembly, isRunning);
      drawPathway(ctx, nodes.mes, nodes.qa, isRunning);
      drawPathway(ctx, nodes.mes, nodes.storage, isRunning);
      drawPathway(ctx, nodes.assembly, nodes.db, isRunning);
      drawPathway(ctx, nodes.qa, nodes.db, isRunning);
      drawPathway(ctx, nodes.storage, nodes.db, isRunning);

      // Generate dynamic database / work order packets
      if (isRunning) {
        packetTimer++;
        if (packetTimer % 45 === 0) {
          // 1. ERP order dispatching to EAI Router
          packets.push({ from: 'erp', to: 'eai', progress: 0, speed: 0.012, color: '#38bdf8', size: 3.5 });
          
          // 2. EAI delivering to MES Core
          setTimeout(() => {
            if (!isRunning) return;
            packets.push({ from: 'eai', to: 'mes', progress: 0, speed: 0.012, color: '#ec4899', size: 3.5 });
          }, 800);

          // 3. MES sending dispatching instructions to shop floor nodes
          setTimeout(() => {
            if (!isRunning) return;
            packets.push({ from: 'mes', to: 'assembly', progress: 0, speed: 0.007, color: '#fbbf24', size: 3 });
            packets.push({ from: 'mes', to: 'qa', progress: 0, speed: 0.006, color: '#a855f7', size: 3 });
            packets.push({ from: 'mes', to: 'storage', progress: 0, speed: 0.007, color: '#10b981', size: 3 });
          }, 2000);

          // 4. Shop floor nodes sending traceability data up to DB
          setTimeout(() => {
            if (!isRunning) return;
            packets.push({ from: 'assembly', to: 'db', progress: 0, speed: 0.005, color: '#f8fafc', size: 2.5 });
            packets.push({ from: 'qa', to: 'db', progress: 0, speed: 0.006, color: '#fbbf24', size: 2.5 });
          }, 3800);
        }
      }

      // Update and draw packets
      packets.forEach(p => {
        if (isRunning) {
          p.progress += p.speed;
        }
        drawPacket(ctx, nodes[p.from], nodes[p.to], Math.min(1.0, p.progress), p.size, p.color);
      });

      // Filter out completed packets
      for (let i = packets.length - 1; i >= 0; i--) {
        if (packets[i].progress >= 1.0) {
          packets.splice(i, 1);
        }
      }

      // Draw Node Units
      // ERP 오더 클라이언트 노드 (Flat client layout)
      ctx.save();
      ctx.translate(nodes.erp.x, nodes.erp.y);
      ctx.fillStyle = 'rgba(15, 23, 42, 0.8)';
      ctx.strokeStyle = 'rgba(56, 189, 248, 0.3)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.roundRect(-40, -20, 80, 40, 5);
      ctx.fill();
      ctx.stroke();

      // Screen lines
      ctx.fillStyle = '#38bdf8';
      ctx.beginPath();
      ctx.rect(-30, -10, 15, 3);
      ctx.rect(-30, -2, 40, 2);
      ctx.rect(-30, 4, 30, 2);
      ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 8.5px Outfit';
      ctx.textAlign = 'center';
      ctx.fillText(nodes.erp.label, 0, 32);
      ctx.restore();

      // EAI Middleware Node (Pink gradient router visual)
      if (nodes.eai) {
        ctx.save();
        ctx.translate(nodes.eai.x, nodes.eai.y);
        ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
        ctx.strokeStyle = '#ec4899';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.roundRect(-30, -20, 60, 40, 5);
        ctx.fill();
        ctx.stroke();

        // Pulsing ports
        ctx.fillStyle = (Date.now() % 600 > 300) ? '#ec4899' : '#334155';
        ctx.beginPath();
        ctx.arc(-10, 0, 3.5, 0, Math.PI * 2);
        ctx.arc(10, 0, 3.5, 0, Math.PI * 2);
        ctx.fill();

        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(-6, 0);
        ctx.lineTo(6, 0);
        ctx.stroke();

        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 8px Outfit';
        ctx.textAlign = 'center';
        ctx.fillText(nodes.eai.label, 0, 32);
        ctx.restore();
      }

      // MES Core Server Racks
      drawServerRack(ctx, nodes.mes.x, nodes.mes.y, nodes.mes.label, '#fbbf24');

      // Shop Floor Automation Nodes
      drawStationNode(ctx, nodes.assembly.x, nodes.assembly.y, nodes.assembly.label, '#f59e0b', 'assembly');
      drawStationNode(ctx, nodes.qa.x, nodes.qa.y, nodes.qa.label, '#38bdf8', 'qa');
      drawStationNode(ctx, nodes.storage.x, nodes.storage.y, nodes.storage.label, '#10b981', 'storage');

      // Database DB (Cylinder database storage visual)
      ctx.save();
      ctx.translate(nodes.db.x, nodes.db.y);
      ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
      ctx.strokeStyle = '#10b981';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.roundRect(-30, -25, 60, 50, 4);
      ctx.fill();
      ctx.stroke();

      // DB disk cylinders lines
      ctx.strokeStyle = 'rgba(16, 185, 129, 0.5)';
      ctx.lineWidth = 1.5;
      for (let i = 0; i < 3; i++) {
        const dy = -15 + i * 14;
        ctx.beginPath();
        ctx.ellipse(0, dy, 22, 5, 0, 0, Math.PI * 2);
        ctx.stroke();

        ctx.fillStyle = (Date.now() % 900 > i * 200) ? '#10b981' : '#334155';
        ctx.beginPath();
        ctx.arc(12, dy + 2, 1.5, 0, Math.PI*2);
        ctx.fill();
      }

      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 8.5px Outfit';
      ctx.textAlign = 'center';
      ctx.fillText(nodes.db.label, 0, 38);
      ctx.restore();

      // Cyber flowchart arrows HUD helper labels
      ctx.fillStyle = 'rgba(251, 191, 36, 0.35)';
      ctx.font = '8px JetBrains Mono';
      ctx.fillText(`ERP TO EAI`, 120, 100);
      ctx.fillText(`EAI TO MES`, 260, 130);
      ctx.fillText(`WIP DISPATCH`, 165, 215);
      ctx.fillText(`DATA CAPTURE`, 390, 215);

      animationFrameId = requestAnimationFrame(render);
    };

    render();

    return () => {
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener('resize', handleResize);
    };
  }, [isRunning]);

  return (
    <div className="mes-dashboard-container">
      {/* Top Level MES Key Performance Indicators */}
      <div className="mes-telemetry-grid">
        <div className="glass-panel mes-kpi-card">
          <div className="kpi-header">
            <TrendingUp size={14} className="text-neon-amber" />
            <span>REAL-TIME THROUGHPUT</span>
          </div>
          <div className="kpi-value text-neon-amber">
            {uphRate} <span className="kpi-unit">UPH</span>
          </div>
          <div className="kpi-desc">대당 목표 타임 (Takt Time): 85초</div>
        </div>

        <div className="glass-panel mes-kpi-card">
          <div className="kpi-header">
            <CheckCircle2 size={14} className="text-neon-green" />
            <span>FIRST PASS YIELD (FPY)</span>
          </div>
          <div className="kpi-value text-neon-green">
            {yieldRate}%
          </div>
          <div className="kpi-desc">직행 합격율 관리 한계선: &gt;98.2%</div>
        </div>

        <div className="glass-panel mes-kpi-card">
          <div className="kpi-header">
            <Layers size={14} className="text-neon-blue" />
            <span>WIP BALANCE RATE</span>
          </div>
          <div className="kpi-value text-neon-blue">
            {wipCount} <span className="kpi-unit">Units</span>
          </div>
          <div className="kpi-desc">공정별 버퍼 점유율: 42% (안정)</div>
        </div>

        <div className="glass-panel mes-kpi-card">
          <div className="kpi-header">
            <ClipboardList size={14} style={{ color: '#ec4899' }} />
            <span>COMPLETED TODAY</span>
          </div>
          <div className="kpi-value" style={{ color: '#ec4899' }}>
            {totalCompleted} <span className="kpi-unit">Cars</span>
          </div>
          <div className="kpi-desc">주간 납품 계획 달성도: 96.5%</div>
        </div>
      </div>

      {/* Main Flow Canvas Visualizer */}
      <div className="glass-panel mes-canvas-panel">
        <div className="mimic-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Server size={18} className="text-neon-amber" />
            <h3>MES LOGICAL DATA-MATERIAL PATHWAY (ERP-MES-SHOP FLOOR 연쇄 동작 시각화)</h3>
          </div>
          <button 
            onClick={() => setIsRunning(!isRunning)} 
            className={`speed-btn ${isRunning ? 'active' : ''}`}
            style={{ fontSize: '0.75rem', padding: '0.3rem 0.6rem', display: 'flex', alignItems: 'center', gap: '4px' }}
          >
            {isRunning ? <Pause size={12} /> : <Play size={12} fill="currentColor" />}
            {isRunning ? '데이터 흐름 정지' : '데이터 흐름 가동'}
          </button>
        </div>

        <div className="mes-canvas-wrapper">
          <canvas ref={canvasRef} className="mes-canvas" />
        </div>
      </div>

      {/* Bottom Dispatching & Database Tracking Grids */}
      <div className="mes-bottom-grid">
        {/* Real-time Order Dispatching Schedule */}
        <div className="glass-panel mes-queue-panel">
          <div className="panel-title" style={{ fontSize: '0.9rem', color: '#fff' }}>
            <ClipboardList size={15} className="text-neon-blue" />
            <span>MES SCHEDULER DISPATCH QUEUE (ERP 수신 오더 실시간 스케줄링)</span>
          </div>
          <div className="mes-order-table-wrapper">
            <table className="mes-order-table font-mono-tech">
              <thead>
                <tr>
                  <th>ORDER ID</th>
                  <th>VEHICLE</th>
                  <th>PAINT COLOR</th>
                  <th>SPECIFICATIONS</th>
                  <th>STATUS</th>
                  <th>PROGRESS</th>
                </tr>
              </thead>
              <tbody>
                {orders.map(ord => (
                  <tr key={ord.orderId} className={ord.status.toLowerCase()}>
                    <td className="order-id">{ord.orderId}</td>
                    <td className="car-type">{ord.carType}</td>
                    <td>
                      <span className="color-badge" style={{ borderColor: ord.color.includes('Black') ? '#334155' : ord.color.includes('Red') ? '#ef4444' : '#94a3b8' }}>
                        {ord.color}
                      </span>
                    </td>
                    <td className="specs">{ord.wheel} / SR:{ord.sunroof ? 'YES' : 'NO'}</td>
                    <td>
                      <span className={`status-badge-val ${ord.status.toLowerCase()}`}>
                        {ord.status}
                      </span>
                    </td>
                    <td>
                      <div className="progress-bar-container">
                        <div 
                          className="progress-bar-fill" 
                          style={{ 
                            width: `${ord.progress}%`,
                            backgroundColor: ord.status === 'Completed' ? '#10b981' : ord.status === 'WIP' ? '#fbbf24' : '#334155'
                          }} 
                        />
                        <span className="progress-percentage">{ord.progress}%</span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Traceability DB Log Table */}
        <div className="glass-panel traceability-db-panel">
          <div className="panel-title" style={{ fontSize: '0.9rem', color: '#fff' }}>
            <Database size={15} className="text-neon-green" />
            <span>TRACEABILITY DATABASE VIEW (추적성 조임 보증/품질 데이터베이스)</span>
          </div>
          <div className="trace-db-wrapper">
            <table className="trace-table font-mono-tech">
              <thead>
                <tr>
                  <th>VIN NO</th>
                  <th>STAGE</th>
                  <th>PARAMETER</th>
                  <th>MEASURED</th>
                  <th>QC</th>
                  <th>TIMESTAMP</th>
                </tr>
              </thead>
              <tbody>
                {traceDb.map((log, idx) => (
                  <tr key={idx} className={log.status.toLowerCase()}>
                    <td className="vin">{log.vin}</td>
                    <td>{log.stage}</td>
                    <td className="param">{log.parameter}</td>
                    <td className="measured-val">{log.value}</td>
                    <td>
                      <span className={`qc-status-badge ${log.status.toLowerCase()}`}>
                        {log.status}
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

      {/* EAI Real-Time Interface Log Panel */}
      <div className="glass-panel eai-log-panel font-mono-tech" style={{ display: 'flex', flexDirection: 'column', gap: '1rem', height: '240px', padding: '1.25rem' }}>
        <div className="panel-title" style={{ fontSize: '0.9rem', color: '#fff', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <ArrowRightLeft size={15} style={{ color: '#ec4899' }} />
          <span>EAI REAL-TIME INTERFACE TRANSMISSION LOG (ERP ➡ EAI ➡ MES 실시간 연동 이력 버스)</span>
        </div>
        <div className="eai-log-table-wrapper" style={{ flex: 1, overflowY: 'auto', border: '1px solid rgba(255, 255, 255, 0.04)', borderRadius: '8px', background: 'rgba(4, 6, 14, 0.5)' }}>
          <table className="eai-table font-mono-tech" style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.72rem' }}>
            <thead>
              <tr style={{ background: 'rgba(13, 20, 38, 0.75)', color: 'var(--text-secondary)' }}>
                <th style={{ padding: '0.6rem 0.8rem', fontWeight: 600, fontSize: '0.7rem', textTransform: 'uppercase' }}>IF ID</th>
                <th style={{ padding: '0.6rem 0.8rem', fontWeight: 600, fontSize: '0.7rem', textTransform: 'uppercase' }}>INTERFACE NAME</th>
                <th style={{ padding: '0.6rem 0.8rem', fontWeight: 600, fontSize: '0.7rem', textTransform: 'uppercase' }}>MIDDLEWARE</th>
                <th style={{ padding: '0.6rem 0.8rem', fontWeight: 600, fontSize: '0.7rem', textTransform: 'uppercase' }}>payload (인터페이스 데이터 전문)</th>
                <th style={{ padding: '0.6rem 0.8rem', fontWeight: 600, fontSize: '0.7rem', textTransform: 'uppercase' }}>STATUS</th>
                <th style={{ padding: '0.6rem 0.8rem', fontWeight: 600, fontSize: '0.7rem', textTransform: 'uppercase' }}>TIMESTAMP</th>
              </tr>
            </thead>
            <tbody>
              {eaiLogs.map((log, idx) => (
                <tr key={idx} style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.03)' }} className="eai-tr-hover">
                  <td style={{ padding: '0.6rem 0.8rem', color: '#ec4899', fontWeight: 700 }}>{log.ifId}</td>
                  <td style={{ padding: '0.6rem 0.8rem', color: '#ffffff', fontWeight: 600 }}>{log.interfaceName}</td>
                  <td style={{ padding: '0.6rem 0.8rem', color: '#94a3b8' }}>{log.middleware}</td>
                  <td style={{ padding: '0.6rem 0.8rem', color: '#fbbf24', fontStyle: 'italic', letterSpacing: '0.2px' }}>{log.payload}</td>
                  <td style={{ padding: '0.6rem 0.8rem' }}>
                    <span className="qc-status-badge ok" style={{ background: 'rgba(16, 185, 129, 0.15)', color: 'var(--color-active-green)' }}>
                      {log.status}
                    </span>
                  </td>
                  <td style={{ padding: '0.6rem 0.8rem', color: 'var(--text-muted)' }}>{log.timestamp}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Interactive Explanation panel for MES */}
      <div className="glass-panel mes-explain-panel">
        <div className="explain-tabs">
          <button 
            className={`explain-tab ${activeLearnTab === 'intro' ? 'active' : ''}`}
            onClick={() => setActiveLearnTab('intro')}
          >
            MES란 무엇인가?
          </button>
          <button 
            className={`explain-tab ${activeLearnTab === 'flows' ? 'active' : ''}`}
            onClick={() => setActiveLearnTab('flows')}
          >
            ERP-MES-PLC 아키텍처
          </button>
          <button 
            className={`explain-tab ${activeLearnTab === 'eai' ? 'active' : ''}`}
            onClick={() => setActiveLearnTab('eai')}
          >
            ERP-EAI-MES 연동 원리
          </button>
          <button 
            className={`explain-tab ${activeLearnTab === 'trace' ? 'active' : ''}`}
            onClick={() => setActiveLearnTab('trace')}
          >
            품질 추적성 (Traceability)
          </button>
          <button 
            className={`explain-tab ${activeLearnTab === 'matching' ? 'active' : ''}`}
            onClick={() => setActiveLearnTab('matching')}
          >
            혼류 생산과 사양 매칭 기법
          </button>
        </div>

        <div className="explain-content font-mono-tech" style={{ fontFamily: 'Outfit', fontSize: '0.88rem' }}>
          {activeLearnTab === 'intro' && (
            <div className="explain-tab-body">
              <h4>
                <Info size={16} className="text-neon-amber inline-icon" />
                MES (Manufacturing Execution System, 제조 실행 시스템)란 무엇인가?
              </h4>
              <p>
                MES는 공장 내 **생산 계획의 수립부터 제품이 완성되어 출하될 때까지의 모든 생산 활동을 실시간으로 감시, 제어, 지시하고 이력을 기록하는 시스템**입니다. 
                경영진이 사용하는 ERP(계획 영역)와 생산 현장의 설비 제어망인 PLC/SCADA(실행 영역) 사이에 위치하여, 공장의 모든 실시간 물리 데이터를 디지털화하는 중요한 허브 역할을 수행합니다.
              </p>
              <p>
                실제 자동차 공장에서 MES가 없다면 오더 생산 순서의 혼선이 빚어져 차체 도색 색상과 장착할 시트 및 전면 도어 사양이 불일치하는 조립 불량이 발생하게 됩니다. 
                MES는 각 차량이 어느 생산 스탠드(Cell)에 진입했는지 실시간으로 파악하여 **"이 차량은 ORD-091이므로, 21인치 휠을 조립하고 오로라 블랙 색상의 문짝을 찾아 장착하라"**고 지시를 정확히 내립니다.
              </p>
            </div>
          )}

          {activeLearnTab === 'eai' && (
            <div className="explain-tab-body">
              <h4>
                <Info size={16} className="text-neon-amber inline-icon" />
                ERP에서 EAI를 거쳐 MES로 이어지는 실시간 데이터 런칭 및 연동 흐름
              </h4>
              <p>
                스마트 팩토리의 생산 시작 신호는 기업 자원 계획 시스템인 <strong>ERP</strong>에서 처음 수립됩니다. 
                고객의 Sales Order를 반영해 ERP가 주간/일간 생산계획(Production Order)을 확정하면, 이 데이터는 MES로 직접 전송되지 않고 <strong>EAI (Enterprise Application Integration, 전사 애플리케이션 통합)</strong> 미들웨어를 거쳐갑니다.
              </p>
              <ul>
                <li><strong>EAI의 역할 (데이터 표준 중계 버스)</strong>: 이기종 플랫폼 간의 프로토콜 변환(SAP RFC ➡ JSON REST API), 이종 시스템 간 데이터 포맷 변환 및 매핑, 그리고 전송 안전을 보장하는 메시지 큐(Message Queue, ActiveMQ/Kafka 등) 처리를 수행합니다.</li>
                <li><strong>MES의 오더 수신 및 WIP 기동 (런칭)</strong>: EAI로부터 생산 오더 전문을 안전하게 전송받은 MES는 <strong>수신된 지시 사양을 공장 현장에 맞게 세부 해체</strong>합니다. (고유 VIN 번호 부여, 도어 사양 매치, 도장 색상 배정). 그 후 물류 Feeder에 자재를 투입하고 컨베이어를 가동함으로써 비로소 <strong>재공(WIP, Work-In-Process) 생산을 공식 기동(WIP Launching)</strong>하게 됩니다.</li>
              </ul>
            </div>
          )}

          {activeLearnTab === 'flows' && (
            <div className="explain-tab-body">
              <h4>스마트 팩토리의 수직 계층도: ERP - MES - PLC/SCADA</h4>
              <p>
                현대 제조업에서는 공장의 운영 체계를 세 단계로 수직 계층화하여 실시간 정보 통합을 이룩합니다.
              </p>
              <ul>
                <li><strong>1계층: ERP (Enterprise Resource Planning, 전사 자원 관리) - '계획(Plan)'</strong>: 일/주/월 단위의 납품 생산 수량 계획을 수립하고 발주 오더를 관리합니다. (비실시간 영역).</li>
                <li><strong>2계층: MES (제조 실행 시스템) - '지시 & 제어(Execution)'</strong>: ERP 계획 오더를 실시간 차량 단위(WIP)로 풀어서 생산 스케줄(Takt Time)을 짜고 설비에 지시를 하달하며 품질 이력을 로깅합니다. (실시간 초/분 단위 영역).</li>
                <li><strong>3계층: PLC / SCADA - '기계 동작(Control)'</strong>: MES의 지시 바이트를 Modbus나 EtherNetIP 등 필드버스망으로 전달받아 실시간 실린더 작동, 모터 컨베이어 구동, 로봇 팔 나사 조임을 실질적으로 가동시킵니다. (밀리초 단위의 초정밀 제어).</li>
              </ul>
            </div>
          )}

          {activeLearnTab === 'trace' && (
            <div className="explain-tab-body">
              <h4>품질 보증의 핵심: 추적성 (Traceability)과 볼트 조임 보증</h4>
              <p>
                <strong>추적성(Traceability)</strong>이란 완성된 자동차의 특정 차량 식별 번호(VIN No)를 조회하면, **해당 차량을 조립할 때 투입된 배터리 셀의 고유 일련번호, 엔진의 제조 국가, 그리고 서스펜션과 엔진 조립 단계에서 조였던 나사의 토크 값**까지 역방향/정방향으로 완벽히 추적해낼 수 있는 이력 관리 시스템입니다.
              </p>
              <p>
                특히 자동차 의장공장의 **Chassis Marriage(샤시 결합)** 단계는 차량의 안전과 직결된 파워트레인을 체결하므로 **조임기(Nutrunner) 토크 값 보증**이 필수적입니다. 
                조임기가 볼트를 조이면 그 즉시 체결 토크 센서 데이터(예: 145.2 Nm)가 MES에 Modbus-TCP로 전송되어, MES 데이터베이스에 저장(OK 판정 시에만 컨베이어 다음 라인 이동 지시)됩니다. 
                이 데이터는 차량 출하 후 10년 이상 보존되어 향후 리콜이나 법적 품질 보증 자료로 활용됩니다.
              </p>
            </div>
          )}

          {activeLearnTab === 'matching' && (
            <div className="explain-tab-body">
              <h4>RFID/Bar-code를 활용한 혼류 생산 매칭 메커니즘</h4>
              <p>
                현대 자동차 의장 라인은 하나의 컨베이어 벨트 라인 위에 세단, SUV, 친환경 전기차가 연달아 꼬리를 물고 지나가는 **혼류 생산(Multi-Model Mix)** 방식으로 돌아갑니다.
              </p>
              <p>
                차량이 각 조립 공정 게이트에 진입할 때마다, 입구에 설치된 **RFID 리더기나 초고속 바코드 스캐너**가 차량 전면에 부착된 식별용 코드를 스캔합니다. 
                스캔된 차량 ID를 인지한 MES는 중앙 DB 서버에서 그 차량의 부품 스펙을 찾아온 뒤, 해당 공정의 제어 PC 및 조립 로봇 PLC(DI/DO 레지스터)로 스펙 지시 코드를 밀어 넣습니다. 
                이와 동시에 서브 자재 라인에서는 **그 차량 전용으로 사양이 맞춤 픽킹된 부품 키팅 카트(Kitting AGV)**가 실시간 매칭되어 차량과 나란히 움직이도록 지시하여, 조립자가 헤매지 않고 정확한 부품을 장착할 수 있도록 합니다.
              </p>
            </div>
          )}
        </div>
      </div>

      <style>{`
        .mes-dashboard-container {
          display: flex;
          flex-direction: column;
          gap: 1.5rem;
          width: 100%;
          animation: fadeIn 0.8s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }

        .mes-telemetry-grid {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 1.25rem;
        }

        @media (max-width: 1024px) {
          .mes-telemetry-grid {
            grid-template-columns: repeat(2, 1fr);
          }
        }

        @media (max-width: 640px) {
          .mes-telemetry-grid {
            grid-template-columns: 1fr;
          }
        }

        .mes-kpi-card {
          padding: 1.25rem;
          display: flex;
          flex-direction: column;
          gap: 0.5rem;
        }

        .kpi-header {
          display: flex;
          align-items: center;
          gap: 0.45rem;
          font-size: 0.75rem;
          font-weight: 700;
          color: var(--text-secondary);
          letter-spacing: 0.05em;
          text-transform: uppercase;
        }

        .kpi-value {
          font-size: 1.8rem;
          font-weight: 800;
          font-family: 'JetBrains Mono', monospace;
        }

        .kpi-unit {
          font-size: 0.9rem;
          color: var(--text-secondary);
          font-weight: 400;
        }

        .kpi-desc {
          font-size: 0.7rem;
          color: var(--text-muted);
          border-top: 1px solid rgba(255,255,255,0.04);
          padding-top: 0.35rem;
          margin-top: 0.25rem;
        }

        .mes-canvas-panel {
          padding: 1.5rem;
          display: flex;
          flex-direction: column;
          gap: 1.25rem;
        }

        .mes-canvas-wrapper {
          width: 100%;
          height: 380px;
          background: rgba(4, 6, 14, 0.85);
          border-radius: 12px;
          border: 1px solid rgba(255, 255, 255, 0.05);
          box-shadow: inset 0 4px 24px rgba(0, 0, 0, 0.9);
          overflow: hidden;
        }

        .mes-canvas {
          width: 100%;
          height: 100%;
          display: block;
        }

        .mes-bottom-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 1.5rem;
        }

        @media (max-width: 1200px) {
          .mes-bottom-grid {
            grid-template-columns: 1fr;
          }
        }

        .mes-queue-panel, .traceability-db-panel {
          padding: 1.25rem;
          display: flex;
          flex-direction: column;
          gap: 1rem;
          height: 350px;
        }

        .mes-order-table-wrapper, .trace-db-wrapper {
          flex: 1;
          overflow-y: auto;
          border: 1px solid rgba(255, 255, 255, 0.04);
          border-radius: 8px;
          background: rgba(4, 6, 14, 0.5);
        }

        .mes-order-table, .trace-table {
          width: 100%;
          border-collapse: collapse;
          text-align: left;
          font-size: 0.72rem;
        }

        .mes-order-table th, .mes-order-table td,
        .trace-table th, .trace-table td {
          padding: 0.6rem 0.8rem;
          border-bottom: 1px solid rgba(255, 255, 255, 0.03);
        }

        .mes-order-table th, .trace-table th {
          background: rgba(13, 20, 38, 0.75);
          color: var(--text-secondary);
          font-weight: 600;
          font-size: 0.7rem;
          letter-spacing: 0.5px;
          text-transform: uppercase;
        }

        .mes-order-table tr:hover, .trace-table tr:hover {
          background: rgba(255, 255, 255, 0.015);
        }

        .mes-order-table .order-id, .trace-table .vin {
          color: var(--color-cyber-blue);
          font-weight: 700;
        }

        .mes-order-table .car-type {
          color: #ffffff;
          font-weight: 600;
        }

        .color-badge {
          border: 1px solid rgba(255,255,255,0.15);
          padding: 1px 5px;
          border-radius: 4px;
          font-size: 0.65rem;
          background: rgba(255,255,255,0.02);
        }

        .status-badge-val {
          font-size: 0.65rem;
          font-weight: 700;
          padding: 1.5px 5px;
          border-radius: 4px;
          letter-spacing: 0.5px;
          text-transform: uppercase;
        }

        .status-badge-val.pending {
          background: rgba(100, 116, 139, 0.15);
          color: var(--text-secondary);
          border: 1px solid rgba(100, 116, 139, 0.3);
        }

        .status-badge-val.wip {
          background: rgba(245, 158, 11, 0.15);
          color: var(--color-warning-amber);
          border: 1px solid rgba(245, 158, 11, 0.3);
        }

        .status-badge-val.completed {
          background: rgba(16, 185, 129, 0.15);
          color: var(--color-active-green);
          border: 1px solid rgba(16, 185, 129, 0.3);
        }

        .progress-bar-container {
          width: 100px;
          height: 10px;
          background: rgba(255,255,255,0.05);
          border-radius: 9999px;
          position: relative;
          overflow: hidden;
          display: inline-flex;
          align-items: center;
        }

        .progress-bar-fill {
          height: 100%;
          border-radius: 9999px;
          transition: width 0.4s ease;
        }

        .progress-percentage {
          position: absolute;
          right: 4px;
          font-size: 0.55rem;
          font-weight: 700;
          color: #ffffff;
        }

        .trace-table .param {
          color: #ffffff;
          font-weight: 500;
        }

        .trace-table .measured-val {
          color: var(--color-cyber-purple);
          font-weight: 600;
        }

        .qc-status-badge {
          font-size: 0.65rem;
          font-weight: 800;
          padding: 1px 5px;
          border-radius: 4px;
        }

        .qc-status-badge.ok {
          background: rgba(16, 185, 129, 0.15);
          color: var(--color-active-green);
        }

        .qc-status-badge.ng {
          background: rgba(239, 68, 68, 0.15);
          color: var(--color-error-crimson);
          animation: pulse-glow 1.5s infinite ease-in-out;
        }

        .trace-table .time-col {
          color: var(--text-muted);
        }

        .mes-explain-panel {
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
          background: rgba(245, 158, 11, 0.05);
          color: var(--text-primary);
          border-color: rgba(245, 158, 11, 0.25);
        }

        .explain-tab.active {
          background: rgba(245, 158, 11, 0.12);
          color: var(--color-warning-amber);
          border-color: rgba(245, 158, 11, 0.4);
          font-weight: 600;
          box-shadow: 0 0 10px rgba(245, 158, 11, 0.15);
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
