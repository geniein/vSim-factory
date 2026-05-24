#!/bin/bash

# ==============================================================================
# vPLC-Runtime Multi-Instance Manager Script
# ==============================================================================
# 이 스크립트는 4개의 가상 PLC 인스턴스를 포트 충돌 없이 기동 및 종료 제어합니다.
# ==============================================================================

VPLC_DIR="../vPlc"
PID_FILE="./vplc.pids"
LOG_DIR="./logs"

show_help() {
    echo "Usage: ./vplc-run.sh [start|stop|status]"
    echo "  start   : C++ 소스를 컴파일하고 4대의 이기종 프로토콜 PLC를 포트 오프셋으로 기동"
    echo "  stop    : 가동 중인 4대의 가상 PLC 프로세스를 일괄 소멸 종료"
    echo "  status  : 현재 백그라운드 구동 중인 PLC 프로세스 상태 모니터링"
}

compile_plc() {
    echo "--------------------------------------------------------"
    echo "🛠️ 1단계: vPLC C++ 메인 런타임 및 조립 로직 라이브러리 빌드 개시..."
    echo "--------------------------------------------------------"
    
    if [ ! -d "$VPLC_DIR" ]; then
        echo "❌ 에러: 인접 디렉토리에 vPlc 프로젝트가 존재하지 않습니다: $VPLC_DIR"
        exit 1
    fi
    
    cd "$VPLC_DIR" || exit 1
    
    # 1. 메인 런타임 빌드 (Snap7 헤더/라이브러리 경로 호환 링크 포함)
    echo "[Build] 컴파일러 구동: vPlc 바이너리 빌드 중..."
    clang++ -std=c++17 -O3 -pthread \
        src/main.cpp \
        src/core/PlcMemory.cpp \
        src/core/PlcLoader.cpp \
        src/core/PlcScheduler.cpp \
        src/modbus/ModbusServer.cpp \
        src/tui/PlcTui.cpp \
        src/s7/S7Server.cpp \
        src/mc/McServer.cpp \
        src/xgt/XgtServer.cpp \
        src/mqtt/MqttPublisher.cpp \
        -o vPlc -Isrc -I/opt/homebrew/include -L/opt/homebrew/lib -lsnap7 -lmosquitto
        
    if [ $? -ne 0 ]; then
        echo "❌ 에러: C++ vPlc 컴파일 실패!"
        exit 1
    fi
    echo "✅ vPlc 빌드 성공!"
    
    # 2. Automotive Assembly 로직 라이브러리 빌드
    echo "[Build] 자동차 조립 공정 dylib 컴파일 중..."
    clang++ -std=c++17 -O3 -shared -fPIC src/logic/assembly_logic.cpp -o libassembly_logic.dylib
    
    if [ $? -ne 0 ]; then
        echo "❌ 에러: libassembly_logic.dylib 컴파일 실패!"
        exit 1
    fi
    echo "✅ libassembly_logic.dylib 빌드 성공!"
    
    cd - > /dev/null || exit 1
}

