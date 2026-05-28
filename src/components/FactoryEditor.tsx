import React, { useState, useEffect, useRef } from 'react';
import { 
  Cpu, Trash2, ArrowRight, Sliders, Info, 
  Plus, Layout, Sparkles 
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

interface FactoryEditorProps {
  onNavigateToMySim: () => void;
}

export const FactoryEditor: React.FC<FactoryEditorProps> = ({ onNavigateToMySim }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  
  // Board State
  const [nodes, setNodes] = useState<Node[]>([
    { id: 'node_feeder_01', type: 'feeder', label: 'Primary Feeder', x: 100, y: 160, parameters: { feedRate: 4.5, payloadColor: '#38bdf8' } },
    { id: 'node_press_01', type: 'press', label: 'Heavy Press 100T', x: 300, y: 160, parameters: { targetPressure: 210, cycleDuration: 3 } }
  ]);
  const [connections, setConnections] = useState<Connection[]>([
    { id: 'conn_01', fromNode: 'node_feeder_01', toNode: 'node_press_01', conveyorRpm: 1450 }
  ]);

  // Selected tool: 'select' | 'wire' | nodeType
  const [activeTool, setActiveTool] = useState<string>('select');
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [wireStartNodeId, setWireStartNodeId] = useState<string | null>(null);

  // Mouse & Dragging states
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [draggedNodeId, setDraggedNodeId] = useState<string | null>(null);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  
  // Notification Toast state
  const [toast, setToast] = useState<{ show: boolean; msg: string; type: 'success' | 'info' | 'error' }>({
    show: false,
    msg: '',
    type: 'success'
  });

  const showNotification = (msg: string, type: 'success' | 'info' | 'error' = 'success') => {
    setToast({ show: true, msg, type });
    setTimeout(() => {
      setToast(prev => ({ ...prev, show: false }));
    }, 3500);
  };

  // Load layout from localStorage on mount if it exists
  useEffect(() => {
    const raw = localStorage.getItem('vsim_custom_layout');
    if (raw) {
      try {
        const parsed = JSON.parse(raw);
        if (parsed.nodes && parsed.connections) {
          setNodes(parsed.nodes);
          setConnections(parsed.connections);
        }
      } catch (e) {
        console.error('Failed to load custom layout in Editor', e);
      }
    }
  }, []);

  const gridSnap = 20;
  const nodeWidth = 76;
  const nodeHeight = 52;

  // Render & Canvas Loop
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

    const drawGrid = () => {
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.025)';
      ctx.lineWidth = 1;
      for (let x = 0; x < width; x += gridSnap) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, height);
        ctx.stroke();
      }
      for (let y = 0; y < height; y += gridSnap) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(width, y);
        ctx.stroke();
      }
    };

    const drawOrthogonalLine = (fromX: number, fromY: number, toX: number, toY: number, isActive = false) => {
      ctx.save();
      ctx.strokeStyle = isActive ? '#10b981' : '#38bdf8';
      ctx.lineWidth = 4;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      
      const midX = (fromX + toX) / 2;
      
      ctx.beginPath();
      ctx.moveTo(fromX, fromY);
      ctx.lineTo(midX, fromY);
      ctx.lineTo(midX, toY);
      ctx.lineTo(toX, toY);
      ctx.stroke();

      // Calculate length along segments to place arrows
      ctx.save();
      ctx.setLineDash([5, 12]);
      ctx.strokeStyle = 'rgba(255,255,255,0.4)';
      ctx.lineWidth = 1.5;
      ctx.lineDashOffset = -Date.now() * 0.01;
      ctx.beginPath();
      ctx.moveTo(fromX, fromY);
      ctx.lineTo(midX, fromY);
      ctx.lineTo(midX, toY);
      ctx.lineTo(toX, toY);
      ctx.stroke();
      ctx.restore();

      ctx.restore();
    };

    const drawMachineNode = (n: Node) => {
      const isSelected = selectedNodeId === n.id;
      const isWireStart = wireStartNodeId === n.id;
      
      let strokeColor = 'rgba(255, 255, 255, 0.15)';
      let shadowGlow = 'transparent';
      let titleBg = 'rgba(30, 41, 59, 0.9)';

      if (isSelected) {
        strokeColor = '#10b981';
        shadowGlow = 'rgba(16, 185, 129, 0.25)';
      } else if (isWireStart) {
        strokeColor = '#38bdf8';
        shadowGlow = 'rgba(56, 189, 248, 0.25)';
      }

      // Draw Main Box bounding plate
      ctx.save();
      ctx.shadowBlur = isSelected || isWireStart ? 10 : 0;
      ctx.shadowColor = shadowGlow;
      ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
      ctx.strokeStyle = strokeColor;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.roundRect(n.x - nodeWidth/2, n.y - nodeHeight/2, nodeWidth, nodeHeight, 6);
      ctx.fill();
      ctx.stroke();
      ctx.restore();

      // Top title mini header inside node
      ctx.fillStyle = titleBg;
      ctx.beginPath();
      ctx.roundRect(n.x - nodeWidth/2 + 2, n.y - nodeHeight/2 + 2, nodeWidth - 4, 16, [4, 4, 0, 0]);
      ctx.fill();

      // Draw Node Label text
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 8.2px Outfit';
      ctx.textAlign = 'center';
      ctx.fillText(n.label.substring(0, 14), n.x, n.y - nodeHeight/2 + 13);

      // Node specific visual graphics in the lower half of node
      const gy = n.y + 10;
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.25)';
      ctx.lineWidth = 1.5;

      if (n.type === 'feeder') {
        // Draw input funnel arrow symbol
        ctx.fillStyle = '#38bdf8';
        ctx.beginPath();
        ctx.moveTo(n.x - 18, gy - 6);
        ctx.lineTo(n.x - 18, gy + 6);
        ctx.lineTo(n.x - 8, gy);
        ctx.closePath();
        ctx.fill();

        ctx.strokeStyle = '#38bdf8';
        ctx.beginPath();
        ctx.moveTo(n.x - 8, gy);
        ctx.lineTo(n.x + 12, gy);
        ctx.stroke();
      } else if (n.type === 'press') {
        // Draw two columns and a stamping hammer
        ctx.fillStyle = '#f97316';
        ctx.fillRect(n.x - 15, gy - 8, 4, 16);
        ctx.fillRect(n.x + 11, gy - 8, 4, 16);
        ctx.fillRect(n.x - 11, gy - 8, 22, 3);
        
        // Stamping head
        ctx.fillStyle = '#cbd5e1';
        ctx.fillRect(n.x - 8, gy - 2, 16, 6);
      } else if (n.type === 'weld_robot') {
        // Draw pivoting robotic arm
        ctx.fillStyle = '#a855f7';
        ctx.beginPath();
        ctx.arc(n.x - 10, gy + 4, 5, 0, Math.PI * 2);
        ctx.fill();
        
        ctx.lineWidth = 3.5;
        ctx.strokeStyle = '#64748b';
        ctx.beginPath();
        ctx.moveTo(n.x - 10, gy + 4);
        ctx.lineTo(n.x, gy - 4);
        ctx.lineTo(n.x + 12, gy + 2);
        ctx.stroke();
      } else if (n.type === 'paint_spray') {
        // Draw linear gantry rail and nozzle spray spray
        ctx.fillStyle = '#ec4899';
        ctx.fillRect(n.x - 16, gy - 8, 32, 3);
        
        ctx.fillStyle = '#94a3b8';
        ctx.fillRect(n.x - 3, gy - 5, 6, 6);
        
        // spray drops
        ctx.fillStyle = 'rgba(236, 72, 153, 0.4)';
        ctx.beginPath();
        ctx.moveTo(n.x, gy + 1);
        ctx.lineTo(n.x - 8, gy + 8);
        ctx.lineTo(n.x + 8, gy + 8);
        ctx.closePath();
        ctx.fill();
      } else if (n.type === 'drying_oven') {
        // Insulated chamber box with IR red elements
        ctx.fillStyle = '#ef4444';
        ctx.beginPath();
        ctx.roundRect(n.x - 18, gy - 6, 36, 12, 2);
        ctx.fill();

        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(n.x - 12, gy);
        ctx.lineTo(n.x + 12, gy);
        ctx.stroke();
      } else if (n.type === 'storage_rack') {
        // Stacker crane grid
        ctx.fillStyle = '#f59e0b';
        ctx.fillRect(n.x - 18, gy - 7, 10, 6);
        ctx.fillRect(n.x - 6, gy - 7, 10, 6);
        ctx.fillRect(n.x + 6, gy - 7, 10, 6);
        ctx.fillRect(n.x - 18, gy + 1, 10, 6);
        ctx.fillRect(n.x - 6, gy + 1, 10, 6);
        ctx.fillRect(n.x + 6, gy + 1, 10, 6);
      }

      // Wiring Ports: Draw Port Circles for Wiring Mode or Hover states
      const showPorts = activeTool === 'wire' || isWireStart;
      if (showPorts) {
        // Input Port (Left side) - Only if not feeder
        if (n.type !== 'feeder') {
          ctx.fillStyle = '#ef4444';
          ctx.strokeStyle = '#ffffff';
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.arc(n.x - nodeWidth/2, n.y, 5, 0, Math.PI * 2);
          ctx.fill();
          ctx.stroke();
        }

        // Output Port (Right side) - Only if not storage_rack
        if (n.type !== 'storage_rack') {
          ctx.fillStyle = '#10b981';
          ctx.strokeStyle = '#ffffff';
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.arc(n.x + nodeWidth/2, n.y, 5, 0, Math.PI * 2);
          ctx.fill();
          ctx.stroke();
        }
      }
    };

    const render = () => {
      ctx.clearRect(0, 0, width, height);

      // 1. Draw Grid Dots
      drawGrid();

      // 2. Draw Wire Connections
      connections.forEach(conn => {
        const fromNode = nodes.find(n => n.id === conn.fromNode);
        const toNode = nodes.find(n => n.id === conn.toNode);
        
        if (fromNode && toNode) {
          const fromX = fromNode.x + nodeWidth/2;
          const fromY = fromNode.y;
          const toX = toNode.x - nodeWidth/2;
          const toY = toNode.y;
          
          const isSelectedConnection = selectedNodeId === null && false; // Future extension
          drawOrthogonalLine(fromX, fromY, toX, toY, isSelectedConnection);
        }
      });

      // 3. Draw Active Wiring preview line
      if (activeTool === 'wire' && wireStartNodeId) {
        const startNode = nodes.find(n => n.id === wireStartNodeId);
        if (startNode) {
          ctx.strokeStyle = 'rgba(56, 189, 248, 0.65)';
          ctx.lineWidth = 2.5;
          ctx.setLineDash([5, 5]);
          ctx.beginPath();
          ctx.moveTo(startNode.x + nodeWidth/2, startNode.y);
          ctx.lineTo(mousePos.x, mousePos.y);
          ctx.stroke();
          ctx.setLineDash([]);
        }
      }

      // 4. Draw Placement Tool preview
      const isPlacingTool = ['feeder', 'press', 'weld_robot', 'paint_spray', 'drying_oven', 'storage_rack'].includes(activeTool);
      if (isPlacingTool) {
        const snapX = Math.round(mousePos.x / gridSnap) * gridSnap;
        const snapY = Math.round(mousePos.y / gridSnap) * gridSnap;

        ctx.save();
        ctx.fillStyle = 'rgba(56, 189, 248, 0.15)';
        ctx.strokeStyle = 'rgba(56, 189, 248, 0.5)';
        ctx.lineWidth = 1.5;
        ctx.setLineDash([4, 4]);
        ctx.beginPath();
        ctx.roundRect(snapX - nodeWidth/2, snapY - nodeHeight/2, nodeWidth, nodeHeight, 6);
        ctx.fill();
        ctx.stroke();
        ctx.restore();
      }

      // 5. Draw Placed Nodes
      nodes.forEach(drawMachineNode);

      animationFrameId = requestAnimationFrame(render);
    };

    render();

    return () => {
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener('resize', handleResize);
    };
  }, [nodes, connections, activeTool, selectedNodeId, wireStartNodeId, mousePos]);

  // Pointer Event Handlers
  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    // Snapped Coordinates
    const snapX = Math.round(x / gridSnap) * gridSnap;
    const snapY = Math.round(y / gridSnap) * gridSnap;

    // Check if clicked inside any node
    const clickedNode = nodes.find(n => {
      return (
        x >= n.x - nodeWidth/2 &&
        x <= n.x + nodeWidth/2 &&
        y >= n.y - nodeHeight/2 &&
        y <= n.y + nodeHeight/2
      );
    });

    // Handle Wiring Mode
    if (activeTool === 'wire') {
      if (clickedNode) {
        // Output click or input click detection
        const isNearOutput = x >= clickedNode.x + nodeWidth/2 - 12;
        const isNearInput = x <= clickedNode.x - nodeWidth/2 + 12;

        if (wireStartNodeId === null) {
          // Select start output port
          if (clickedNode.type !== 'storage_rack' && isNearOutput) {
            setWireStartNodeId(clickedNode.id);
          } else {
            showNotification('컨베이어 연결은 설비의 우측(출력 포트)에서 시작해야 합니다.', 'info');
          }
        } else {
          // Link to target input port
          if (clickedNode.id === wireStartNodeId) {
            setWireStartNodeId(null); // Cancel
            return;
          }

          if (clickedNode.type !== 'feeder' && isNearInput) {
            // Check if connection already exists
            const exists = connections.some(c => c.fromNode === wireStartNodeId && c.toNode === clickedNode.id);
            if (!exists) {
              const newConn: Connection = {
                id: `conn_${Date.now()}`,
                fromNode: wireStartNodeId,
                toNode: clickedNode.id,
                conveyorRpm: 1450
              };
              setConnections(prev => [...prev, newConn]);
              showNotification('컨베이어 이송 벨트가 정상적으로 직교 구축되었습니다.');
            }
            setWireStartNodeId(null);
            setActiveTool('select');
          } else {
            showNotification('컨베이어의 목적지는 설비의 좌측(입력 포트)이어야 합니다.', 'info');
            setWireStartNodeId(null);
          }
        }
      } else {
        setWireStartNodeId(null); // click empty space cancels wiring
      }
      return;
    }

    // Handle Tool Placement Mode
    const isPlacingTool = ['feeder', 'press', 'weld_robot', 'paint_spray', 'drying_oven', 'storage_rack'].includes(activeTool);
    if (isPlacingTool) {
      // Prevent overlapping placements
      const isOverlapped = nodes.some(n => {
        return Math.abs(n.x - snapX) < nodeWidth && Math.abs(n.y - snapY) < nodeHeight;
      });

      if (isOverlapped) {
        showNotification('설비 배치가 중첩될 수 없습니다. 다른 위치를 선택하십시오.', 'error');
        return;
      }

      let label = '';
      let defaultParams: Record<string, any> = {};

      if (activeTool === 'feeder') {
        label = `Feeder ${nodes.filter(n=>n.type==='feeder').length+1}`;
        defaultParams = { feedRate: 4.0, payloadColor: '#38bdf8' };
      } else if (activeTool === 'press') {
        label = `Press ${nodes.filter(n=>n.type==='press').length+1}`;
        defaultParams = { targetPressure: 210, cycleDuration: 3 };
      } else if (activeTool === 'weld_robot') {
        label = `Weld Robot ${nodes.filter(n=>n.type==='weld_robot').length+1}`;
        defaultParams = { arcCurrent: 120, cycleDuration: 2 };
      } else if (activeTool === 'paint_spray') {
        label = `Sprayer ${nodes.filter(n=>n.type==='paint_spray').length+1}`;
        defaultParams = { nozzlePressure: 4.5, colorHex: '#ec4899' };
      } else if (activeTool === 'drying_oven') {
        label = `IR Oven ${nodes.filter(n=>n.type==='drying_oven').length+1}`;
        defaultParams = { targetTemp: 110, cycleDuration: 4 };
      } else if (activeTool === 'storage_rack') {
        label = `Store Rack ${nodes.filter(n=>n.type==='storage_rack').length+1}`;
        defaultParams = { storageCapacity: 36 };
      }

      const newNode: Node = {
        id: `node_${activeTool}_${Date.now()}`,
        type: activeTool as Node['type'],
        label,
        x: snapX,
        y: snapY,
        parameters: defaultParams
      };

      setNodes(prev => [...prev, newNode]);
      setSelectedNodeId(newNode.id);
      setActiveTool('select');
      showNotification(`${label} 설비가 그리드 정렬 배치되었습니다.`);
      return;
    }

    // Default Selection & Dragging Mode
    if (clickedNode) {
      setSelectedNodeId(clickedNode.id);
      setIsDragging(true);
      setDraggedNodeId(clickedNode.id);
      setDragOffset({
        x: x - clickedNode.x,
        y: y - clickedNode.y
      });
    } else {
      setSelectedNodeId(null);
    }
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    setMousePos({ x, y });

    // Handle Drag Movement
    if (isDragging && draggedNodeId) {
      const snapX = Math.round((x - dragOffset.x) / gridSnap) * gridSnap;
      const snapY = Math.round((y - dragOffset.y) / gridSnap) * gridSnap;

      setNodes(prev => {
        return prev.map(n => {
          if (n.id === draggedNodeId) {
            return { ...n, x: snapX, y: snapY };
          }
          return n;
        });
      });
    }
  };

  const handlePointerUp = () => {
    setIsDragging(false);
    setDraggedNodeId(null);
  };

  // Delete Selected Equipment
  const handleDeleteNode = () => {
    if (!selectedNodeId) return;

    const nodeToDelete = nodes.find(n => n.id === selectedNodeId);
    if (!nodeToDelete) return;

    // 1. Remove Node
    setNodes(prev => prev.filter(n => n.id !== selectedNodeId));
    // 2. Remove any connections attached to this node
    setConnections(prev => prev.filter(c => c.fromNode !== selectedNodeId && c.toNode !== selectedNodeId));
    
    setSelectedNodeId(null);
    showNotification(`${nodeToDelete.label} 설비 및 연결 벨트를 해체하였습니다.`, 'info');
  };

  // Update selected equipment parameters from inspector
  const updateNodeParameter = (key: string, val: any) => {
    if (!selectedNodeId) return;
    setNodes(prev => prev.map(n => {
      if (n.id === selectedNodeId) {
        return {
          ...n,
          parameters: {
            ...n.parameters,
            [key]: val
          }
        };
      }
      return n;
    }));
  };

  const updateNodeLabel = (newLabel: string) => {
    if (!selectedNodeId) return;
    setNodes(prev => prev.map(n => {
      if (n.id === selectedNodeId) {
        return { ...n, label: newLabel };
      }
      return n;
    }));
  };

  // Clear Board Layout completely
  const handleClearBoard = () => {
    if (window.confirm('디자인 중인 모든 가상 공정 배치를 초기화하시겠습니까?')) {
      setNodes([]);
      setConnections([]);
      setSelectedNodeId(null);
      setWireStartNodeId(null);
      showNotification('공정 에디터 보드가 초기화되었습니다.', 'info');
    }
  };

  // Stage & Deploy to My Sim
  const handleDeployLayout = () => {
    // Validation
    const feederNodes = nodes.filter(n => n.type === 'feeder');
    if (feederNodes.length === 0) {
      showNotification('배포 실패: 최소 1개 이상의 원소재 피더(Feeder) 설비가 필요합니다.', 'error');
      return;
    }

    if (nodes.length > 1 && connections.length === 0) {
      showNotification('배포 실패: 배치된 설비 간 연결된 컨베이어가 없습니다.', 'error');
      return;
    }

    const payload = {
      layoutId: `custom_layout_${Date.now()}`,
      timestamp: new Date().toISOString(),
      nodes,
      connections
    };

    localStorage.setItem('vsim_custom_layout', JSON.stringify(payload));
    showNotification('🎉 축하합니다! 커스텀 가상 스마트 팩토리 설계도가 성공적으로 배포 완료되었습니다.');

    setTimeout(() => {
      onNavigateToMySim();
    }, 1200);
  };

  const activeNode = nodes.find(n => n.id === selectedNodeId);

  return (
    <div className="factory-editor-container">
      {/* Top action control panel */}
      <div className="editor-control-header glass-panel font-mono-tech">
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Layout size={18} className="text-neon-cyan" />
          <h4 style={{ margin: 0, fontSize: '0.92rem', color: '#fff', fontWeight: 700 }}>
            VIRTUAL FACTORY DRAG & DROP EDITOR (커스텀 가상 공정 조립반)
          </h4>
        </div>
        
        <div style={{ display: 'flex', gap: '10px' }}>
          <button 
            className="speed-btn" 
            onClick={handleClearBoard}
            style={{ fontSize: '0.72rem', borderColor: 'rgba(239, 68, 68, 0.4)', background: 'rgba(239, 68, 68, 0.05)', color: '#f87171' }}
          >
            초기화 (CLEAR)
          </button>
          
          <button 
            className="speed-btn"
            onClick={handleDeployLayout}
            style={{ 
              fontSize: '0.75rem', 
              fontWeight: 800,
              borderColor: '#10b981', 
              background: 'rgba(16, 185, 129, 0.15)',
              color: '#10b981',
              boxShadow: '0 0 10px rgba(16,185,129,0.1)'
            }}
          >
            ⚡ 커스텀 공장 배포 (DEPLOY TO MY SIM)
          </button>
        </div>
      </div>

      {/* Center 3-column editor layout */}
      <div className="editor-workspace-layout">
        
        {/* Column A: Equipment Palette Sidebar */}
        <div className="editor-palette-sidebar glass-panel font-mono-tech">
          <div className="panel-title" style={{ fontSize: '0.78rem', borderBottom: '1px solid rgba(255,255,255,0.06)', paddingBottom: '0.5rem', marginBottom: '0.75rem' }}>
            <Plus size={14} className="text-neon-cyan" />
            <span>설비 도구 팔레트 (PALETTE)</span>
          </div>

          {/* Action Tools */}
          <div className="tool-category-label">기본 편집 도구</div>
          <div className="palette-grid">
            <button 
              className={`palette-tool-item ${activeTool === 'select' ? 'active' : ''}`}
              onClick={() => { setActiveTool('select'); setWireStartNodeId(null); }}
            >
              <Sliders size={15} />
              <span>선택 & 이동</span>
            </button>
            <button 
              className={`palette-tool-item ${activeTool === 'wire' ? 'active' : ''}`}
              onClick={() => { setActiveTool('wire'); setSelectedNodeId(null); }}
            >
              <ArrowRight size={15} />
              <span>컨베이어 연결</span>
            </button>
          </div>

          <div className="tool-category-label">공정 설비 종류 (클릭 후 격자판 클릭)</div>
          <div className="palette-grid flex-col">
            <button 
              className={`palette-machine-item feeder ${activeTool === 'feeder' ? 'active' : ''}`}
              onClick={() => setActiveTool('feeder')}
            >
              <div className="symbol feeder-color" />
              <div style={{ textAlign: 'left' }}>
                <div className="m-label">소재 공급기 (Feeder)</div>
                <div className="m-desc">최초 바디 차판을 피딩 이송함</div>
              </div>
            </button>

            <button 
              className={`palette-machine-item press ${activeTool === 'press' ? 'active' : ''}`}
              onClick={() => setActiveTool('press')}
            >
              <div className="symbol press-color" />
              <div style={{ textAlign: 'left' }}>
                <div className="m-label">고압 프레스 (Press)</div>
                <div className="m-desc">유압 실린더로 판재를 고압 성형</div>
              </div>
            </button>

            <button 
              className={`palette-machine-item weld_robot ${activeTool === 'weld_robot' ? 'active' : ''}`}
              onClick={() => setActiveTool('weld_robot')}
            >
              <div className="symbol weld-color" />
              <div style={{ textAlign: 'left' }}>
                <div className="m-label">용접 로봇 (Welding Robot)</div>
                <div className="m-desc">정밀 아크 방전 차체 접합용 로봇</div>
              </div>
            </button>

            <button 
              className={`palette-machine-item paint_spray ${activeTool === 'paint_spray' ? 'active' : ''}`}
              onClick={() => setActiveTool('paint_spray')}
            >
              <div className="symbol paint-color" />
              <div style={{ textAlign: 'left' }}>
                <div className="m-label">페인트 분무기 (Paint Sprayer)</div>
                <div className="m-desc">에어 스프레이로 자동 외관 도색</div>
              </div>
            </button>

            <button 
              className={`palette-machine-item drying_oven ${activeTool === 'drying_oven' ? 'active' : ''}`}
              onClick={() => setActiveTool('drying_oven')}
            >
              <div className="symbol oven-color" />
              <div style={{ textAlign: 'left' }}>
                <div className="m-label">건조 건조로 (Drying Oven)</div>
                <div className="m-desc">적외선 열판 코일로 페인트 굽기</div>
              </div>
            </button>

            <button 
              className={`palette-machine-item storage_rack ${activeTool === 'storage_rack' ? 'active' : ''}`}
              onClick={() => setActiveTool('storage_rack')}
            >
              <div className="symbol rack-color" />
              <div style={{ textAlign: 'left' }}>
                <div className="m-label">자동 적재 창고 (Storage Rack)</div>
                <div className="m-desc">가공 완제품 고밀도 선반 보관</div>
              </div>
            </button>
          </div>
        </div>

        {/* Column B: Interactive Canvas Grid Board */}
        <div className="editor-board-main glass-panel">
          <div className="board-header font-mono-tech">
            <span style={{ color: '#94a3b8', fontSize: '0.72rem' }}>
              💡 가이드: [도구 선택] ➡ [격자 클릭 배치], 마우스 드래그로 장비 이동 가능.
            </span>
            <div className="grid-zoom-tag font-mono-tech">SNAP GRID: 20PX</div>
          </div>

          <div className="editor-canvas-container">
            <canvas 
              ref={canvasRef} 
              className="editor-grid-canvas"
              onPointerDown={handlePointerDown}
              onPointerMove={handlePointerMove}
              onPointerUp={handlePointerUp}
            />
          </div>
        </div>

        {/* Column C: Properties Inspector & Connection List */}
        <div className="editor-inspector-sidebar glass-panel font-mono-tech">
          <div className="panel-title" style={{ fontSize: '0.78rem', borderBottom: '1px solid rgba(255,255,255,0.06)', paddingBottom: '0.5rem', marginBottom: '0.75rem' }}>
            <Sliders size={14} className="text-neon-cyan" />
            <span>설비 속성 제어반 (INSPECTOR)</span>
          </div>

          {activeNode ? (
            <div className="inspector-content">
              {/* Common Name/Label */}
              <div className="inspector-field">
                <label className="field-label">설비 커스텀 명칭</label>
                <input 
                  type="text" 
                  value={activeNode.label} 
                  onChange={(e) => updateNodeLabel(e.target.value)}
                  className="inspector-input"
                />
              </div>

              <div className="inspector-field">
                <label className="field-label">설비 종류</label>
                <span className="field-static-tag">{activeNode.type.toUpperCase()}</span>
              </div>

              {/* Node-type Specific Settings */}
              {activeNode.type === 'feeder' && (
                <>
                  <div className="inspector-field">
                    <label className="field-label">소재 공급률 (Cycle / 10s)</label>
                    <input 
                      type="range" min="2" max="8" step="0.5"
                      value={activeNode.parameters.feedRate || 4}
                      onChange={(e) => updateNodeParameter('feedRate', Number(e.target.value))}
                      className="inspector-slider"
                    />
                    <div className="field-value-display">{(activeNode.parameters.feedRate || 4).toFixed(1)} 회</div>
                  </div>

                  <div className="inspector-field">
                    <label className="field-label">바디 섀시 색상</label>
                    <select 
                      value={activeNode.parameters.payloadColor || '#38bdf8'}
                      onChange={(e) => updateNodeParameter('payloadColor', e.target.value)}
                      className="inspector-input"
                    >
                      <option value="#38bdf8">Neon Blue (세단)</option>
                      <option value="#ec4899">Hot Pink (SUV)</option>
                      <option value="#10b981">Emerald Green (전기차)</option>
                      <option value="#f97316">Neon Orange (쿠페)</option>
                    </select>
                  </div>
                </>
              )}

              {activeNode.type === 'press' && (
                <>
                  <div className="inspector-field">
                    <label className="field-label">압착 목표치 압력 (Setpoint)</label>
                    <input 
                      type="range" min="150" max="300" step="10"
                      value={activeNode.parameters.targetPressure || 210}
                      onChange={(e) => updateNodeParameter('targetPressure', Number(e.target.value))}
                      className="inspector-slider"
                    />
                    <div className="field-value-display">{(activeNode.parameters.targetPressure || 210)} Bar</div>
                  </div>

                  <div className="inspector-field">
                    <label className="field-label">압축 성형 가공 시간</label>
                    <input 
                      type="range" min="1" max="6" step="1"
                      value={activeNode.parameters.cycleDuration || 3}
                      onChange={(e) => updateNodeParameter('cycleDuration', Number(e.target.value))}
                      className="inspector-slider"
                    />
                    <div className="field-value-display">{(activeNode.parameters.cycleDuration || 3)} 초</div>
                  </div>
                </>
              )}

              {activeNode.type === 'weld_robot' && (
                <>
                  <div className="inspector-field">
                    <label className="field-label">아크 방전 전류 강도 (Ampere)</label>
                    <input 
                      type="range" min="80" max="150" step="5"
                      value={activeNode.parameters.arcCurrent || 120}
                      onChange={(e) => updateNodeParameter('arcCurrent', Number(e.target.value))}
                      className="inspector-slider"
                    />
                    <div className="field-value-display">{(activeNode.parameters.arcCurrent || 120)} A</div>
                  </div>

                  <div className="inspector-field">
                    <label className="field-label">용접 작업 소요 시간</label>
                    <input 
                      type="range" min="1" max="5" step="1"
                      value={activeNode.parameters.cycleDuration || 2}
                      onChange={(e) => updateNodeParameter('cycleDuration', Number(e.target.value))}
                      className="inspector-slider"
                    />
                    <div className="field-value-display">{(activeNode.parameters.cycleDuration || 2)} 초</div>
                  </div>
                </>
              )}

              {activeNode.type === 'paint_spray' && (
                <>
                  <div className="inspector-field">
                    <label className="field-label">스프레이 노즐 토출 압력</label>
                    <input 
                      type="range" min="3.0" max="6.0" step="0.1"
                      value={activeNode.parameters.nozzlePressure || 4.5}
                      onChange={(e) => updateNodeParameter('nozzlePressure', Number(e.target.value))}
                      className="inspector-slider"
                    />
                    <div className="field-value-display">{(activeNode.parameters.nozzlePressure || 4.5).toFixed(1)} Bar</div>
                  </div>

                  <div className="inspector-field">
                    <label className="field-label">분무 도색 색상 선택</label>
                    <input 
                      type="color" 
                      value={activeNode.parameters.colorHex || '#ec4899'} 
                      onChange={(e) => updateNodeParameter('colorHex', e.target.value)}
                      style={{ width: '100%', height: '32px', background: 'transparent', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '6px', cursor: 'pointer' }}
                    />
                  </div>
                </>
              )}

              {activeNode.type === 'drying_oven' && (
                <>
                  <div className="inspector-field">
                    <label className="field-label">IR 가열 목표치 온도 (°C)</label>
                    <input 
                      type="range" min="80" max="140" step="5"
                      value={activeNode.parameters.targetTemp || 110}
                      onChange={(e) => updateNodeParameter('targetTemp', Number(e.target.value))}
                      className="inspector-slider"
                    />
                    <div className="field-value-display">{(activeNode.parameters.targetTemp || 110)} °C</div>
                  </div>

                  <div className="inspector-field">
                    <label className="field-label">도막 건조 베이킹 타임</label>
                    <input 
                      type="range" min="2" max="8" step="1"
                      value={activeNode.parameters.cycleDuration || 4}
                      onChange={(e) => updateNodeParameter('cycleDuration', Number(e.target.value))}
                      className="inspector-slider"
                    />
                    <div className="field-value-display">{(activeNode.parameters.cycleDuration || 4)} 초</div>
                  </div>
                </>
              )}

              {activeNode.type === 'storage_rack' && (
                <div className="inspector-field">
                  <label className="field-label">창고 하이베이 총 보관 용량</label>
                  <input 
                    type="range" min="12" max="64" step="4"
                    value={activeNode.parameters.storageCapacity || 36}
                    onChange={(e) => updateNodeParameter('storageCapacity', Number(e.target.value))}
                    className="inspector-slider"
                  />
                  <div className="field-value-display">{(activeNode.parameters.storageCapacity || 36)} PALLETS</div>
                </div>
              )}

              {/* Action Buttons inside inspector */}
              <button 
                onClick={handleDeleteNode}
                className="inspector-action-btn delete-btn font-mono-tech"
              >
                <Trash2 size={13} />
                <span>설비 해체 (DELETE)</span>
              </button>
            </div>
          ) : (
            <div className="empty-inspector">
              <Info size={24} className="text-neon-cyan" style={{ marginBottom: '0.75rem', opacity: 0.6 }} />
              <p style={{ margin: 0 }}>격자판 위 장비 아이콘을 클릭하여 속성을 조절해 보십시오.</p>
            </div>
          )}

          {/* Quick status of piping connections */}
          <div className="panel-title" style={{ fontSize: '0.78rem', borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: '0.75rem', marginTop: 'auto', marginBottom: '0.5rem' }}>
            <Cpu size={14} className="text-neon-cyan" />
            <span>이송 컨베이어 연결선 목록</span>
          </div>
          <div className="connections-small-list font-mono-tech">
            {connections.length > 0 ? (
              connections.map(conn => {
                const from = nodes.find(n=>n.id===conn.fromNode)?.label || 'Unknown';
                const to = nodes.find(n=>n.id===conn.toNode)?.label || 'Unknown';
                return (
                  <div key={conn.id} className="conn-log-row">
                    <span style={{ color: '#38bdf8' }}>{from}</span>
                    <ArrowRight size={10} style={{ color: '#64748b' }} />
                    <span style={{ color: '#10b981' }}>{to}</span>
                    <button 
                      onClick={() => setConnections(prev => prev.filter(c=>c.id !== conn.id))}
                      style={{ marginLeft: 'auto', background: 'transparent', border: 'none', color: '#ef4444', fontSize: '0.65rem', cursor: 'pointer', outline: 'none' }}
                    >
                      해체
                    </button>
                  </div>
                );
              })
            ) : (
              <span style={{ fontSize: '0.65rem', color: '#64748b', textAlign: 'center', display: 'block', padding: '0.5rem 0' }}>컨베이어 연결선이 비어 있습니다.</span>
            )}
          </div>
        </div>

      </div>

      {/* Interactive Toast Notifications */}
      {toast.show && (
        <div className={`editor-toast font-mono-tech ${toast.type}`}>
          <Sparkles size={14} />
          <span>{toast.msg}</span>
        </div>
      )}

      <style>{`
        .factory-editor-container {
          display: flex;
          flex-direction: column;
          gap: 1rem;
          width: 100%;
          height: calc(100vh - 3rem);
          box-sizing: border-box;
          animation: fadeIn 0.8s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }

        .editor-control-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 0.75rem 1.25rem;
          height: 3.5rem;
          box-sizing: border-box;
          border-color: rgba(56, 189, 248, 0.2);
        }

        .editor-workspace-layout {
          display: grid;
          grid-template-columns: 280px 1fr 280px;
          gap: 1rem;
          flex: 1;
          height: calc(100% - 4.5rem);
          box-sizing: border-box;
          overflow: hidden;
        }

        /* Column A: Palette Sidebar Styling */
        .editor-palette-sidebar {
          padding: 1rem;
          display: flex;
          flex-direction: column;
          gap: 0.75rem;
          overflow-y: auto;
          box-sizing: border-box;
          height: 100%;
        }

        .tool-category-label {
          font-size: 0.65rem;
          color: var(--text-muted);
          text-transform: uppercase;
          letter-spacing: 0.5px;
          margin-top: 0.25rem;
          font-weight: 700;
        }

        .palette-grid {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 0.5rem;
        }

        .palette-grid.flex-col {
          display: flex;
          flex-direction: column;
          gap: 0.45rem;
        }

        .palette-tool-item {
          background: rgba(255,255,255,0.02);
          border: 1px solid rgba(255,255,255,0.06);
          color: var(--text-secondary);
          padding: 0.45rem;
          border-radius: 6px;
          font-size: 0.72rem;
          cursor: pointer;
          transition: all 0.2s ease;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 4px;
          font-weight: 600;
        }

        .palette-tool-item:hover {
          background: rgba(56, 189, 248, 0.05);
          color: var(--text-primary);
          border-color: rgba(56, 189, 248, 0.2);
        }

        .palette-tool-item.active {
          background: rgba(56, 189, 248, 0.12);
          color: #38bdf8;
          border-color: rgba(56, 189, 248, 0.45);
          box-shadow: 0 0 10px rgba(56, 189, 248, 0.08);
        }

        .palette-machine-item {
          background: rgba(255,255,255,0.015);
          border: 1px solid rgba(255,255,255,0.04);
          color: var(--text-secondary);
          padding: 0.5rem 0.75rem;
          border-radius: 8px;
          cursor: pointer;
          transition: all 0.25s cubic-bezier(0.16, 1, 0.3, 1);
          display: flex;
          align-items: center;
          gap: 12px;
        }

        .palette-machine-item .symbol {
          width: 14px;
          height: 14px;
          border-radius: 4px;
          flex-shrink: 0;
        }

        .feeder-color { background: #38bdf8; }
        .press-color { background: #f97316; }
        .weld-color { background: #a855f7; }
        .paint-color { background: #ec4899; }
        .oven-color { background: #ef4444; }
        .rack-color { background: #f59e0b; }

        .palette-machine-item:hover {
          background: rgba(255, 255, 255, 0.03);
          border-color: rgba(255, 255, 255, 0.1);
          transform: translateX(2px);
        }

        .palette-machine-item.active {
          background: rgba(56, 189, 248, 0.06);
          border-color: rgba(56, 189, 248, 0.35);
          color: #fff;
        }

        .m-label {
          font-size: 0.76rem;
          font-weight: 700;
          color: var(--text-primary);
        }

        .m-desc {
          font-size: 0.6rem;
          color: var(--text-muted);
          margin-top: 1px;
        }

        /* Column B: Board Canvas Grid */
        .editor-board-main {
          display: flex;
          flex-direction: column;
          overflow: hidden;
          box-sizing: border-box;
          height: 100%;
        }

        .board-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 0.5rem 1rem;
          border-bottom: 1px solid rgba(255,255,255,0.06);
          background: rgba(13, 20, 38, 0.4);
        }

        .grid-zoom-tag {
          font-size: 0.65rem;
          color: var(--color-cyber-blue);
          background: rgba(56, 189, 248, 0.08);
          border: 1px solid rgba(56, 189, 248, 0.2);
          padding: 1px 5px;
          border-radius: 4px;
          font-weight: 700;
        }

        .editor-canvas-container {
          flex: 1;
          width: 100%;
          background: #060913;
          position: relative;
          overflow: hidden;
          cursor: crosshair;
        }

        .editor-grid-canvas {
          width: 100%;
          height: 100%;
          display: block;
        }

        /* Column C: Properties Inspector Styling */
        .editor-inspector-sidebar {
          padding: 1rem;
          display: flex;
          flex-direction: column;
          gap: 0.75rem;
          overflow-y: auto;
          box-sizing: border-box;
          height: 100%;
        }

        .empty-inspector {
          flex: 1;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          text-align: center;
          font-size: 0.75rem;
          color: var(--text-muted);
          padding: 1.5rem;
          line-height: 1.5;
        }

        .inspector-content {
          display: flex;
          flex-direction: column;
          gap: 1rem;
          flex: 1;
        }

        .inspector-field {
          display: flex;
          flex-direction: column;
          gap: 0.35rem;
        }

        .field-label {
          font-size: 0.7rem;
          color: var(--text-secondary);
          font-weight: 600;
          letter-spacing: 0.2px;
        }

        .inspector-input {
          background: rgba(255, 255, 255, 0.02);
          border: 1px solid rgba(255, 255, 255, 0.08);
          color: #fff;
          padding: 0.45rem 0.65rem;
          border-radius: 6px;
          font-size: 0.75rem;
          font-family: inherit;
          width: 100%;
          box-sizing: border-box;
        }

        .inspector-input:focus {
          border-color: rgba(56, 189, 248, 0.4);
          outline: none;
        }

        .field-static-tag {
          font-size: 0.68rem;
          font-weight: 700;
          color: var(--color-cyber-blue);
          background: rgba(56, 189, 248, 0.08);
          border: 1px solid rgba(56, 189, 248, 0.2);
          padding: 3px 8px;
          border-radius: 4px;
          align-self: flex-start;
        }

        .inspector-slider {
          width: 100%;
          height: 4px;
          accent-color: #38bdf8;
          cursor: pointer;
          margin: 4px 0;
        }

        .field-value-display {
          font-size: 0.76rem;
          font-weight: 700;
          color: #10b981;
          text-align: right;
          font-family: 'JetBrains Mono', monospace;
        }

        .inspector-action-btn {
          width: 100%;
          padding: 0.55rem;
          border-radius: 6px;
          font-size: 0.72rem;
          font-weight: 700;
          cursor: pointer;
          transition: all 0.2s;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 6px;
          margin-top: auto;
          border: 1px solid transparent;
        }

        .inspector-action-btn.delete-btn {
          border-color: rgba(239, 68, 68, 0.4);
          background: rgba(239, 68, 68, 0.05);
          color: #f87171;
        }

        .inspector-action-btn.delete-btn:hover {
          background: #ef4444;
          color: #ffffff;
        }

        .connections-small-list {
          flex-shrink: 0;
          max-height: 120px;
          overflow-y: auto;
          border: 1px solid rgba(255,255,255,0.04);
          background: rgba(4, 6, 14, 0.4);
          padding: 0.35rem;
          border-radius: 6px;
          display: flex;
          flex-direction: column;
          gap: 4px;
        }

        .conn-log-row {
          display: flex;
          align-items: center;
          gap: 6px;
          font-size: 0.65rem;
          padding: 0.25rem 0.35rem;
          background: rgba(255,255,255,0.015);
          border-radius: 4px;
        }

        /* Toast Popup */
        .editor-toast {
          position: fixed;
          bottom: 2rem;
          right: 2rem;
          background: rgba(13, 20, 38, 0.95);
          border: 1px solid #10b981;
          color: #10b981;
          padding: 0.75rem 1.25rem;
          border-radius: 10px;
          font-size: 0.78rem;
          font-weight: 600;
          display: flex;
          align-items: center;
          gap: 8px;
          box-shadow: 0 10px 30px rgba(0, 0, 0, 0.5), 0 0 20px rgba(16, 185, 129, 0.1);
          z-index: 200;
          animation: slideUp 0.30s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }

        .editor-toast.error {
          border-color: #ef4444;
          color: #f87171;
          box-shadow: 0 10px 30px rgba(0, 0, 0, 0.5), 0 0 20px rgba(239, 68, 68, 0.1);
        }

        .editor-toast.info {
          border-color: #38bdf8;
          color: #38bdf8;
          box-shadow: 0 10px 30px rgba(0, 0, 0, 0.5), 0 0 20px rgba(56, 189, 248, 0.1);
        }
      `}</style>
    </div>
  );
};
