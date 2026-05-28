import { Home, Factory, MonitorPlay, ShieldAlert, Database, ShieldCheck, Truck, Wrench, Package } from 'lucide-react';

export type TabId = 'home' | 'live-monitor' | 'scada' | 'mes' | 'iqis' | 'fms' | 'cmms' | 'wms';

interface SidebarProps {
  activeTab: TabId;
  onTabChange: (tab: TabId) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ activeTab, onTabChange }) => {
  const menuItems = [
    {
      id: 'home' as TabId,
      label: 'INTRO HOME',
      desc: 'vSim-FACTORY 코어',
      icon: <Home size={20} />,
      colorClass: 'blue-menu'
    },
    {
      id: 'live-monitor' as TabId,
      label: 'LIVE MONITOR',
      desc: '가상 공정 시뮬레이터',
      icon: <MonitorPlay size={20} />,
      colorClass: 'green-menu'
    },
    {
      id: 'scada' as TabId,
      label: 'SCADA SYSTEM',
      desc: '의장 공장 실시간 감시',
      icon: <Factory size={20} />,
      colorClass: 'purple-menu'
    },
    {
      id: 'mes' as TabId,
      label: 'MES SYSTEM',
      desc: '제조 실행 & 이력 추적',
      icon: <Database size={20} />,
      colorClass: 'amber-menu'
    },
    {
      id: 'iqis' as TabId,
      label: 'IQIS SYSTEM',
      desc: '통합 품질 & 공정 능력',
      icon: <ShieldCheck size={20} />,
      colorClass: 'crimson-menu'
    },
    {
      id: 'fms' as TabId,
      label: 'FMS / ACS',
      desc: 'AGV 군집 물류 & 제어',
      icon: <Truck size={20} />,
      colorClass: 'cyan-menu'
    },
    {
      id: 'cmms' as TabId,
      label: 'CMMS SYSTEM',
      desc: '예방 보전 & 설비 수명',
      icon: <Wrench size={20} />,
      colorClass: 'lime-menu'
    },
    {
      id: 'wms' as TabId,
      label: 'WMS SYSTEM',
      desc: '자동 창고 & 재고 관제',
      icon: <Package size={20} />,
      colorClass: 'rose-menu'
    }
  ];

  return (
    <aside className="glass-panel main-sidebar">
      {/* Sidebar Branding Brand Logo */}
      <div className="sidebar-brand">
        <div className="brand-icon-wrapper">
          <Factory className="brand-logo-icon" size={22} />
        </div>
        <div className="brand-texts">
          <span className="brand-title">vSim-FACTORY</span>
          <span className="brand-sub">DIGITAL TWIN GATEWAY</span>
        </div>
      </div>

      {/* Menu List */}
      <nav className="sidebar-nav">
        {menuItems.map(item => {
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => onTabChange(item.id)}
              className={`sidebar-nav-item ${item.colorClass} ${isActive ? 'active' : ''}`}
            >
              <div className="nav-icon">{item.icon}</div>
              <div className="nav-details">
                <span className="nav-label">{item.label}</span>
                <span className="nav-desc">{item.desc}</span>
              </div>
              <div className="active-glow-bar" />
            </button>
          );
        })}
      </nav>

      {/* Sidebar Footer System telemetry status */}
      <div className="sidebar-footer">
        <div className="system-status-indicator">
          <div className="pulse-indicator status-dot" />
          <div className="status-labels">
            <span className="status-title">GATEWAY ONLINE</span>
            <span className="status-detail font-mono-tech">192.168.1.100</span>
          </div>
        </div>
        
        <div className="sec-logs font-mono-tech">
          <ShieldAlert size={11} style={{ marginRight: '3px' }} />
          <span>SSL_CIPHER: TLS_AES_256_GCM</span>
        </div>
      </div>

      <style>{`
        .main-sidebar {
          width: 250px;
          height: calc(100vh - 3rem);
          display: flex;
          flex-direction: column;
          padding: 1.5rem 1rem;
          gap: 2rem;
          position: sticky;
          top: 1.5rem;
          box-sizing: border-box;
          flex-shrink: 0;
          z-index: 100;
        }

        .sidebar-brand {
          display: flex;
          align-items: center;
          gap: 0.75rem;
          padding: 0 0.5rem 1.25rem 0.5rem;
          border-bottom: 1px solid rgba(255, 255, 255, 0.05);
        }

        .brand-icon-wrapper {
          width: 38px;
          height: 38px;
          border-radius: 10px;
          background: radial-gradient(135deg, rgba(56, 189, 248, 0.1) 0%, rgba(168, 85, 247, 0.1) 100%);
          border: 1px solid rgba(56, 189, 248, 0.2);
          display: flex;
          align-items: center;
          justify-content: center;
          box-shadow: 0 4px 10px rgba(0, 0, 0, 0.2);
        }

        .brand-logo-icon {
          color: var(--color-cyber-blue);
          filter: drop-shadow(0 0 5px rgba(56, 189, 248, 0.5));
          animation: pulse-glow 2.5s infinite ease-in-out;
        }

        .brand-texts {
          display: flex;
          flex-direction: column;
        }

        .brand-title {
          font-size: 0.95rem;
          font-weight: 800;
          letter-spacing: 0.5px;
          color: #ffffff;
        }

        .brand-sub {
          font-size: 0.62rem;
          font-weight: 600;
          color: var(--text-muted);
          letter-spacing: 1px;
        }

        .sidebar-nav {
          display: flex;
          flex-direction: column;
          gap: 0.55rem;
          flex: 1;
        }

        .sidebar-nav-item {
          display: flex;
          align-items: center;
          padding: 0.75rem 1rem;
          gap: 0.75rem;
          background: transparent;
          border: 1px solid transparent;
          border-radius: 12px;
          cursor: pointer;
          position: relative;
          overflow: hidden;
          transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
          text-align: left;
          width: 100%;
        }

        .sidebar-nav-item:hover {
          background: rgba(255, 255, 255, 0.02);
          border-color: rgba(255, 255, 255, 0.04);
        }

        .nav-icon {
          color: var(--text-secondary);
          transition: transform 0.25s, color 0.25s;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .sidebar-nav-item:hover .nav-icon {
          transform: scale(1.1);
        }

        .nav-details {
          display: flex;
          flex-direction: column;
        }

        .nav-label {
          font-size: 0.82rem;
          font-weight: 700;
          letter-spacing: 0.5px;
          color: var(--text-secondary);
          transition: color 0.25s;
        }

        .nav-desc {
          font-size: 0.65rem;
          color: var(--text-muted);
        }

        .active-glow-bar {
          position: absolute;
          left: 0;
          top: 25%;
          height: 50%;
          width: 3px;
          border-radius: 0 4px 4px 0;
          opacity: 0;
          transition: all 0.25s;
        }

        /* Menu Coloring Themes */
        .blue-menu.active {
          background: rgba(56, 189, 248, 0.08);
          border-color: rgba(56, 189, 248, 0.25);
          box-shadow: 0 4px 15px rgba(56, 189, 248, 0.04);
        }
        .blue-menu.active .nav-icon {
          color: var(--color-cyber-blue);
          filter: drop-shadow(0 0 6px rgba(56, 189, 248, 0.6));
        }
        .blue-menu.active .nav-label { color: #ffffff; }
        .blue-menu.active .active-glow-bar {
          opacity: 1;
          background: var(--color-cyber-blue);
          box-shadow: 0 0 10px var(--color-cyber-blue);
        }

        .green-menu.active {
          background: rgba(16, 185, 129, 0.08);
          border-color: rgba(16, 185, 129, 0.25);
          box-shadow: 0 4px 15px rgba(16, 185, 129, 0.04);
        }
        .green-menu.active .nav-icon {
          color: var(--color-active-green);
          filter: drop-shadow(0 0 6px rgba(16, 185, 129, 0.6));
        }
        .green-menu.active .nav-label { color: #ffffff; }
        .green-menu.active .active-glow-bar {
          opacity: 1;
          background: var(--color-active-green);
          box-shadow: 0 0 10px var(--color-active-green);
        }

        .purple-menu.active {
          background: rgba(168, 85, 247, 0.08);
          border-color: rgba(168, 85, 247, 0.25);
          box-shadow: 0 4px 15px rgba(168, 85, 247, 0.04);
        }
        .purple-menu.active .nav-icon {
          color: var(--color-cyber-purple);
          filter: drop-shadow(0 0 6px rgba(168, 85, 247, 0.6));
        }
        .purple-menu.active .nav-label { color: #ffffff; }
        .purple-menu.active .active-glow-bar {
          opacity: 1;
          background: var(--color-cyber-purple);
          box-shadow: 0 0 10px var(--color-cyber-purple);
        }

        .amber-menu.active {
          background: rgba(245, 158, 11, 0.08);
          border-color: rgba(245, 158, 11, 0.25);
          box-shadow: 0 4px 15px rgba(245, 158, 11, 0.04);
        }
        .amber-menu.active .nav-icon {
          color: var(--color-warning-amber);
          filter: drop-shadow(0 0 6px rgba(245, 158, 11, 0.6));
        }
        .amber-menu.active .nav-label { color: #ffffff; }
        .amber-menu.active .active-glow-bar {
          opacity: 1;
          background: var(--color-warning-amber);
          box-shadow: 0 0 10px var(--color-warning-amber);
        }

        .crimson-menu.active {
          background: rgba(239, 68, 68, 0.08);
          border-color: rgba(239, 68, 68, 0.25);
          box-shadow: 0 4px 15px rgba(239, 68, 68, 0.04);
        }
        .crimson-menu.active .nav-icon {
          color: var(--color-error-crimson);
          filter: drop-shadow(0 0 6px rgba(239, 68, 68, 0.6));
        }
        .crimson-menu.active .nav-label { color: #ffffff; }
        .crimson-menu.active .active-glow-bar {
          opacity: 1;
          background: var(--color-error-crimson);
          box-shadow: 0 0 10px var(--color-error-crimson);
        }

        .cyan-menu.active {
          background: rgba(6, 182, 212, 0.08);
          border-color: rgba(6, 182, 212, 0.25);
          box-shadow: 0 4px 15px rgba(6, 182, 212, 0.04);
        }
        .cyan-menu.active .nav-icon {
          color: #06b6d4;
          filter: drop-shadow(0 0 6px rgba(6, 182, 212, 0.6));
        }
        .cyan-menu.active .nav-label { color: #ffffff; }
        .cyan-menu.active .active-glow-bar {
          opacity: 1;
          background: #06b6d4;
          box-shadow: 0 0 10px rgba(6, 182, 212, 0.8);
        }

        .lime-menu.active {
          background: rgba(132, 204, 22, 0.08);
          border-color: rgba(132, 204, 22, 0.25);
          box-shadow: 0 4px 15px rgba(132, 204, 22, 0.04);
        }
        .lime-menu.active .nav-icon {
          color: #84cc16;
          filter: drop-shadow(0 0 6px rgba(132, 204, 22, 0.6));
        }
        .lime-menu.active .nav-label { color: #ffffff; }
        .lime-menu.active .active-glow-bar {
          opacity: 1;
          background: #84cc16;
          box-shadow: 0 0 10px rgba(132, 204, 22, 0.8);
        }

        .rose-menu.active {
          background: rgba(244, 63, 94, 0.08);
          border-color: rgba(244, 63, 94, 0.25);
          box-shadow: 0 4px 15px rgba(244, 63, 94, 0.04);
        }
        .rose-menu.active .nav-icon {
          color: #f43f5e;
          filter: drop-shadow(0 0 6px rgba(244, 63, 94, 0.6));
        }
        .rose-menu.active .nav-label { color: #ffffff; }
        .rose-menu.active .active-glow-bar {
          opacity: 1;
          background: #f43f5e;
          box-shadow: 0 0 10px rgba(244, 63, 94, 0.8);
        }

        .sidebar-footer {
          display: flex;
          flex-direction: column;
          gap: 0.75rem;
          border-top: 1px solid rgba(255,255,255,0.05);
          padding-top: 1rem;
        }

        .system-status-indicator {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          padding: 0 0.25rem;
        }

        .status-dot {
          width: 7px;
          height: 7px;
          border-radius: 50%;
          background: var(--color-active-green);
          box-shadow: 0 0 6px var(--color-active-green);
        }

        .status-labels {
          display: flex;
          flex-direction: column;
        }

        .status-title {
          font-size: 0.68rem;
          font-weight: 700;
          color: var(--text-primary);
          letter-spacing: 0.5px;
        }

        .status-dot-offline {
          background: var(--color-error-crimson);
          box-shadow: 0 0 6px var(--color-error-crimson);
        }

        .status-detail {
          font-size: 0.6rem;
          color: var(--text-muted);
        }

        .sec-logs {
          font-size: 0.55rem;
          color: var(--text-muted);
          background: rgba(255,255,255,0.01);
          border: 1px solid rgba(255,255,255,0.03);
          padding: 0.25rem 0.5rem;
          border-radius: 6px;
          display: flex;
          align-items: center;
          letter-spacing: 0.3px;
        }

        @media (max-width: 768px) {
          .main-sidebar {
            width: 70px;
            padding: 1.5rem 0.5rem;
          }
          .brand-texts, .nav-desc, .nav-label, .sidebar-footer {
            display: none;
          }
          .sidebar-brand {
            justify-content: center;
            padding-bottom: 1rem;
          }
          .sidebar-nav-item {
            justify-content: center;
            padding: 0.85rem 0;
          }
        }
      `}</style>
    </aside>
  );
};
