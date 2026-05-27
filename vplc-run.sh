#!/bin/bash

# ==============================================================================
# vPLC-Runtime Multi-Instance Manager Script
# ==============================================================================
# 이 스크립트는 4개의 가상 PLC 인스턴스를 포트 충돌 없이 기동 및 종료 제어합니다.
# ==============================================================================

FACTORY_DIR="$(cd "$(dirname "$0")" && pwd)"
VPLC_DIR="$(cd "$FACTORY_DIR/../vPLC-runtime" && pwd)"
PID_FILE="$FACTORY_DIR/vplc.pids"
LOG_DIR="$FACTORY_DIR/logs"

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
    
    # 1. CMake 빌드 감지 및 실행 (권장 방식)
    if [ -f "CMakeLists.txt" ] && command -v cmake &> /dev/null; then
        echo "[Build] CMake 환경 감지. CMake를 사용하여 빌드합니다..."
        mkdir -p build
        cd build || exit 1
        cmake ..
        if [ $? -ne 0 ]; then
            echo "❌ 에러: CMake 구성 실패!"
            exit 1
        fi
        
        NUM_PROCS=$(nproc 2>/dev/null || sysctl -n hw.ncpu 2>/dev/null || echo 2)
        cmake --build . --config Release -j $NUM_PROCS
        if [ $? -ne 0 ]; then
            echo "❌ 에러: CMake 빌드 실패!"
            exit 1
        fi
        cd ..
        
        # 빌드된 결과물 복사
        cp build/vPlc . 2>/dev/null || true
        if [ "$(uname -s)" = "Darwin" ]; then
            cp build/libassembly_logic.dylib . 2>/dev/null || true
            cp build/libmock_logic.dylib . 2>/dev/null || true
        else
            cp build/libassembly_logic.so . 2>/dev/null || true
            cp build/libmock_logic.so . 2>/dev/null || true
        fi
    else
        # 2. 직접 컴파일러 빌드 (CMake가 없을 경우의 대체 방식)
        echo "[Build] CMake가 없거나 감지되지 않아 직접 컴파일러로 빌드합니다..."
        
        OS_NAME=$(uname -s)
        if [ "$OS_NAME" = "Darwin" ]; then
            COMPILER="clang++"
            LIB_EXT="dylib"
            INC_FLAGS="-I/opt/homebrew/include"
            LIB_FLAGS="-L/opt/homebrew/lib"
        else
            COMPILER="g++"
            LIB_EXT="so"
            INC_FLAGS="-I/usr/local/include -I/usr/include"
            LIB_FLAGS="-L/usr/local/lib -L/usr/lib"
        fi
        
        # 컴파일러 실행 파일 확인
        if ! command -v "$COMPILER" &> /dev/null; then
            if command -v g++ &> /dev/null; then
                COMPILER="g++"
            elif command -v clang++ &> /dev/null; then
                COMPILER="clang++"
            else
                echo "❌ 에러: 적합한 C++ 컴파일러(g++ 또는 clang++)를 찾을 수 없습니다."
                exit 1
            fi
        fi
        
        echo "[Build] 감지된 컴파일러: $COMPILER (OS: $OS_NAME)"
        
        # 메인 바이너리 빌드 (새로 추가된 PlcTagManager 및 WebServer 포함)
        $COMPILER -std=c++17 -O3 -pthread \
            src/main.cpp \
            src/core/PlcMemory.cpp \
            src/core/PlcTagManager.cpp \
            src/core/PlcLoader.cpp \
            src/core/PlcScheduler.cpp \
            src/modbus/ModbusServer.cpp \
            src/tui/PlcTui.cpp \
            src/s7/S7Server.cpp \
            src/mc/McServer.cpp \
            src/xgt/XgtServer.cpp \
            src/mqtt/MqttPublisher.cpp \
            src/web/WebServer.cpp \
            -o vPlc -Isrc $INC_FLAGS $LIB_FLAGS -lsnap7 -lmosquitto
            
        if [ $? -ne 0 ]; then
            echo "❌ 에러: C++ vPlc 컴파일 실패!"
            exit 1
        fi
        echo "✅ vPlc 빌드 성공!"
        
        # Automotive Assembly 로직 라이브러리 빌드
        echo "[Build] 자동차 조립 공정 라이브러리 (libassembly_logic.$LIB_EXT) 직접 컴파일 중..."
        $COMPILER -std=c++17 -O3 -shared -fPIC src/logic/assembly_logic.cpp -o libassembly_logic.$LIB_EXT -Isrc
        
        if [ $? -ne 0 ]; then
            echo "❌ 에러: libassembly_logic.$LIB_EXT 컴파일 실패!"
            exit 1
        fi
        echo "✅ libassembly_logic.$LIB_EXT 빌드 성공!"
    fi
    
    cd "$FACTORY_DIR" || exit 1
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
    nohup ./build/vPlc -p modbus -o 10 -w 8110 --headless ./build/libassembly_logic.so > "$LOG_DIR/plc1_feeder.log" 2>&1 < /dev/null &
    PLC1_PID=$!
    cd "$FACTORY_DIR" || exit 1
    sleep 0.25
    
    # 2. PLC #2: CNC 가공 공정 (지멘스 S7)
    # 포트: 1020 + 20 = 1040
    echo "[Start] PLC #2: CNC가공 (CNC Mill) 가동 -> Siemens S7 (Port 1040)"
    cd "$VPLC_DIR" || exit 1
    nohup ./build/vPlc -p s7 -o 20 -w 8120 --headless ./build/libassembly_logic.so > "$LOG_DIR/plc2_cnc.log" 2>&1 < /dev/null &
    PLC2_PID=$!
    cd "$FACTORY_DIR" || exit 1
    sleep 0.25
    
    # 3. PLC #3: QC 검사 공정 (미쓰비시 MC)
    # 포트: 5011 + 30 = 5041
    echo "[Start] PLC #3: 비전QC (QC Vision) 가동 -> MELSEC MC (Port 5041)"
    cd "$VPLC_DIR" || exit 1
    nohup ./build/vPlc -p mc -o 30 -w 8130 --headless ./build/libassembly_logic.so > "$LOG_DIR/plc3_qc.log" 2>&1 < /dev/null &
    PLC3_PID=$!
    cd "$FACTORY_DIR" || exit 1
    sleep 0.25
    
    # 4. PLC #4: 출하 분류 공정 (LS Electric XGT)
    # 포트: 2004 + 40 = 2044
    echo "[Start] PLC #4: 출하분류 (Sorter) 가동 -> LS Electric XGT (Port 2044)"
    cd "$VPLC_DIR" || exit 1
    nohup ./build/vPlc -p xgt -o 40 -w 8140 --headless ./build/libassembly_logic.so > "$LOG_DIR/plc4_sorter.log" 2>&1 < /dev/null &
    PLC4_PID=$!
    cd "$FACTORY_DIR" || exit 1
    sleep 0.25
    
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
