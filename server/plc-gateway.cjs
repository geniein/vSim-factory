const net = require('net');
const http = require('http');
const { WebSocketServer } = require('ws');
const modbus = require('jsmodbus');
const nodes7 = require('nodes7');

// ==========================================
// 1. 설정 및 포트 정의
// ==========================================
const WS_PORT = 4546;

const PLC_CONFIGS = {
  feeder: { ip: '127.0.0.1', port: 5030, protocol: 'modbus' },
  cnc:    { ip: '127.0.0.1', port: 1040, protocol: 's7'     },
  qc:     { ip: '127.0.0.1', port: 5041, protocol: 'mc'     },
  sorter: { ip: '127.0.0.1', port: 2044, protocol: 'xgt'    }
};

// ==========================================
// 2. 실시간 로거
// ==========================================
const colors = {
  reset: "\x1b[0m",
  bold: "\x1b[1m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
  magenta: "\x1b[35m",
  cyan: "\x1b[36m",
  red: "\x1b[31m",
  gray: "\x1b[90m"
};

function log(type, message, color = colors.reset) {
  const now = new Date();
  const timeStr = now.toLocaleTimeString([], { hour12: false }) + '.' + String(now.getMilliseconds()).padStart(3, '0');
  console.log(`${colors.gray}[${timeStr}]${colors.reset} ${color}${colors.bold}[${type}]${colors.reset} ${message}`);
}

// ==========================================
// 3. 글로벌 상태 변수
// ==========================================
const plcConnections = {
  feeder: false,
  cnc: false,
  qc: false,
  sorter: false
};

const plcData = {
  feeder: { conveyor_run: false, pos: 0, completed: 0, speed: 200, error: false },
  cnc:    { conveyor_run: false, lift_down: false, clamp_on: false, rotate_right: false, speed: 200, pos: 0, completed: 0, error: false },
  qc:     { conveyor_run: false, laser_on: false, rotate_right: false, completed: 0, error: false },
  sorter: { conveyor_run: false, completed: 0, speed: 200, error: false }
};

// ==========================================
// 4. PROTOCOL 1: Modbus TCP Client (Feeder PLC #1 - Port 5030)
// ==========================================
let modbusClient = null;
let modbusSocket = null;

function connectModbus() {
  const { ip, port } = PLC_CONFIGS.feeder;
  log('MODBUS', `PLC #1 Feeder 소켓 연결 시도 중 (${ip}:${port})...`, colors.blue);
  
  modbusSocket = new net.Socket();
  modbusClient = new modbus.client.TCP(modbusSocket);

  modbusSocket.on('connect', () => {
    log('MODBUS', `🟢 PLC #1 Feeder 연결 성공!`, colors.green);
    plcConnections.feeder = true;
    broadcastStatus();
  });

  modbusSocket.on('error', (err) => {
    if (plcConnections.feeder) {
      log('MODBUS', `🔴 PLC #1 Feeder 연결 오류: ${err.message}`, colors.red);
    }
  });

  modbusSocket.on('close', () => {
    if (plcConnections.feeder) {
      log('MODBUS', `🔴 PLC #1 Feeder 연결이 끊어졌습니다.`, colors.yellow);
      plcConnections.feeder = false;
      broadcastStatus();
    }
    setTimeout(connectModbus, 3000); // 3초 후 재연결 시도
  });

  modbusSocket.connect({ host: ip, port: port });
}

async function pollModbus() {
  if (!plcConnections.feeder || !modbusClient) return;

  try {
    // 1. Read Coils 0-8 to check %QX0.0 (Feeder push conveyor)
    const resp = await modbusClient.readCoils(0, 8);
    const coils = resp.response.body.valuesAsArray;
    
    plcData.feeder.conveyor_run = coils[0] || false;
    plcData.feeder.error = coils[6] || false;

    // 2. Read Holding Registers 0-2 (completed, speed)
    const holdingResp = await modbusClient.readHoldingRegisters(0, 2);
    const holdingRegs = holdingResp.response.body.valuesAsArray;
    plcData.feeder.completed = holdingRegs[0] || 0;
    plcData.feeder.speed = holdingRegs[1] || 200;

    // 3. Read Input Registers 0-1 (pos)
    const inputResp = await modbusClient.readInputRegisters(0, 1);
    const inputRegs = inputResp.response.body.valuesAsArray;
    plcData.feeder.pos = inputRegs[0] || 0;
  } catch (err) {
    // Silent fail on polling error to avoid crash
  }
}

