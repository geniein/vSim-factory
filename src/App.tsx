import { useSimulation } from './hooks/useSimulation';
import { Header } from './components/Header';
import { SettingsPanel } from './components/SettingsPanel';
import { SimulatorCanvas } from './components/SimulatorCanvas';
import { StatsDashboard } from './components/StatsDashboard';
import './App.css';

function App() {
  const {
    isRunning,
    settings,
    items,
    machines,
    stats,
    plcData,
    dynamicStageCount,
    setDynamicStageCount,
    dynamicPlcsData,
    changeMode,
    applyDynamicStageCount,
    setSettings,
    startSimulation,
    pauseSimulation,
    resetSimulation,
    setSystemSpeed,
    handleSpeedUpdate,
    feedMaterial,
    stopAllPlcs
  } = useSimulation();

  return (
    <div className="app-container">
      {/* Top dashboard header bar */}
      <Header
        isRunning={isRunning}
        settings={settings}
        uptime={stats.uptime}
        onStart={startSimulation}
        onPause={pauseSimulation}
        onReset={resetSimulation}
        onSpeedChange={setSystemSpeed}
        onFeedMaterial={feedMaterial}
        onModeChange={changeMode}
        dynamicStageCount={dynamicStageCount}
        onDynamicStageCountChange={setDynamicStageCount}
        onApplyDynamicStageCount={applyDynamicStageCount}
        onStopPlcs={stopAllPlcs}
      />

      {/* Main 3-column dashboard grid */}
      <main className="dashboard-grid">
        {/* Left side process settings slider console */}
        <SettingsPanel
          settings={settings}
          onChange={setSettings}
          onSpeedUpdate={handleSpeedUpdate}
        />

        {/* Center 2D SVG animations factory live canvas */}
        <SimulatorCanvas
          items={items}
          machines={machines}
          settings={settings}
          isRunning={isRunning}
          plcData={plcData}
          plcConnections={stats.plcConnections || { feeder: false, cnc: false, qc: false, sorter: false }}
          dynamicStageCount={dynamicStageCount}
          dynamicPlcsData={dynamicPlcsData}
        />

        {/* Right side statistical cards and logging terminal console */}
        <StatsDashboard
          stats={stats}
          machines={machines}
          plcMode={settings.plcMode}
        />
      </main>
    </div>
  );
}

export default App;
