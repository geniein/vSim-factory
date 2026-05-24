import React, { useMemo } from 'react';
import { BarChart4, ClipboardList, AlertOctagon, TrendingUp, ShieldCheck, Flame, RefreshCw, Cpu } from 'lucide-react';
import type { SimulationStats, Machine } from '../types/simulation';

interface StatsDashboardProps {
  stats: SimulationStats;
  machines: Machine[];
  plcMode: 'emulated' | 'runtime';
}

export const StatsDashboard: React.FC<StatsDashboardProps> = ({ stats, machines, plcMode }) => {
  // Calculate real-time yield rate
  const yieldRate = useMemo(() => {
    const totalProcessed = stats.totalCompleted + stats.totalDefective;
    if (totalProcessed === 0) return 100.0;
    return (stats.totalCompleted / totalProcessed) * 100;
  }, [stats.totalCompleted, stats.totalDefective]);

  const conns = stats.plcConnections || { feeder: false, cnc: false, qc: false, sorter: false };
  const isRuntime = plcMode === 'runtime';

  return (
    <div className="stats-panel">
      {/* 1. OEE Metric Board */}
      <div className="glass-panel stat-card oee-card">
        <div className="stat-card-title">
          <TrendingUp size={16} style={{ color: 'var(--color-cyber-blue)' }} />
          <span>종합 설비 효율 (OEE)</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginTop: '0.5rem' }}>
          <span className="stat-card-value" style={{ fontSize: '2.5rem', fontWeight: 800, color: 'var(--text-primary)', textShadow: '0 0 15px rgba(56, 189, 248, 0.3)' }}>
            {stats.oee}%
          </span>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', paddingBottom: '0.5rem' }}>
            가동률 × 성능율 × 양품률 종합 지표
          </span>
        </div>
        
        {/* Visual progress bar */}
        <div style={{ width: '100%', height: '6px', background: 'rgba(255,255,255,0.08)', borderRadius: '3px', marginTop: '0.75rem', overflow: 'hidden' }}>
          <div
            style={{
              width: `${stats.oee}%`,
              height: '100%',
              background: 'linear-gradient(90deg, var(--color-cyber-blue), var(--color-cyber-purple), var(--color-active-green))',
              borderRadius: '3px',
              transition: 'width 0.5s ease-out'
            }}
          />
        </div>
      </div>

      {/* 2. Numeric Statistics Panel */}
      <div className="stats-grid">
        <div className="glass-panel stat-card">
          <div className="stat-card-title">
            <ClipboardList size={13} style={{ color: 'var(--color-cyber-blue)' }} />
            <span>총 원자재 투입</span>
          </div>
          <span className="stat-card-value">{stats.totalSpawned} 개</span>
        </div>

        <div className="glass-panel stat-card">
          <div className="stat-card-title">
            <ShieldCheck size={13} style={{ color: 'var(--color-active-green)' }} />
            <span>양품 출하 완료</span>
          </div>
          <span className="stat-card-value" style={{ color: 'var(--color-active-green)' }}>
            {stats.totalCompleted} 개
          </span>
        </div>

        <div className="glass-panel stat-card">
          <div className="stat-card-title">
            <AlertOctagon size={13} style={{ color: 'var(--color-error-crimson)' }} />
            <span>불량 스크랩품</span>
          </div>
          <span className="stat-card-value" style={{ color: 'var(--color-error-crimson)' }}>
            {stats.totalDefective} 개
          </span>
        </div>

        <div className="glass-panel stat-card">
          <div className="stat-card-title">
            <BarChart4 size={13} style={{ color: 'var(--color-cyber-purple)' }} />
            <span>실시간 양품수율</span>
          </div>
          <span className="stat-card-value" style={{ color: yieldRate > 90 ? 'var(--color-active-green)' : 'var(--color-warning-amber)' }}>
            {yieldRate.toFixed(1)}%
          </span>
        </div>
      </div>

      {/* 2.5. NEW!! vPLC-Runtime Live Heterogeneous Protocol Controller Panel */}
      {isRuntime && (
        <div className="glass-panel" style={{ padding: '1.25rem', border: '1px solid rgba(168, 85, 247, 0.15)', background: 'linear-gradient(180deg, rgba(13, 20, 38, 0.65) 0%, rgba(168, 85, 247, 0.02) 100%)' }}>
          <h3 className="panel-title" style={{ borderBottom: 'none', paddingBottom: '0.75rem', fontSize: '0.95rem' }}>
            <Cpu size={15} style={{ color: 'var(--color-cyber-purple)' }} />
            vPLC 런타임 분산 제어반
          </h3>
          
          <div className="machine-status-list">
            {/* PLC 1: Feeder (Modbus) */}
            <div className="machine-status-item" style={{ background: 'rgba(255,255,255,0.01)' }}>
              <div className="machine-info">
                <span className={`machine-indicator ${conns.feeder ? 'indicator-processing' : 'indicator-blocked'}`} />
                <span style={{ fontSize: '0.8rem', fontWeight: 500 }}>vPLC #1 Feeder (Modbus)</span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
                <span className="font-mono-tech" style={{ fontSize: '0.7rem', fontWeight: 600, color: conns.feeder ? 'var(--color-active-green)' : 'var(--color-error-crimson)' }}>
                  {conns.feeder ? '🟢 ONLINE' : '🔴 OFFLINE'}
                </span>
                <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>Port: 5030 (Offset 10)</span>
              </div>
            </div>

            {/* PLC 2: CNC (S7) */}
            <div className="machine-status-item" style={{ background: 'rgba(255,255,255,0.01)' }}>
              <div className="machine-info">
                <span className={`machine-indicator ${conns.cnc ? 'indicator-processing' : 'indicator-blocked'}`} />
                <span style={{ fontSize: '0.8rem', fontWeight: 500 }}>vPLC #2 CNC Mill (S7Comm)</span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
                <span className="font-mono-tech" style={{ fontSize: '0.7rem', fontWeight: 600, color: conns.cnc ? 'var(--color-active-green)' : 'var(--color-error-crimson)' }}>
                  {conns.cnc ? '🟢 ONLINE' : '🔴 OFFLINE'}
                </span>
                <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>Port: 1040 (Offset 20)</span>
              </div>
            </div>

            {/* PLC 3: QC (MC) */}
            <div className="machine-status-item" style={{ background: 'rgba(255,255,255,0.01)' }}>
              <div className="machine-info">
                <span className={`machine-indicator ${conns.qc ? 'indicator-processing' : 'indicator-blocked'}`} />
                <span style={{ fontSize: '0.8rem', fontWeight: 500 }}>vPLC #3 Vision QC (MELSEC MC)</span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
                <span className="font-mono-tech" style={{ fontSize: '0.7rem', fontWeight: 600, color: conns.qc ? 'var(--color-active-green)' : 'var(--color-error-crimson)' }}>
                  {conns.qc ? '🟢 ONLINE' : '🔴 OFFLINE'}
                </span>
                <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>Port: 5041 (Offset 30)</span>
              </div>
            </div>

            {/* PLC 4: Sorter (XGT) */}
            <div className="machine-status-item" style={{ background: 'rgba(255,255,255,0.01)' }}>
              <div className="machine-info">
                <span className={`machine-indicator ${conns.sorter ? 'indicator-processing' : 'indicator-blocked'}`} />
                <span style={{ fontSize: '0.8rem', fontWeight: 500 }}>vPLC #4 Sorter (LS XGT)</span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
                <span className="font-mono-tech" style={{ fontSize: '0.7rem', fontWeight: 600, color: conns.sorter ? 'var(--color-active-green)' : 'var(--color-error-crimson)' }}>
                  {conns.sorter ? '🟢 ONLINE' : '🔴 OFFLINE'}
                </span>
                <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>Port: 2044 (Offset 40)</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 3. Bottleneck Analysis & Machine Status List */}
      <div className="glass-panel" style={{ padding: '1.25rem' }}>
        <h3 className="panel-title" style={{ borderBottom: 'none', paddingBottom: '0.75rem', fontSize: '0.95rem' }}>
          <Flame size={15} style={{ color: 'var(--color-warning-amber)' }} />
          설비 가동 상태 & 실시간 병목 감지
        </h3>

        {/* Dynamic Bottleneck warning box */}
        <div
          style={{
            background: stats.bottleneck.includes('병목') || stats.bottleneck.includes('단선')
              ? 'rgba(239, 68, 68, 0.08)'
              : 'rgba(56, 189, 248, 0.05)',
            border: stats.bottleneck.includes('병목') || stats.bottleneck.includes('단선')
              ? '1px solid rgba(239, 68, 68, 0.2)'
              : '1px solid rgba(56, 189, 248, 0.2)',
            padding: '0.65rem 0.75rem',
            borderRadius: '8px',
            fontSize: '0.8rem',
            marginBottom: '1rem',
            lineHeight: '1.4'
          }}
        >
          <span style={{ color: 'var(--text-secondary)' }}>공정 제어 병목: </span>
          <strong
            className="pulse-indicator"
            style={{
              color: stats.bottleneck.includes('병목') || stats.bottleneck.includes('단선')
                ? 'var(--color-error-crimson)'
                : stats.bottleneck.includes('안정')
                ? 'var(--color-active-green)'
                : 'var(--color-warning-amber)',
              display: 'inline-block'
            }}
          >
            {stats.bottleneck}
          </strong>
        </div>

        <div className="machine-status-list">
          {machines.map((machine) => {
            const isProcessing = machine.status === 'processing';
            const isBlocked = machine.status === 'blocked';
            let indicatorClass = 'indicator-idle';
            let statusLabel = '대기 (STANDBY)';

            if (isProcessing) {
              indicatorClass = 'indicator-processing';
              statusLabel = '가동 중 (RUN)';
            } else if (isBlocked) {
              indicatorClass = 'indicator-blocked';
              statusLabel = '가공 지연 (BLOCKED)';
            }

            return (
              <div key={machine.id} className="machine-status-item">
                <div className="machine-info">
                  <span className={`machine-indicator ${indicatorClass}`} />
                  <span style={{ fontSize: '0.8rem', fontWeight: 500 }}>{machine.name}</span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
                  <span
                    className="font-mono-tech"
                    style={{
                      fontSize: '0.75rem',
                      fontWeight: 600,
                      color: isProcessing
                        ? 'var(--color-active-green)'
                        : isBlocked
                        ? 'var(--color-error-crimson)'
                        : 'var(--color-warning-amber)'
                    }}
                  >
                    {statusLabel}
                  </span>
                  <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>
                    누적 처리량: {machine.processedCount}개
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 4. Live System Logger terminal Console */}
      <div className="glass-panel log-console" style={{ minHeight: isRuntime ? '160px' : '220px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem', borderBottom: '1px solid rgba(255,255,255,0.06)', paddingBottom: '0.5rem' }}>
          <span style={{ fontSize: '0.8rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
            <RefreshCw size={13} className="rotate-anim" style={{ color: 'var(--color-cyber-blue)' }} />
            실시간 공정 로그 콘솔
          </span>
          <span className="font-mono-tech" style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>
            Total logs: {stats.logs.length}
          </span>
        </div>
        <div className="log-list">
          {stats.logs.length === 0 ? (
            <div style={{ color: 'var(--text-muted)', textAlign: 'center', paddingTop: '2.5rem', fontSize: '0.8rem' }}>
              공장이 가동되면 실시간 운영 로그가 여기에 자동 스트리밍됩니다.
            </div>
          ) : (
            stats.logs.map((log) => (
              <div key={log.id} className="log-entry">
                <span className="log-time">[{log.timestamp}]</span>
                <span className={`log-text log-${log.type}`}>{log.message}</span>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