// ==========================================
// 5. PROTOCOL 2: Siemens S7 Client (CNC PLC #2 - Port 1040)
// ==========================================
const s7Client = new nodes7();

function connectS7() {
  const { ip, port } = PLC_CONFIGS.cnc;
  log('S7', `PLC #2 CNC 소켓 연결 시도 중 (${ip}:${port})...`, colors.blue);

  // S7 connections require rack 0, slot 1 or 2. S7Server maps directly.
  s7Client.initiateConnection({ host: ip, port: port, rack: 0, slot: 1 }, (err) => {
    if (err) {
      if (plcConnections.cnc) {
        log('S7', `🔴 PLC #2 CNC 연결 오류: ${err}`, colors.red);
      }
      plcConnections.cnc = false;
      broadcastStatus();
      setTimeout(connectS7, 3000);
      return;
    }

    log('S7', `🟢 PLC #2 CNC 연결 성공!`, colors.green);
    plcConnections.cnc = true;
    broadcastStatus();
    
    // Register variables for polling
    // DB1.DBX 272.0 represents Coil 0 (%QX0.0 Conveyor Run)
    // DB1.DBX 272.1 represents Coil 1 (%QX0.1 Robot Lift Down)
    // DB1.DBX 272.2 represents Coil 2 (%QX0.2 Robot Clamp Solenoid)
    // DB1.DBX 272.3 represents Coil 3 (%QX0.3 Robot Rotate Right)
    // DB1.DBX 272.4 represents Coil 4 (%QX0.4 Assembly Done)
    // DB1.DBW 128 represents Input Register %IW0 (Conveyor Position)
    // DB1.DBW 0 represents Holding Register %MW0 (Completed Cars)
    // DB1.DBW 2 represents Holding Register %MW1 (Conveyor Speed)
    const s7Vars = {
      'conveyor_run': 'DB1,X272.0',
      'lift_down': 'DB1,X272.1',
      'clamp_on': 'DB1,X272.2',
      'rotate_right': 'DB1,X272.3',
      'assembly_done': 'DB1,X272.4',
      'pos': 'DB1,INT128',
      'completed': 'DB1,INT0',
      'speed': 'DB1,INT2'
    };

    s7Client.setTranslationCB((tag) => s7Vars[tag] || tag);
    s7Client.addItems(Object.keys(s7Vars));
  });
}

function pollS7() {
  if (!plcConnections.cnc) return;

  s7Client.readAllItems((err, values) => {
    if (err || !values) {
      log('S7', `🔴 PLC #2 CNC 폴링 오류: ${err || 'Empty values'}`, colors.yellow);
      s7Client.dropConnection(() => {
        plcConnections.cnc = false;
        broadcastStatus();
        setTimeout(connectS7, 3000);
      });
      return;
    }

    plcData.cnc.conveyor_run = values.conveyor_run || false;
    plcData.cnc.lift_down = values.lift_down || false;
    plcData.cnc.clamp_on = values.clamp_on || false;
    plcData.cnc.rotate_right = values.rotate_right || false;
    plcData.cnc.pos = values.pos || 0;
    plcData.cnc.completed = values.completed || 0;
    plcData.cnc.speed = values.speed || 200;
  });
}

// ==========================================
// 6. PROTOCOL 3: Mitsubishi MC Protocol Client (QC PLC #3 - Port 5041)
// ==========================================
let mcSocket = null;

