import { useState } from 'react';
import { useSimulation } from './hooks/useSimulation';
import { Header } from './components/Header';
import { SettingsPanel } from './components/SettingsPanel';
import { SimulatorCanvas } from './components/SimulatorCanvas';
import { StatsDashboard } from './components/StatsDashboard';
import { Sidebar, type TabId } from './components/Sidebar';
import { HomeIntro } from './components/HomeIntro';
import { ScadaDashboard } from './components/ScadaDashboard';
import { MesDashboard } from './components/MesDashboard';
import { IqisDashboard } from './components/IqisDashboard';
import { FmsDashboard } from './components/FmsDashboard';
import { CmmsDashboard } from './components/CmmsDashboard';
import { WmsDashboard } from './components/WmsDashboard';
import { FactoryEditor } from './components/FactoryEditor';
import { MySimDashboard } from './components/MySimDashboard';
import './App.css';

function App() {
  const [activeTab, setActiveTab] = useState<TabId>('home');
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
    stopAllPlcs,
    startAllPlcs
  } = useSimulation();

  return (
    <div className="main-layout-wrapper">
      {/* Sidebar for navigation */}
      <Sidebar activeTab={activeTab} onTabChange={setActiveTab} />

      {/* Main content container */}
      <div className="content-container">
        {activeTab === 'home' && (
          <HomeIntro
            onNavigateToLiveMonitor={() => setActiveTab('live-monitor')}
            onNavigateToScada={() => setActiveTab('scada')}
            onNavigateToMes={() => setActiveTab('mes')}
            onNavigateToIqis={() => setActiveTab('iqis')}
            onNavigateToFms={() => setActiveTab('fms')}
            onNavigateToCmms={() => setActiveTab('cmms')}
            onNavigateToWms={() => setActiveTab('wms')}
          />
        )}

        {activeTab === 'live-monitor' && (
          <div className="app-container" style={{ padding: 0, maxWidth: 'none', width: '100%' }}>
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
              onStartPlcs={startAllPlcs}
              plcConnections={stats.plcConnections || { feeder: false, cnc: false, qc: false, sorter: false }}
              dynamicPlcsData={dynamicPlcsData}
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
        )}

        {activeTab === 'scada' && (
          <ScadaDashboard />
        )}

        {activeTab === 'mes' && (
          <MesDashboard />
        )}

        {activeTab === 'iqis' && (
          <IqisDashboard />
        )}

        {activeTab === 'fms' && (
          <FmsDashboard />
        )}

        {activeTab === 'cmms' && (
          <CmmsDashboard />
        )}

        {activeTab === 'wms' && (
          <WmsDashboard />
        )}

        {activeTab === 'factory-editor' && (
          <FactoryEditor onNavigateToMySim={() => setActiveTab('my-sim')} />
        )}

        {activeTab === 'my-sim' && (
          <MySimDashboard onNavigateToEditor={() => setActiveTab('factory-editor')} />
        )}
      </div>
    </div>
  );
}

export default App;
