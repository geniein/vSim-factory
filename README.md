# 🏗️ 실시간 가상 공장 시뮬레이터 (vSim-Factory)

> **vSim-Factory**는 웹 브라우저 상에서 실시간으로 완벽하게 동작하는 가상 스마트 공장 실시간 관제 시뮬레이터(Live Digital Twin Simulator)입니다.  
> 세련된 다크 테크(Cyber Tech) 테마 레이아웃과 60fps의 고성능 SVG 그래픽스 애니메이션을 통해 생산 공정의 흐름과 병목 현상을 직관적으로 실시간 분석할 수 있습니다.

---

## 🎯 주요 기능 및 특징 (Key Features)

### 1. ⚙️ 실시간 인터랙티브 공정 변수 설정
* 설정 패널의 슬라이더를 통해 가동 중에도 실시간으로 파라미터를 변경하여 공정의 변화를 즉각 관측할 수 있습니다.
  * **원자재 투입 주기**: 아이템 상자 생성 주기 조절 (0.8초 ~ 5.0초)
  * **컨베이어 벨트 속도**: 벨트 위 아이템들의 전송 속도 가감 (0.5x ~ 3.0x)
  * **CNC 가공 장비 주기**: 1개 아이템의 정밀 가공 시간 설정 (0.5초 ~ 4.0초)
  * **품질 검사 불량률**: 품질 검사대(QC)에서 임의 유발되는 불량품의 확률 비율 (0% ~ 50%)

### 2. 🏗️ 고성능 60fps 생산라인 시각화 (Live SVG Animation)
* `requestAnimationFrame`과 정밀 시간 차이(Delta Time) 기반 시뮬레이션 클럭 설계.
* 컨베이어 속도에 따라 동적으로 도트 흐름 속도가 조정되는 **반응형 컨베이어 애니메이션**.
* 기계 가동 시 회전하는 **CNC 기어 및 툴 모션**과 비전 검사기의 **상하 무빙 레이저 스캐닝 빔**.
* 컨베이어 벨트 위에서 상자가 겹치지 않고 대기 행렬을 이루는 **지능형 간격 유지 충돌 엔진**.

### 3. 📊 스마트 팩토리 대시보드 (Real-time Analytics)
* **종합설비효율(OEE)**: 기계 가동률(Availability), 성능율(Performance), 양품률(Quality)을 실시간으로 취합하여 종합 연산.
* **실시간 생산 수량 집계**: 총 투입량, 양품 완제품 출하량, 불량품 폐기 처리량 및 실시간 양품 수율(%) 모니터링.
* **실시간 병목구간(Bottleneck) 감지**: 공정 상태 머신 분석을 바탕으로 현재 라인의 핵심 병목 병원(가공 지연, 적체 현상 등)을 자동 판별.
* **스트리밍 로그 콘솔**: 아이템 생성부터 가공 완료, 합격/불합격 판정 및 적합 입고까지의 전 과정을 실시간 색상 코드로 출력.

---

## 🎨 디자인 시스템 및 에스테틱 (Aesthetics)
영화 속에 등장하는 첨단 중앙 관제 센터 스타일을 세련되게 재현하였습니다.
* **Deep Slate Theme**: `#070a13` 테마 기반의 눈이 편안한 울트라 다크 테마.
* **Glassmorphism**: 투명하고 깔끔한 반투명 카드 레이아웃과 얇은 테두리 효과.
* **Vibrant Neon Status Lights**:
  * 🟩 **정상 가동 (Active)**: 에메랄드 그린 발광 효과
  * 🟧 **대기 중 (Idle/Warning)**: 앰버 오렌지 발광 효과
  * 🟥 **에러/병목 (Blocked/Error)**: 네온 크림슨 레드 발광 효과

---

## 🛠️ 기술 스택 (Tech Stack)
* **프레임워크**: React 19 (Vite)
* **언어**: TypeScript (Strict Mode)
* **스타일링**: Vanilla CSS (Custom Properties, Flexbox & CSS Grid)
* **아이콘**: `lucide-react` (고품질 테크 벡터 아이콘 패키지)

---

## 📂 폴더 및 파일 아키텍처
```
vSim-factory/
├── src/
│   ├── types/
│   │   └── simulation.ts       # 데이터 구조 및 상태 규격 정의 (Strict TypeScript)
│   ├── hooks/
│   │   └── useSimulation.ts   # delta-time 기반 60fps 핵심 시뮬레이션 엔진 훅
│   ├── components/
│   │   ├── Header.tsx         # 시뮬레이션 제어 바 (시작, 정지, 리셋, 클럭배속)
│   │   ├── SettingsPanel.tsx  # 공정 제어 실시간 매개변수 슬라이더
│   │   ├── SimulatorCanvas.tsx# 2D 스마트 공장 그래픽화 모니터 (SVG)
│   │   └── StatsDashboard.tsx # OEE, 실시간 지표 카드, 병목 감지 및 실시간 로그 콘솔
│   ├── App.tsx                # 대시보드 컴포넌트 통합 및 상태 연결
│   ├── index.css              # 글로벌 CSS 토큰 (다크 테마, 글래스모피즘, 네온 등)
│   └── App.css                # 전체 Grid 레이아웃 및 세부 폼 요소 스타일
```

---

## 🚀 시작하기 (Getting Started)

### 의존성 라이브러리 설치
```bash
npm install
```

### 로컬 개발 서버 구동
```bash
npm run dev
```
브라우저로 `http://localhost:5173` 에 접속하여 실시간 대시보드를 즉시 체험해 보실 수 있습니다.

---

## 🚨 개발 준수 사항 및 Git 컨벤션 (Instructions & Conventions)
본 프로젝트는 협업과 코드 품질을 유지하기 위해 별도 정의된 **[instructions.md](file:///Users/in-youngjin/Documents/personal/vSim-factory/instructions.md)**의 지침과 Git 컨벤션을 준수합니다.

### 1. ⚙️ 엄격한 TypeScript 규칙
* 변수 및 함수 입력/출력값에 반드시 엄격한 TypeScript 타입을 선언합니다.
* `any` 타입의 사용은 절대 금지합니다.

### 2. 🔒 보안 및 설정값 관리
* API 엔드포인트 및 민감한 키 값은 절대로 코드에 직접 하드코딩하지 않으며, 반드시 `.env.local` 환경 변수 파일에 로드하여 동적 호출합니다.

### 3. 🔄 작업 프로세스 (Work Step)
1. **분석**: 요구사항을 수령하면 연관된 파일 목록을 먼저 스캔하여 분석합니다.
2. **설계 공유**: 코드 수정 전, 작업 방향을 2~3줄 요약하여 사용자에게 확인을 받습니다.
3. **구현 및 검증**: 코드 작성 후 `npm run build`를 통과하는지 자체 검증 후 가이드합니다.

### 4. 🔀 Git 커밋 규칙 (Git Commit Convention)
* 커밋 메시지 양식: `[type] (scope): description`
* **주의**: **사용자의 지시가 있을 때까지 임의로 `git commit` 이나 `git push` 명령을 임의 실행하지 않고 코드로 보존**합니다.

```
# 예시 커밋 메시지
[feature] (simulation): 가공 지연 방지 컨베이어 Spacing 간격 유지 60fps 알고리즘 추가
[refactor] (components): canvas svg 내 미사용 lucide 아이콘 정리 및 type-only 임포트 적용
```
