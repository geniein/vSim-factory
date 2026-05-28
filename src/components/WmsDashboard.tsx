import React, { useEffect, useRef, useState } from 'react';
import { 
  Package, Activity, Database, Info, Play, Pause, 
  TrendingUp, Settings, ArrowRightLeft
} from 'lucide-react';

interface StockItem {
  partCode: string;
  name: string;
  category: 'BODY' | 'BATTERY' | 'CHASSIS' | 'ELECTRONICS';
  quantity: number;
  safetyStock: number;
  shelfLocation: string;
  status: 'SAFE' | 'REPLENISH';
}

interface WmsTransaction {
  id: string;
  type: 'INBOUND' | 'OUTBOUND';
  partCode: string;
  quantity: number;
  location: string;
  status: 'COMPLETED' | 'WIP' | 'PENDING';
  timestamp: string;
}

export const WmsDashboard: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isRunning, setIsRunning] = useState(true);

  // WMS KPI Telemetry
  const [capacityPercent, setCapacityPercent] = useState(78.4);
  const [inboundToday, setInboundToday] = useState(84);
  const [outboundToday, setOutboundToday] = useState(72);
  const [stockAccuracy] = useState(99.98);

  // Active study tab
  const [activeLearnTab, setActiveLearnTab] = useState<'intro' | 'asrs' | 'fifo' | 'rop'>('intro');

  // Stock Items Master Grid
  const [stockItems, setStockItems] = useState<StockItem[]>([
    { partCode: 'PT-BDY-021', name: 'Steel Side Panel Left', category: 'BODY', quantity: 120, safetyStock: 40, shelfLocation: 'A-02', status: 'SAFE' },
    { partCode: 'PT-BAT-088', name: 'EV Battery Cell Mod 4', category: 'BATTERY', quantity: 18, safetyStock: 25, shelfLocation: 'C-04', status: 'REPLENISH' },
    { partCode: 'PT-CHS-004', name: 'Chassis Axle H-Beam', category: 'CHASSIS', quantity: 45, safetyStock: 15, shelfLocation: 'B-01', status: 'SAFE' },
    { partCode: 'PT-ELC-109', name: 'ADCU Main Brain Core', category: 'ELECTRONICS', quantity: 95, safetyStock: 30, shelfLocation: 'E-03', status: 'SAFE' },
    { partCode: 'PT-BDY-052', name: 'Genesis Front Bonnet', category: 'BODY', quantity: 9, safetyStock: 20, shelfLocation: 'A-05', status: 'REPLENISH' }
  ]);

  // Real-time WMS transactions queue
  const [transactions, setTransactions] = useState<WmsTransaction[]>([
    { id: 'TXN-01048', type: 'OUTBOUND', partCode: 'PT-BDY-021', quantity: 2, location: 'A-02', status: 'COMPLETED', timestamp: '21:30:15' },
    { id: 'TXN-01049', type: 'INBOUND', partCode: 'PT-ELC-109', quantity: 50, location: 'E-03', status: 'COMPLETED', timestamp: '21:31:02' },
    { id: 'TXN-01050', type: 'OUTBOUND', partCode: 'PT-BAT-088', quantity: 1, location: 'C-04', status: 'WIP', timestamp: '21:32:45' },
    { id: 'TXN-01051', type: 'INBOUND', partCode: 'PT-CHS-004', quantity: 10, location: 'B-01', status: 'PENDING', timestamp: '21:33:20' }
  ]);

  // Telemetry fluctuation simulator
  useEffect(() => {
    if (!isRunning) return;

    const interval = setInterval(() => {
      // 1. Transaction additions
      if (Math.random() < 0.45) {
        const types: ('INBOUND'|'OUTBOUND')[] = ['INBOUND', 'OUTBOUND'];
        const selectedType = types[Math.floor(Math.random() * types.length)];
        
        // Pick random item
        const randItem = stockItems[Math.floor(Math.random() * stockItems.length)];
        const qty = Math.floor(Math.random() * 4) + 1;

        const now = new Date();
        const timeStr = `${now.getHours().toString().padStart(2,'0')}:${now.getMinutes().toString().padStart(2,'0')}:${now.getSeconds().toString().padStart(2,'0')}`;
        
        const txnId = 1052 + Math.floor(Math.random() * 900);
        const newTxn: WmsTransaction = {
          id: `TXN-0${txnId}`,
          type: selectedType,
          partCode: randItem.partCode,
          quantity: qty,
          location: randItem.shelfLocation,
          status: Math.random() > 0.3 ? 'COMPLETED' : 'WIP',
          timestamp: timeStr
        };

        // Update Inbound/Outbound counts
        if (selectedType === 'INBOUND') {
          setInboundToday(prev => prev + 1);
          // Increase stock qty
          setStockItems(items => items.map(item => {
            if (item.partCode === randItem.partCode) {
              const newQty = item.quantity + qty;
              return { ...item, quantity: newQty, status: newQty >= item.safetyStock ? 'SAFE' : 'REPLENISH' };
            }
            return item;
          }));
        } else {
          setOutboundToday(prev => prev + 1);
          // Decrease stock qty
          setStockItems(items => items.map(item => {
            if (item.partCode === randItem.partCode) {
              const newQty = Math.max(0, item.quantity - qty);
              return { ...item, quantity: newQty, status: newQty >= item.safetyStock ? 'SAFE' : 'REPLENISH' };
            }
            return item;
          }));
        }

        setTransactions(prev => [newTxn, ...prev.slice(0, 4)]);
      }

      // 2. Capacity fluctuations
      setCapacityPercent(prev => {
        const delta = +(Math.random() * 0.4 - 0.2).toFixed(2);
        return +(Math.max(60, Math.min(95, prev + delta))).toFixed(2);
      });

    }, 3000);

    return () => clearInterval(interval);
  }, [isRunning, stockItems]);

  // AS/RS Automated Warehouse Crane Simulator (Canvas)
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

    // 6x6 Rack coordinates setup
    const cols = 6;
    const rows = 6;
    const rackStartX = 60;
    const rackStartY = 50;
    const slotW = 55;
    const slotH = 40;
    const rackW = cols * slotW;
    const rackH = rows * slotH;

    // Crane kinematics
    let craneX = rackStartX + slotW * 0.5; // Starts at col 0 center
    let craneY = rackStartY + slotH * 5.5; // Starts at bottom row
    let targetX = craneX;
    let targetY = craneY;
    let carryingBoxColor: string | null = null;
    let craneState: 'IDLE' | 'GOING_TO_RETRIEVE' | 'RETRIEVING' | 'GOING_TO_UNLOAD' | 'UNLOADING' = 'IDLE';
    let targetCol = 0;
    let targetRow = 0;
    
    // Virtual stock boxes in rack (seeded statically)
    const rackStockColors: (string | null)[][] = [];
    const colors = ['#f43f5e', '#10b981', '#38bdf8', '#fbbf24', null];
    
    for (let r = 0; r < rows; r++) {
      rackStockColors[r] = [];
      for (let c = 0; c < cols; c++) {
        // Leave E and F bottom mostly empty for retrieve animations
        if (r >= 4 && c >= 4) {
          rackStockColors[r][c] = null;
        } else {
          rackStockColors[r][c] = Math.random() > 0.25 ? colors[Math.floor(Math.random() * (colors.length - 1))] : null;
        }
      }
    }

    let cycleTimer = 0;

    const render = () => {
      ctx.clearRect(0, 0, width, height);
      cycleTimer++;

      // 1. Draw grid background
      ctx.strokeStyle = 'rgba(244, 63, 94, 0.015)';
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

      // 2. Draw Outbound Conveyor belt at the bottom
      ctx.fillStyle = '#1e293b';
      ctx.fillRect(40, 310, 520, 16);
      
      // Moving dashes on belt
      ctx.strokeStyle = '#475569';
      ctx.lineWidth = 3;
      ctx.setLineDash([8, 12]);
      ctx.lineDashOffset = isRunning ? -cycleTimer * 1.0 : 0;
      ctx.beginPath();
      ctx.moveTo(40, 318);
      ctx.lineTo(560, 318);
      ctx.stroke();
      ctx.setLineDash([]); // reset

      // 3. Draw AS/RS Rack Shelf Structures
      ctx.strokeStyle = '#334155';
      ctx.lineWidth = 3;
      ctx.strokeRect(rackStartX, rackStartY, rackW, rackH);

      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          const rx = rackStartX + c * slotW;
          const ry = rackStartY + r * slotH;

          // Draw slot border
          ctx.strokeStyle = '#1e293b';
          ctx.lineWidth = 1.5;
          ctx.strokeRect(rx, ry, slotW, slotH);

          // Draw Box if present
          const boxColor = rackStockColors[r][c];
          if (boxColor) {
            ctx.save();
            ctx.fillStyle = boxColor;
            ctx.strokeStyle = 'rgba(255,255,255,0.15)';
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.roundRect(rx + 8, ry + 8, slotW - 16, slotH - 16, 2);
            ctx.fill();
            ctx.stroke();

            // Box packaging labels
            ctx.fillStyle = 'rgba(255,255,255,0.4)';
            ctx.font = '7px Outfit';
            ctx.textAlign = 'center';
            ctx.fillText('PT', rx + slotW * 0.5, ry + slotH * 0.5 + 2);
            ctx.restore();
          }
          
          // Slot Coordinate Labels (A-1, A-2 etc)
          const rowChar = String.fromCharCode(65 + r);
          ctx.fillStyle = 'rgba(148, 163, 184, 0.25)';
          ctx.font = '6px JetBrains Mono';
          ctx.fillText(`${rowChar}-${c+1}`, rx + 4, ry + 10);
        }
      }

      // 4. AS/RS Crane FSM Logic & Travel Interpolation
      if (isRunning) {
        if (craneState === 'IDLE' && cycleTimer % 180 === 0) {
          // Trigger a new retrieval cycle: choose a non-empty slot
          let found = false;
          let attempt = 0;
          while (!found && attempt < 20) {
            attempt++;
            const tr = Math.floor(Math.random() * rows);
            const tc = Math.floor(Math.random() * cols);
            if (rackStockColors[tr][tc] !== null) {
              targetRow = tr;
              targetCol = tc;
              craneState = 'GOING_TO_RETRIEVE';
              found = true;
            }
          }
        }

        // Kinetic motion towards target
        if (craneState === 'GOING_TO_RETRIEVE') {
          targetX = rackStartX + targetCol * slotW + slotW * 0.5;
          targetY = rackStartY + targetRow * slotH + slotH * 0.5;

          const dx = targetX - craneX;
          const dy = targetY - craneY;
          craneX += Math.sign(dx) * Math.min(Math.abs(dx), 2.5);
          craneY += Math.sign(dy) * Math.min(Math.abs(dy), 2.5);

          // Arrive at retrieval slot
          if (Math.abs(dx) < 1 && Math.abs(dy) < 1) {
            craneX = targetX;
            craneY = targetY;
            craneState = 'RETRIEVING';
          }
        } else if (craneState === 'RETRIEVING') {
          // Extract box (takes 20 frames)
          if (cycleTimer % 20 === 0) {
            carryingBoxColor = rackStockColors[targetRow][targetCol];
            rackStockColors[targetRow][targetCol] = null; // empty rack slot
            craneState = 'GOING_TO_UNLOAD';
          }
        } else if (craneState === 'GOING_TO_UNLOAD') {
          // Unload station is at bottom center (col 3, below rack)
          targetX = rackStartX + 3 * slotW + slotW * 0.5;
          targetY = rackStartY + rackH + 18; // Drop to belt level

          const dx = targetX - craneX;
          const dy = targetY - craneY;
          craneX += Math.sign(dx) * Math.min(Math.abs(dx), 2.5);
          craneY += Math.sign(dy) * Math.min(Math.abs(dy), 2.5);

          if (Math.abs(dx) < 1 && Math.abs(dy) < 1) {
            craneX = targetX;
            craneY = targetY;
            craneState = 'UNLOADING';
          }
        } else if (craneState === 'UNLOADING') {
          // Drop box onto conveyor (takes 20 frames)
          if (cycleTimer % 20 === 0) {
            carryingBoxColor = null; // dropped
            craneState = 'IDLE';

            // Randomly restock retrieved slot later
            const refilledRow = targetRow;
            const refilledCol = targetCol;
            const colorsList = ['#f43f5e', '#10b981', '#38bdf8', '#fbbf24'];
            setTimeout(() => {
              rackStockColors[refilledRow][refilledCol] = colorsList[Math.floor(Math.random() * colorsList.length)];
            }, 5000);
          }
        }
      }

      // 5. Draw Stocker Crane Structure (AS/RS Crane Rail)
      ctx.save();
      // Vertical Column beam
      ctx.strokeStyle = '#475569';
      ctx.lineWidth = 6;
      ctx.beginPath();
      ctx.moveTo(craneX, rackStartY);
      ctx.lineTo(craneX, rackStartY + rackH + 20);
      ctx.stroke();

      // Mechanical guide wire inside column
      ctx.strokeStyle = '#94a3b8';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(craneX, rackStartY);
      ctx.lineTo(craneX, rackStartY + rackH + 20);
      ctx.stroke();

      // Shuttle platform (glowing light at carriage)
      ctx.translate(craneX, craneY);
      ctx.fillStyle = '#f43f5e';
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.roundRect(-15, -6, 30, 12, 3);
      ctx.fill();
      ctx.stroke();

      // Draw box inside shuttle if carrying
      if (carryingBoxColor) {
        ctx.fillStyle = carryingBoxColor;
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.roundRect(-8, -12, 16, 12, 1.5);
        ctx.fill();
        ctx.stroke();
      }

      // Sweeping sensor laser lines (Scanner head on crane)
      if (isRunning && craneState !== 'IDLE') {
        ctx.strokeStyle = 'rgba(244, 63, 94, 0.3)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(-12, 0);
        ctx.lineTo(-30, 0);
        ctx.moveTo(12, 0);
        ctx.lineTo(30, 0);
        ctx.stroke();
      }

      ctx.restore();

      // Technical status box overlay
      ctx.fillStyle = 'rgba(15, 23, 42, 0.7)';
      ctx.strokeStyle = 'rgba(244, 63, 94, 0.2)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.roundRect(15, 15, 180, 24, 6);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = '#f43f5e';
      ctx.font = 'bold 8px Outfit';
      ctx.fillText(`AS/RS SHUTTLE: ${craneState}`, 25, 29);

      animationFrameId = requestAnimationFrame(render);
    };

    render();

    return () => {
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener('resize', handleResize);
    };
  }, [isRunning]);

  return (
    <div className="wms-dashboard-container">
      {/* Top Telemetry Panel */}
      <div className="wms-telemetry-grid">
        <div className="glass-panel wms-kpi-card">
          <div className="kpi-header">
            <Package size={14} className="text-neon-rose" />
            <span>STORAGE CAP (선반 충전율)</span>
          </div>
          <div className="wms-kpi-val text-neon-rose">
            {capacityPercent}% <span className="kpi-unit">Slots</span>
          </div>
          <div className="kpi-desc">재고 슬롯: 392 / 500 사용 중</div>
        </div>

        <div className="glass-panel wms-kpi-card">
          <div className="kpi-header">
            <TrendingUp size={14} className="text-neon-rose" />
            <span>INBOUND DISPATCH</span>
          </div>
          <div className="wms-kpi-val text-neon-rose">
            {inboundToday} <span className="kpi-unit">Parts</span>
          </div>
          <div className="kpi-desc">금일 물품 입고 완료 건수</div>
        </div>

        <div className="glass-panel wms-kpi-card">
          <div className="kpi-header">
            <ArrowRightLeft size={14} style={{ color: '#a855f7' }} />
            <span>OUTBOUND DISPATCH</span>
          </div>
          <div className="wms-kpi-val" style={{ color: '#a855f7' }}>
            {outboundToday} <span className="kpi-unit">Parts</span>
          </div>
          <div className="kpi-desc">MES 생산 지시용 출하 건수</div>
        </div>

        <div className="glass-panel wms-kpi-card">
          <div className="kpi-header">
            <Activity size={14} className="text-neon-green" />
            <span>STOCK ACCURACY</span>
          </div>
          <div className="wms-kpi-val text-neon-green">
            {stockAccuracy}%
          </div>
          <div className="kpi-desc">자동 바코드 렉 대사 오차율 0%</div>
        </div>
      </div>

      {/* Main Grid: AS/RS Crane mimic & Inventory status */}
      <div className="wms-center-grid">
        {/* AS/RS Automation Canvas */}
        <div className="glass-panel wms-canvas-panel">
          <div className="mimic-header">
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Settings size={17} className="text-neon-rose" />
              <h3>AS/RS AUTOMATED STORAGE DIAGNOSTIC (AS/RS 실시간 입출고 적재 맵)</h3>
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
          <div className="wms-canvas-wrapper">
            <canvas ref={canvasRef} className="wms-canvas" />
          </div>
        </div>

        {/* Live Inventory Status Master Grid */}
        <div className="glass-panel wms-list-panel">
          <div className="mimic-header">
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Database size={16} className="text-neon-rose" />
              <h3>INVENTORY STATUS MASTER (부품별 실시간 보관 수량 및 안전 재고)</h3>
            </div>
          </div>
          <div className="stock-cards-scroll font-mono-tech">
            {stockItems.map(item => {
              const isSafe = item.status === 'SAFE';
              return (
                <div key={item.partCode} className="stock-card-item">
                  <div className="stock-card-header">
                    <span className="stock-id-badge">{item.partCode}</span>
                    <span className={`stock-status-badge ${item.status.toLowerCase()}`}>{isSafe ? '재고 충족' : '보충 필요'}</span>
                  </div>

                  <div className="stock-card-body">
                    <div className="stock-name">{item.name}</div>
                    
                    <div className="stock-details">
                      <div className="stock-detail">
                        <span>현재 수량:</span>
                        <strong style={{ color: isSafe ? '#10b981' : '#f43f5e' }}>{item.quantity} Pcs</strong>
                      </div>
                      <div className="stock-detail">
                        <span>안전 재고:</span>
                        <span>{item.safetyStock} Pcs</span>
                      </div>
                      <div className="stock-detail">
                        <span>선반 위치:</span>
                        <strong className="text-white">{item.shelfLocation}</strong>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Bottom Dispatch Transaction Log Table */}
      <div className="glass-panel wms-bottom-panel">
        <div className="panel-title" style={{ fontSize: '0.9rem', color: '#fff' }}>
          <Database size={15} className="text-neon-rose" />
          <span>WMS REAL-TIME IN/OUTBOUND TRANSACTION LOG (실시간 창고 입출고 정보 원격 데이터베이스)</span>
        </div>
        <div className="wms-table-wrapper">
          <table className="wms-table font-mono-tech">
            <thead>
              <tr>
                <th>TRANSACTION ID</th>
                <th>IN/OUTBOUND</th>
                <th>PART CODE</th>
                <th>DISPATCH QTY</th>
                <th>SHELF LOCATION</th>
                <th>TX STATUS</th>
                <th>TIME</th>
              </tr>
            </thead>
            <tbody>
              {transactions.map((tx, idx) => (
                <tr key={idx} className={tx.status.toLowerCase()}>
                  <td className="tx-id">{tx.id}</td>
                  <td>
                    <span className={`txn-badge ${tx.type.toLowerCase()}`}>
                      {tx.type}
                    </span>
                  </td>
                  <td style={{ color: '#ffffff', fontWeight: '600' }}>{tx.partCode}</td>
                  <td>{tx.quantity} Pcs</td>
                  <td style={{ color: '#a855f7', fontWeight: '700' }}>{tx.location}</td>
                  <td>
                    <span className={`tx-status-badge ${tx.status.toLowerCase()}`}>
                      {tx.status}
                    </span>
                  </td>
                  <td style={{ color: '#94a3b8' }}>{tx.timestamp}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* WMS Learn Center */}
      <div className="glass-panel wms-explain-panel">
        <div className="explain-tabs">
          <button 
            className={`explain-tab ${activeLearnTab === 'intro' ? 'active' : ''}`}
            onClick={() => setActiveLearnTab('intro')}
          >
            WMS 란 무엇인가?
          </button>
          <button 
            className={`explain-tab ${activeLearnTab === 'asrs' ? 'active' : ''}`}
            onClick={() => setActiveLearnTab('asrs')}
          >
            자동 창고 시스템 (AS/RS)
          </button>
          <button 
            className={`explain-tab ${activeLearnTab === 'fifo' ? 'active' : ''}`}
            onClick={() => setActiveLearnTab('fifo')}
          >
            선입선출 (FIFO) 및 이력 관리
          </button>
          <button 
            className={`explain-tab ${activeLearnTab === 'rop' ? 'active' : ''}`}
            onClick={() => setActiveLearnTab('rop')}
          >
            재발주점 (ROP) 및 경제적 주문량 (EOQ)
          </button>
        </div>

        <div className="explain-content" style={{ fontSize: '0.88rem', lineHeight: '1.6' }}>
          {activeLearnTab === 'intro' && (
            <div className="explain-tab-body">
              <h4>
                <Info size={16} className="text-neon-rose inline-icon" />
                WMS (Warehouse Management System, 창고 관리 시스템) 란 무엇인가?
              </h4>
              <p>
                WMS는 **공장의 부품 창고 및 제품 보관소에 물품이 반입되는 순간부터 생산 라인으로 출하되거나 최종 납품될 때까지의 전 과정을 총괄하는 디지털 물류 관리 시스템**입니다.
              </p>
              <p>
                제조 공정(MES)에 자재를 투입하고, 군관리 시스템(FMS)에 AGV 미션을 배정하기 위해서는 무엇보다 **정확한 실시간 재고 정보**가 수립되어야 합니다. 
                WMS는 각 부품의 보관 선반 위치, 안전 재고 한도, 유통 기한 등을 DB에 수록하여 수동 장부 매칭 오차를 0%로 통제합니다. 
                부품 재고가 안전 임계선 이하로 내려가면 구매팀에 **"Bonnet 부품의 재고가 9개로 하락했으니 재발주점(ROP) 수량 50개를 추가 주문하라"**는 발주 명령을 송출합니다.
              </p>
            </div>
          )}

          {activeLearnTab === 'asrs' && (
            <div className="explain-tab-body">
              <h4>AS/RS (Automated Storage & Retrieval System, 자동 창고 시스템)의 메커니즘</h4>
              <p>
                **AS/RS (자동 창고 시스템)**는 사람의 개입 없이 컴퓨터의 통제를 받는 크레인 셔틀(Stocker Crane)을 이용하여 물품을 랙(Rack) 선반에 수직으로 입고하고 필요 시 자동으로 컨베이어 벨트로 꺼내오는 하드웨어-소프트웨어 통합 자동 물류 시스템입니다.
              </p>
              <ul>
                <li><strong>수직 공간 극대화</strong>: 좁은 평면 공간 내에 10m~30m 높이의 격자 선반 렉을 짜서 토지 효율성을 300% 이상 증대시킵니다.</li>
                <li><strong>스태커 크레인 주행</strong>: FMS/ACS의 셔틀 주행 명령과 동일하게, X축(가로) 레일 주행과 Y축(세로) 엘리베이터 승하강을 조합하여 임계 노선으로 최단 경로를 탐색해 부품을 입출고합니다. (위의 캔버스 렉 모의 시그널이 AS/RS 크레인의 움직임입니다.)</li>
              </ul>
            </div>
          )}

          {activeLearnTab === 'fifo' && (
            <div className="explain-tab-body">
              <h4>선입선출 (FIFO: First-In, First-Out) 및 Lot 추적 관리</h4>
              <p>
                창고에 입고된 부품은 보관 순서대로 출고되어야 기판의 열화나 녹씸, 품질 변이를 차단할 수 있습니다.
              </p>
              <ul>
                <li><strong>선입선출 (FIFO)</strong>: WMS 스케줄러는 부품 상자가 입고된 시각(Timestamp)을 기준으로 로트(Lot No) 번호를 발행합니다. MES에서 출고 오더를 하달하면, 크레인 셔틀은 렉에 저장된 동일 부품 중 **입고 타임스탬프가 가장 먼저 찍힌 상자 위치**를 역추적하여 최우선으로 꺼내옵니다.</li>
                <li><strong>Lot 추적</strong>: 특정 시기에 조립된 차들에 조향 장치 불량이 발견되었을 때, WMS 로트 데이터베이스를 조회하면 **"해당 장치가 5월 10일 오전에 입고되었던 Lot-A23 부품 렉에서 출고되었다"**를 알아내어, 동일 시기 부품을 전량 추적 리콜(Quality Recall)할 수 있는 안전 이력을 제공합니다.</li>
              </ul>
            </div>
          )}

          {activeLearnTab === 'rop' && (
            <div className="explain-tab-body">
              <h4>수학적 재고 제어: 재발주점 (ROP) 및 경제적 주문량 (EOQ) 산출 공식</h4>
              <p>
                WMS는 재고 부족으로 생산 라인이 멈추는 리스크(Stockout)와, 너무 많은 재고를 쌓아놓아 창고 운영비가 낭비되는 리스크를 방지하기 위해 정교한 재고 수학적 공식들을 활용합니다.
              </p>
              <ul>
                <li><strong>재발주점 (ROP: Reorder Point)</strong>: 재고가 며칠분 남았을 때 발주를 넣어야 하는지 알려주는 지수입니다.
                  <br />
                  `ROP = (일일 자재 수요량 × 조달 기간 Lead Time) + 안전 재고(Safety Stock)`
                </li>
                <li><strong>경제적 주문량 (EOQ: Economic Order Quantity)</strong>: 주문 비용과 재고 유지비의 가중치가 만나는 최적의 1회 주문량을 계산하는 기법입니다.
                  <br />
                  `EOQ = √ (2 × 연간 수요량 × 주문당 고정비 / 개당 연간 재고 유지비)`
                </li>
              </ul>
            </div>
          )}
        </div>
      </div>

      <style>{`
        .wms-dashboard-container {
          display: flex;
          flex-direction: column;
          gap: 1.5rem;
          width: 100%;
          animation: fadeIn 0.8s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }

        .wms-telemetry-grid {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 1.25rem;
        }

        @media (max-width: 1024px) {
          .wms-telemetry-grid {
            grid-template-columns: repeat(2, 1fr);
          }
        }

        @media (max-width: 640px) {
          .wms-telemetry-grid {
            grid-template-columns: 1fr;
          }
        }

        .wms-kpi-card {
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

        .wms-kpi-val {
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

        .wms-center-grid {
          display: grid;
          grid-template-columns: 1.25fr 0.75fr;
          gap: 1.5rem;
        }

        @media (max-width: 1100px) {
          .wms-center-grid {
            grid-template-columns: 1fr;
          }
        }

        .wms-canvas-panel, .wms-list-panel {
          padding: 1.5rem;
          display: flex;
          flex-direction: column;
          gap: 1.25rem;
          height: 400px;
        }

        .wms-canvas-wrapper {
          flex: 1;
          background: rgba(4, 6, 14, 0.85);
          border-radius: 12px;
          border: 1px solid rgba(255, 255, 255, 0.05);
          box-shadow: inset 0 4px 24px rgba(0, 0, 0, 0.9);
          overflow: hidden;
          position: relative;
        }

        .wms-canvas {
          width: 100%;
          height: 100%;
          display: block;
        }

        .stock-cards-scroll {
          flex: 1;
          display: flex;
          flex-direction: column;
          gap: 0.65rem;
          overflow-y: auto;
          padding-right: 0.25rem;
        }

        .stock-card-item {
          background: rgba(255, 255, 255, 0.02);
          border: 1px solid rgba(255, 255, 255, 0.04);
          border-radius: 8px;
          padding: 0.75rem 1rem;
          display: flex;
          flex-direction: column;
          gap: 0.5rem;
          transition: all 0.2s;
        }

        .stock-card-item:hover {
          background: rgba(244, 63, 94, 0.03);
          border-color: rgba(244, 63, 94, 0.15);
        }

        .stock-card-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          border-bottom: 1px solid rgba(255, 255, 255, 0.03);
          padding-bottom: 0.35rem;
        }

        .stock-id-badge {
          font-weight: 800;
          color: #ffffff;
          font-size: 0.75rem;
        }

        .stock-status-badge {
          font-size: 0.65rem;
          font-weight: 800;
          padding: 1.5px 5px;
          border-radius: 4px;
          letter-spacing: 0.3px;
        }

        .stock-status-badge.safe {
          background: rgba(16, 185, 129, 0.12);
          color: #10b981;
          border: 1px solid rgba(16, 185, 129, 0.25);
        }

        .stock-status-badge.replenish {
          background: rgba(244, 63, 94, 0.12);
          color: #f43f5e;
          border: 1px solid rgba(244, 63, 94, 0.25);
        }

        .stock-card-body {
          display: flex;
          flex-direction: column;
          gap: 0.4rem;
        }

        .stock-name {
          color: #ffffff;
          font-size: 0.78rem;
          font-weight: 600;
        }

        .stock-details {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 0.5rem;
          font-size: 0.7rem;
        }

        .stock-detail {
          display: flex;
          flex-direction: column;
          color: var(--text-muted);
        }

        .wms-bottom-panel {
          padding: 1.25rem;
          display: flex;
          flex-direction: column;
          gap: 1rem;
          height: 330px;
        }

        .wms-table-wrapper {
          flex: 1;
          overflow-y: auto;
          border: 1px solid rgba(255, 255, 255, 0.04);
          border-radius: 8px;
          background: rgba(4, 6, 14, 0.5);
        }

        .wms-table {
          width: 100%;
          border-collapse: collapse;
          text-align: left;
          font-size: 0.72rem;
        }

        .wms-table th, .wms-table td {
          padding: 0.6rem 0.8rem;
          border-bottom: 1px solid rgba(255, 255, 255, 0.03);
        }

        .wms-table th {
          background: rgba(13, 20, 38, 0.75);
          color: var(--text-secondary);
          font-weight: 600;
          font-size: 0.7rem;
          letter-spacing: 0.5px;
          text-transform: uppercase;
        }

        .wms-table tr:hover {
          background: rgba(255, 255, 255, 0.015);
        }

        .wms-table .tx-id {
          color: #f43f5e;
          font-weight: 700;
        }

        .txn-badge {
          font-size: 0.6rem;
          font-weight: 800;
          padding: 1.5px 4px;
          border-radius: 3px;
        }

        .txn-badge.inbound {
          background: rgba(16, 185, 129, 0.15);
          color: #10b981;
          border: 1px solid rgba(16, 185, 129, 0.3);
        }

        .txn-badge.outbound {
          background: rgba(168, 85, 247, 0.15);
          color: #a855f7;
          border: 1px solid rgba(168, 85, 247, 0.3);
        }

        .tx-status-badge {
          font-size: 0.62rem;
          font-weight: 700;
          padding: 1.5px 4px;
          border-radius: 3px;
          text-transform: uppercase;
        }

        .tx-status-badge.pending {
          background: rgba(239, 68, 68, 0.12);
          color: #f87171;
          border: 1px solid rgba(239, 68, 68, 0.25);
        }

        .tx-status-badge.wip {
          background: rgba(245, 158, 11, 0.12);
          color: #fbbf24;
          border: 1px solid rgba(245, 158, 11, 0.25);
        }

        .tx-status-badge.completed {
          background: rgba(16, 185, 129, 0.12);
          color: #34d399;
          border: 1px solid rgba(16, 185, 129, 0.25);
        }

        .wms-explain-panel {
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
          background: rgba(244, 63, 94, 0.05);
          color: var(--text-primary);
          border-color: rgba(244, 63, 94, 0.25);
        }

        .explain-tab.active {
          background: rgba(244, 63, 94, 0.12);
          color: #f43f5e;
          border-color: rgba(244, 63, 94, 0.4);
          font-weight: 600;
          box-shadow: 0 0 10px rgba(244, 63, 94, 0.15);
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