start_plcs() {
    if [ -f "$PID_FILE" ]; then
        echo "⚠️ 경고: 이미 가동 중인 vPLC 정보가 기록되어 있습니다. 먼저 stop을 실행해 주십시오."
        status_plcs
        return
    fi
    
    # 컴파일 실행
    compile_plc
    
    mkdir -p "$LOG_DIR"
    echo ""
    echo "--------------------------------------------------------"
    echo "🚀 2단계: 4대의 가상 PLC 분산 네트워크 일괄 가동 개시..."
    echo "--------------------------------------------------------"
    
    # 1. PLC #1: 투입 공정 (Modbus TCP)
    # 포트: 5020 + 10 = 5030
    echo "[Start] PLC #1: 투입기 (Feeder) 가동 -> Modbus TCP (Port 5030)"
    cd "$VPLC_DIR" || exit 1
    ./vPlc -p modbus -o 10 assembly > "../vSim-factory/logs/plc1_feeder.log" 2>&1 < /dev/null &
    PLC1_PID=$!
    cd - > /dev/null || exit 1
    
    # 2. PLC #2: CNC 가공 공정 (지멘스 S7)
    # 포트: 1020 + 20 = 1040
    echo "[Start] PLC #2: CNC가공 (CNC Mill) 가동 -> Siemens S7 (Port 1040)"
    cd "$VPLC_DIR" || exit 1
    ./vPlc -p s7 -o 20 assembly > "../vSim-factory/logs/plc2_cnc.log" 2>&1 < /dev/null &
    PLC2_PID=$!
    cd - > /dev/null || exit 1
    
    # 3. PLC #3: QC 검사 공정 (미쓰비시 MC)
    # 포트: 5011 + 30 = 5041
    echo "[Start] PLC #3: 비전QC (QC Vision) 가동 -> MELSEC MC (Port 5041)"
    cd "$VPLC_DIR" || exit 1
    ./vPlc -p mc -o 30 assembly > "../vSim-factory/logs/plc3_qc.log" 2>&1 < /dev/null &
    PLC3_PID=$!
    cd - > /dev/null || exit 1
    
    # 4. PLC #4: 출하 분류 공정 (LS Electric XGT)
    # 포트: 2004 + 40 = 2044
    echo "[Start] PLC #4: 출하분류 (Sorter) 가동 -> LS Electric XGT (Port 2044)"
    cd "$VPLC_DIR" || exit 1
    ./vPlc -p xgt -o 40 assembly > "../vSim-factory/logs/plc4_sorter.log" 2>&1 < /dev/null &
    PLC4_PID=$!
    cd - > /dev/null || exit 1
    
    # PIDs 기록
    echo "$PLC1_PID" > "$PID_FILE"
    echo "$PLC2_PID" >> "$PID_FILE"
    echo "$PLC3_PID" >> "$PID_FILE"
    echo "$PLC4_PID" >> "$PID_FILE"
    
    echo "--------------------------------------------------------"
    echo "🟢 4대 vPLC 분산 엔진 가동 완료 (PIDs 기록 완료)"
    echo "   - 로그 폴더: $LOG_DIR"
    echo "--------------------------------------------------------"
}

stop_plcs() {
    echo "--------------------------------------------------------"
    echo "🛑 3단계: 백그라운드 가상 PLC 프로세스 일괄 소멸 정지..."
    echo "--------------------------------------------------------"
    
    if [ ! -f "$PID_FILE" ]; then
        echo "ℹ️ 정보: 가동 중인 vPLC 정보($PID_FILE)가 존재하지 않습니다."
        return
    fi
    
    while IFS= read -r pid; do
        if ps -p "$pid" > /dev/null; then
            echo "[Stop] PID $pid 프로세스에 안전 종료 신호(SIGTERM) 송신..."
            kill "$pid"
            
            # 2초간 유예 대기
            for i in {1..10}; do
                if ! ps -p "$pid" > /dev/null; then
                    break
                fi
                sleep 0.2
            done
            
            # 미종료시 강제 종료
            if ps -p "$pid" > /dev/null; then
                echo "⚠️ 경고: PID $pid 미반응으로 강제 종료(SIGKILL) 집행..."
                kill -9 "$pid"
            fi
        else
            echo "ℹ️ 정보: PID $pid 프로세스는 이미 종료되어 있습니다."
        fi
    done < "$PID_FILE"
    
    rm -f "$PID_FILE"
    echo "✅ 모든 가상 PLC 인스턴스 정지 완료."
    echo "--------------------------------------------------------"
}

status_plcs() {
    echo "--------------------------------------------------------"
    echo "📊 가상 PLC 백그라운드 프로세스 동작 상태 모니터"
    echo "--------------------------------------------------------"
    
    if [ ! -f "$PID_FILE" ]; then
        echo "🔴 대기 중: 가동 중인 백그라운드 PLC 인스턴스가 존재하지 않습니다."
        return
    fi
    
    IDX=1
    NAMES=("Feeder [Modbus]" "CNC Mill [S7]" "QC Vision [MC]" "Sorter [XGT]")
    PORTS=("5030" "1040" "5041" "2044")
    
    while IFS= read -r pid; do
        NAME=${NAMES[$((IDX-1))]}
        PORT=${PORTS[$((IDX-1))]}
        if ps -p "$pid" > /dev/null; then
            echo -e "🟢 PLC #$IDX \033[1;32mONLINE\033[0m : $NAME (PID: $pid) ➡️ Port \033[1;36m$PORT\033[0m"
        else
            echo -e "🔴 PLC #$IDX \033[1;31mOFFLINE\033[0m: $NAME (PID: $pid) ➡️ Port $PORT"
        fi
        IDX=$((IDX+1))
    done < "$PID_FILE"
    echo "--------------------------------------------------------"
}

case "$1" in
    start)
        start_plcs
        ;;
    stop)
        stop_plcs
        ;;
    status)
        status_plcs
        ;;
    *)
        show_help
        ;;
esac
