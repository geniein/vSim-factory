import React from 'react';
import { Play, Pause, RotateCcw, Factory, Clock, Zap, Package, Layers, Power } from 'lucide-react';
import type { SimulationSettings } from '../types/simulation';

interface HeaderProps {
  isRunning: boolean;
  settings: SimulationSettings;
  uptime: number;
  onStart: () => void;
  onPause: () => void;
  onReset: () => void;
  onSpeedChange: (speed: number) => void;
  onFeedMaterial: () => void;
  onModeChange: (mode: 'emulated' | 'runtime' | 'dynamic') => void;
  dynamicStageCount: number;
  onDynamicStageCountChange: (count: number) => void;
  onApplyDynamicStageCount: () => void;
  onStopPlcs: () => void;
  onStartPlcs: () => void;
  plcConnections: { feeder: boolean; cnc: boolean; qc: boolean; sorter: boolean };
  dynamicPlcsData: any[];
}

export const Header: React.FC<HeaderProps> = ({
  isRunning,
  settings,
  uptime,
  onStart,
  onPause,
  onReset,
  onSpeedChange,
  onFeedMaterial,
  onModeChange,
  dynamicStageCount,
  onDynamicStageCountChange,
  onApplyDynamicStageCount,
  onStopPlcs,
  onStartPlcs,
  plcConnections,
  dynamicPlcsData
}) => {
  // Format uptime into mm:ss
  const formatUptime = (seconds: number) => {
    const mm = Math.floor(seconds / 60).toString().padStart(2, '0');
    const ss = (seconds % 60).toString().padStart(2, '0');
    return `${mm}:${ss}`;
  };

  const speedOptions = [0.5, 1.0, 2.0, 4.0];

  const isPlcRuntimeActive = settings.plcMode === 'runtime'
    ? (plcConnections.feeder || plcConnections.cnc || plcConnections.qc || plcConnections.sorter)
    : (dynamicPlcsData && dynamicPlcsData.some((p: any) => p.online));

  return (
    <header className="glass-panel header-bar">
      <div className="header-title-section">
        <Factory className="header-logo-icon" size={28} />
        <div>
          <h1 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 700, letterSpacing: '0.5px' }}>
            VIRTUAL FACTORY <span className="text-neon-blue">LIVE MONITOR</span>
          </h1>
          <p style={{ margin: 0, fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
            상태 기계 기반 실시간 스마트 제조 시뮬레이터
          </p>
        </div>
      </div>

      {/* Mode Selector */}
      <div style={{ display: 'flex', gap: '0.25rem', background: 'rgba(255,255,255,0.02)', padding: '0.25rem', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.05)' }}>
        <button
          onClick={() => onModeChange('emulated')}
          className={`speed-btn ${settings.plcMode === 'emulated' ? 'active' : ''}`}
          style={{ fontSize: '0.75rem', padding: '0.25rem 0.5rem', minWidth: '80px' }}
        >
          브라우저 에뮬
        </button>
        <button
          onClick={() => onModeChange('runtime')}
          className={`speed-btn ${settings.plcMode === 'runtime' ? 'active' : ''}`}
          style={{ fontSize: '0.75rem', padding: '0.25rem 0.5rem', minWidth: '120px' }}
        >
          기본 고정 공정 (vPLC)
        </button>
        <button
          onClick={() => onModeChange('dynamic')}
          className={`speed-btn ${settings.plcMode === 'dynamic' ? 'active' : ''}`}
          style={{ fontSize: '0.75rem', padding: '0.25rem 0.5rem', minWidth: '120px' }}
        >
          가변 멀티 공정 (vPLC)
        </button>
      </div>

      {/* Dynamic Stage Count Slider (Only visible in dynamic mode) */}
      {settings.plcMode === 'dynamic' && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: 'rgba(56, 189, 248, 0.08)', padding: '0.25rem 0.6rem', borderRadius: '8px', border: '1px solid rgba(56, 189, 248, 0.2)' }}>
          <Layers size={14} style={{ color: 'var(--color-cyber-blue)' }} />
          <span style={{ fontSize: '0.75rem', color: 'var(--color-cyber-blue)', fontWeight: 600 }}>공정 수:</span>
          <input
            type="range"
            min={3}
            max={20}
            value={dynamicStageCount}
            onChange={(e) => onDynamicStageCountChange(parseInt(e.target.value, 10))}
            style={{ width: '80px', accentColor: 'var(--color-cyber-blue)', cursor: 'pointer' }}
          />
          <span className="font-mono-tech" style={{ fontSize: '0.75rem', color: '#fff', width: '32px', textAlign: 'center', fontWeight: 600 }}>
            {dynamicStageCount}단
          </span>
          <button
            onClick={onApplyDynamicStageCount}
            className="control-btn"
            style={{
              padding: '2px 8px',
              fontSize: '0.7rem',
              borderColor: 'var(--color-cyber-blue)',
              background: 'rgba(56, 189, 248, 0.15)',
              color: '#fff',
              boxShadow: '0 0 8px rgba(56, 189, 248, 0.2)'
            }}
          >
            적용
          </button>
        </div>
      )}

      <div className="header-controls">
        {/* Status indicator badge */}
        <div className="header-status">
          <span
            className={`pulse-indicator machine-indicator ${
              isRunning ? 'indicator-processing' : 'indicator-idle'
            }`}
          />
          <span className="font-mono-tech" style={{ fontWeight: 500 }}>
            {isRunning ? 'LIVE RUNNING' : 'SYSTEM PAUSED'}
          </span>
        </div>

        {/* Uptime Counter */}
        <div className="header-status" style={{ background: 'rgba(168, 85, 247, 0.08)', borderColor: 'rgba(168, 85, 247, 0.2)' }}>
          <Clock size={14} style={{ color: 'var(--color-cyber-purple)' }} />
          <span className="font-mono-tech" style={{ color: 'var(--color-cyber-purple)', fontWeight: 600 }}>
            {formatUptime(uptime)}
          </span>
        </div>

        {/* System Speed multiplier selector */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', background: 'rgba(255,255,255,0.02)', padding: '0.25rem 0.5rem', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.05)' }}>
          <Zap size={13} style={{ color: 'var(--color-cyber-blue)' }} />
          <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>클럭배속:</span>
          <div style={{ display: 'flex', gap: '2px' }}>
            {speedOptions.map((speed) => (
              <button
                key={speed}
                onClick={() => onSpeedChange(speed)}
                className={`speed-btn ${settings.systemSpeed === speed ? 'active' : ''}`}
                style={{ padding: '2px 6px', fontSize: '0.7rem' }}
              >
                {speed}x
              </button>
            ))}
          </div>
        </div>

        {/* Start / Pause / Reset / Feed Control buttons */}
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          {!isRunning ? (
            <button className="control-btn active" onClick={onStart}>
              <Play size={16} fill="currentColor" /> 가동
            </button>
          ) : (
            <>
              <button
                className="control-btn"
                onClick={onFeedMaterial}
                style={{
                  borderColor: 'var(--color-cyber-purple)',
                  background: 'rgba(168, 85, 247, 0.1)',
                  boxShadow: '0 0 10px rgba(168, 85, 247, 0.15)'
                }}
              >
                <Package size={16} style={{ color: 'var(--color-cyber-purple)' }} /> 원자재 투입
              </button>
              <button className="control-btn" onClick={onPause} style={{ borderColor: 'var(--color-warning-amber)' }}>
                <Pause size={16} style={{ color: 'var(--color-warning-amber)' }} /> 일시정지
              </button>
            </>
          )}

          <button className="control-btn" onClick={onReset} title="시뮬레이션 초기화">
            <RotateCcw size={16} /> 리셋
          </button>

          {settings.plcMode !== 'emulated' && (
            isPlcRuntimeActive ? (
              <button
                className="control-btn"
                onClick={onStopPlcs}
                style={{
                  borderColor: '#ef4444',
                  background: 'rgba(239, 68, 68, 0.12)',
                  color: '#fca5a5',
                  boxShadow: '0 0 12px rgba(239, 68, 68, 0.4)',
                  fontWeight: 600
                }}
                title="C++ vPLC 프로세스 일괄 안전 정지 및 소멸 지시"
              >
                <Power size={16} style={{ color: '#ef4444' }} /> vPLC OFF (정지)
              </button>
            ) : (
              <button
                className="control-btn pulse-indicator"
                onClick={onStartPlcs}
                style={{
                  borderColor: 'var(--color-active-green)',
                  background: 'rgba(16, 185, 129, 0.12)',
                  color: 'var(--color-active-green)',
                  boxShadow: '0 0 12px rgba(16, 185, 129, 0.4)',
                  fontWeight: 600
                }}
                title="C++ 백그라운드 vPLC 프로세스 일괄 기동"
              >
                <Power size={16} style={{ color: 'var(--color-active-green)' }} /> 🔌 vPLC ON (기동)
              </button>
            )
          )}
        </div>
      </div>
    </header>
  );
};