function connectMC() {
  const { ip, port } = PLC_CONFIGS.qc;
  log('MELSEC-MC', `PLC #3 QC 소켓 연결 시도 중 (${ip}:${port})...`, colors.blue);

  mcSocket = new net.Socket();

  mcSocket.on('connect', () => {
    log('MELSEC-MC', `🟢 PLC #3 QC 연결 성공!`, colors.green);
    plcConnections.qc = true;
    broadcastStatus();
  });

  mcSocket.on('data', (data) => {
    // Parse QnA 3E Frame Response
    // Header is 11 bytes. Remaining is read data block
    if (data.length >= 15) {
      // D0: Completed Cars (2 bytes, little endian)
      const d0_val = data[11] | (data[12] << 8);
      // D1: Conveyor Speed (2 bytes)
      const d1_val = data[13] | (data[14] << 8);
      
      plcData.qc.completed = d0_val;
      
      // QC specific logic state: Read Y03 (%QX0.3 Laser sweep), Y05 (%QX0.5 Run lamp)
      // Note: For simplicity, we can also query coils.
      // C++ vPLC registers coils at %QX0.0 onwards. In assembly logic, 
      // %QX0.3 is Robot Rotate Solenoid (laser sweep), %QX0.0 is Conveyor Run.
      // We can also extract this or simulate states
      plcData.qc.conveyor_run = plcData.cnc.conveyor_run; // Synced with CNC conveyor
      plcData.qc.laser_on = plcData.cnc.rotate_right;     // CNC arm rotate right maps to laser sweep in QC
      plcData.qc.completed = d0_val;
    }
  });

  mcSocket.on('error', (err) => {
    if (plcConnections.qc) {
      log('MELSEC-MC', `🔴 PLC #3 QC 연결 오류: ${err.message}`, colors.red);
    }
  });

  mcSocket.on('close', () => {
    if (plcConnections.qc) {
      log('MELSEC-MC', `🔴 PLC #3 QC 연결이 끊어졌습니다.`, colors.yellow);
      plcConnections.qc = false;
      broadcastStatus();
    }
    setTimeout(connectMC, 3000);
  });

  mcSocket.connect({ host: ip, port: port });
}

function pollMC() {
  if (!plcConnections.qc || !mcSocket) return;

  // Batch Read D0, D1 (Head device D0, Device Code D=A8, count 2 words)
  // Subheader: 50 00, Net: 00, PC: FF, Dest: FF 03, Station: 00, Length: 0C 00, Timer: 10 00, Cmd: 01 04, Sub: 00 00, Addr: 00 00 00, Code: A8, Count: 02 00
  const req = Buffer.from([
    0x50, 0x00, 0x00, 0xFF, 0xFF, 0x03, 0x00, 0x0C, 0x00, 0x10, 0x00, 0x01, 0x04, 0x00, 0x00, 0x00, 0x00, 0x00, 0xA8, 0x02, 0x00
  ]);
  
  mcSocket.write(req);
}

// ==========================================
// 7. PROTOCOL 4: LS Electric XGT FEnet Client (Sorter PLC #4 - Port 2044)
// ==========================================
let xgtSocket = null;

function connectXGT() {
  const { ip, port } = PLC_CONFIGS.sorter;
  log('LS-XGT', `PLC #4 Sorter 소켓 연결 시도 중 (${ip}:${port})...`, colors.blue);

  xgtSocket = new net.Socket();

  xgtSocket.on('connect', () => {
    log('LS-XGT', `🟢 PLC #4 Sorter 연결 성공!`, colors.green);
    plcConnections.sorter = true;
    broadcastStatus();
  });

  xgtSocket.on('data', (data) => {
    // Parse XGT FEnet Response packet
    if (data.length >= 30) {
      const companyId = data.toString('ascii', 0, 8);
      if (companyId === 'LSIS-XGT') {
        const varLen = data[32] | (data[33] << 8);
        const dataOffset = 34 + varLen;
        
        if (data.length >= dataOffset + 4) {
          const val = data[dataOffset + 2] | (data[dataOffset + 3] << 8);
          
          // Identify if it's completed car counter (%MW0)
          // Look at Sorter stats completed
          plcData.sorter.completed = val;
          plcData.sorter.conveyor_run = plcData.cnc.conveyor_run; // Sync
        }
      }
    }
  });

  xgtSocket.on('error', (err) => {
    if (plcConnections.sorter) {
      log('LS-XGT', `🔴 PLC #4 Sorter 연결 오류: ${err.message}`, colors.red);
    }
  });

  xgtSocket.on('close', () => {
    if (plcConnections.sorter) {
      log('LS-XGT', `🔴 PLC #4 Sorter 연결이 끊어졌습니다.`, colors.yellow);
      plcConnections.sorter = false;
      broadcastStatus();
    }
    setTimeout(connectXGT, 3000);
  });

  xgtSocket.connect({ host: ip, port: port });
}

