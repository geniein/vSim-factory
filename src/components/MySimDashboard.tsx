import React, { useState, useEffect, useRef } from 'react';
import { 
  Play, Pause, RotateCcw, AlertTriangle, Cpu, CheckCircle, 
  Zap, MonitorPlay, Activity, Settings 
} from 'lucide-react';

interface Node {
  id: string;
  type: 'feeder' | 'press' | 'weld_robot' | 'paint_spray' | 'drying_oven' | 'storage_rack';
  label: string;
  x: number;
  y: number;
  parameters: Record<string, any>;
}

interface Connection {
  id: string;
  fromNode: string;
  toNode: string;
  conveyorRpm: number;
}

const generateSerialNo = () => {
  const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const l1 = letters[Math.floor(Math.random() * 26)];
  const l2 = letters[Math.floor(Math.random() * 26)];
  const l3 = letters[Math.floor(Math.random() * 26)];
  const num = Math.floor(100000 + Math.random() * 900000);
  return `${l1}${l2}${l3} ${num}`;
};

interface Material {
  id: string;
  x: number;
  y: number;
  color: string;
  currentConnId: string | null;
  currentNodeId: string | null;
  progress: number; // 0 to 1 along conveyor path
  status: 'moving' | 'processing' | 'waiting';
  processFramesLeft: number;
  hasBeenPressed: boolean;
  hasBeenWelded: boolean;
  hasBeenPainted: boolean;
  hasBeenBaked: boolean;
  hasBeenStored: boolean;
  serialNo: string;
}

interface MySimDashboardProps {
  onNavigateToEditor: () => void;
}

