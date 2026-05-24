import React from 'react';
import { Play, Pause, RotateCcw, Factory, Clock, Zap } from 'lucide-react';
import type { SimulationSettings } from '../types/simulation';

interface HeaderProps {
  isRunning: boolean;
  settings: SimulationSettings;
  uptime: number;
  onStart: () => void;
  onPause: () => void;
  onReset: () => void;
  onSpeedChange: (speed: number) => void;
}

export const Header: React.FC<HeaderProps> = ({
  isRunning,
  settings,
  uptime,
  onStart,
  onPause,
  onReset,
  onSpeedChange
}) => {
  // Format uptime into mm:ss
  const formatUptime = (seconds: number) => {
    const mm = Math.floor(seconds / 60).toString().padStart(2, '0');
    const ss = (seconds % 60).toString().padStart(2, '0');
    return `${mm}:${ss}`;
  };

  const speedOptions = [0.5, 1.0, 2.0, 4.0];

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

        {/* Start / Pause / Reset Control buttons */}
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          {!isRunning ? (
            <button className="control-btn active" onClick={onStart}>
              <Play size={16} fill="currentColor" /> 가동
            </button>
          ) : (
            <button className="control-btn" onClick={onPause} style={{ borderColor: 'var(--color-warning-amber)' }}>
              <Pause size={16} style={{ color: 'var(--color-warning-amber)' }} /> 일시정지
            </button>
          )}

          <button className="control-btn" onClick={onReset} title="시뮬레이션 초기화">
            <RotateCcw size={16} /> 리셋
          </button>
        </div>
      </div>
    </header>
  );
};