function pollXGT() {
  if (!plcConnections.sorter || !xgtSocket) return;

  // Read Word Register %MW0 (Completed Cars)
  // InvokeID = 3, Data length = 19 (13 00)
  // Variable name length = 5, Name = "%MW0"
  const header = Buffer.from([
    0x4C, 0x53, 0x49, 0x53, 0x2D, 0x58, 0x47, 0x54, // "LSIS-XGT"
    0x00, 0x00, 0x00, 0x00, 0xA0, 0x33, 0x03, 0x00, 0x12, 0x00
  ]);
  const body = Buffer.from([
    0x00, 0x00, 0x00, 0x00, 0x54, 0x00, 0x02, 0x00, 0x00, 0x00, 0x01, 0x00, 0x04, 0x00, 0x25, 0x4D, 0x57, 0x30 // "%MW0"
  ]);
  
  xgtSocket.write(Buffer.concat([header, body]));
}

// ==========================================
// 8. 100ms 폴링 통합 루프 및 공정 연동 브릿지 (60fps 데이터 갱신)
// ==========================================
let prevFeederCompleted = -1;
let prevCncCompleted = -1;
let prevQcCompleted = -1;

let cncChassisTriggered = false;
let qcChassisTriggered = false;
let sorterChassisTriggered = false;

async function runProcessBridge() {
  // ----------------------------------------------------
  // 1. Feeder (Modbus) ➔ CNC (S7) 브릿지 연동
  // ----------------------------------------------------
  if (plcConnections.feeder && plcConnections.cnc) {
    const curFeederCompleted = plcData.feeder.completed;
    
    // 최초 실행 시 또는 증가 시 감지
    if (prevFeederCompleted !== -1 && curFeederCompleted > prevFeederCompleted) {
      log('BRIDGE', `Feeder ➔ CNC: 가공 Chassis Present (%MW2=1) 주입!`, colors.magenta);
      
      // CNC S7 Holding Register 2 (%MW2 - Chassis Present force) 에 1 기입 (address*2 = 4)
      s7Client.writeItems('DB1,INT4', 1, (err) => {
        if (!err) {
          // 1초 후 자동 회수하여 펄스 트리거 형태로 유지
          setTimeout(() => {
            log('BRIDGE', `Feeder ➔ CNC: 가공 Chassis Present (%MW2=0) 자동 회수`, colors.blue);
            s7Client.writeItems('DB1,INT4', 0, (err) => {});
          }, 1000);
        }
      });
    }
    prevFeederCompleted = curFeederCompleted;
  }

  // ----------------------------------------------------
  // 2. CNC (S7) ➔ QC (MC) 브릿지 연동
  // ----------------------------------------------------
  if (plcConnections.cnc && plcConnections.qc && mcSocket) {
    const curCncCompleted = plcData.cnc.completed;
    if (prevCncCompleted !== -1 && curCncCompleted > prevCncCompleted) {
      log('BRIDGE', `CNC ➔ QC: 비전 Chassis Present (MC D2=1) 주입!`, colors.magenta);
      
      // QC (MC) Device D2 (%MW2 - Chassis Present force) 에 1 기입
      const header = Buffer.from([
        0x50, 0x00, 0x00, 0xFF, 0xFF, 0x03, 0x00, 0x0E, 0x00, 0x10, 0x00, 0x01, 0x14, 0x00, 0x00, 0x02, 0x00, 0x00, 0xA8, 0x01, 0x00
      ]);
      const valBuf = Buffer.from([1, 0]);
      mcSocket.write(Buffer.concat([header, valBuf]));
      
      // 1초 후 자동 회수하여 펄스 트리거 형태로 유지
      setTimeout(() => {
        if (plcConnections.qc && mcSocket) {
          log('BRIDGE', `CNC ➔ QC: 비전 Chassis Present (MC D2=0) 자동 회수`, colors.blue);
          const resetHeader = Buffer.from([
            0x50, 0x00, 0x00, 0xFF, 0xFF, 0x03, 0x00, 0x0E, 0x00, 0x10, 0x00, 0x01, 0x14, 0x00, 0x00, 0x02, 0x00, 0x00, 0xA8, 0x01, 0x00
          ]);
          const resetValBuf = Buffer.from([0, 0]);
          mcSocket.write(Buffer.concat([resetHeader, resetValBuf]));
        }
      }, 1000);
    }
    prevCncCompleted = curCncCompleted;
  }

  // ----------------------------------------------------
  // 3. QC (MC) ➔ Sorter (XGT) 브릿지 연동
  // ----------------------------------------------------
  if (plcConnections.qc && plcConnections.sorter && xgtSocket) {
    const curQcCompleted = plcData.qc.completed;
    if (prevQcCompleted !== -1 && curQcCompleted > prevQcCompleted) {
      log('BRIDGE', `QC ➔ Sorter: 분류 Chassis Present (XGT %MW2=1) 주입!`, colors.magenta);
      
      // Sorter (XGT) %MW2 (%MW2 - Chassis Present force) 에 1 기입
      const header = Buffer.from([
        0x4C, 0x53, 0x49, 0x53, 0x2D, 0x58, 0x47, 0x54, // "LSIS-XGT"
        0x00, 0x00, 0x00, 0x00, 0xA0, 0x33, 0x02, 0x00, 0x16, 0x00
      ]);
      const body = Buffer.from([
        0x00, 0x00, 0x00, 0x00, 0x58, 0x00, 0x02, 0x00, 0x00, 0x00, 0x01, 0x00, 0x04, 0x00, 0x25, 0x4D, 0x57, 0x32, // "%MW2"
        0x02, 0x00, 1, 0
      ]);
      xgtSocket.write(Buffer.concat([header, body]));
      
      // 1초 후 자동 회수하여 펄스 트리거 형태로 유지
      setTimeout(() => {
        if (plcConnections.sorter && xgtSocket) {
          log('BRIDGE', `QC ➔ Sorter: 분류 Chassis Present (XGT %MW2=0) 자동 회수`, colors.blue);
          const resetHeader = Buffer.from([
            0x4C, 0x53, 0x49, 0x53, 0x2D, 0x58, 0x47, 0x54, // "LSIS-XGT"
            0x00, 0x00, 0x00, 0x00, 0xA0, 0x33, 0x02, 0x00, 0x16, 0x00
          ]);
          const resetBody = Buffer.from([
            0x00, 0x00, 0x00, 0x00, 0x58, 0x00, 0x02, 0x00, 0x00, 0x00, 0x01, 0x00, 0x04, 0x00, 0x25, 0x4D, 0x57, 0x32, // "%MW2"
            0x02, 0x00, 0, 0
          ]);
          xgtSocket.write(Buffer.concat([resetHeader, resetBody]));
        }
      }, 1000);
    }
    prevQcCompleted = curQcCompleted;
  }
}

