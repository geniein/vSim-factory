import { useState, useEffect, useRef, useCallback } from 'react';
import type { Item, Machine, SimulationSettings, SimulationStats, LogMessage, ItemStatus, PlcData } from '../types/simulation';

const MAX_LOGS = 50;

// Coordinates for factory layout
export const PATH_COORDINATES = {
  spawn: { x: 50, y: 200 },
  machineEntrance: { x: 230, y: 200 },
  machine: { x: 280, y: 200 },
  machineExit: { x: 330, y: 200 },
  inspectEntrance: { x: 470, y: 200 },
  inspect: { x: 520, y: 200 },
  inspectExit: { x: 570, y: 200 },
  warehouse: { x: 740, y: 100 },
  scrapyard: { x: 740, y: 300 }
};

export function useSimulation() {
  const [isRunning, setIsRunning] = useState<boolean>(false);
  const [settings, setSettings] = useState<SimulationSettings>({
    spawnRate: 2.0,      // spawns every 2 seconds
    conveyorSpeed: 1.5,   // speed multiplier
    processingTime: 1.8,  // takes 1.8s to process
    defectRate: 5.0,      // 5% defect rate
    systemSpeed: 1.0,     // 1x speed
    plcMode: 'emulated'   // 'emulated' for browser-only, 'runtime' for vPLC C++
  });

  const [items, setItems] = useState<Item[]>([]);
  const [machines, setMachines] = useState<Machine[]>([
    {
      id: 'm1',
      name: '초정밀 가공기 (CNC)',
      status: 'idle',
      currentItemId: null,
      processedCount: 0,
      totalBusyTime: 0
    },
    {
      id: 'm2',
      name: '비전 검사 장비 (QC)',
      status: 'idle',
      currentItemId: null,
      processedCount: 0,
      totalBusyTime: 0
    }
  ]);

  const [stats, setStats] = useState<SimulationStats>({
    totalSpawned: 0,
    totalCompleted: 0,
    totalDefective: 0,
    totalProcessed: 0,
    oee: 100,
    bottleneck: '원자재 투입 속도 부족 (대기 중)',
    uptime: 0,
    logs: [],
    plcConnections: { feeder: false, cnc: false, qc: false, sorter: false },
    plcLatency: { feeder: 5, cnc: 5, qc: 5, sorter: 5 }
  });

  const [plcData, setPlcData] = useState<PlcData>({
    feeder: { conveyor_run: false, error: false },
    cnc:    { conveyor_run: false, lift_down: false, clamp_on: false, rotate_right: false, speed: 200, pos: 0, completed: 0, error: false },
    qc:     { conveyor_run: false, laser_on: false, rotate_right: false, completed: 0, error: false },
    sorter: { conveyor_run: false, completed: 0, speed: 200, error: false }
  });

  // Keep mutable references for the animation loop to prevent closure staleness
  const stateRef = useRef({
    isRunning,
    settings,
    items,
    machines,
    stats,
    lastTime: 0,
    spawnAccumulator: 0,
    uptimeAccumulator: 0,
    logCounter: 0
  });

  // WebSocket reference for live vPLC runtime mode
  const wsRef = useRef<WebSocket | null>(null);

  // Sync state ref
  useEffect(() => {
    stateRef.current.isRunning = isRunning;
    stateRef.current.settings = settings;
    stateRef.current.items = items;
    stateRef.current.machines = machines;
    stateRef.current.stats = stats;
  }, [isRunning, settings, items, machines, stats]);

  // Helper to add system logs safely
  const addLog = useCallback((message: string, type: LogMessage['type'] = 'info') => {
    const timestamp = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    const newLog: LogMessage = {
      id: `log-${Date.now()}-${stateRef.current.logCounter++}`,
      timestamp,
      type,
      message
    };

    setStats((prev) => ({
      ...prev,
      logs: [newLog, ...prev.logs].slice(0, MAX_LOGS)
    }));
  }, []);

  // Write variables/registers to vPLCs through WebSocket gateway
  const writePlcRegister = useCallback((plcId: string, address: number, value: number) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        type: 'write_register',
        plcId,
        address,
        value
      }));
    }
  }, []);

  // Control simulation state
  const startSimulation = useCallback(() => {
    if (!isRunning) {
      setIsRunning(true);
      stateRef.current.lastTime = performance.now();
      addLog(
        settings.plcMode === 'runtime'
          ? 'vPLC-Runtime 연동 모드로 가상 공장 가동을 개시합니다.'
          : '가상 에뮬레이터 모드로 가상 공장 가동을 개시합니다.',
        'info'
      );

      // In runtime mode, sync initial settings immediately to PLC registers
      if (settings.plcMode === 'runtime') {
        const speedValue = Math.round(settings.conveyorSpeed * 150); // Scale speed (e.g. 1.5x -> 225)
        writePlcRegister('cnc', 1, speedValue);
        writePlcRegister('sorter', 1, speedValue);
      }
    }
  }, [isRunning, settings.plcMode, settings.conveyorSpeed, writePlcRegister, addLog]);

  const pauseSimulation = useCallback(() => {
    if (isRunning) {
      setIsRunning(false);
      addLog('시뮬레이션을 일시정지합니다.', 'warning');
    }
  }, [isRunning, addLog]);

  const resetSimulation = useCallback(() => {
    setIsRunning(false);
    setItems([]);
    setMachines([
      {
        id: 'm1',
        name: '초정밀 가공기 (CNC)',
        status: 'idle',
        currentItemId: null,
        processedCount: 0,
        totalBusyTime: 0
      },
      {
        id: 'm2',
        name: '비전 검사 장비 (QC)',
        status: 'idle',
        currentItemId: null,
        processedCount: 0,
        totalBusyTime: 0
      }
    ]);
    setStats({
      totalSpawned: 0,
      totalCompleted: 0,
      totalDefective: 0,
      totalProcessed: 0,
      oee: 100,
      bottleneck: '원자재 투입 속도 부족 (대기 중)',
      uptime: 0,
      logs: [],
      plcConnections: { feeder: false, cnc: false, qc: false, sorter: false },
      plcLatency: { feeder: 5, cnc: 5, qc: 5, sorter: 5 }
    });
    stateRef.current.spawnAccumulator = 0;
    stateRef.current.uptimeAccumulator = 0;
    stateRef.current.logCounter = 0;
    
    // Clear logs immediately
    setTimeout(() => {
      addLog('시스템이 초기화되었습니다. 생산 대기 중.', 'info');
    }, 50);
  }, [addLog]);

  const setSystemSpeed = useCallback((speed: number) => {
    setSettings(prev => ({ ...prev, systemSpeed: speed }));
    addLog(`배속이 ${speed}x 로 조정되었습니다.`, 'info');
  }, [addLog]);

  // ==============================================================================
  // 1. WEBSOCKET HIL CONNECTION LIFECYCLE (vPLC-Runtime Mode)
  // ==============================================================================
  useEffect(() => {
    if (settings.plcMode !== 'runtime') {
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
      return;
    }

    addLog('Modbus/S7/MC/XGT 중계 게이트웨이(ws://localhost:4546) 연결 시도 중...', 'info');

    const connectWs = () => {
      if (settings.plcMode !== 'runtime') return;

      const ws = new WebSocket('ws://localhost:4546');
      wsRef.current = ws;

      ws.onopen = () => {
        addLog('🔌 중계 게이트웨이 소켓 연결에 성공했습니다.', 'success');
        
        // Sync speed setting to PLCs
        const speedValue = Math.round(settings.conveyorSpeed * 150);
        writePlcRegister('cnc', 1, speedValue);
        writePlcRegister('sorter', 1, speedValue);
      };

      ws.onmessage = (event) => {
        try {
          const packet = JSON.parse(event.data);
          
          if (packet.type === 'connection_status') {
            const conns = packet.plcConnections;
            setStats(prev => ({
              ...prev,
              plcConnections: conns
            }));
          } 
          
          else if (packet.type === 'plc_data') {
            const pd = packet.plcData;
            setPlcData(pd);
            
            if (stateRef.current.isRunning) {
              // Map C++ vPLC dynamic physical states directly into React animation & stats!
            // 1. CNC Machine (PLC #2) Pos (0 to 1000 mm) maps to active conveyor cargo!
            const pos = pd.cnc.pos || 0;
            const activeItems: Item[] = [];

            if (pos > 0 && pos < 1000) {
              let itemStatus: ItemStatus = 'conveyor1';
              let progress = 0;
              let x = PATH_COORDINATES.spawn.x;
              let y = PATH_COORDINATES.spawn.y;

              if (pos <= 500) {
                // Conveyor 1: moving from Spawn (50, 200) to CNC entrance (230, 200)
                itemStatus = 'conveyor1';
                progress = pos / 500;
                const dx = PATH_COORDINATES.machineEntrance.x - PATH_COORDINATES.spawn.x;
                x = PATH_COORDINATES.spawn.x + dx * progress;
                y = PATH_COORDINATES.spawn.y;
              } else if (pos > 500) {
                // Conveyor 2: moving from CNC Exit (330, 200) to Sorter / QC (470, 200)
                itemStatus = 'conveyor2';
                progress = (pos - 500) / 500;
                const dx = PATH_COORDINATES.inspectEntrance.x - PATH_COORDINATES.machineExit.x;
                x = PATH_COORDINATES.machineExit.x + dx * progress;
                y = PATH_COORDINATES.machineExit.y;
              }

              activeItems.push({
                id: 'ITEM-PLC',
                spawnTime: Date.now(),
                status: itemStatus,
                progress,
                quality: 'unknown',
                x,
                y,
                history: []
              });
            } else if (pos === 500) {
              // Exact 500mm means processing in CNC Machine (M1)
              activeItems.push({
                id: 'ITEM-PLC',
                spawnTime: Date.now(),
                status: 'processing',
                progress: 0.5,
                quality: 'unknown',
                x: PATH_COORDINATES.machine.x,
                y: PATH_COORDINATES.machine.y,
                history: []
              });
            }

            setItems(activeItems);

            // 2. Map CNC Machine state based on PLC clamp/spindle indicators
            setMachines(prev => prev.map(m => {
              if (m.id === 'm1') {
                const isBlocked = pd.cnc.clamp_on && !pd.cnc.conveyor_run;
                const status = isBlocked ? 'blocked' : (pd.cnc.conveyor_run || pd.cnc.lift_down) ? 'processing' : 'idle';
                return {
                  ...m,
                  status,
                  processedCount: pd.cnc.completed || 0,
                  currentItemId: pd.cnc.conveyor_run ? 'ITEM-PLC' : null
                };
              } else if (m.id === 'm2') {
                // QC vision inspector status based on MC laser_on
                const status = pd.qc.laser_on ? 'processing' : 'idle';
                return {
                  ...m,
                  status,
                  processedCount: pd.qc.completed || 0,
                  currentItemId: pd.qc.laser_on ? 'ITEM-PLC' : null
                };
              }
              return m;
            }));

            // 3. Map Sorter statistics
            setStats(prev => {
              const totalCompleted = pd.sorter.completed || 0;
              const totalSpawned = pd.feeder.conveyor_run ? totalCompleted + 1 : totalCompleted;
              
              // Dynamic OEE based on how many PLCs are currently online
              const conns = prev.plcConnections || { feeder: false, cnc: false, qc: false, sorter: false };
              const onlineCount = Object.values(conns).filter(Boolean).length;
              const calculatedOee = Math.round((onlineCount / 4) * 100);

              // Detect bottlenecks
              let bottleneck = '원자재 투입 대기 중 (Feeder)';
              if (onlineCount < 4) {
                bottleneck = 'vPLC 가상 런타임 오프라인 단선 발생';
              } else if (pd.cnc.lift_down) {
                bottleneck = 'CNC 가공 가동 안정화 구간';
              } else if (pd.qc.laser_on) {
                bottleneck = 'QC 검정 기계 비전 리딩 구간';
              } else if (pd.feeder.conveyor_run) {
                bottleneck = '원자재 피딩 투입 활성';
              }

              return {
                ...prev,
                totalSpawned,
                totalCompleted,
                totalProcessed: totalCompleted,
                oee: calculatedOee,
                bottleneck
              };
            });
            }
          }
        } catch (err) {
          // Parse err silently
        }
      };

      ws.onclose = () => {
        if (settings.plcMode === 'runtime') {
          setStats(prev => ({
            ...prev,
            plcConnections: { feeder: false, cnc: false, qc: false, sorter: false }
          }));
          setTimeout(connectWs, 3000);
        }
      };

      ws.onerror = () => {
        ws.close();
      };
    };

    connectWs();

    return () => {
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
    };
  }, [settings.plcMode]);

  // Write changes when speed setting is updated by user in runtime mode
  const handleSpeedUpdate = useCallback((newSpeed: number) => {
    setSettings(prev => {
      const nextSettings = { ...prev, conveyorSpeed: newSpeed };
      
      if (nextSettings.plcMode === 'runtime') {
        const speedValue = Math.round(newSpeed * 150); // Scale speed factor
        writePlcRegister('cnc', 1, speedValue);
        writePlcRegister('sorter', 1, speedValue);
        addLog(`[vPLC 원격 전송] CNC/Sorter speed = ${speedValue} mm/s 기입 완료`, 'info');
      }

      return nextSettings;
    });
  }, [writePlcRegister, addLog]);

  // ==============================================================================
  // 2. STANDALONE BROWSER-ONLY SIMULATION FRAME TICK LOOP (Emulated Mode)
  // ==============================================================================
  useEffect(() => {
    let animationId: number;

    const tick = (time: number) => {
      if (!stateRef.current.isRunning || stateRef.current.settings.plcMode === 'runtime') {
        stateRef.current.lastTime = time;
        animationId = requestAnimationFrame(tick);
        return;
      }

      // Calculate elapsed time (seconds)
      const realDelta = (time - stateRef.current.lastTime) / 1000;
      stateRef.current.lastTime = time;

      // Bound delta to prevent huge jumps on tab switch
      const delta = Math.min(realDelta, 0.1) * stateRef.current.settings.systemSpeed;

      // Read mutable state variables
      const { settings: currentSettings, items: currentItems, machines: currentMachines } = stateRef.current;

      // Update Uptime Accumulator
      stateRef.current.uptimeAccumulator += delta;
      const newUptime = Math.floor(stateRef.current.uptimeAccumulator);

      // Spawn New Items
      stateRef.current.spawnAccumulator += delta;
      let spawnedItem: Item | null = null;
      
      const spawnInterval = currentSettings.spawnRate;
      if (stateRef.current.spawnAccumulator >= spawnInterval) {
        stateRef.current.spawnAccumulator -= spawnInterval;

        const firstItem = currentItems.find(i => i.status === 'conveyor1');
        const canSpawn = !firstItem || firstItem.progress > 0.15; // Space buffer for spawning crate

        if (canSpawn) {
          const rawId = Math.random().toString(36).substring(2, 6).toUpperCase();
          const itemId = `ITEM-${rawId}`;
          spawnedItem = {
            id: itemId,
            spawnTime: time,
            status: 'conveyor1',
            progress: 0,
            quality: 'unknown',
            x: PATH_COORDINATES.spawn.x,
            y: PATH_COORDINATES.spawn.y,
            history: [{ status: 'spawned', time }]
          };
        }
      }

      // Process active Items & Conveyors
      let updatedItems: Item[] = spawnedItem ? [...currentItems, spawnedItem] : [...currentItems];
      let updatedMachines = currentMachines.map(m => ({ ...m }));
      
      const m1 = updatedMachines.find(m => m.id === 'm1')!;
      const m2 = updatedMachines.find(m => m.id === 'm2')!;

      // Spacing margins
      const CONVEYOR1_LENGTH = PATH_COORDINATES.machineEntrance.x - PATH_COORDINATES.spawn.x;
      const CONVEYOR2_LENGTH = PATH_COORDINATES.inspectEntrance.x - PATH_COORDINATES.machineExit.x;
      const CONVEYOR3_LENGTH = PATH_COORDINATES.warehouse.x - PATH_COORDINATES.inspectExit.x;

      const spacingMargin1 = 30 / CONVEYOR1_LENGTH; 
      const spacingMargin2 = 30 / CONVEYOR2_LENGTH;
      const spacingMargin3 = 30 / CONVEYOR3_LENGTH;

      const finalActiveItems: Item[] = [];
      let completedInThisTick = 0;
      let defectiveInThisTick = 0;
      let processedInThisTick = 0;

      const itemsByStatus: Record<ItemStatus, Item[]> = {
        spawned: [],
        conveyor1: [],
        processing: [],
        conveyor2: [],
        inspecting: [],
        conveyor3: [],
        completed: [],
        defective: []
      };

      updatedItems.forEach(item => {
        itemsByStatus[item.status].push(item);
      });

      // Update Conveyor 3 Items (Warehouse good)
      const conv3Items = [...itemsByStatus.conveyor3].sort((a, b) => b.progress - a.progress);
      conv3Items.forEach((item, index) => {
        let maxProgress = 1.0;
        if (index > 0) {
          maxProgress = conv3Items[index - 1].progress - spacingMargin3;
        }

        const speed = 0.08 * currentSettings.conveyorSpeed * delta;
        const nextProgress = Math.min(item.progress + speed, maxProgress);

        if (nextProgress >= 1.0) {
          completedInThisTick++;
          addLog(`[출하 완료] ${item.id} 창고 입고`, 'success');
        } else {
          const dx = PATH_COORDINATES.warehouse.x - PATH_COORDINATES.inspectExit.x;
          const dy = PATH_COORDINATES.warehouse.y - PATH_COORDINATES.inspectExit.y;
          finalActiveItems.push({
            ...item,
            progress: nextProgress,
            x: PATH_COORDINATES.inspectExit.x + dx * nextProgress,
            y: PATH_COORDINATES.inspectExit.y + dy * nextProgress
          });
        }
      });

      // Update Defective Items (Scrapyard)
      const defectItems = [...itemsByStatus.defective].sort((a, b) => b.progress - a.progress);
      defectItems.forEach((item, index) => {
        let maxProgress = 1.0;
        if (index > 0) {
          maxProgress = defectItems[index - 1].progress - spacingMargin3;
        }

        const speed = 0.08 * currentSettings.conveyorSpeed * delta;
        const nextProgress = Math.min(item.progress + speed, maxProgress);

        if (nextProgress >= 1.0) {
          defectiveInThisTick++;
          addLog(`[폐기 조치] ${item.id} 불량 판정으로 스크랩 처리`, 'error');
        } else {
          const dx = PATH_COORDINATES.scrapyard.x - PATH_COORDINATES.inspectExit.x;
          const dy = PATH_COORDINATES.scrapyard.y - PATH_COORDINATES.inspectExit.y;
          finalActiveItems.push({
            ...item,
            progress: nextProgress,
            x: PATH_COORDINATES.inspectExit.x + dx * nextProgress,
            y: PATH_COORDINATES.inspectExit.y + dy * nextProgress
          });
        }
      });

      // Update M2 (QC Vision inspection)
      const inspectingItems = itemsByStatus.inspecting;
      if (inspectingItems.length > 0) {
        const item = inspectingItems[0];
        m2.status = 'processing';
        m2.currentItemId = item.id;
        m2.totalBusyTime += delta * 1000;

        const speed = (1 / 0.8) * delta; // Takes 0.8s
        const nextProgress = item.progress + speed;

        if (nextProgress >= 1.0) {
          const isDefective = Math.random() * 100 < currentSettings.defectRate;
          const quality = isDefective ? 'defective' : 'good';
          const nextStatus = isDefective ? 'defective' : 'conveyor3';
          
          processedInThisTick++;
          m2.processedCount++;
          m2.status = 'idle';
          m2.currentItemId = null;

          addLog(`[비전 QC 완료] ${item.id} 검사 결과: ${isDefective ? '🟥 불량 판정' : '🟩 양품 판정'}`, isDefective ? 'error' : 'success');

          finalActiveItems.push({
            ...item,
            status: nextStatus,
            progress: 0,
            quality,
            x: PATH_COORDINATES.inspectExit.x,
            y: PATH_COORDINATES.inspectExit.y,
            history: [...item.history, { status: nextStatus, time }]
          });
        } else {
          finalActiveItems.push({
            ...item,
            progress: nextProgress,
            x: PATH_COORDINATES.inspect.x,
            y: PATH_COORDINATES.inspect.y
          });
        }
      } else {
        m2.status = 'idle';
        m2.currentItemId = null;
      }

      // Update Conveyor 2 (CNC -> QC)
      const conv2Items = [...itemsByStatus.conveyor2].sort((a, b) => b.progress - a.progress);
      let qcStationOccupied = m2.status === 'processing';
      
      conv2Items.forEach((item, index) => {
        let maxProgress = 1.0;
        if (index > 0) {
          maxProgress = conv2Items[index - 1].progress - spacingMargin2;
        } else if (qcStationOccupied) {
          maxProgress = 0.95;
        }

        const speed = 0.08 * currentSettings.conveyorSpeed * delta;
        const nextProgress = Math.min(item.progress + speed, maxProgress);

        if (nextProgress >= 0.95 && !qcStationOccupied) {
          qcStationOccupied = true;
          finalActiveItems.push({
            ...item,
            status: 'inspecting',
            progress: 0,
            x: PATH_COORDINATES.inspect.x,
            y: PATH_COORDINATES.inspect.y,
            history: [...item.history, { status: 'inspecting', time }]
          });
        } else {
          const dx = PATH_COORDINATES.inspectEntrance.x - PATH_COORDINATES.machineExit.x;
          finalActiveItems.push({
            ...item,
            progress: nextProgress,
            x: PATH_COORDINATES.machineExit.x + dx * nextProgress,
            y: PATH_COORDINATES.machineExit.y
          });
        }
      });

      // Update M1 (CNC processing)
      const processingItems = itemsByStatus.processing;
      const isConveyor2BackedUp = conv2Items.length > 0 && conv2Items[conv2Items.length - 1].progress < spacingMargin2;
      
      if (processingItems.length > 0) {
        const item = processingItems[0];
        
        if (isConveyor2BackedUp) {
          m1.status = 'blocked';
          m1.currentItemId = item.id;
          finalActiveItems.push({
            ...item,
            x: PATH_COORDINATES.machine.x,
            y: PATH_COORDINATES.machine.y
          });
        } else {
          m1.status = 'processing';
          m1.currentItemId = item.id;
          m1.totalBusyTime += delta * 1000;

          const speed = (1 / currentSettings.processingTime) * delta;
          const nextProgress = item.progress + speed;

          if (nextProgress >= 1.0) {
            m1.processedCount++;
            m1.status = 'idle';
            m1.currentItemId = null;
            addLog(`[CNC 공정 완료] ${item.id} 가공 처리 및 냉각 완료`, 'info');

            finalActiveItems.push({
              ...item,
              status: 'conveyor2',
              progress: 0,
              x: PATH_COORDINATES.machineExit.x,
              y: PATH_COORDINATES.machineExit.y,
              history: [...item.history, { status: 'conveyor2', time }]
            });
          } else {
            finalActiveItems.push({
              ...item,
              progress: nextProgress,
              x: PATH_COORDINATES.machine.x,
              y: PATH_COORDINATES.machine.y
            });
          }
        }
      } else {
        m1.status = 'idle';
        m1.currentItemId = null;
      }

      // Update Conveyor 1 (Spawn -> CNC)
      const conv1Items = [...itemsByStatus.conveyor1].sort((a, b) => b.progress - a.progress);
      let cncOccupied = m1.status === 'processing' || m1.status === 'blocked';
      
      conv1Items.forEach((item, index) => {
        let maxProgress = 1.0;
        if (index > 0) {
          maxProgress = conv1Items[index - 1].progress - spacingMargin1;
        } else if (cncOccupied) {
          maxProgress = 0.95;
        }

        const speed = 0.08 * currentSettings.conveyorSpeed * delta;
        const nextProgress = Math.min(item.progress + speed, maxProgress);

        if (nextProgress >= 0.95 && !cncOccupied) {
          cncOccupied = true;
          finalActiveItems.push({
            ...item,
            status: 'processing',
            progress: 0,
            x: PATH_COORDINATES.machine.x,
            y: PATH_COORDINATES.machine.y,
            history: [...item.history, { status: 'processing', time }]
          });
        } else {
          const dx = PATH_COORDINATES.machineEntrance.x - PATH_COORDINATES.spawn.x;
          finalActiveItems.push({
            ...item,
            progress: nextProgress,
            x: PATH_COORDINATES.spawn.x + dx * nextProgress,
            y: PATH_COORDINATES.spawn.y
          });
        }
      });

      // Update states and aggregate Stats
      setItems(finalActiveItems);
      setMachines(updatedMachines);

      setStats(prev => {
        const totalSpawned = prev.totalSpawned + (spawnedItem ? 1 : 0);
        const totalCompleted = prev.totalCompleted + completedInThisTick;
        const totalDefective = prev.totalDefective + defectiveInThisTick;
        const totalProcessed = prev.totalProcessed + processedInThisTick;

        const activeTime = newUptime > 0 ? newUptime : 1;
        const m1BusyRatio = Math.min(m1.totalBusyTime / (activeTime * 1000), 1.0);
        
        const totalChecked = totalCompleted + totalDefective;
        const yieldRatio = totalChecked > 0 ? (totalCompleted / totalChecked) : 1.0;
        
        const calculatedOee = Math.round((m1BusyRatio * 0.4 + 0.6) * yieldRatio * 100);

        let currentBottleneck = '원자재 투입 속도 부족 (대기 중)';
        if (m1.status === 'blocked') {
          currentBottleneck = '비전 검사기 가공 지연 (컨베이어 2 정체)';
        } else if (conv1Items.length >= 4) {
          currentBottleneck = 'CNC 가공 장비 가공 속도 병목';
        } else if (m1.status === 'processing') {
          currentBottleneck = '가동 안정 구간';
        }

        return {
          ...prev,
          totalSpawned,
          totalCompleted,
          totalDefective,
          totalProcessed,
          oee: Math.min(Math.max(calculatedOee, 10), 100),
          bottleneck: currentBottleneck,
          uptime: newUptime
        };
      });

      animationId = requestAnimationFrame(tick);
    };

    animationId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(animationId);
  }, []);

  return {
    isRunning,
    settings,
    items,
    machines,
    stats,
    plcData,
    setSettings,
    startSimulation,
    pauseSimulation,
    resetSimulation,
    setSystemSpeed,
    handleSpeedUpdate,
    addLog
  };
}
