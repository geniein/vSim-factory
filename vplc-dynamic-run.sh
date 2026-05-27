#!/bin/bash

# ==============================================================================
# vPLC-Runtime Dynamic Multi-Instance Manager Script
# ==============================================================================
# 이 스크립트는 N개(3~20개)의 가상 PLC 인스턴스를 이기종 프로토콜 순환 배치로 구동합니다.
# ==============================================================================

FACTORY_DIR="$(cd "$(dirname "$0")" && pwd)"
VPLC_DIR="$(cd "$FACTORY_DIR/../vPLC-runtime" && pwd)"
PID_FILE="$FACTORY_DIR/vplc-dynamic.pids"
LOG_DIR="$FACTORY_DIR/logs"

show_help() {
    echo "Usage: ./vplc-dynamic-run.sh [start|stop|status] [count]"
    echo "  start [N] : C++ 소스를 빌드하고 N대(3~20)의 이기종 순환 프로토콜 PLC를 포트 오프셋으로 기동"
    echo "  stop      : 현재 백그라운드 구동 중인 모든 동적 가상 PLC 프로세스 정지"
    echo "  status    : 현재 동적 가상 PLC 프로세스 상태 모니터링"
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
        
        # 메인 바이너리 빌드
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
    COUNT=$1
    if [ -z "$COUNT" ]; then
        COUNT=8
    fi

    # 3 ~ 20 범위 보정
    if [ "$COUNT" -lt 3 ]; then
        COUNT=3
    elif [ "$COUNT" -gt 20 ]; then
        COUNT=20
    fi

    if [ -f "$PID_FILE" ]; then
        echo "⚠️ 경고: 이미 가동 중인 가변 vPLC 정보가 기록되어 있습니다. 먼저 stop을 실행해 주십시오."
        status_plcs
        return
    fi
    
    # 컴파일 실행
    compile_plc
    
    mkdir -p "$LOG_DIR"
    echo ""
    echo "--------------------------------------------------------"
    echo "🚀 2단계: ${COUNT}대의 가변 이기종 가상 PLC 분산 가동 개시..."
    echo "--------------------------------------------------------"
    
    rm -f "$PID_FILE"
    
    for ((i=1; i<=COUNT; i++)); do
        OFFSET=$((i * 10))
        
        # 프로토콜 순환 배치 규칙 (Modbus ➔ S7 ➔ MC ➔ XGT)
        PROT_IDX=$(( (i - 1) % 4 ))
        case $PROT_IDX in
            0)
                PROTOCOL="modbus"
                PORT=$((5020 + OFFSET))
                DESC="Modbus TCP"
                ;;
            1)
                PROTOCOL="s7"
                PORT=$((1020 + OFFSET))
                DESC="Siemens S7"
                ;;
            2)
                PROTOCOL="mc"
                PORT=$((5011 + OFFSET))
                DESC="MELSEC MC"
                ;;
            3)
                PROTOCOL="xgt"
                PORT=$((2004 + OFFSET))
                DESC="LS Electric XGT"
                ;;
        esac
        
        echo "[Start] PLC #$i: 공정 $i 기동 ➡️ $DESC (Port: $PORT, Offset: $OFFSET)"
        
        cd "$VPLC_DIR" || exit 1
        # Embedded web server port도 충돌나지 않게 8080 + offset 형태로 전달
        WEB_PORT=$((8080 + OFFSET))
        
        nohup ./build/vPlc -p "$PROTOCOL" -o "$OFFSET" -w "$WEB_PORT" --headless ./build/libassembly_logic.so > "$LOG_DIR/plc${i}_dynamic_${PROTOCOL}.log" 2>&1 < /dev/null &
        PLC_PID=$!
        
        cd "$FACTORY_DIR" || exit 1
        
        # PIDs 및 프로토콜 정보 저장
        echo "$i:$PROTOCOL:$PORT:$PLC_PID" >> "$PID_FILE"
        sleep 0.25
    done
    
    echo "--------------------------------------------------------"
    echo "🟢 ${COUNT}대 가변 이기종 vPLC 가동 완료 (PIDs 기록 완료)"
    echo "   - 로그 폴더: $LOG_DIR"
    echo "--------------------------------------------------------"
}

stop_plcs() {
    echo "--------------------------------------------------------"
    echo "🛑 3단계: 백그라운드 가변 가상 PLC 프로세스 일괄 정지..."
    echo "--------------------------------------------------------"
    
    if [ ! -f "$PID_FILE" ]; then
        echo "ℹ️ 정보: 가동 중인 가변 vPLC 정보($PID_FILE)가 존재하지 않습니다."
        return
    fi
    
    while IFS= read -r line; do
        if [ -z "$line" ]; then continue; fi
        
        # 포맷: i:protocol:port:pid
        IFS=':' read -r idx protocol port pid <<< "$line"
        
        if ps -p "$pid" > /dev/null; then
            echo "[Stop] PLC #$idx (PID $pid) 안전 종료 신호(SIGTERM) 송신..."
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
                echo "⚠️ 경고: PLC #$idx (PID $pid) 미반응으로 강제 종료(SIGKILL) 집행..."
                kill -9 "$pid"
            fi
        else
            echo "ℹ️ 정보: PLC #$idx (PID $pid) 이미 종료되어 있습니다."
        fi
    done < "$PID_FILE"
    
    rm -f "$PID_FILE"
    echo "✅ 모든 가변 가상 PLC 인스턴스 정지 완료."
    echo "--------------------------------------------------------"
}

status_plcs() {
    echo "--------------------------------------------------------"
    echo "📊 가변 가상 PLC 백그라운드 프로세스 동작 상태 모니터"
    echo "--------------------------------------------------------"
    
    if [ ! -f "$PID_FILE" ]; then
        echo "🔴 대기 중: 가동 중인 가변 PLC 인스턴스가 존재하지 않습니다."
        return
    fi
    
    while IFS= read -r line; do
        if [ -z "$line" ]; then continue; fi
        
        IFS=':' read -r idx protocol port pid <<< "$line"
        
        case $protocol in
            "modbus") DESC="Modbus TCP" ;;
            "s7")     DESC="Siemens S7" ;;
            "mc")     DESC="MELSEC MC"  ;;
            "xgt")    DESC="LS Electric XGT" ;;
        esac
        
        if ps -p "$pid" > /dev/null; then
            echo -e "🟢 PLC #$idx \033[1;32mONLINE\033[0m : $DESC (PID: $pid) ➡️ Port \033[1;36m$port\033[0m"
        else
            echo -e "🔴 PLC #$idx \033[1;31mOFFLINE\033[0m: $DESC (PID: $pid) ➡️ Port $port"
        fi
    done < "$PID_FILE"
    echo "--------------------------------------------------------"
}

case "$1" in
    start)
        start_plcs "$2"
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