setInterval(async () => {
  pollModbus();
  pollS7();
  pollMC();
  pollXGT();
  await runProcessBridge();
  broadcastData();
}, 100);

// ==========================================
// 9. WEB SCRIPT & WEBSOCKET 통신 허브
// ==========================================
const server = http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' });
  res.end('vPLC-Runtime 이기종 프로토콜 모바일/웹 게이트웨이 구동 중입니다.');
});

const wss = new WebSocketServer({ server });

// WebSocket broadcast helper
function broadcast(msgObj) {
  const jsonStr = JSON.stringify(msgObj);
  wss.clients.forEach((client) => {
    if (client.readyState === 1) { // OPEN state
      client.send(jsonStr);
    }
  });
}

function broadcastStatus() {
  broadcast({
    type: 'connection_status',
    plcConnections
  });
}

function broadcastData() {
  broadcast({
    type: 'plc_data',
    plcData
  });
}

// Handle Client Messages (WebSocket writes to vPLC registers)
wss.on('connection', (ws) => {
  log('WS-HUB', '리액트 시뮬레이션 브라우저가 게이트웨이에 연결되었습니다.', colors.cyan);
  
  // Send initial statuses immediately
  ws.send(JSON.stringify({ type: 'connection_status', plcConnections }));
  ws.send(JSON.stringify({ type: 'plc_data', plcData }));

  ws.on('message', async (message) => {
    try {
      const data = JSON.parse(message);
      
      if (data.type === 'write_register') {
        const { plcId, address, value } = data;
        log('WS-WRITE', `원격 제어 지시 수신 [PLC: ${plcId}, Register: ${address}, Value: ${value}]`, colors.magenta);
        
        // 1. Write to Feeder (Modbus) Holding Register
        if (plcId === 'feeder' && plcConnections.feeder && modbusClient) {
          const intVal = parseInt(value, 10);
          await modbusClient.writeSingleRegister(address, intVal);
          log('MODBUS-WRITE', `Modbus single register ${address} = ${intVal} 작성 성공`, colors.green);
          
          // 수동 원자재 투입 (%MW2 = 1)의 경우 1초 후에 자동 0으로 회수하여 펄스 트리거 생성
          if (address === 2 && intVal === 1) {
            setTimeout(async () => {
              try {
                if (modbusClient && plcConnections.feeder) {
                  await modbusClient.writeSingleRegister(address, 0);
                  log('MODBUS-WRITE', `Modbus single register ${address} = 0 수동 투입 신호 자동 회수 완료`, colors.blue);
                }
              } catch (err) {
                log('MODBUS-WRITE', `Modbus single register ${address} = 0 자동 회수 실패: ${err.message}`, colors.red);
              }
            }, 1000);
          }
        }
        
        // 2. Write to CNC (S7) Holding Register (DB1)
        else if (plcId === 'cnc' && plcConnections.cnc) {
          const intVal = parseInt(value, 10);
          // Convert value to big-endian buffer
          const buf = Buffer.alloc(2);
          buf.writeInt16BE(intVal, 0);
          s7Client.writeItems(`DB1,INT${address * 2}`, intVal, (err) => {
            if (err) log('S7-WRITE', `S7 write error: ${err}`, colors.red);
            else log('S7-WRITE', `S7 DB1 register ${address} = ${intVal} 작성 성공`, colors.green);
          });
        }
        
        // 3. Write to QC (MC) Device Register (D1)
        else if (plcId === 'qc' && plcConnections.qc && mcSocket) {
          const intVal = parseInt(value, 10);
          // CMD = 1401 Batch Write, Write 1 word to D1
          const header = Buffer.from([
            0x50, 0x00, 0x00, 0xFF, 0xFF, 0x03, 0x00, 0x0E, 0x00, 0x10, 0x00, 0x01, 0x14, 0x00, 0x00, 0x01, 0x00, 0x00, 0xA8, 0x01, 0x00
          ]);
          const valBuf = Buffer.from([intVal & 0xFF, (intVal >> 8) & 0xFF]);
          mcSocket.write(Buffer.concat([header, valBuf]));
          log('MC-WRITE', `MC Batch Write D${address} = ${intVal} 송신 완료`, colors.green);
        }
        
        // 4. Write to Sorter (XGT) Word Register (%MW1)
        else if (plcId === 'sorter' && plcConnections.sorter && xgtSocket) {
          const intVal = parseInt(value, 10);
          // Command = 0058 (Write request), datatype = 0200 (Word), name = "%MW1", value = intVal
          const header = Buffer.from([
            0x4C, 0x53, 0x49, 0x53, 0x2D, 0x58, 0x47, 0x54, // "LSIS-XGT"
            0x00, 0x00, 0x00, 0x00, 0xA0, 0x33, 0x02, 0x00, 0x16, 0x00
          ]);
          const body = Buffer.from([
            0x00, 0x00, 0x00, 0x00, 0x58, 0x00, 0x02, 0x00, 0x00, 0x00, 0x01, 0x00, 0x04, 0x00, 0x25, 0x4D, 0x57, 0x31, // "%MW1"
            0x02, 0x00, intVal & 0xFF, (intVal >> 8) & 0xFF
          ]);
          xgtSocket.write(Buffer.concat([header, body]));
          log('XGT-WRITE', `XGT Write %MW${address} = ${intVal} 송신 완료`, colors.green);
        }
      }
    } catch (err) {
      log('WS-ERROR', `메시지 처리 실패: ${err.message}`, colors.red);
    }
  });

  ws.on('close', () => {
    log('WS-HUB', '리액트 시뮬레이션 브라우저의 연결이 해제되었습니다.', colors.yellow);
  });
});

// ==========================================
// 10. 기동 시작
// ==========================================
server.listen(WS_PORT, () => {
  log('START', `========================================================`, colors.cyan);
  log('START', `🔌 vPLC 이기종 프로토콜 통합 WebSocket 게이트웨이 기동 완료`, colors.cyan);
  log('START', `   - 웹소켓 서버 포트: ws://localhost:${WS_PORT}`, colors.cyan);
  log('START', `========================================================`, colors.cyan);
  
  // PLC 연결 풀 초기 가동
  connectModbus();
  connectS7();
  connectMC();
  connectXGT();
});