export const MySimDashboard: React.FC<MySimDashboardProps> = ({ onNavigateToEditor }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  
  // Loaded Custom Layout States
  const [layout, setLayout] = useState<{ nodes: Node[]; connections: Connection[] } | null>(null);
  const [isRunning, setIsRunning] = useState(true);
  const [speedMultiplier, setSpeedMultiplier] = useState(1);
  const [simCounter, setSimCounter] = useState(0);

  // Machine operational states
  const [nodesActiveStatus, setNodesActiveStatus] = useState<Record<string, 'RUN' | 'STOP'>>({});
  
  const nodeWidth = 76;
  const nodeHeight = 52;
  const gridSnap = 20;

  // Load deployed layout from localStorage
  useEffect(() => {
    const raw = localStorage.getItem('vsim_custom_layout');
    if (raw) {
      try {
        const parsed = JSON.parse(raw);
        setLayout(parsed);

        // Initialize VPLC states to RUN for all custom placed nodes
        const initialStatus: Record<string, 'RUN' | 'STOP'> = {};
        parsed.nodes.forEach((n: Node) => {
          initialStatus[`${n.id}_VPLC`] = 'RUN';
        });
        setNodesActiveStatus(initialStatus);
      } catch (e) {
        console.error('Failed to parse custom layout JSON', e);
      }
    }
  }, []);

  // Main Canvas Physics & Animation loop
  useEffect(() => {
    if (!layout || layout.nodes.length === 0) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let width = (canvas.width = canvas.offsetWidth);
    let height = (canvas.height = canvas.offsetHeight);

    const handleResize = () => {
      if (!canvas) return;
      width = canvas.width = canvas.offsetWidth;
      height = canvas.height = canvas.offsetHeight;
    };
    window.addEventListener('resize', handleResize);

    // Discrete-Event Simulation Materials State
    const activeMaterials: Material[] = [];
    let materialSpawnersTimer: Record<string, number> = {};
    
    // Initialize spawner frame countdowns
    layout.nodes.forEach(n => {
      if (n.type === 'feeder') {
        const rate = n.parameters.feedRate || 4.0;
        materialSpawnersTimer[n.id] = Math.round(600 / rate); // Spawn frame interval (60fps based)
      }
    });

    // Node processing occupation registries
    const nodesOccupyingMatId: Record<string, string | null> = {};
    layout.nodes.forEach(n => {
      nodesOccupyingMatId[n.id] = null;
    });

    let animationFrameId: number;
    let conveyorAnimationOffset = 0;
    
    // Statically tracked parameters for visual cycles
    let visualCycles: Record<string, number> = {};
    layout.nodes.forEach(n => {
      visualCycles[n.id] = 0;
    });

    // Helper: Orthogonal Wiring coordinate interpolator
    const getConveyorPathCoord = (conn: Connection, progress: number) => {
      const fromNode = layout.nodes.find(n => n.id === conn.fromNode);
      const toNode = layout.nodes.find(n => n.id === conn.toNode);

      if (!fromNode || !toNode) return { x: 0, y: 0, angle: 0 };

      const x1 = fromNode.x + nodeWidth/2;
      const y1 = fromNode.y;
      const x2 = toNode.x - nodeWidth/2;
      const y2 = toNode.y;

      const midX = (x1 + x2) / 2;

      // Orthogonal paths consist of 3 lines: 
      // Seg 1: (x1, y1) to (midX, y1)
      // Seg 2: (midX, y1) to (midX, y2)
      // Seg 3: (midX, y2) to (x2, y2)

      const len1 = Math.abs(midX - x1);
      const len2 = Math.abs(y2 - y1);
      const len3 = Math.abs(x2 - midX);
      const totalLen = len1 + len2 + len3;

      if (totalLen === 0) return { x: x1, y: y1, angle: 0 };

      const d1 = len1 / totalLen;
      const d2 = len2 / totalLen;
      const d3 = len3 / totalLen;

      let rx = x1;
      let ry = y1;
      let angle = 0;

      if (progress < d1) {
        const segP = progress / d1;
        rx = x1 + (midX - x1) * segP;
        ry = y1;
        angle = 0;
      } else if (progress < d1 + d2) {
        const segP = (progress - d1) / d2;
        rx = midX;
        ry = y1 + (y2 - y1) * segP;
        angle = Math.PI / 2 * Math.sign(y2 - y1);
      } else {
        const segP = (progress - d1 - d2) / d3;
        rx = midX + (x2 - midX) * segP;
        ry = y2;
        angle = 0;
      }

      return { x: rx, y: ry, angle };
    };

    const drawOrthogonalLine = (fromX: number, fromY: number, toX: number, toY: number) => {
      ctx.save();
      ctx.strokeStyle = '#1e293b';
      ctx.lineWidth = 14;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      const midX = (fromX + toX) / 2;
      
      ctx.beginPath();
      ctx.moveTo(fromX, fromY);
      ctx.lineTo(midX, fromY);
      ctx.lineTo(midX, toY);
      ctx.lineTo(toX, toY);
      ctx.stroke();

      // Inside wire marking conveyor dashes
      ctx.strokeStyle = '#475569';
      ctx.lineWidth = 3;
      ctx.setLineDash([8, 12]);
      ctx.lineDashOffset = -conveyorAnimationOffset;
      ctx.beginPath();
      ctx.moveTo(fromX, fromY);
      ctx.lineTo(midX, fromY);
      ctx.lineTo(midX, toY);
      ctx.lineTo(toX, toY);
      ctx.stroke();
      ctx.restore();
    };

    const drawMachineNode = (n: Node) => {
      const plcState = nodesActiveStatus[`${n.id}_VPLC`] || 'RUN';
      const isStopped = plcState === 'STOP';
      const isWorking = nodesOccupyingMatId[n.id] !== null && !isStopped && isRunning;
      
      let strokeColor = isStopped ? '#ef4444' : isWorking ? '#10b981' : '#334155';
      let titleBg = isStopped ? 'rgba(239, 68, 68, 0.15)' : 'rgba(30, 41, 59, 0.9)';

      // 1. Draw machine frame box
      ctx.save();
      ctx.fillStyle = 'rgba(15, 23, 42, 0.88)';
      ctx.strokeStyle = strokeColor;
      ctx.lineWidth = 2.2;
      ctx.beginPath();
      ctx.roundRect(n.x - nodeWidth/2, n.y - nodeHeight/2, nodeWidth, nodeHeight, 6);
      ctx.fill();
      ctx.stroke();
      ctx.restore();

      // 2. Title header
      ctx.fillStyle = titleBg;
      ctx.beginPath();
      ctx.roundRect(n.x - nodeWidth/2 + 2, n.y - nodeHeight/2 + 2, nodeWidth - 4, 16, [4, 4, 0, 0]);
      ctx.fill();

      ctx.fillStyle = isStopped ? '#ef4444' : '#ffffff';
      ctx.font = 'bold 8.5px Outfit';
      ctx.textAlign = 'center';
      ctx.fillText(n.label, n.x, n.y - nodeHeight/2 + 13);

      // Node specific graphics
      const gy = n.y + 10;
      visualCycles[n.id] += isWorking ? 0.08 * speedMultiplier : 0;

      if (n.type === 'feeder') {
        ctx.fillStyle = n.parameters.payloadColor || '#38bdf8';
        ctx.beginPath();
        ctx.moveTo(n.x - 18, gy - 6);
        ctx.lineTo(n.x - 18, gy + 6);
        ctx.lineTo(n.x - 8, gy);
        ctx.closePath();
        ctx.fill();
        
        ctx.strokeStyle = ctx.fillStyle;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(n.x - 8, gy);
        ctx.lineTo(n.x + 12, gy);
        ctx.stroke();
      } else if (n.type === 'press') {
        ctx.fillStyle = isStopped ? '#475569' : '#f97316';
        ctx.fillRect(n.x - 15, gy - 8, 4, 16);
        ctx.fillRect(n.x + 11, gy - 8, 4, 16);
        ctx.fillRect(n.x - 11, gy - 8, 22, 3);
        
        // Piston compressing animation
        let compressY = 0;
        if (isWorking) {
          compressY = Math.abs(Math.sin(visualCycles[n.id])) * 7;
        }
        ctx.fillStyle = '#cbd5e1';
        ctx.fillRect(n.x - 8, gy - 6 + compressY, 16, 6);

        // Compression impact flash
        if (isWorking && compressY > 5.5) {
          ctx.strokeStyle = 'rgba(253, 224, 71, 0.8)';
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.ellipse(n.x, gy + 7, 18, 4, 0, 0, Math.PI * 2);
          ctx.stroke();
        }
      } else if (n.type === 'weld_robot') {
        const pivotAngle = Math.sin(visualCycles[n.id] * 0.8) * 0.45 - 0.25;

        ctx.fillStyle = '#a855f7';
        ctx.beginPath();
        ctx.arc(n.x - 12, gy + 5, 5, 0, Math.PI * 2);
        ctx.fill();
        
        ctx.lineWidth = 3.5;
        ctx.strokeStyle = '#64748b';
        ctx.beginPath();
        ctx.moveTo(n.x - 12, gy + 5);
        ctx.lineTo(n.x - 3 + pivotAngle * 10, gy - 3);
        ctx.lineTo(n.x + 10 + pivotAngle * 5, gy + 3);
        ctx.stroke();

        // Weld arc flame glow (breathing neon halo)
        if (isWorking && Math.abs(pivotAngle + 0.2) < 0.2) {
          ctx.save();
          const arcGradient = ctx.createRadialGradient(n.x + 10, gy + 3, 1, n.x + 10, gy + 3, 12);
          arcGradient.addColorStop(0, '#ffffff');
          arcGradient.addColorStop(0.3, 'rgba(56, 189, 248, 0.7)');
          arcGradient.addColorStop(1, 'rgba(56, 189, 248, 0)');
          ctx.fillStyle = arcGradient;
          ctx.beginPath();
          ctx.arc(n.x + 10, gy + 3, 12, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();
        }
      } else if (n.type === 'paint_spray') {
        let sprayX = n.x - 12 + Math.abs(Math.sin(visualCycles[n.id])) * 24;
        
        ctx.fillStyle = '#ec4899';
        ctx.fillRect(n.x - 16, gy - 8, 32, 3);
        
        ctx.fillStyle = '#cbd5e1';
        ctx.fillRect(sprayX - 3, gy - 5, 6, 6);

        // spray colored mist
        if (isWorking) {
          ctx.save();
          const paintCol = n.parameters.colorHex || '#ec4899';
          const sprayGrad = ctx.createLinearGradient(sprayX, gy + 1, sprayX, gy + 10);
          sprayGrad.addColorStop(0, paintCol);
          sprayGrad.addColorStop(1, 'rgba(255,255,255,0)');
          ctx.fillStyle = sprayGrad;
          ctx.beginPath();
          ctx.moveTo(sprayX, gy + 1);
          ctx.lineTo(sprayX - 10, gy + 9);
          ctx.lineTo(sprayX + 10, gy + 9);
          ctx.closePath();
          ctx.fill();
          ctx.restore();
        }
      } else if (n.type === 'drying_oven') {
        const ovenCoilCol = isWorking 
          ? `rgba(239, 68, 68, ${0.4 + Math.sin(visualCycles[n.id] * 2) * 0.3})`
          : 'rgba(51, 65, 85, 0.7)';

        ctx.fillStyle = ovenCoilCol;
        ctx.beginPath();
        ctx.roundRect(n.x - 20, gy - 6, 40, 12, 2);
        ctx.fill();

        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(n.x - 15, gy);
        ctx.lineTo(n.x + 15, gy);
        ctx.stroke();

        // floating convective wave
        if (isWorking) {
          ctx.save();
          ctx.strokeStyle = 'rgba(239, 68, 68, 0.3)';
          ctx.lineWidth = 1;
          const heatW = (Date.now() * 0.05) % 20;
          ctx.beginPath();
          ctx.moveTo(n.x, gy + 5 - heatW);
          ctx.bezierCurveTo(n.x + 3, gy - heatW, n.x - 3, gy - 5 - heatW, n.x, gy - 10 - heatW);
          ctx.stroke();
          ctx.restore();
        }
      } else if (n.type === 'storage_rack') {
        // draw storage blocks
        ctx.fillStyle = '#334155';
        ctx.fillRect(n.x - 20, gy - 8, 40, 16);

        ctx.strokeStyle = '#f59e0b';
        ctx.lineWidth = 1;
        ctx.strokeRect(n.x - 20, gy - 8, 40, 16);
      }
    };

    const drawMaterialPayload = (m: Material) => {
      ctx.save();
      // Draw small metallic car outline represent the moving item
      ctx.fillStyle = m.color;
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      // Draw rectangular car carriage
      ctx.roundRect(m.x - 13, m.y - 7, 26, 14, 3);
      ctx.fill();
      ctx.stroke();

      // Inside visual detail (unpainted primer check)
      if (!m.hasBeenPainted) {
        ctx.fillStyle = 'rgba(15, 23, 42, 0.6)';
        ctx.fillRect(m.x - 6, m.y - 4, 12, 8);
      } else {
        // Glowing outline when painted
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.7)';
        ctx.strokeRect(m.x - 6, m.y - 4, 12, 8);
      }

      ctx.restore();

      // Draw Serial Number HUD badge above custom material
      ctx.save();
      ctx.fillStyle = 'rgba(15, 23, 42, 0.75)';
      ctx.strokeStyle = m.color;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.roundRect(m.x - 28, m.y - 20, 56, 11, 3);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 6.8px JetBrains Mono';
      ctx.textAlign = 'center';
      ctx.fillText(m.serialNo, m.x, m.y - 12);
      ctx.restore();
    };

    const render = () => {
      // Clear
      ctx.clearRect(0, 0, width, height);

      // Draw technical grid background
      ctx.strokeStyle = 'rgba(56, 189, 248, 0.015)';
      ctx.lineWidth = 1;
      for (let x = 0; x < width; x += gridSnap) {
        ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, height); ctx.stroke();
      }
      for (let y = 0; y < height; y += gridSnap) {
        ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(width, y); ctx.stroke();
      }

      // Increment conveyor belt dash offsets
      if (isRunning) {
        conveyorAnimationOffset += 1.2 * speedMultiplier;
      }

      // 1. Draw Custom Conveyors (Connections)
      layout.connections.forEach(conn => {
        const fromNode = layout.nodes.find(n => n.id === conn.fromNode);
        const toNode = layout.nodes.find(n => n.id === conn.toNode);
        
        if (fromNode && toNode) {
          drawOrthogonalLine(fromNode.x + nodeWidth/2, fromNode.y, toNode.x - nodeWidth/2, toNode.y);
        }
      });

      // 2. Draw Custom Machinery Nodes
      layout.nodes.forEach(drawMachineNode);

      // 3. Spawners Physics & Event Updates
      if (isRunning) {
        layout.nodes.forEach(n => {
          if (n.type === 'feeder') {
            const plcState = nodesActiveStatus[`${n.id}_VPLC`] || 'RUN';
            if (plcState === 'STOP') return;

            // Tick countdown
            materialSpawnersTimer[n.id] -= 1 * speedMultiplier;
            if (materialSpawnersTimer[n.id] <= 0) {
              const rate = n.parameters.feedRate || 4.0;
              materialSpawnersTimer[n.id] = Math.round(600 / rate); // reset

              // Check if output connection exists
              const outConn = layout.connections.find(c => c.fromNode === n.id);
              if (outConn) {
                // Spawn new material particle
                const newMat: Material = {
                  id: `mat_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
                  x: n.x + nodeWidth/2,
                  y: n.y,
                  color: n.parameters.payloadColor || '#38bdf8',
                  currentConnId: outConn.id,
                  currentNodeId: null,
                  progress: 0,
                  status: 'moving',
                  processFramesLeft: 0,
                  hasBeenPressed: false,
                  hasBeenWelded: false,
                  hasBeenPainted: false,
                  hasBeenBaked: false,
                  hasBeenStored: false,
                  serialNo: generateSerialNo()
                };
                activeMaterials.push(newMat);
              }
            }
          }
        });
      }

      // 4. Particle Physics & Material Flow calculations
      for (let i = activeMaterials.length - 1; i >= 0; i--) {
        const m = activeMaterials[i];

        if (!isRunning) {
          // just render statically
          if (m.currentConnId) {
            const conn = layout.connections.find(c => c.id === m.currentConnId);
            if (conn) {
              const { x: rx, y: ry } = getConveyorPathCoord(conn, m.progress);
              m.x = rx; m.y = ry;
            }
          }
          drawMaterialPayload(m);
          continue;
        }

        // --- A. Material state is MOVING along conveyor ---
        if (m.status === 'moving' && m.currentConnId) {
          const conn = layout.connections.find(c => c.id === m.currentConnId);
          if (conn) {
            const targetNode = layout.nodes.find(n => n.id === conn.toNode);
            const targetNodePlc = nodesActiveStatus[`${conn.toNode}_VPLC`] || 'RUN';

            // Collision check: check if there's another material waiting right in front on this conveyor
            const bufferHaltDist = 0.08; // safety gap
            let pathBlocked = false;
            
            for (let j = 0; j < activeMaterials.length; j++) {
              const other = activeMaterials[j];
              if (other.id !== m.id && other.currentConnId === m.currentConnId) {
                if (other.progress > m.progress && other.progress - m.progress < bufferHaltDist) {
                  pathBlocked = true;
                  break;
                }
              }
            }

            // Also path blocked if the target machine itself is currently occupied
            if (targetNode && nodesOccupyingMatId[targetNode.id] !== null && m.progress >= 0.9) {
              pathBlocked = true;
            }

            if (!pathBlocked) {
              const conveyorSpeed = (conn.conveyorRpm / 1450) * 0.003 * speedMultiplier;
              m.progress += conveyorSpeed;
            }

            // Compute actual coordinates
            const { x: rx, y: ry } = getConveyorPathCoord(conn, m.progress);
            m.x = rx;
            m.y = ry;

            // Reached destination machine
            if (m.progress >= 1.0 && targetNode) {
              m.progress = 1.0;
              m.x = targetNode.x;
              m.y = targetNode.y;
              m.currentConnId = null;
              m.currentNodeId = targetNode.id;
              
              if (targetNodePlc === 'STOP') {
                // If machine is offline, queue up waiting at entrance
                m.status = 'waiting';
              } else {
                // Initiate processing
                m.status = 'processing';
                nodesOccupyingMatId[targetNode.id] = m.id;
                
                // Fetch cycle time configured by user (default to 2s)
                const sec = targetNode.parameters.cycleDuration || 2;
                m.processFramesLeft = Math.round(sec * 60);
              }
            }
          }
        }

        // --- B. Material state is PROCESSING inside machine ---
        else if (m.status === 'processing' && m.currentNodeId) {
          const node = layout.nodes.find(n => n.id === m.currentNodeId);
          const nodePlc = nodesActiveStatus[`${m.currentNodeId}_VPLC`] || 'RUN';

          if (node && nodePlc === 'RUN') {
            m.processFramesLeft -= 1 * speedMultiplier;
            m.x = node.x;
            m.y = node.y;

            // Apply machine work processing effects
            if (node.type === 'press') {
              m.hasBeenPressed = true;
            } else if (node.type === 'weld_robot') {
              m.hasBeenWelded = true;
            } else if (node.type === 'paint_spray') {
              m.hasBeenPainted = true;
              m.color = node.parameters.colorHex || '#ec4899'; // paint body!
            } else if (node.type === 'drying_oven') {
              m.hasBeenBaked = true;
            } else if (node.type === 'storage_rack') {
              m.hasBeenStored = true;
            }

            // Processing complete
            if (m.processFramesLeft <= 0) {
              nodesOccupyingMatId[node.id] = null; // free machine

              // Find downstream connections
              const nextConn = layout.connections.find(c => c.fromNode === node.id);
              if (nextConn) {
                m.status = 'moving';
                m.currentConnId = nextConn.id;
                m.currentNodeId = null;
                m.progress = 0;
              } else {
                // No downstream path: completed!
                setSimCounter(c => c + 1);
                activeMaterials.splice(i, 1); // remove from simulation
                continue;
              }
            }
          }
        }

        // --- C. Material state is WAITING (Offline bottleneck) ---
        else if (m.status === 'waiting' && m.currentNodeId) {
          const nodePlc = nodesActiveStatus[`${m.currentNodeId}_VPLC`] || 'RUN';
          if (nodePlc === 'RUN' && nodesOccupyingMatId[m.currentNodeId] === null) {
            // Machine recovered & free!
            m.status = 'processing';
            nodesOccupyingMatId[m.currentNodeId] = m.id;
            
            const nodeObj = layout.nodes.find(n => n.id === m.currentNodeId);
            const sec = nodeObj?.parameters.cycleDuration || 2;
            m.processFramesLeft = Math.round(sec * 60);
          }
        }

        // Render payload
        drawMaterialPayload(m);
      }

      animationFrameId = requestAnimationFrame(render);
    };

    render();

    return () => {
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener('resize', handleResize);
    };
  }, [layout, isRunning, speedMultiplier, nodesActiveStatus]);

  // VPLC operational status switch handler
  const handleSimPlcToggle = (nodeId: string) => {
    const key = `${nodeId}_VPLC`;
    setNodesActiveStatus(prev => {
      const current = prev[key];
      const next = current === 'RUN' ? 'STOP' : 'RUN';
      return {
        ...prev,
        [key]: next
      };
    });
  };

  const handleSimReset = () => {
    // Reset all status to RUN and restart counter
    setSimCounter(0);
    if (layout) {
      const initialStatus: Record<string, 'RUN' | 'STOP'> = {};
      layout.nodes.forEach((n: Node) => {
        initialStatus[`${n.id}_VPLC`] = 'RUN';
      });
      setNodesActiveStatus(initialStatus);
    }
    showNotification('커스텀 공정 시뮬레이션 상태가 성공적으로 초기화되었습니다.');
  };

  const showNotification = (msg: string) => {
    const toastElem = document.getElementById('sim-toast');
    if (toastElem) {
      toastElem.innerText = `⚡ ${msg}`;
      toastElem.classList.add('show');
      setTimeout(() => {
        toastElem.classList.remove('show');
      }, 3000);
    }
  };

  if (!layout) {
    return (
      <div className="mysim-dashboard-container font-mono-tech" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 'calc(100vh - 4.5rem)' }}>
        <div className="glass-panel" style={{ padding: '2.5rem', textAlign: 'center', maxWidth: '520px', border: '1px solid rgba(168,85,247,0.2)' }}>
          <AlertTriangle size={48} className="text-neon-amber" style={{ marginBottom: '1.25rem', animation: 'pulse-glow 1.5s infinite' }} />
          <h2 style={{ color: '#fff', fontSize: '1.3rem', margin: '0 0 0.5rem 0', fontWeight: 800 }}>
            커스텀 공장 레이아웃이 비어 있습니다!
          </h2>
          <p style={{ fontSize: '0.82rem', color: '#94a3b8', lineHeight: 1.5, margin: '0 0 2rem 0' }}>
            나만의 커스텀 스마트 팩토리를 직접 조립하고 배포하기 위해 
            가상 공장 에디터(FACTORY EDITOR)로 먼저 이동해 주시기 바랍니다.
          </p>

          <button 
            className="speed-btn active"
            onClick={onNavigateToEditor}
            style={{ 
              fontSize: '0.85rem', 
              padding: '0.75rem 1.75rem', 
              borderColor: '#c084fc', 
              background: 'rgba(168, 85, 247, 0.15)',
              color: '#c084fc',
              fontWeight: 'bold',
              cursor: 'pointer',
              borderRadius: '8px'
            }}
          >
            가상 공장 에디터로 이동하기
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="mysim-dashboard-container">
      {/* Simulation Master Header Status Panel */}
      <div className="mysim-telemetry-grid">
        <div className="glass-panel telemetry-card mysim-glow">
          <div className="telemetry-header">
            <MonitorPlay size={14} className="text-neon-purple" />
            <span>CUSTOM SIM STATUS</span>
          </div>
          <div className="telemetry-value text-neon-purple">
            {isRunning ? 'ACTIVE' : 'PAUSED'}
          </div>
          <div className="telemetry-footer">
            <span>Flow Engine: 60fps Physics</span>
          </div>
        </div>

        <div className="glass-panel telemetry-card mysim-glow">
          <div className="telemetry-header">
            <Cpu size={14} className="text-neon-cyan" />
            <span>TOTAL INSTALLED NODES</span>
          </div>
          <div className="telemetry-value text-neon-cyan">
            {layout.nodes.length} <span className="telemetry-unit">Units</span>
          </div>
          <div className="telemetry-footer">
            <span>Conveyor Tracks: {layout.connections.length} Lines</span>
          </div>
        </div>

        <div className="glass-panel telemetry-card mysim-glow">
          <div className="telemetry-header">
            <CheckCircle size={14} className="text-neon-green" />
            <span>FINISHED PRODUCTS</span>
          </div>
          <div className="telemetry-value text-neon-green">
            {simCounter} <span className="telemetry-unit">Chassis</span>
          </div>
          <div className="telemetry-footer">
            <span>Flow yield: 100% Audit Pass</span>
          </div>
        </div>

        <div className="glass-panel telemetry-card mysim-glow">
          <div className="telemetry-header">
            <Zap size={14} className="text-neon-amber" />
            <span>VPLC HANDSHAKE STATUS</span>
          </div>
          <div className="telemetry-value text-neon-amber">
            {Object.values(nodesActiveStatus).includes('STOP') ? 'INTERRUPT' : 'SECURE'}
          </div>
          <div className="telemetry-footer">
            <span>Field bus: Modbus-TCP Handshake</span>
          </div>
        </div>
      </div>

      {/* Main Playback Controllers */}
      <div className="glass-panel mysim-controls-panel font-mono-tech">
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Settings size={18} className="text-neon-purple" />
          <h4 style={{ margin: 0, fontSize: '0.92rem', color: '#fff', fontWeight: 700 }}>
            CUSTOM FACTORY SIMULATION CONTROLLER (커스텀 공정 시뮬레이션 제어반)
          </h4>
        </div>
        
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center', marginLeft: 'auto' }}>
          <button 
            onClick={() => setIsRunning(!isRunning)} 
            className={`speed-btn ${isRunning ? 'active' : ''}`}
            style={{ fontSize: '0.78rem', padding: '0.5rem 1rem', display: 'flex', alignItems: 'center', gap: '5px' }}
          >
            {isRunning ? <Pause size={12} /> : <Play size={12} fill="currentColor" />}
            {isRunning ? '정지 (PAUSE)' : '가동 (RUN)'}
          </button>

          <div style={{ display: 'flex', alignItems: 'center', gap: '2px', background: 'rgba(255,255,255,0.02)', padding: '2px', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.05)' }}>
            {[1, 2, 4].map(spd => (
              <button
                key={spd}
                onClick={() => setSpeedMultiplier(spd)}
                className={`speed-btn ${speedMultiplier === spd ? 'active' : ''}`}
                style={{ padding: '4px 8px', fontSize: '0.7rem' }}
              >
                {spd}x
              </button>
            ))}
          </div>

          <button 
            onClick={handleSimReset}
            className="speed-btn"
            style={{ fontSize: '0.78rem', padding: '0.5rem 1rem', borderColor: 'rgba(168, 85, 247, 0.4)', background: 'rgba(168, 85, 247, 0.05)', color: '#c084fc', display: 'flex', alignItems: 'center', gap: '4px' }}
          >
            <RotateCcw size={12} />
            초기화
          </button>

          <button 
            className="speed-btn"
            onClick={onNavigateToEditor}
            style={{ fontSize: '0.78rem', padding: '0.5rem 1rem', borderColor: 'rgba(255,255,255,0.1)', color: '#94a3b8' }}
          >
            설계 변경 (EDITOR)
          </button>
        </div>
      </div>

      {/* Simulator canvas Mimic Panel */}
      <div className="glass-panel mysim-mimic-panel">
        <div className="mimic-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Activity size={18} className="text-neon-purple" />
            <h3 style={{ textTransform: 'uppercase', fontSize: '0.95rem' }}>
              CUSTOM FACTORY RUNTIME SIMULATION (실시간 가동 현황판)
            </h3>
          </div>
          <div className="sim-speed-hud font-mono-tech">
            MULTIPLIER: {speedMultiplier}x | CONVEYOR HEARTBEAT: OK
          </div>
        </div>

        <div className="mimic-canvas-wrapper" style={{ height: '390px' }}>
          <canvas ref={canvasRef} className="mimic-canvas" />
        </div>
      </div>

      {/* Dynamic VPLC control for placed custom machinery */}
      <div className="glass-panel custom-plc-panel font-mono-tech">
        <div className="panel-title" style={{ fontSize: '0.9rem', color: '#fff', borderBottom: '1px solid rgba(255,255,255,0.06)', paddingBottom: '0.5rem' }}>
          <Cpu size={15} className="text-neon-cyan" />
          <span>VPLC INDIVIDUAL REMOTE SHUTDOWN (배치 설비 모듈별 가상 PLC 제어망)</span>
        </div>
        <div className="custom-plc-table-wrapper" style={{ marginTop: '0.75rem', maxHeight: '180px', overflowY: 'auto' }}>
          <table className="plc-register-table">
            <thead>
              <tr>
                <th>PLC NODE ID</th>
                <th>설비 이름</th>
                <th>가동 지시 상태 (원격 제어)</th>
                <th>통신 포트</th>
                <th>실시간 전송 이력</th>
              </tr>
            </thead>
            <tbody>
              {layout.nodes.map((node, i) => {
                const plcKey = `${node.id}_VPLC`;
                const status = nodesActiveStatus[plcKey] || 'RUN';
                return (
                  <tr key={node.id} className={status === 'STOP' ? 'tr-fault-bg' : ''}>
                    <td className="node-name" style={{ color: status === 'STOP' ? '#f87171' : '#ffffff' }}>{plcKey}</td>
                    <td style={{ color: '#94a3b8', fontSize: '0.72rem' }}>{node.label}</td>
                    <td>
                      <button 
                        onClick={() => handleSimPlcToggle(node.id)}
                        className={`plc-badge-status ${status.toLowerCase()}`}
                        style={{ border: '1px solid transparent', cursor: 'pointer', outline: 'none', transition: 'all 0.2s', padding: '2px 7px' }}
                      >
                        {status} ⚙
                      </button>
                    </td>
                    <td style={{ color: '#38bdf8', fontSize: '0.7rem' }}>Port {502 + i} (Modbus-TCP)</td>
                    <td style={{ color: status === 'STOP' ? '#64748b' : '#10b981', fontSize: '0.7rem' }}>
                      {status === 'STOP' ? 'CONNECTION_LOST_TIMEOUT' : `0x${((Date.now() + i * 23) % 256).toString(16).toUpperCase().padStart(2,'0')}FE00A1`}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Floating Success Toast notification */}
      <div id="sim-toast" className="editor-toast font-mono-tech success"></div>

      <style>{`
        .mysim-dashboard-container {
          display: flex;
          flex-direction: column;
          gap: 1.5rem;
          width: 100%;
          animation: fadeIn 0.8s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }

        .mysim-telemetry-grid {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 1.25rem;
        }

        @media (max-width: 1024px) {
          .mysim-telemetry-grid {
            grid-template-columns: repeat(2, 1fr);
          }
        }

        @media (max-width: 640px) {
          .mysim-telemetry-grid {
            grid-template-columns: 1fr;
          }
        }

        .telemetry-card {
          background: rgba(13, 20, 38, 0.45);
          border: 1px solid rgba(139, 92, 246, 0.15);
          border-radius: 12px;
          padding: 1.25rem;
          display: flex;
          flex-direction: column;
          gap: 0.5rem;
          transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1);
          box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
        }

        .telemetry-card:hover {
          border-color: rgba(139, 92, 246, 0.35);
          box-shadow: 0 4px 25px rgba(139, 92, 246, 0.08);
          transform: translateY(-2px);
        }

        .mysim-glow {
          border-color: rgba(139, 92, 246, 0.25);
        }

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
        .mysim-controls-panel {
          background: rgba(13, 20, 38, 0.45);
          border: 1px solid rgba(139, 92, 246, 0.18);
          border-radius: 12px;
          padding: 0.75rem 1.25rem;
          display: flex;
          align-items: center;
          height: 3.5rem;
          box-sizing: border-box;
        }

        .sim-speed-hud {
          font-size: 0.7rem;
          color: var(--color-cyber-blue);
          background: rgba(56, 189, 248, 0.08);
          border: 1px solid rgba(56, 189, 248, 0.2);
          padding: 3px 7px;
          border-radius: 4px;
          font-weight: 700;
        }

        .mysim-mimic-panel {
          background: rgba(13, 20, 38, 0.45);
          border: 1px solid rgba(139, 92, 246, 0.15);
          border-radius: 12px;
          padding: 1.25rem;
          display: flex;
          flex-direction: column;
          gap: 1rem;
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

        .mimic-canvas-wrapper {
          width: 100%;
          height: 390px;
          background: rgba(4, 6, 14, 0.88);
          border-radius: 12px;
          border: 1px solid rgba(255, 255, 255, 0.05);
          box-shadow: inset 0 4px 24px rgba(0, 0, 0, 0.9);
          overflow: hidden;
          position: relative;
        }

        .mimic-canvas {
          width: 100%;
          height: 100%;
          display: block;
        }

        /* PLC registers list */
        .custom-plc-panel {
          background: rgba(13, 20, 38, 0.45);
          border: 1px solid rgba(139, 92, 246, 0.15);
          border-radius: 12px;
          padding: 1.25rem;
          display: flex;
          flex-direction: column;
        }

        .custom-plc-table-wrapper {
          border: 1px solid rgba(255,255,255,0.04);
          background: rgba(4, 6, 14, 0.4);
          border-radius: 8px;
          margin-top: 0.75rem;
          max-height: 185px;
          overflow-y: auto;
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

        /* Toast notifications inside simulation */
        #sim-toast {
          position: fixed;
          bottom: 2rem;
          right: 2rem;
          opacity: 0;
          pointer-events: none;
          transition: opacity 0.30s ease, transform 0.30s ease;
          transform: translateY(10px);
        }

        #sim-toast.show {
          opacity: 1;
          pointer-events: auto;
          transform: translateY(0);
        }
      `}</style>
    </div>
  );
};
