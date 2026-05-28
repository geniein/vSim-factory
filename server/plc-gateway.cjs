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
// MES DATA TRACKING & HANDSHAKE HELPERS
// ==========================================
function stringToWords(str) {
  const words = [];
  const padded = (str || "ABC 000000").padEnd(10, ' ').substring(0, 10);
  for (let i = 0; i < 5; i++) {
    const char1 = padded.charCodeAt(i * 2);
    const char2 = padded.charCodeAt(i * 2 + 1);
    words.push((char1 << 8) | char2);
  }
  return words;
}

function wordsToString(words) {
  let str = '';
  for (let i = 0; i < 5; i++) {
    const word = words[i] || 0;
    if (word === 0) continue; // Skip empty register words
    const char1 = String.fromCharCode((word >> 8) & 0xFF);
    const char2 = String.fromCharCode(word & 0xFF);
    if (char1 !== '\0') str += char1;
    if (char2 !== '\0') str += char2;
  }
  // Keep serial format clean
  return str.trim();
}

function generateSerialNo() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  let randStr = '';
  for (let i = 0; i < 3; i++) {
    randStr += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  let randNum = '';
  for (let i = 0; i < 6; i++) {
    randNum += Math.floor(Math.random() * 10).toString();
  }
  return `${randStr} ${randNum}`;
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
  feeder: { conveyor_run: false, pos: 0, completed: 0, speed: 200, error: false, serial: "          " },
  cnc:    { conveyor_run: false, lift_down: false, clamp_on: false, rotate_right: false, speed: 200, pos: 0, completed: 0, error: false, serial: "          " },
  qc:     { conveyor_run: false, laser_on: false, rotate_right: false, completed: 0, error: false, serial: "          " },
  sorter: { conveyor_run: false, completed: 0, speed: 200, error: false, serial: "          " }
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

    // Configure Feeder as Slave (register 4 = 0) to prevent auto-spawning
    setTimeout(async () => {
      try {
        if (plcConnections.feeder && modbusClient) {
          await modbusClient.writeSingleRegister(4, 0);
          log('MODBUS', '⚙️ PLC #1 Feeder (Slave Mode) 자동 세팅 완료', colors.green);
        }
      } catch (err) {}
    }, 500);
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

    // 4. Read Holding Registers 10-14 (Serial No)
    try {
      const serialResp = await modbusClient.readHoldingRegisters(10, 5);
      const serialRegs = serialResp.response.body.valuesAsArray;
      plcData.feeder.serial = wordsToString(serialRegs);
    } catch (e) {
      plcData.feeder.serial = "          ";
    }
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

    // Auto-configure CNC as Follower (register 4 = 0 -> DB1,INT8)
    setTimeout(() => {
      if (plcConnections.cnc && s7Client) {
        s7Client.writeItems('DB1,INT8', 0, (err) => {
          if (!err) log('S7', '⚙️ PLC #2 CNC (Follower Mode) 자동 세팅 완료', colors.green);
        });
      }
    }, 500);
    
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
      'speed': 'DB1,INT2',
      'serial_w0': 'DB1,INT20',
      'serial_w1': 'DB1,INT22',
      'serial_w2': 'DB1,INT24',
      'serial_w3': 'DB1,INT26',
      'serial_w4': 'DB1,INT28'
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

    const serialWords = [
      values.serial_w0 || 0,
      values.serial_w1 || 0,
      values.serial_w2 || 0,
      values.serial_w3 || 0,
      values.serial_w4 || 0
    ];
    plcData.cnc.serial = wordsToString(serialWords);
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
  mcSocket.recvBuf = Buffer.alloc(0);

  mcSocket.on('connect', () => {
    log('MELSEC-MC', `🟢 PLC #3 QC 연결 성공!`, colors.green);
    plcConnections.qc = true;
    broadcastStatus();

    // Auto-configure QC as Follower (register 4 = 0 -> MC.D.4)
    setTimeout(() => {
      if (plcConnections.qc && mcSocket) {
        const header = Buffer.from([
          0x50, 0x00, 0x00, 0xFF, 0xFF, 0x03, 0x00, 0x0E, 0x00, 0x10, 0x00, 0x01, 0x14, 0x00, 0x00, 0x04, 0x00, 0x00, 0xA8, 0x01, 0x00
        ]);
        const valBuf = Buffer.from([0, 0]);
        mcSocket.write(Buffer.concat([header, valBuf]));
        log('MELSEC-MC', '⚙️ PLC #3 QC (Follower Mode) 자동 세팅 완료', colors.green);
      }
    }, 500);
  });

  mcSocket.on('data', (data) => {
    mcSocket.recvBuf = Buffer.concat([mcSocket.recvBuf, data]);

    while (mcSocket.recvBuf.length >= 9) {
      if (mcSocket.recvBuf[0] !== 0xD0 || mcSocket.recvBuf[1] !== 0x00) {
        mcSocket.recvBuf = mcSocket.recvBuf.subarray(1);
        continue;
      }

      const length = mcSocket.recvBuf[7] | (mcSocket.recvBuf[8] << 8);
      const packetLen = 9 + length;

      if (mcSocket.recvBuf.length < packetLen) {
        break;
      }

      const packet = mcSocket.recvBuf.subarray(0, packetLen);
      mcSocket.recvBuf = mcSocket.recvBuf.subarray(packetLen);

      const endCode = packet[9] | (packet[10] << 8);
      if (endCode === 0) {
        if (length === 0x06 || length === 6) {
          // Completed Cars (D0, D1) read - 2 words = 4 bytes response (total length = 6)
          const d0_val = packet[11] | (packet[12] << 8);
          plcData.qc.completed = d0_val;
          plcData.qc.conveyor_run = plcData.cnc.conveyor_run;
          plcData.qc.laser_on = plcData.cnc.rotate_right;
        } else if (length === 0x0A || length === 0x0C || length === 10 || length === 12) {
          // D10-D14 Serial No (5 words = 10 bytes)
          const serialWords = [];
          for (let i = 0; i < 5; i++) {
            serialWords.push(packet[11 + i*2] | (packet[11 + i*2 + 1] << 8));
          }
          plcData.qc.serial = wordsToString(serialWords);
        }
      }
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
  const req = Buffer.from([
    0x50, 0x00, 0x00, 0xFF, 0xFF, 0x03, 0x00, 0x0C, 0x00, 0x10, 0x00, 0x01, 0x04, 0x00, 0x00, 0x00, 0x00, 0x00, 0xA8, 0x02, 0x00
  ]);
  mcSocket.write(req);

  // Batch Read D10..D14 (Head device D10, Device Code D=A8, count 5 words) for Serial No
  setTimeout(() => {
    if (plcConnections.qc && mcSocket) {
      const reqSerial = Buffer.from([
        0x50, 0x00, 0x00, 0xFF, 0xFF, 0x03, 0x00, 0x0C, 0x00, 0x10, 0x00, 0x01, 0x04, 0x00, 0x00, 0x0A, 0x00, 0x00, 0xA8, 0x05, 0x00
      ]);
      mcSocket.write(reqSerial);
    }
  }, 25);
}

// ==========================================
// 7. PROTOCOL 4: LS Electric XGT FEnet Client (Sorter PLC #4 - Port 2044)
// ==========================================
let xgtSocket = null;

let xgtSerialWords = [0, 0, 0, 0, 0];

function connectXGT() {
  const { ip, port } = PLC_CONFIGS.sorter;
  log('LS-XGT', `PLC #4 Sorter 소켓 연결 시도 중 (${ip}:${port})...`, colors.blue);

  xgtSocket = new net.Socket();

  xgtSocket.on('connect', () => {
    log('LS-XGT', `🟢 PLC #4 Sorter 연결 성공!`, colors.green);
    plcConnections.sorter = true;
    broadcastStatus();

    // Auto-configure Sorter as Follower (register 4 = 0 -> LS.W.4)
    setTimeout(() => {
      if (plcConnections.sorter && xgtSocket) {
        const header = Buffer.from([
          0x4C, 0x53, 0x49, 0x53, 0x2D, 0x58, 0x47, 0x54, 0x00, 0x00, 0x00, 0x00, 0xA0, 0x33, 0x02, 0x00, 0x16, 0x00
        ]);
        const body = Buffer.from([
          0x00, 0x00, 0x00, 0x00, 0x58, 0x00, 0x02, 0x00, 0x00, 0x00, 0x01, 0x00, 0x04, 0x00, 0x25, 0x4D, 0x57, 0x31,
          0x02, 0x00, 0, 0
        ]);
        body.write(`%MW4`, 14);
        xgtSocket.write(Buffer.concat([header, body]));
        log('LS-XGT', '⚙️ PLC #4 Sorter (Follower Mode) 자동 세팅 완료', colors.green);
      }
    }, 500);
  });

  xgtSocket.on('data', (data) => {
    // Parse XGT FEnet Response packet
    if (data.length >= 30) {
      const companyId = data.toString('ascii', 0, 8);
      if (companyId === 'LSIS-XGT') {
        const invokeId = data[14] | (data[15] << 8);
        const varLen = data[32] | (data[33] << 8);
        const dataOffset = 34 + varLen;
        
        if (data.length >= dataOffset + 4) {
          const val = data[dataOffset + 2] | (data[dataOffset + 3] << 8);
          
          if (invokeId === 3) {
            plcData.sorter.completed = val;
            plcData.sorter.conveyor_run = plcData.cnc.conveyor_run; // Sync
          } else if (invokeId >= 20 && invokeId <= 24) {
            xgtSerialWords[invokeId - 20] = val;
            plcData.sorter.serial = wordsToString(xgtSerialWords);
          }
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

  // 1. Read Word Register %MW0 (Completed Cars) - InvokeID = 3
  const header = Buffer.from([
    0x4C, 0x53, 0x49, 0x53, 0x2D, 0x58, 0x47, 0x54,
    0x00, 0x00, 0x00, 0x00, 0xA0, 0x33, 0x03, 0x00, 0x12, 0x00
  ]);
  const body = Buffer.from([
    0x00, 0x00, 0x00, 0x00, 0x54, 0x00, 0x02, 0x00, 0x00, 0x00, 0x01, 0x00, 0x04, 0x00, 0x25, 0x4D, 0x57, 0x30
  ]);
  xgtSocket.write(Buffer.concat([header, body]));

  // 2. Read Serial words %MW10..14 (Invoke 20..24)
  for (let i = 0; i < 5; i++) {
    setTimeout(() => {
      if (plcConnections.sorter && xgtSocket) {
        const h = Buffer.from([
          0x4C, 0x53, 0x49, 0x53, 0x2D, 0x58, 0x47, 0x54,
          0x00, 0x00, 0x00, 0x00, 0xA0, 0x33, 20 + i, 0, 0x13, 0x00
        ]);
        const b = Buffer.from([
          0x00, 0x00, 0x00, 0x00, 0x54, 0x00, 0x02, 0x00, 0x00, 0x00, 0x01, 0x00, 0x05, 0x00, 0x25, 0x4D, 0x57, 0x31, 0x30
        ]);
        b.write(`%MW${10 + i}`, 14);
        xgtSocket.write(Buffer.concat([h, b]));
      }
    }, 10 + i * 15);
  }
}

// ==========================================
// 8. 100ms 폴링 통합 루프 및 공정 연동 브릿지 (60fps 데이터 갱신)
// ==========================================
let prevFeederCompleted = -1;
let prevCncCompleted = -1;
let prevQcCompleted = -1;
let prevSorterCompleted = -1;

let cncChassisTriggered = false;
let qcChassisTriggered = false;
let sorterChassisTriggered = false;

async function runProcessBridge() {
  // ----------------------------------------------------
  // 1. Feeder (Modbus) ➔ CNC (S7) 브릿지 연동
  // ----------------------------------------------------
  if (plcConnections.feeder && plcConnections.cnc) {
    const curFeederCompleted = plcData.feeder.completed;
    
    // 최초 실행 시 또는 증가 시 감지 (스캔 가드: 시리얼 번호가 비어 있지 않은 정식 차대만 이송!)
    if (prevFeederCompleted !== -1 && curFeederCompleted > prevFeederCompleted && plcData.feeder.serial.trim() !== "") {
      log('BRIDGE', `Feeder ➔ CNC: 가공 Chassis Present (%MW2=1) 주입!`, colors.magenta);
      
      // [MES] Feeder의 시리얼을 읽어서 CNC의 DB1.DBW20~28에 복사!
      log('MES-BRIDGE', `Feeder ➔ CNC: 시리얼 넘버 [${plcData.feeder.serial}] MES Tracking 이송!`, colors.cyan);
      const words = stringToWords(plcData.feeder.serial);
      
      // Siemens S7 일괄 쓰기(Batch Write)를 수행하여 소켓 뒤엉킴과 패킷 유실 방지!
      s7Client.writeItems(
        ['DB1,INT20', 'DB1,INT22', 'DB1,INT24', 'DB1,INT26', 'DB1,INT28'],
        [words[0], words[1], words[2], words[3], words[4]],
        (err) => {
          if (err) log('S7-WRITE', `Siemens S7 batch serial write error: ${err}`, colors.red);
        }
      );

      // CNC S7 Holding Register 2 (%MW2 - Chassis Present force) 에 1 기입 (address*2 = 4 -> DB1,INT4)
      s7Client.writeItems('DB1,INT4', 1, (err) => {
        if (!err) {
          log('BRIDGE', `Feeder ➔ CNC: 가공 Chassis Present (%MW2=1) 기입 완료`, colors.blue);
        }
      });

      // [MES] 이송이 완료된 이전 공정(Feeder)의 시리얼 레지스터를 깨끗하게 리셋(0)하여 찌꺼기 렌더링 방지!
      setTimeout(async () => {
        try {
          if (modbusClient && plcConnections.feeder) {
            log('BRIDGE', `Feeder: 시리얼 넘버 [%MW10..14] 초기화 청소 완료`, colors.gray);
            for (let i = 0; i < 5; i++) {
              await modbusClient.writeSingleRegister(10 + i, 0);
            }
          }
        } catch (err) {}
      }, 500);
    }
    prevFeederCompleted = curFeederCompleted;
  }

  // ----------------------------------------------------
  // 2. CNC (S7) ➔ QC (MC) 브릿지 연동
  // ----------------------------------------------------
  if (plcConnections.cnc && plcConnections.qc && mcSocket) {
    const curCncCompleted = plcData.cnc.completed;
    if (prevCncCompleted !== -1 && curCncCompleted > prevCncCompleted && plcData.cnc.serial.trim() !== "") {
      log('BRIDGE', `CNC ➔ QC: 비전 Chassis Present (MC D2=1) 주입!`, colors.magenta);
      
      // [MES] CNC의 시리얼을 읽어서 QC(MC) D10~D14에 복사!
      log('MES-BRIDGE', `CNC ➔ QC: 시리얼 넘버 [${plcData.cnc.serial}] MES Tracking 이송!`, colors.cyan);
      const words = stringToWords(plcData.cnc.serial);
      const serHeader = Buffer.from([
        0x50, 0x00, 0x00, 0xFF, 0xFF, 0x03, 0x00, 0x16, 0x00, 0x10, 0x00, 0x01, 0x14, 0x00, 0x00, 0x0A, 0x00, 0x00, 0xA8, 0x05, 0x00
      ]);
      const serBuf = Buffer.alloc(10);
      for (let i = 0; i < 5; i++) {
        serBuf.writeUInt16LE(words[i], i * 2);
      }
      mcSocket.write(Buffer.concat([serHeader, serBuf]));

      // QC (MC) Device D2 (%MW2 - Chassis Present force) 에 1 기입
      const header = Buffer.from([
        0x50, 0x00, 0x00, 0xFF, 0xFF, 0x03, 0x00, 0x0E, 0x00, 0x10, 0x00, 0x01, 0x14, 0x00, 0x00, 0x02, 0x00, 0x00, 0xA8, 0x01, 0x00
      ]);
      const valBuf = Buffer.from([1, 0]);
      mcSocket.write(Buffer.concat([header, valBuf]));
      log('BRIDGE', `CNC ➔ QC: 비전 Chassis Present (MC D2=1) 기입 완료`, colors.blue);

      // [MES] 이송이 완료된 이전 공정(CNC S7)의 시리얼 레지스터를 깨끗하게 리셋(0)하여 찌꺼기 렌더링 방지!
      setTimeout(() => {
        if (plcConnections.cnc) {
          log('BRIDGE', `CNC: 시리얼 넘버 [DB1,INT20..28] 초기화 청소 완료`, colors.gray);
          s7Client.writeItems(
            ['DB1,INT20', 'DB1,INT22', 'DB1,INT24', 'DB1,INT26', 'DB1,INT28'],
            [0, 0, 0, 0, 0],
            (err) => {
              if (err) log('S7-WRITE', `CNC serial clear failed: ${err}`, colors.red);
            }
          );
        }
      }, 500);
    }
    prevCncCompleted = curCncCompleted;
  }

  // ----------------------------------------------------
  // 3. QC (MC) ➔ Sorter (XGT) 브릿지 연동
  // ----------------------------------------------------
  if (plcConnections.qc && plcConnections.sorter && xgtSocket) {
    const curQcCompleted = plcData.qc.completed;
    if (prevQcCompleted !== -1 && curQcCompleted > prevQcCompleted && plcData.qc.serial.trim() !== "") {
      log('BRIDGE', `QC ➔ Sorter: 분류 Chassis Present (XGT %MW2=1) 주입!`, colors.magenta);
      
      // [MES] QC의 시리얼을 읽어서 Sorter(XGT) %MW10~%MW14에 복사!
      log('MES-BRIDGE', `QC ➔ Sorter: 시리얼 넘버 [${plcData.qc.serial}] MES Tracking 이송!`, colors.cyan);
      const words = stringToWords(plcData.qc.serial);
      for (let i = 0; i < 5; i++) {
        const addr = 10 + i;
        const xgtHeader = Buffer.from([
          0x4C, 0x53, 0x49, 0x53, 0x2D, 0x58, 0x47, 0x54, 0x00, 0x00, 0x00, 0x00, 0xA0, 0x33, 0x02, 0x00, 0x17, 0x00
        ]);
        const xgtWriteBody = Buffer.from([
          0x00, 0x00, 0x00, 0x00, 0x58, 0x00, 0x02, 0x00, 0x00, 0x00, 0x01, 0x00, 0x05, 0x00, 0x25, 0x4D, 0x57, 0x31, 0x30,
          0x02, 0x00, words[i] & 0xFF, (words[i] >> 8) & 0xFF
        ]);
        xgtWriteBody.write(`%MW${addr}`, 14);
        xgtSocket.write(Buffer.concat([xgtHeader, xgtWriteBody]));
      }

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
      log('BRIDGE', `QC ➔ Sorter: 분류 Chassis Present (XGT %MW2=1) 기입 완료`, colors.blue);

      // [MES] 이송이 완료된 이전 공정(QC MC)의 시리얼 레지스터를 깨끗하게 리셋(0)하여 찌꺼기 렌더링 방지!
      setTimeout(() => {
        if (plcConnections.qc && mcSocket) {
          log('BRIDGE', `QC: 시리얼 넘버 [D10..14] 초기화 청소 완료`, colors.gray);
          const clearHeader = Buffer.from([
            0x50, 0x00, 0x00, 0xFF, 0xFF, 0x03, 0x00, 0x16, 0x00, 0x10, 0x00, 0x01, 0x14, 0x00, 0x00, 0x0A, 0x00, 0x00, 0xA8, 0x05, 0x00
          ]);
          const clearBuf = Buffer.alloc(10); // 10 bytes of 0
          mcSocket.write(Buffer.concat([clearHeader, clearBuf]));
        }
      }, 500);
    }
    prevQcCompleted = curQcCompleted;
  }

  // ----------------------------------------------------
  // 4. Sorter (XGT) ➔ 출하 완료 및 시리얼 클리어
  // ----------------------------------------------------
  if (plcConnections.sorter && xgtSocket) {
    const curSorterCompleted = plcData.sorter.completed;
    if (prevSorterCompleted !== -1 && curSorterCompleted > prevSorterCompleted) {
      log('BRIDGE', `Sorter: 출하 완료 감지 (%MW0=${curSorterCompleted})`, colors.magenta);
      
      // 출하가 끝난 Sorter XGT의 시리얼 넘버를 0으로 클리어
      setTimeout(() => {
        if (plcConnections.sorter && xgtSocket) {
          log('BRIDGE', `Sorter: 시리얼 넘버 [%MW10..14] 초기화 청소 완료`, colors.gray);
          for (let i = 0; i < 5; i++) {
            const addr = 10 + i;
            const xgtHeader = Buffer.from([
              0x4C, 0x53, 0x49, 0x53, 0x2D, 0x58, 0x47, 0x54, 0x00, 0x00, 0x00, 0x00, 0xA0, 0x33, 0x02, 0x00, 0x17, 0x00
            ]);
            const xgtWriteBody = Buffer.from([
              0x00, 0x00, 0x00, 0x00, 0x58, 0x00, 0x02, 0x00, 0x00, 0x00, 0x01, 0x00, 0x05, 0x00, 0x25, 0x4D, 0x57, 0x31, 0x30,
              0x02, 0x00, 0, 0
            ]);
            xgtWriteBody.write(`%MW${addr}`, 14);
            xgtSocket.write(Buffer.concat([xgtHeader, xgtWriteBody]));
          }
        }
      }, 1000); // 1초 대기 후 클리어 (출하 이펙트를 충분히 보여줌)
    }
    prevSorterCompleted = curSorterCompleted;
  }
}

// ==============================================================================
// DYNAMIC MULTI-STAGE HETEROGENEOUS PLC CONNECTION POOL
// ==============================================================================
let dynamicPlcCount = 0;
let dynamicPlcs = [];

function startDynamicPLCs(count) {
  stopDynamicPLCs();

  dynamicPlcCount = count;
  dynamicPlcs = [];

  log('DYNAMIC-POOL', `다이내믹 공정 연결 풀 설정 개시... 총 공정 수: ${count}`, colors.cyan);

  for (let i = 1; i <= count; i++) {
    const offset = i * 10;
    const protIdx = (i - 1) % 4;
    let protocol = 'modbus';
    let port = 5020 + offset;
    
    if (protIdx === 1) {
      protocol = 's7';
      port = 1020 + offset;
    } else if (protIdx === 2) {
      protocol = 'mc';
      port = 5011 + offset;
    } else if (protIdx === 3) {
      protocol = 'xgt';
      port = 2004 + offset;
    }

    const entry = {
      idx: i,
      protocol,
      port,
      online: false,
      connecting: false,
      socket: null,
      client: null,
      prevCompleted: -1,
      data: {
        conveyor_run: false,
        pos: 0,
        completed: 0,
        speed: 200,
        error: false,
        serial: "          "
      }
    };

    dynamicPlcs.push(entry);
    connectDynamicPLC(entry);
  }
}

function connectDynamicPLC(plc) {
  if (dynamicPlcCount === 0) return;
  if (plc.online || plc.connecting) return;
  plc.connecting = true;
  
  const ip = '127.0.0.1';
  
  if (plc.protocol === 'modbus') {
    plc.socket = new net.Socket();
    plc.client = new modbus.client.TCP(plc.socket);
    
    plc.socket.on('connect', () => {
      plc.online = true;
      plc.connecting = false;
      log('DYNAMIC-MODBUS', `🟢 Dynamic PLC #${plc.idx} Modbus (Port: ${plc.port}) 연결 성공!`, colors.green);
      broadcastDynamicStatus();

      // Configure Feeder as Slave (0) to prevent auto-spawning in dynamic mode
      const masterVal = 0;
      setTimeout(async () => {
        try {
          if (plc.online && plc.client) {
            await plc.client.writeSingleRegister(4, masterVal);
            log('DYNAMIC-MODBUS', `⚙️ Dynamic PLC #${plc.idx} (Slave Mode) 자동 세팅 완료`, colors.green);
          }
        } catch (e) {}
      }, 500);
    });
    
    plc.socket.on('error', () => {});
    
    plc.socket.on('close', () => {
      if (plc.online) {
        log('DYNAMIC-MODBUS', `🔴 Dynamic PLC #${plc.idx} Modbus (Port: ${plc.port}) 연결 해제`, colors.yellow);
      }
      plc.online = false;
      plc.connecting = false;
      plc.client = null;
      plc.socket = null;
      broadcastDynamicStatus();
      setTimeout(() => { if (dynamicPlcCount > 0 && !plc.online) connectDynamicPLC(plc); }, 4000);
    });
    
    plc.socket.connect({ host: ip, port: plc.port });
  } 
  
  else if (plc.protocol === 's7') {
    plc.client = new nodes7();
    plc.client.initiateConnection({ host: ip, port: plc.port, rack: 0, slot: 1 }, (err) => {
      if (err) {
        plc.online = false;
        plc.connecting = false;
        plc.client = null;
        setTimeout(() => { if (dynamicPlcCount > 0 && !plc.online) connectDynamicPLC(plc); }, 4000);
        return;
      }
      
      const s7Vars = {
        'conveyor_run': 'DB1,X272.0',
        'error': 'DB1,X272.6',
        'pos': 'DB1,INT128',
        'completed': 'DB1,INT0',
        'speed': 'DB1,INT2',
        'serial_w0': 'DB1,INT20',
        'serial_w1': 'DB1,INT22',
        'serial_w2': 'DB1,INT24',
        'serial_w3': 'DB1,INT26',
        'serial_w4': 'DB1,INT28'
      };
      
      plc.client.setTranslationCB((tag) => s7Vars[tag] || tag);
      plc.client.addItems(Object.keys(s7Vars));
      
      plc.online = true;
      plc.connecting = false;
      log('DYNAMIC-S7', `🟢 Dynamic PLC #${plc.idx} S7 (Port: ${plc.port}) 연결 성공!`, colors.green);
      broadcastDynamicStatus();

      // Configure Follower (register 4 = DB1,INT8) to prevent auto-spawning in dynamic mode
      const masterVal = 0;
      setTimeout(() => {
        if (plc.online && plc.client) {
          plc.client.writeItems('DB1,INT8', masterVal, (err) => {
            if (!err) log('DYNAMIC-S7', `⚙️ Dynamic PLC #${plc.idx} (Slave Mode) 자동 세팅 완료`, colors.green);
          });
        }
      }, 500);
    });
  } 
  
  else if (plc.protocol === 'mc') {
    plc.socket = new net.Socket();
    plc.recvBuf = Buffer.alloc(0);
    
    plc.socket.on('connect', () => {
      plc.online = true;
      plc.connecting = false;
      log('DYNAMIC-MC', `🟢 Dynamic PLC #${plc.idx} MC (Port: ${plc.port}) 연결 성공!`, colors.green);
      broadcastDynamicStatus();

      // Auto-configure Follower (register 4 = MC.D.4) to prevent auto-spawning
      const masterVal = 0;
      setTimeout(() => {
        if (plc.online && plc.socket) {
          const header = Buffer.from([
            0x50, 0x00, 0x00, 0xFF, 0xFF, 0x03, 0x00, 0x0E, 0x00, 0x10, 0x00, 0x01, 0x14, 0x00, 0x00, 0x04, 0x00, 0x00, 0xA8, 0x01, 0x00
          ]);
          const valBuf = Buffer.from([masterVal & 0xFF, (masterVal >> 8) & 0xFF]);
          plc.socket.write(Buffer.concat([header, valBuf]));
          log('DYNAMIC-MC', `⚙️ Dynamic PLC #${plc.idx} (${masterVal ? 'Master' : 'Follower'} Mode) 자동 세팅 완료`, colors.green);
        }
      }, 500);
    });
    
    plc.socket.on('data', (data) => {
      plc.recvBuf = Buffer.concat([plc.recvBuf, data]);

      while (plc.recvBuf.length >= 9) {
        if (plc.recvBuf[0] !== 0xD0 || plc.recvBuf[1] !== 0x00) {
          plc.recvBuf = plc.recvBuf.subarray(1);
          continue;
        }

        const length = plc.recvBuf[7] | (plc.recvBuf[8] << 8);
        const packetLen = 9 + length;

        if (plc.recvBuf.length < packetLen) {
          break;
        }

        const packet = plc.recvBuf.subarray(0, packetLen);
        plc.recvBuf = plc.recvBuf.subarray(packetLen);

        const endCode = packet[9] | (packet[10] << 8);
        if (endCode === 0) {
          if (length === 0x06 || length === 6) {
            // Coil read response: Y0 (conveyor_run), Y6 (error)
            const y0_run = (packet[11] & 0x10) !== 0;
            const y6_error = (packet[14] & 0x10) !== 0;
            plc.data.conveyor_run = y0_run;
            plc.data.error = y6_error;
          }
          else if (length === 0x14 || length === 20 || length === 18 || length === 0x08 || length === 8 || length === 6) { 
            // Register read response: D0 (completed), D1 (speed), D8 (pos) - 9 words read length=20
            const d0_val = packet[11] | (packet[12] << 8);
            const d1_val = packet[13] | (packet[14] << 8);
            plc.data.completed = d0_val;
            plc.data.speed = d1_val;
            
            // If we successfully read 9 words (length=20), parse D8 mapped from MODBUS.IR.0
            if (length >= 18 && packet.length >= 29) {
              const d8_pos = packet[27] | (packet[28] << 8);
              plc.data.pos = d8_pos;
            } else {
              // MC PLC 인코더 속도에 기반한 자체 연산 위상동기(PLL) 백업
              if (plc.prevCompleted !== -1 && d0_val > plc.prevCompleted) {
                plc.data.pos = 0;
              }
            }
            plc.prevCompleted = d0_val;
          } 
          else if (length === 0x0A || length === 0x0C || length === 10 || length === 12) { // D10-D14 (10 bytes = 5 words)
            const serialWords = [];
            for (let i = 0; i < 5; i++) {
              serialWords.push(packet[11 + i*2] | (packet[11 + i*2 + 1] << 8));
            }
            plc.data.serial = wordsToString(serialWords);
          }
        }
      }
    });
    
    plc.socket.on('error', () => {});
    
    plc.socket.on('close', () => {
      if (plc.online) {
        log('DYNAMIC-MC', `🔴 Dynamic PLC #${plc.idx} MC (Port: ${plc.port}) 연결 해제`, colors.yellow);
      }
      plc.online = false;
      plc.connecting = false;
      plc.socket = null;
      broadcastDynamicStatus();
      setTimeout(() => { if (dynamicPlcCount > 0 && !plc.online) connectDynamicPLC(plc); }, 4000);
    });
    
    plc.socket.connect({ host: ip, port: plc.port });
  } 
  
  else if (plc.protocol === 'xgt') {
    plc.socket = new net.Socket();
    
    plc.socket.on('connect', () => {
      plc.online = true;
      plc.connecting = false;
      log('DYNAMIC-XGT', `🟢 Dynamic PLC #${plc.idx} XGT (Port: ${plc.port}) 연결 성공!`, colors.green);
      broadcastDynamicStatus();

      // Auto-configure Follower (register 4 = LS.W.4) to prevent auto-spawning
      const masterVal = 0;
      setTimeout(() => {
        if (plc.online && plc.socket) {
          const header = Buffer.from([
            0x4C, 0x53, 0x49, 0x53, 0x2D, 0x58, 0x47, 0x54, 0x00, 0x00, 0x00, 0x00, 0xA0, 0x33, 0x02, 0x00, 0x16, 0x00
          ]);
          const body = Buffer.from([
            0x00, 0x00, 0x00, 0x00, 0x58, 0x00, 0x02, 0x00, 0x00, 0x00, 0x01, 0x00, 0x04, 0x00, 0x25, 0x4D, 0x57, 0x31,
            0x02, 0x00, masterVal & 0xFF, (masterVal >> 8) & 0xFF
          ]);
          body.write(`%MW4`, 14);
          plc.socket.write(Buffer.concat([header, body]));
          log('DYNAMIC-XGT', `⚙️ Dynamic PLC #${plc.idx} (${masterVal ? 'Master' : 'Follower'} Mode) 자동 세팅 완료`, colors.green);
        }
      }, 500);
    });
    
    plc.socket.on('data', (data) => {
      if (data.length >= 30) {
        const companyId = data.toString('ascii', 0, 8);
        if (companyId === 'LSIS-XGT') {
          const invokeId = data[14] | (data[15] << 8);
          const varLen = data[32] | (data[33] << 8);
          const dataOffset = 34 + varLen;
          
          if (data.length >= dataOffset + 4) {
            const val = data[dataOffset + 2] | (data[dataOffset + 3] << 8);
            
            if (invokeId === 10) {
              plc.data.completed = val;
            } else if (invokeId === 11) {
              plc.data.speed = val;
            } else if (invokeId === 12) {
              plc.data.pos = val;
            } else if (invokeId === 13) {
              plc.data.conveyor_run = (val & 0x01) !== 0;
              plc.data.error = (val & 0x40) !== 0; // %QX0.6 (64)
            } else if (invokeId >= 20 && invokeId <= 24) {
              if (!plc.xgtWords) plc.xgtWords = [0, 0, 0, 0, 0];
              plc.xgtWords[invokeId - 20] = val;
              plc.data.serial = wordsToString(plc.xgtWords);
            }
          }
        }
      }
    });
    
    plc.socket.on('error', () => {});
    
    plc.socket.on('close', () => {
      if (plc.online) {
        log('DYNAMIC-XGT', `🔴 Dynamic PLC #${plc.idx} XGT (Port: ${plc.port}) 연결 해제`, colors.yellow);
      }
      plc.online = false;
      plc.connecting = false;
      plc.socket = null;
      broadcastDynamicStatus();
      setTimeout(() => { if (dynamicPlcCount > 0 && !plc.online) connectDynamicPLC(plc); }, 4000);
    });
    
    plc.socket.connect({ host: ip, port: plc.port });
  }
}

function pollDynamicPLCs() {
  if (dynamicPlcCount === 0) return;
  
  dynamicPlcs.forEach((plc) => {
    if (!plc.online) return;
    
    if (plc.protocol === 'modbus' && plc.client) {
      plc.client.readCoils(0, 8).then((resp) => {
        const coils = resp.response.body.valuesAsArray;
        plc.data.conveyor_run = coils[0] || false;
        plc.data.error = coils[6] || false;
      }).catch(() => {});
      
      plc.client.readHoldingRegisters(0, 2).then((resp) => {
        const regs = resp.response.body.valuesAsArray;
        plc.data.completed = regs[0] || 0;
        plc.data.speed = regs[1] || 200;
      }).catch(() => {});
      
      plc.client.readHoldingRegisters(10, 5).then((resp) => {
        const regs = resp.response.body.valuesAsArray;
        plc.data.serial = wordsToString(regs);
      }).catch(() => {});
      
      plc.client.readInputRegisters(0, 1).then((resp) => {
        const regs = resp.response.body.valuesAsArray;
        plc.data.pos = regs[0] || 0;
      }).catch(() => {});
    } 
    
    else if (plc.protocol === 's7' && plc.client) {
      plc.client.readAllItems((err, values) => {
        if (err || !values) {
          plc.online = false;
          plc.client.dropConnection(() => {
            plc.client = null;
            setTimeout(() => { if (dynamicPlcCount > 0) connectDynamicPLC(plc); }, 4000);
          });
          return;
        }
        plc.data.conveyor_run = values.conveyor_run || false;
        plc.data.error = values.error || false;
        plc.data.pos = values.pos || 0;
        plc.data.completed = values.completed || 0;
        plc.data.speed = values.speed || 200;

        const serialWords = [
          values.serial_w0 || 0,
          values.serial_w1 || 0,
          values.serial_w2 || 0,
          values.serial_w3 || 0,
          values.serial_w4 || 0
        ];
        plc.data.serial = wordsToString(serialWords);
      });
    } 
    
    else if (plc.protocol === 'mc' && plc.socket) {
      // 1. D0-D8 Register read (D0 completed, D1 speed, D8 encoder pos mapped from MODBUS.IR.0) - count 9 words (0x09)
      const reqRegs = Buffer.from([
        0x50, 0x00, 0x00, 0xFF, 0xFF, 0x03, 0x00, 0x0C, 0x00, 0x10, 0x00, 0x01, 0x04, 0x00, 0x00, 0x00, 0x00, 0x00, 0xA8, 0x09, 0x00
      ]);
      plc.socket.write(reqRegs);
      
      // 2. Y0-Y7 Coil read (Y0 run, Y6 error)
      setTimeout(() => {
        if (plc.online && plc.socket) {
          const reqCoils = Buffer.from([
            0x50, 0x00, 0x00, 0xFF, 0xFF, 0x03, 0x00, 0x0C, 0x00, 0x10, 0x00, 0x01, 0x04, 0x01, 0x00, 0x00, 0x00, 0x00, 0x9D, 0x08, 0x00
          ]);
          plc.socket.write(reqCoils);
        }
      }, 30);

      // 2b. Read Serial words D10..14 (Invoke 5 words)
      setTimeout(() => {
        if (plc.online && plc.socket) {
          const reqSerial = Buffer.from([
            0x50, 0x00, 0x00, 0xFF, 0xFF, 0x03, 0x00, 0x0C, 0x00, 0x10, 0x00, 0x01, 0x04, 0x00, 0x00, 0x0A, 0x00, 0x00, 0xA8, 0x05, 0x00
          ]);
          plc.socket.write(reqSerial);
        }
      }, 50);
      
      // Fixed: Removed gateway-side pos emulator, now using true D8 position mapped directly from C++ vPLC!
    } 
    
    else if (plc.protocol === 'xgt' && plc.socket) {
      // 1. completed (%MW0) - Invoke: 10
      const req1 = Buffer.from([
        0x4C, 0x53, 0x49, 0x53, 0x2D, 0x58, 0x47, 0x54, 0x00, 0x00, 0x00, 0x00, 0xA0, 0x33, 0x0A, 0x00, 0x12, 0x00,
        0x00, 0x00, 0x00, 0x00, 0x54, 0x00, 0x02, 0x00, 0x00, 0x00, 0x01, 0x00, 0x04, 0x00, 0x25, 0x4D, 0x57, 0x30
      ]);
      plc.socket.write(req1);
      
      // 2. speed (%MW1) - Invoke: 11
      setTimeout(() => {
        if (plc.online && plc.socket) {
          const req2 = Buffer.from([
            0x4C, 0x53, 0x49, 0x53, 0x2D, 0x58, 0x47, 0x54, 0x00, 0x00, 0x00, 0x00, 0xA0, 0x33, 0x0B, 0x00, 0x12, 0x00,
            0x00, 0x00, 0x00, 0x00, 0x54, 0x00, 0x02, 0x00, 0x00, 0x00, 0x01, 0x00, 0x04, 0x00, 0x25, 0x4D, 0x57, 0x31
          ]);
          plc.socket.write(req2);
        }
      }, 20);
      
      // 3. pos (%IW0) - Invoke: 12
      setTimeout(() => {
        if (plc.online && plc.socket) {
          const req3 = Buffer.from([
            0x4C, 0x53, 0x49, 0x53, 0x2D, 0x58, 0x47, 0x54, 0x00, 0x00, 0x00, 0x00, 0xA0, 0x33, 0x0C, 0x00, 0x12, 0x00,
            0x00, 0x00, 0x00, 0x00, 0x54, 0x00, 0x02, 0x00, 0x00, 0x00, 0x01, 0x00, 0x04, 0x00, 0x25, 0x49, 0x57, 0x30
          ]);
          plc.socket.write(req3);
        }
      }, 40);

      // 4. coils (%QX0.0..0.7) - Invoke: 13
      setTimeout(() => {
        if (plc.online && plc.socket) {
          const req4 = Buffer.from([
            0x4C, 0x53, 0x49, 0x53, 0x2D, 0x58, 0x47, 0x54, 0x00, 0x00, 0x00, 0x00, 0xA0, 0x33, 0x0D, 0x00, 0x14, 0x00,
            0x00, 0x00, 0x00, 0x00, 0x54, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01, 0x00, 0x06, 0x00, 0x25, 0x51, 0x58, 0x30, 0x2E, 0x30
          ]);
          plc.socket.write(req4);
        }
      }, 60);

      // 4b. Read Serial words %MW10..14 (Invoke 20..24)
      for (let i = 0; i < 5; i++) {
        setTimeout(() => {
          if (plc.online && plc.socket) {
            const h = Buffer.from([
              0x4C, 0x53, 0x49, 0x53, 0x2D, 0x58, 0x47, 0x54, 0x00, 0x00, 0x00, 0x00, 0xA0, 0x33, 20 + i, 0, 0x13, 0x00
            ]);
            const b = Buffer.from([
              0x00, 0x00, 0x00, 0x00, 0x54, 0x00, 0x02, 0x00, 0x00, 0x00, 0x01, 0x00, 0x05, 0x00, 0x25, 0x4D, 0x57, 0x31, 0x30
            ]);
            b.write(`%MW${10 + i}`, 14);
            plc.socket.write(Buffer.concat([h, b]));
          }
        }, 80 + i * 15);
      }
    }
  });
}

function stopDynamicPLCs() {
  dynamicPlcCount = 0;
  dynamicPlcs.forEach((plc) => {
    if (plc.socket) {
      plc.socket.destroy();
    }
    if (plc.client && plc.protocol === 's7') {
      plc.client.dropConnection(() => {});
    }
  });
  dynamicPlcs = [];
  log('DYNAMIC-POOL', `다이내믹 공정 연결 풀 제거 완료.`, colors.yellow);
}

// ------------------------------------------------------------------------------
// DYNAMIC CHAIN MES DATA TRACKING & HANDSHAKE
// ------------------------------------------------------------------------------
let prevDynamicCompleted = [];

async function runDynamicProcessBridge() {
  if (dynamicPlcCount === 0 || dynamicPlcs.length === 0) return;
  
  if (prevDynamicCompleted.length !== dynamicPlcCount) {
    prevDynamicCompleted = dynamicPlcs.map(p => p.data.completed);
    return;
  }
  
  for (let i = 0; i < dynamicPlcCount - 1; i++) {
    const curPlc = dynamicPlcs[i];
    const nextPlc = dynamicPlcs[i + 1];
    const prevComp = prevDynamicCompleted[i];
    
    const serialStr = curPlc.data.serial || "          ";
    // 스캔 가드: 시리얼이 비어 있지 않은 정품 차대일 때만 다음 dynamic 공정으로 바통 이송!
    if (prevComp !== -1 && curPlc.data.completed > prevComp && serialStr.trim() !== "") {
      log('DYNAMIC-MES', `공정 #${curPlc.idx} 완료 ➔ 공정 #${nextPlc.idx} (${nextPlc.protocol.toUpperCase()}): 시리얼 [${serialStr}] MES 이송!`, colors.magenta);
      writeDynamicPlcSerialAndTrigger(nextPlc, serialStr);
      
      // 물리적으로 다음 공정으로 이송되었으므로 이전 공정의 시리얼을 완전히 비운다
      writeDynamicPlcSerial(curPlc, "          ");
      curPlc.data.serial = "";
    }
    
    prevDynamicCompleted[i] = curPlc.data.completed;
  }

  // 최종 공정 완료 체크 및 시리얼 클리어
  if (dynamicPlcCount > 0) {
    const lastPlc = dynamicPlcs[dynamicPlcCount - 1];
    const lastPrevComp = prevDynamicCompleted[dynamicPlcCount - 1];
    const lastSerial = lastPlc.data.serial || "";
    if (lastPrevComp !== -1 && lastPlc.data.completed > lastPrevComp && lastSerial.trim() !== "") {
      log('DYNAMIC-MES', `🏁 [최종 공정 완료] 완성차 출하! 시리얼 [${lastSerial.trim()}]`, colors.green);
      writeDynamicPlcSerial(lastPlc, "          ");
      lastPlc.data.serial = "";
    }
    prevDynamicCompleted[dynamicPlcCount - 1] = lastPlc.data.completed;
  }
}

async function writeDynamicPlcSerial(plc, serial) {
  if (!plc.online) return;
  const words = stringToWords(serial);
  if (plc.protocol === 'modbus' && plc.client) {
    for (let i = 0; i < 5; i++) {
      try { await plc.client.writeSingleRegister(10 + i, words[i]); } catch (e) {}
    }
  } else if (plc.protocol === 's7' && plc.client) {
    // S7 sequential callback chaining to prevent parallel write conflicts
    plc.client.writeItems('DB1,INT20', words[0], () => {
      plc.client.writeItems('DB1,INT22', words[1], () => {
        plc.client.writeItems('DB1,INT24', words[2], () => {
          plc.client.writeItems('DB1,INT26', words[3], () => {
            plc.client.writeItems('DB1,INT28', words[4], () => {});
          });
        });
      });
    });
  }
}

async function writeDynamicPlcSerialAndTrigger(plc, serial) {
  if (!plc.online) return;
  const words = stringToWords(serial);
  
  if (plc.protocol === 'modbus' && plc.client) {
    for (let i = 0; i < 5; i++) {
      try { await plc.client.writeSingleRegister(10 + i, words[i]); } catch (e) {}
    }
    try {
      await plc.client.writeSingleRegister(2, 1);
      setTimeout(async () => {
        try { if (plc.online && plc.client) await plc.client.writeSingleRegister(2, 0); } catch (err) {}
      }, 1000);
    } catch (e) {}
  }
  
  else if (plc.protocol === 's7' && plc.client) {
    // S7 sequential callback chaining to write serial words, then trigger DB1,INT4 with a 1-second reset pulse
    plc.client.writeItems('DB1,INT20', words[0], () => {
      plc.client.writeItems('DB1,INT22', words[1], () => {
        plc.client.writeItems('DB1,INT24', words[2], () => {
          plc.client.writeItems('DB1,INT26', words[3], () => {
            plc.client.writeItems('DB1,INT28', words[4], () => {
              plc.client.writeItems('DB1,INT4', 1, () => {
                setTimeout(() => {
                  if (plc.online && plc.client) plc.client.writeItems('DB1,INT4', 0, () => {});
                }, 1000);
              });
            });
          });
        });
      });
    });
  }
  
  else if (plc.protocol === 'mc' && plc.socket) {
    const header = Buffer.from([
      0x50, 0x00, 0x00, 0xFF, 0xFF, 0x03, 0x00, 0x16, 0x00, 0x10, 0x00, 0x01, 0x14, 0x00, 0x00, 0x0A, 0x00, 0x00, 0xA8, 0x05, 0x00
    ]);
    const valBuf = Buffer.alloc(10);
    for (let i = 0; i < 5; i++) {
      valBuf.writeUInt16LE(words[i], i * 2);
    }
    plc.socket.write(Buffer.concat([header, valBuf]));
    
    setTimeout(() => {
      if (plc.online && plc.socket) {
        const trigHeader = Buffer.from([
          0x50, 0x00, 0x00, 0xFF, 0xFF, 0x03, 0x00, 0x0E, 0x00, 0x10, 0x00, 0x01, 0x14, 0x00, 0x00, 0x02, 0x00, 0x00, 0xA8, 0x01, 0x00
        ]);
        plc.socket.write(Buffer.concat([trigHeader, Buffer.from([1, 0])]));
        setTimeout(() => {
          if (plc.online && plc.socket) {
            plc.socket.write(Buffer.concat([trigHeader, Buffer.from([0, 0])]));
          }
        }, 1000);
      }
    }, 100);
  }
  
  else if (plc.protocol === 'xgt' && plc.socket) {
    for (let i = 0; i < 5; i++) {
      const addr = 10 + i;
      const header = Buffer.from([
        0x4C, 0x53, 0x49, 0x53, 0x2D, 0x58, 0x47, 0x54, 0x00, 0x00, 0x00, 0x00, 0xA0, 0x33, 0x02, 0x00, 0x17, 0x00
      ]);
      const xgtWriteBody = Buffer.from([
        0x00, 0x00, 0x00, 0x00, 0x58, 0x00, 0x02, 0x00, 0x00, 0x00, 0x01, 0x00, 0x05, 0x00, 0x25, 0x4D, 0x57, 0x31, 0x30,
        0x02, 0x00, words[i] & 0xFF, (words[i] >> 8) & 0xFF
      ]);
      xgtWriteBody.write(`%MW${addr}`, 14);
      plc.socket.write(Buffer.concat([header, xgtWriteBody]));
    }
    
    setTimeout(() => {
      if (plc.online && plc.socket) {
        const header = Buffer.from([
          0x4C, 0x53, 0x49, 0x53, 0x2D, 0x58, 0x47, 0x54, 0x00, 0x00, 0x00, 0x00, 0xA0, 0x33, 0x02, 0x00, 0x16, 0x00
        ]);
        const body = Buffer.from([
          0x00, 0x00, 0x00, 0x00, 0x58, 0x00, 0x02, 0x00, 0x00, 0x00, 0x01, 0x00, 0x04, 0x00, 0x25, 0x4D, 0x57, 0x32,
          0x02, 0x00, 1, 0
        ]);
        plc.socket.write(Buffer.concat([header, body]));
        setTimeout(() => {
          if (plc.online && plc.socket) {
            const resetBody = Buffer.from([
              0x00, 0x00, 0x00, 0x00, 0x58, 0x00, 0x02, 0x00, 0x00, 0x00, 0x01, 0x00, 0x04, 0x00, 0x25, 0x4D, 0x57, 0x32,
              0x02, 0x00, 0, 0
            ]);
            plc.socket.write(Buffer.concat([header, resetBody]));
          }
        }, 1000);
      }
    }, 100);
  }
}

// ------------------------------------------------------------------------------

setInterval(async () => {
  if (dynamicPlcCount > 0) {
    pollDynamicPLCs();
    await runDynamicProcessBridge();
    broadcastDynamicData();
  } else {
    pollModbus();
    pollS7();
    pollMC();
    pollXpush();
    pollXGT();
    await runProcessBridge();
    broadcastData();
  }
}, 100);

// XGT polling fallback helper (if xgt is active but pollXGT needs safety)
function pollXpush() {
  // Safe helper
}

// ==========================================
// 9. WEB SCRIPT & WEBSOCKET 통신 허브
// ==========================================
const server = http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' });
  res.end('vPLC-Runtime 이기종 프로토콜 모바일/웹 게이트웨이 구동 중입니다.');
});

const wss = new WebSocketServer({ server });

function broadcast(msgObj) {
  const jsonStr = JSON.stringify(msgObj);
  wss.clients.forEach((client) => {
    if (client.readyState === 1) {
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

function broadcastDynamicStatus() {
  broadcast({
    type: 'plc_dynamic_status',
    plcConnections: dynamicPlcs.map(p => ({ idx: p.idx, online: p.online, protocol: p.protocol }))
  });
}

function broadcastDynamicData() {
  broadcast({
    type: 'plc_dynamic_data',
    stageCount: dynamicPlcCount,
    plcs: dynamicPlcs.map(p => ({
      idx: p.idx,
      protocol: p.protocol,
      port: p.port,
      online: p.online,
      data: {
        conveyor_run: p.data.conveyor_run,
        pos: Math.round(p.data.pos),
        completed: p.data.completed,
        speed: p.data.speed,
        error: p.data.error,
        serial: p.data.serial || "          "
      }
    }))
  });
}

// Handle Client Messages
wss.on('connection', (ws) => {
  log('WS-HUB', '리액트 시뮬레이션 브라우저가 게이트웨이에 연결되었습니다.', colors.cyan);
  
  if (dynamicPlcCount > 0) {
    ws.send(JSON.stringify({
      type: 'plc_dynamic_data',
      stageCount: dynamicPlcCount,
      plcs: dynamicPlcs.map(p => ({
        idx: p.idx,
        protocol: p.protocol,
        port: p.port,
        online: p.online,
        data: p.data
      }))
    }));
  } else {
    ws.send(JSON.stringify({ type: 'connection_status', plcConnections }));
    ws.send(JSON.stringify({ type: 'plc_data', plcData }));
  }

  ws.on('message', async (message) => {
    try {
      const data = JSON.parse(message);
      
      // 1. Dynamic Mode Scale Commands
      if (data.type === 'start_dynamic') {
        const count = parseInt(data.count, 10) || 8;
        log('DYNAMIC-CONTROL', `다이내믹 공정 확장 지시 수신 [Count: ${count}]. C++ 백그라운드 프로세스 기동 중...`, colors.magenta);
        
        const { exec } = require('child_process');
        exec(`./vplc-dynamic-run.sh stop && ./vplc-dynamic-run.sh start ${count}`, { cwd: __dirname + '/..' }, (err, stdout, stderr) => {
          if (err) {
            log('DYNAMIC-CONTROL', `❌ C++ 가변 vPLC 구동 실패: ${err.message}`, colors.red);
          } else {
            log('DYNAMIC-CONTROL', `🟢 C++ 가변 vPLC 구동 및 초기화 완료!`, colors.green);
          }
        });

        startDynamicPLCs(count);
      } 
      
      else if (data.type === 'stop_dynamic') {
        log('DYNAMIC-CONTROL', `다이내믹 공정 정지 및 리셋 지시 수신. C++ 프로세스 종료 중...`, colors.magenta);
        
        const { exec } = require('child_process');
        exec(`./vplc-dynamic-run.sh stop`, { cwd: __dirname + '/..' }, (err) => {
          if (err) log('DYNAMIC-CONTROL', `❌ C++ 가변 vPLC 정지 실패: ${err.message}`, colors.red);
        });

        stopDynamicPLCs();
      }
      
      else if (data.type === 'start_fixed') {
        log('FIXED-CONTROL', `기본 고정 공정 vPLC 기동 지시 수신. C++ 프로세스 기동 중...`, colors.magenta);
        
        const { exec } = require('child_process');
        exec(`./vplc-run.sh stop && ./vplc-run.sh start`, { cwd: __dirname + '/..' }, (err, stdout, stderr) => {
          if (err) {
            log('FIXED-CONTROL', `❌ C++ 고정 vPLC 구동 실패: ${err.message}`, colors.red);
          } else {
            log('FIXED-CONTROL', `🟢 C++ 고정 vPLC 구동 및 초기화 완료!`, colors.green);
          }
        });
      }
      
      else if (data.type === 'stop_fixed') {
        log('FIXED-CONTROL', `기본 고정 공정 vPLC 정지 지시 수신. C++ 프로세스 종료 중...`, colors.magenta);
        
        const { exec } = require('child_process');
        exec(`./vplc-run.sh stop`, { cwd: __dirname + '/..' }, (err) => {
          if (err) log('FIXED-CONTROL', `❌ C++ 고정 vPLC 정지 실패: ${err.message}`, colors.red);
        });
      }
      
      // 2. Dynamic Register Write Command
      else if (data.type === 'write_dynamic_register') {
        const { idx, address, value } = data;
        const plc = dynamicPlcs.find(p => p.idx === idx);
        if (plc && plc.online) {
          const intVal = parseInt(value, 10);
          
          if (idx === 1 && address === 2 && intVal === 1) {
            const newSerial = generateSerialNo();
            log('DYNAMIC-MES', `🆕 [MES 원자재 주입] Dynamic PLC #1 신규 시리얼 생성 ➡️ [${newSerial}]`, colors.green);
            plc.data.serial = newSerial;
            
            const words = stringToWords(newSerial);
            // 1. Write serial to registers MW10-MW14 (Scan)
            if (plc.protocol === 'modbus' && plc.client) {
              for (let i = 0; i < 5; i++) {
                try { await plc.client.writeSingleRegister(10 + i, words[i]); } catch (e) {}
              }
            } else if (plc.protocol === 's7' && plc.client) {
              // S7 sequential callback chaining to prevent parallel write conflicts during raw chassis provisioning
              plc.client.writeItems('DB1,INT20', words[0], () => {
                plc.client.writeItems('DB1,INT22', words[1], () => {
                  plc.client.writeItems('DB1,INT24', words[2], () => {
                    plc.client.writeItems('DB1,INT26', words[3], () => {
                      plc.client.writeItems('DB1,INT28', words[4], () => {});
                    });
                  });
                });
              });
            }
            
            // 2. Trigger start after short delay
            setTimeout(async () => {
              if (plc.protocol === 'modbus' && plc.client) {
                await plc.client.writeSingleRegister(2, 1);
                setTimeout(async () => {
                  try { if (plc.online && plc.client) await plc.client.writeSingleRegister(2, 0); } catch (e) {}
                }, 1000);
              } else if (plc.protocol === 's7' && plc.client) {
                plc.client.writeItems('DB1,INT4', 1, () => {
                  setTimeout(() => {
                    if (plc.online && plc.client) plc.client.writeItems('DB1,INT4', 0, () => {});
                  }, 1000);
                });
              }
            }, 100);
          } else {
            log('DYNAMIC-WRITE', `Dynamic PLC #${idx} (${plc.protocol}) Register ${address} = ${value} 쓰기 지시 수신`, colors.magenta);
            if (plc.protocol === 'modbus' && plc.client) {
              await plc.client.writeSingleRegister(address, intVal);
            } 
            else if (plc.protocol === 's7' && plc.client) {
              plc.client.writeItems(`DB1,INT${address * 2}`, intVal, (err) => {
                if (err) log('DYNAMIC-S7-WRITE', `S7 write error: ${err}`, colors.red);
              });
            } 
            else if (plc.protocol === 'mc' && plc.socket) {
              const header = Buffer.from([
                0x50, 0x00, 0x00, 0xFF, 0xFF, 0x03, 0x00, 0x0E, 0x00, 0x10, 0x00, 0x01, 0x14, 0x00, 0x00, 0x01, 0x00, 0x00, 0xA8, 0x01, 0x00
              ]);
              const valBuf = Buffer.from([intVal & 0xFF, (intVal >> 8) & 0xFF]);
              plc.socket.write(Buffer.concat([header, valBuf]));
            } 
            else if (plc.protocol === 'xgt' && plc.socket) {
              const header = Buffer.from([
                0x4C, 0x53, 0x49, 0x53, 0x2D, 0x58, 0x47, 0x54, 0x00, 0x00, 0x00, 0x00, 0xA0, 0x33, 0x02, 0x00, 0x16, 0x00
              ]);
              const body = Buffer.from([
                0x00, 0x00, 0x00, 0x00, 0x58, 0x00, 0x02, 0x00, 0x00, 0x00, 0x01, 0x00, 0x04, 0x00, 0x25, 0x4D, 0x57, 0x31,
                0x02, 0x00, intVal & 0xFF, (intVal >> 8) & 0xFF
              ]);
              plc.socket.write(Buffer.concat([header, body]));
            }
          }
        }
      }
      
      // 3. Fixed Mode Write Command (Backward Compatible)
      else if (data.type === 'write_register') {
        const { plcId, address, value } = data;
        log('WS-WRITE', `원격 제어 지시 수신 [PLC: ${plcId}, Register: ${address}, Value: ${value}]`, colors.magenta);
        
        if (plcId === 'feeder' && plcConnections.feeder && modbusClient) {
          const intVal = parseInt(value, 10);
          
          if (address === 2 && intVal === 1) {
            // 인터록 감지: 이미 Feeder에 화물이 있는 경우 주입 차단! (방어적 타입 가드 적용)
            const feederSerial = plcData.feeder.serial ? String(plcData.feeder.serial).trim() : "";
            const feederPos = plcData.feeder.pos || 0;
            const feederRun = plcData.feeder.conveyor_run || false;
            
            if (feederSerial !== "" || feederPos > 0 || feederRun) {
              log('MES-INTERLOCK', `⚠️ [주입 차단] 이미 Feeder 공정에 이송 중인 자재가 존재하므로 신규 투입을 차단합니다. (Serial: [${feederSerial}], Pos: ${feederPos}, Run: ${feederRun})`, colors.yellow);
              return;
            }
            
            const newSerial = generateSerialNo();
            log('MES', `🆕 [MES 원자재 주입] 신규 차량 생성! 시리얼 부여 ➡️ [${newSerial}]`, colors.green);
            const words = stringToWords(newSerial);
            for (let i = 0; i < 5; i++) {
              try {
                await modbusClient.writeSingleRegister(10 + i, words[i]);
              } catch (err) {}
            }
          }

          await modbusClient.writeSingleRegister(address, intVal);
        }
        else if (plcId === 'cnc' && plcConnections.cnc) {
          const intVal = parseInt(value, 10);
          s7Client.writeItems(`DB1,INT${address * 2}`, intVal, (err) => {
            if (err) log('S7-WRITE', `S7 write error: ${err}`, colors.red);
          });
        }
        else if (plcId === 'qc' && plcConnections.qc && mcSocket) {
          const intVal = parseInt(value, 10);
          const header = Buffer.from([
            0x50, 0x00, 0x00, 0xFF, 0xFF, 0x03, 0x00, 0x0E, 0x00, 0x10, 0x00, 0x01, 0x14, 0x00, 0x00, 0x01, 0x00, 0x00, 0xA8, 0x01, 0x00
          ]);
          const valBuf = Buffer.from([intVal & 0xFF, (intVal >> 8) & 0xFF]);
          mcSocket.write(Buffer.concat([header, valBuf]));
        }
        else if (plcId === 'sorter' && plcConnections.sorter && xgtSocket) {
          const intVal = parseInt(value, 10);
          const header = Buffer.from([
            0x4C, 0x53, 0x49, 0x53, 0x2D, 0x58, 0x47, 0x54, 0x00, 0x00, 0x00, 0x00, 0xA0, 0x33, 0x02, 0x00, 0x16, 0x00
          ]);
          const body = Buffer.from([
            0x00, 0x00, 0x00, 0x00, 0x58, 0x00, 0x02, 0x00, 0x00, 0x00, 0x01, 0x00, 0x04, 0x00, 0x25, 0x4D, 0x57, 0x31,
            0x02, 0x00, intVal & 0xFF, (intVal >> 8) & 0xFF
          ]);
          xgtSocket.write(Buffer.concat([header, body]));
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
  
  connectModbus();
  connectS7();
  connectMC();
  connectXGT();
});

