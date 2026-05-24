import React from 'react';
import { Sliders, RefreshCw, AlertTriangle, Truck, Cpu, Wifi } from 'lucide-react';
import type { SimulationSettings } from '../types/simulation';

interface SettingsPanelProps {
  settings: SimulationSettings;
  onChange: React.Dispatch<React.SetStateAction<SimulationSettings>>;
  onSpeedUpdate: (speed: number) => void;
}

export const SettingsPanel: React.FC<SettingsPanelProps> = ({ settings, onChange, onSpeedUpdate }) => {
  const handleSliderChange = (key: keyof SimulationSettings, value: number) => {
    if (key === 'conveyorSpeed') {
      onSpeedUpdate(value);
    } else {
      onChange((prev) => ({
        ...prev,
        [key]: value
      }));
    }
  };

  const handleModeChange = (mode: 'emulated' | 'runtime') => {
    onChange((prev) => ({
      ...prev,
      plcMode: mode
    }));
  };

  const isRuntime = settings.plcMode === 'runtime';

  return (
    <div className="glass-panel panel-container">
      {/* Dynamic PLC Mode Switcher */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', paddingBottom: '1rem', borderBottom: '1px solid rgba(255, 255, 255, 0.08)' }}>
        <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
          <Cpu size={14} style={{ color: 'var(--color-cyber-blue)' }} />
          PLC 시뮬레이션 가동 모드
        </span>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px', background: 'rgba(4, 6, 14, 0.5)', padding: '3px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.05)' }}>
          <button
            onClick={() => handleModeChange('emulated')}
            className={`speed-btn ${settings.plcMode === 'emulated' ? 'active' : ''}`}
            style={{ padding: '6px 0', fontSize: '0.75rem', fontWeight: 600, borderRadius: '6px', border: 'none' }}
          >
            가상 에뮬레이터
          </button>
          <button
            onClick={() => handleModeChange('runtime')}
            className={`speed-btn ${settings.plcMode === 'runtime' ? 'active' : ''}`}
            style={{ padding: '6px 0', fontSize: '0.75rem', fontWeight: 600, borderRadius: '6px', border: 'none', color: settings.plcMode === 'runtime' ? 'var(--color-cyber-purple)' : '' }}
          >
            C++ 런타임 연동
          </button>
        </div>
      </div>

      <h2 className="panel-title" style={{ borderBottom: 'none', paddingTop: '0.25rem', paddingBottom: 0 }}>
        <Sliders size={18} style={{ color: 'var(--color-cyber-blue)' }} />
        공정 설정 제어반
      </h2>

      <div className="settings-group">
        {/* Conveyor Speed Slider - ALWAYS ACTIVE */}
        <div className="setting-item">
          <div className="setting-label-row">
            <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
              <Truck size={14} style={{ color: 'var(--color-cyber-blue)' }} />
              컨베이어 벨트 속도
            </span>
            <span className="setting-value">{settings.conveyorSpeed.toFixed(1)} 배속</span>
          </div>
          <input
            type="range"
            min="0.5"
            max="3.0"
            step="0.1"
            value={settings.conveyorSpeed}
            onChange={(e) => handleSliderChange('conveyorSpeed', parseFloat(e.target.value))}
          />
          <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
            {isRuntime
              ? '실시간 Modbus/S7/MC/XGT 레지스터로 속도를 기입합니다.'
              : '벨트 위 상자들의 실시간 전송 속도를 결정합니다.'}
          </span>
        </div>

        {/* Spawn Rate Slider - DISABLED IN RUNTIME MODE */}
        <div className="setting-item" style={{ opacity: isRuntime ? 0.45 : 1, transition: 'opacity 0.2s' }}>
          <div className="setting-label-row">
            <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
              <RefreshCw size={14} style={{ color: 'var(--color-cyber-purple)' }} />
              원자재 투입 주기
            </span>
            <span className="setting-value">{settings.spawnRate.toFixed(1)} 초</span>
          </div>
          <input
            type="range"
            min="0.8"
            max="5.0"
            step="0.1"
            value={settings.spawnRate}
            disabled={isRuntime}
            onChange={(e) => handleSliderChange('spawnRate', parseFloat(e.target.value))}
          />
          <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
            {isRuntime ? 'C++ vPLC Feeder 가상 로직이 주기를 제어합니다.' : '매 초마다 원자재 상자가 자동 생성되어 투입됩니다.'}
          </span>
        </div>

        {/* Machine Processing Time Slider - DISABLED IN RUNTIME MODE */}
        <div className="setting-item" style={{ opacity: isRuntime ? 0.45 : 1, transition: 'opacity 0.2s' }}>
          <div className="setting-label-row">
            <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
              <Sliders size={14} style={{ color: 'var(--color-active-green)' }} />
              CNC 가공 기계 속도
            </span>
            <span className="setting-value">{settings.processingTime.toFixed(1)} 초/개</span>
          </div>
          <input
            type="range"
            min="0.5"
            max="4.0"
            step="0.1"
            value={settings.processingTime}
            disabled={isRuntime}
            onChange={(e) => handleSliderChange('processingTime', parseFloat(e.target.value))}
          />
          <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
            {isRuntime ? 'C++ vPLC 가공 로직 주기 타이밍을 가집니다.' : '1개의 아이템을 CNC 가공하는 데 걸리는 시간입니다.'}
          </span>
        </div>

        {/* Defect Probability Slider - DISABLED IN RUNTIME MODE */}
        <div className="setting-item" style={{ opacity: isRuntime ? 0.45 : 1, transition: 'opacity 0.2s' }}>
          <div className="setting-label-row">
            <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
              <AlertTriangle size={14} style={{ color: 'var(--color-error-crimson)' }} />
              품질 검사 불량률
            </span>
            <span className="setting-value" style={{ color: 'var(--color-error-crimson)' }}>
              {settings.defectRate.toFixed(0)} %
            </span>
          </div>
          <input
            type="range"
            min="0"
            max="50"
            step="1"
            value={settings.defectRate}
            disabled={isRuntime}
            onChange={(e) => handleSliderChange('defectRate', parseFloat(e.target.value))}
          />
          <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
            {isRuntime ? 'C++ vPLC QC 검사 프로그램 내부 난수가 적용됩니다.' : '품질검사대(QC)에서 임의 유발되는 불량품의 확률 비율입니다.'}
          </span>
        </div>
      </div>

      {isRuntime ? (
        <div style={{ marginTop: '0.5rem', padding: '0.75rem', borderRadius: '8px', background: 'rgba(168, 85, 247, 0.05)', border: '1px dashed rgba(168, 85, 247, 0.15)' }}>
          <p style={{ margin: 0, fontSize: '0.75rem', color: 'var(--text-secondary)', lineHeight: '1.4', display: 'flex', gap: '0.25rem', flexDirection: 'column' }}>
            <span style={{ color: 'var(--color-cyber-purple)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
              <Wifi size={13} className="pulse-indicator" />
              vPLC-Runtime HIL 연동 모드 활성
            </span>
            <span>
              공장의 기계 제어 신호와 물리 상자의 컨베이어 이동 좌표는 이제 백그라운드에서 구동 중인 4대의 C++ PLC들(Modbus, S7, MC, XGT)의 실제 스캔 연산과 100% 동기화되어 실시간 동작합니다!
            </span>
          </p>
        </div>
      ) : (
        <div style={{ marginTop: '0.5rem', padding: '0.75rem', borderRadius: '8px', background: 'rgba(56, 189, 248, 0.04)', border: '1px dashed rgba(56, 189, 248, 0.1)' }}>
          <p style={{ margin: 0, fontSize: '0.75rem', color: 'var(--text-secondary)', lineHeight: '1.4' }}>
            💡 <strong style={{ color: 'var(--text-primary)' }}>가상 에뮬레이터:</strong> 브라우저 샌드박스 내부에서 React 가상 상태 머신을 바탕으로 독립 작동하며, 모든 공정 파라미터 슬라이더를 즉시 조절할 수 있습니다.
          </p>
        </div>
      )}
    </div>
  );
};
