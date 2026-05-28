import React, { useEffect, useRef, useState } from 'react';
import { Factory, Play, Shield, Terminal, ArrowRight, Cpu, Layers, Gauge, Database, Truck, Wrench, Package } from 'lucide-react';

interface HomeIntroProps {
  onNavigateToLiveMonitor: () => void;
  onNavigateToScada: () => void;
  onNavigateToMes: () => void;
  onNavigateToIqis: () => void;
  onNavigateToFms: () => void;
  onNavigateToCmms: () => void;
  onNavigateToWms: () => void;
}

export const HomeIntro: React.FC<HomeIntroProps> = ({
  onNavigateToLiveMonitor,
  onNavigateToScada,
  onNavigateToMes,
  onNavigateToIqis,
  onNavigateToFms,
  onNavigateToCmms,
  onNavigateToWms
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [hoveredCard, setHoveredCard] = useState<number | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationFrameId: number;
    let width = (canvas.width = canvas.offsetWidth);
    let height = (canvas.height = canvas.offsetHeight);

    const handleResize = () => {
      if (!canvas) return;
      width = canvas.width = canvas.offsetWidth;
      height = canvas.height = canvas.offsetHeight;
    };

    window.addEventListener('resize', handleResize);

    // Particle structure for 3D simulation
    interface Particle {
      x: number;
      y: number;
      z: number;
      ox: number; // original X
      oy: number; // original Y
      oz: number; // original Z
      color: string;
      size: number;
      angle: number;
      speed: number;
      orbitRadius: number;
      orbitSpeed: number;
      phase: number;
    }

    const particles: Particle[] = [];
    const particleCount = 200;
    const colors = ['#38bdf8', '#a855f7', '#10b981', '#6366f1'];

    // Generate random particles in a sphere/torus shape
    for (let i = 0; i < particleCount; i++) {
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(Math.random() * 2 - 1);
      const orbitRadius = 140 + Math.random() * 80;
      
      particles.push({
        x: 0,
        y: 0,
        z: 0,
        ox: orbitRadius * Math.sin(phi) * Math.cos(theta),
        oy: orbitRadius * Math.sin(phi) * Math.sin(theta),
        oz: orbitRadius * Math.cos(phi),
        color: colors[Math.floor(Math.random() * colors.length)],
        size: 1 + Math.random() * 2.5,
        angle: Math.random() * Math.PI * 2,
        speed: 0.005 + Math.random() * 0.01,
        orbitRadius,
        orbitSpeed: 0.002 + Math.random() * 0.005,
        phase: Math.random() * Math.PI * 2
      });
    }

    // Rings definition for cyber core
    interface Ring {
      radius: number;
      pitch: number;
      roll: number;
      yaw: number;
      color: string;
      lineWidth: number;
      dashPattern: number[];
      speed: number;
    }

    const rings: Ring[] = [
      { radius: 110, pitch: 0.5, roll: 0.3, yaw: 0, color: 'rgba(56, 189, 248, 0.45)', lineWidth: 1.5, dashPattern: [10, 15], speed: 0.005 },
      { radius: 150, pitch: -0.4, roll: 0.6, yaw: 0, color: 'rgba(168, 85, 247, 0.4)', lineWidth: 1, dashPattern: [40, 20, 10, 20], speed: -0.003 },
      { radius: 180, pitch: 0.8, roll: -0.5, yaw: 0, color: 'rgba(16, 185, 129, 0.35)', lineWidth: 2, dashPattern: [100, 40], speed: 0.002 },
      { radius: 80, pitch: 0.1, roll: 0.1, yaw: 0, color: 'rgba(99, 102, 241, 0.5)', lineWidth: 3, dashPattern: [5, 5], speed: -0.01 }
    ];

    let globalRotationY = 0;
    let globalRotationX = 0;
    let mouseX = 0;
    let mouseY = 0;
    let targetRotationX = 0.3;
    let targetRotationY = 0.5;

    const handleMouseMove = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      mouseX = (e.clientX - rect.left) - width / 2;
      mouseY = (e.clientY - rect.top) - height / 2;
      
      targetRotationY = (mouseX / width) * 1.5;
      targetRotationX = -(mouseY / height) * 1.5;
    };

    canvas.addEventListener('mousemove', handleMouseMove);

    // Render loop
    const render = () => {
      ctx.clearRect(0, 0, width, height);

      // Smooth camera interpolation
      globalRotationX += (targetRotationX - globalRotationX) * 0.05;
      globalRotationY += (targetRotationY - globalRotationY) * 0.05;

      // Draw futuristic background grid
      ctx.strokeStyle = 'rgba(56, 189, 248, 0.03)';
      ctx.lineWidth = 1;
      const gridSize = 40;
      
      // Vertical grid lines
      for (let x = 0; x < width; x += gridSize) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, height);
        ctx.stroke();
      }
      // Horizontal grid lines
      for (let y = 0; y < height; y += gridSize) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(width, y);
        ctx.stroke();
      }

      const centerX = width / 2;
      const centerY = height / 2;
      const fov = 400; // Perspective projection field of view

      // Update and project particles
      const projectedParticles = particles.map(p => {
        // Increment phase for orbit movement
        p.angle += p.orbitSpeed;

        // Calculate 3D position in orbit
        // We orbit them around Y axis in their initial positions
        const cosA = Math.cos(p.angle);
        const sinA = Math.sin(p.angle);
        
        let lx = p.ox * cosA - p.oz * sinA;
        let ly = p.oy;
        let lz = p.ox * sinA + p.oz * cosA;

        // Apply interactive mouse rotation (X & Y axes)
        // Rotate Y (yaw)
        const cosRy = Math.cos(globalRotationY);
        const sinRy = Math.sin(globalRotationY);
        let rx = lx * cosRy - lz * sinRy;
        let rz = lx * sinRy + lz * cosRy;
        
        // Rotate X (pitch)
        const cosRx = Math.cos(globalRotationX);
        const sinRx = Math.sin(globalRotationX);
        let ry = ly * cosRx - rz * sinRx;
        rz = ly * sinRx + rz * cosRx;

        // Depth projection
        const scale = fov / (fov + rz);
        const projX = centerX + rx * scale;
        const projY = centerY + ry * scale;

        return {
          projX,
          projY,
          scale,
          color: p.color,
          size: p.size * scale,
          z: rz
        };
      });

      // Sort by depth (painters algorithm) to render back to front
      projectedParticles.sort((a, b) => b.z - a.z);

      // Draw Rings
      rings.forEach(ring => {
        ring.yaw += ring.speed;
        
        const segments = 120;
        ctx.beginPath();
        ctx.lineWidth = ring.lineWidth;
        ctx.strokeStyle = ring.color;
        ctx.setLineDash(ring.dashPattern);

        for (let i = 0; i <= segments; i++) {
          const u = (i / segments) * Math.PI * 2;
          
          // Coordinate in local ring space
          let rx = ring.radius * Math.cos(u + ring.yaw);
          let ry = 0;
          let rz = ring.radius * Math.sin(u + ring.yaw);

          // Apply ring local pitch (rotation around X) and roll (rotation around Z)
          // 1. Pitch
          const cp = Math.cos(ring.pitch);
          const sp = Math.sin(ring.pitch);
          let y1 = ry * cp - rz * sp;
          let z1 = ry * sp + rz * cp;

          // 2. Roll
          const cr = Math.cos(ring.roll);
          const sr = Math.sin(ring.roll);
          let x2 = rx * cr - y1 * sr;
          let y2 = rx * sr + y1 * cr;
          let z2 = z1;

          // Apply camera rotations
          // Camera Y
          const cosRy = Math.cos(globalRotationY);
          const sinRy = Math.sin(globalRotationY);
          let cx = x2 * cosRy - z2 * sinRy;
          let cz = x2 * sinRy + z2 * cosRy;

          // Camera X
          const cosRx = Math.cos(globalRotationX);
          const sinRx = Math.sin(globalRotationX);
          let cy = y2 * cosRx - cz * sinRx;
          cz = y2 * sinRx + cz * cosRx;

          // Projection
          const s = fov / (fov + cz);
          const px = centerX + cx * s;
          const py = centerY + cy * s;

          if (i === 0) {
            ctx.moveTo(px, py);
          } else {
            ctx.lineTo(px, py);
          }
        }
        ctx.stroke();
      });
      ctx.setLineDash([]); // Reset line dash

      // Draw Particles
      projectedParticles.forEach(p => {
        if (p.projX < 0 || p.projX > width || p.projY < 0 || p.projY > height) return;
        
        ctx.beginPath();
        ctx.arc(p.projX, p.projY, p.size, 0, Math.PI * 2);
        
        // Add neon glow for larger particles
        if (p.size > 1.8) {
          ctx.shadowBlur = 8;
          ctx.shadowColor = p.color;
        } else {
          ctx.shadowBlur = 0;
        }

        ctx.fillStyle = p.color;
        ctx.globalAlpha = Math.max(0.15, Math.min(1.0, p.scale));
        ctx.fill();
      });

      ctx.shadowBlur = 0; // Reset shadow
      ctx.globalAlpha = 1.0; // Reset alpha

      // Draw central digital core token
      const pulseRadius = 50 + Math.sin(Date.now() * 0.003) * 3;
      
      // Hologram ring
      ctx.beginPath();
      ctx.arc(centerX, centerY, pulseRadius, 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(56, 189, 248, 0.4)';
      ctx.lineWidth = 1;
      ctx.stroke();

      // Core glow
      const grad = ctx.createRadialGradient(centerX, centerY, 5, centerX, centerY, pulseRadius);
      grad.addColorStop(0, 'rgba(56, 189, 248, 0.25)');
      grad.addColorStop(0.5, 'rgba(168, 85, 247, 0.08)');
      grad.addColorStop(1, 'rgba(7, 10, 19, 0)');
      
      ctx.beginPath();
      ctx.arc(centerX, centerY, pulseRadius, 0, Math.PI * 2);
      ctx.fillStyle = grad;
      ctx.fill();

      // Cyber core inner logo/circle
      ctx.beginPath();
      ctx.arc(centerX, centerY, 15, 0, Math.PI * 2);
      ctx.fillStyle = '#38bdf8';
      ctx.shadowBlur = 15;
      ctx.shadowColor = '#38bdf8';
      ctx.fill();
      
      ctx.beginPath();
      ctx.arc(centerX, centerY, 28, 0, Math.PI * 2);
      ctx.strokeStyle = '#a855f7';
      ctx.lineWidth = 1.5;
      ctx.shadowBlur = 10;
      ctx.shadowColor = '#a855f7';
      ctx.stroke();
      
      ctx.shadowBlur = 0;

      // Draw radar sweep line
      const sweepAngle = (Date.now() * 0.001) % (Math.PI * 2);
      ctx.beginPath();
      ctx.moveTo(centerX, centerY);
      ctx.lineTo(
        centerX + Math.cos(sweepAngle) * 200,
        centerY + Math.sin(sweepAngle) * 200
      );
      ctx.strokeStyle = 'rgba(56, 189, 248, 0.04)';
      ctx.lineWidth = 1.5;
      ctx.stroke();

      // Draw technical HUD labels in the corners of the canvas
      ctx.fillStyle = 'rgba(56, 189, 248, 0.4)';
      ctx.font = '9px JetBrains Mono';
      
      ctx.fillText(`SYS.SYS_SPEED: ${Math.sin(Date.now() * 0.001).toFixed(4)} RAD/S`, 20, 30);
      ctx.fillText(`VSIM.CORE_UPTIME: ${(performance.now() / 1000).toFixed(2)}S`, 20, 45);
      ctx.fillText(`ACTIVE_PARTICLES: ${particleCount}`, 20, 60);

      ctx.textAlign = 'right';
      ctx.fillText(`SYSTEM_STATUS: EMULATION_OK`, width - 20, 30);
      ctx.fillText(`VSIM_ENGINE_REV: v4.12.0_TS`, width - 20, 45);
      ctx.fillText(`RESOLUTION: ${width}x${height}`, width - 20, 60);
      ctx.textAlign = 'left';

      // Futuristic brackets around core
      const bSize = 35;
      const bOffset = 70;
      ctx.strokeStyle = 'rgba(56, 189, 248, 0.3)';
      ctx.lineWidth = 1.5;

      // Top-Left bracket
      ctx.beginPath();
      ctx.moveTo(centerX - bOffset, centerY - bOffset + bSize);
      ctx.lineTo(centerX - bOffset, centerY - bOffset);
      ctx.lineTo(centerX - bOffset + bSize, centerY - bOffset);
      ctx.stroke();

      // Top-Right bracket
      ctx.beginPath();
      ctx.moveTo(centerX + bOffset, centerY - bOffset + bSize);
      ctx.lineTo(centerX + bOffset, centerY - bOffset);
      ctx.lineTo(centerX + bOffset - bSize, centerY - bOffset);
      ctx.stroke();

      // Bottom-Left bracket
      ctx.beginPath();
      ctx.moveTo(centerX - bOffset, centerY + bOffset - bSize);
      ctx.lineTo(centerX - bOffset, centerY + bOffset);
      ctx.lineTo(centerX - bOffset + bSize, centerY + bOffset);
      ctx.stroke();

      // Bottom-Right bracket
      ctx.beginPath();
      ctx.moveTo(centerX + bOffset, centerY + bOffset - bSize);
      ctx.lineTo(centerX + bOffset, centerY + bOffset);
      ctx.lineTo(centerX + bOffset - bSize, centerY + bOffset);
      ctx.stroke();

      animationFrameId = requestAnimationFrame(render);
    };

    render();

    return () => {
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener('resize', handleResize);
      canvas.removeEventListener('mousemove', handleMouseMove);
    };
  }, []);

  const features = [
    {
      icon: <Cpu className="text-neon-blue" size={24} />,
      title: "가상 PLC (vPLC) 시뮬레이션",
      description: "C++ 백그라운드 런타임과 웹소켓(WebSocket)으로 연동되어, 정밀한 멀티스레드 상태 기계 연산을 브라우저에 실시간 동기화합니다."
    },
    {
      icon: <Gauge className="text-neon-green" size={24} />,
      title: "실시간 감시 & 데이터 통계",
      description: "생산량, 불량률, OEE(설비종합효율), 가동 사이클 타임(C/T) 등을 실시간 대시보드와 로그 터미널로 추적하고 기록합니다."
    },
    {
      icon: <Layers className="text-neon-amber" size={24} />,
      title: "가변 멀티 공정 아키텍처",
      description: "동적으로 피더(Feeder)부터 소터(Sorter)까지 최대 20단계의 공정을 배치하고 연쇄적인 상태 연동을 실시간으로 감시합니다."
    }
  ];

  return (
    <div className="home-intro-container">
      {/* Dynamic 3D-projected Background Canvas */}
      <div className="intro-animation-wrapper">
        <canvas ref={canvasRef} className="intro-canvas" />
        
        {/* Glowing Title overlay */}
        <div className="intro-content-overlay">
          <div className="vsim-badge">
            <Shield size={12} className="vsim-badge-icon" />
            <span>VSIM-FACTORY DIGITAL TWIN CORE v4.12</span>
          </div>
          <h1 className="intro-title">
            vSim<span className="text-neon-blue">-FACTORY</span>
          </h1>
          <p className="intro-subtitle">
            상태 기계 모델링 기반의 실시간 제조 공정 가상 시뮬레이터 및 의장 공장 SCADA 통합 관제실
          </p>
          
          <div className="action-buttons">
            <button className="glow-btn blue-glow" onClick={onNavigateToLiveMonitor}>
              <Play size={16} fill="currentColor" />
              <span>실시간 가상 공정 모니터</span>
              <ArrowRight size={16} />
            </button>
            <button className="glow-btn purple-glow" onClick={onNavigateToScada}>
              <Factory size={16} />
              <span>의장 공장 SCADA 시스템</span>
              <ArrowRight size={16} />
            </button>
            <button className="glow-btn amber-glow" onClick={onNavigateToMes}>
              <Database size={16} />
              <span>MES 제조 실행 시스템</span>
              <ArrowRight size={16} />
            </button>
            <button className="glow-btn crimson-glow" onClick={onNavigateToIqis}>
              <Shield size={16} />
              <span>IQIS 품질 분석 시스템</span>
              <ArrowRight size={16} />
            </button>
            <button className="glow-btn cyan-glow" onClick={onNavigateToFms}>
              <Truck size={16} />
              <span>FMS / ACS 물류 제어</span>
              <ArrowRight size={16} />
            </button>
            <button className="glow-btn lime-glow" onClick={onNavigateToCmms}>
              <Wrench size={16} />
              <span>CMMS 설비 보전 시스템</span>
              <ArrowRight size={16} />
            </button>
            <button className="glow-btn rose-glow" onClick={onNavigateToWms}>
              <Package size={16} />
              <span>WMS 자동 창고 시스템</span>
              <ArrowRight size={16} />
            </button>
          </div>
        </div>
      </div>

      {/* Description Cards Section */}
      <div className="intro-features-grid">
        {features.map((feature, idx) => (
          <div 
            key={idx}
            className={`glass-panel intro-feature-card ${hoveredCard === idx ? 'hovered' : ''}`}
            onMouseEnter={() => setHoveredCard(idx)}
            onMouseLeave={() => setHoveredCard(null)}
          >
            <div className="feature-icon-wrapper">
              {feature.icon}
            </div>
            <h3 className="feature-title">{feature.title}</h3>
            <p className="feature-desc">{feature.description}</p>
            <div className="feature-card-glow-bg" />
          </div>
        ))}
      </div>

      {/* Tech Specifications and Explanation Footer */}
      <div className="glass-panel tech-spec-panel">
        <div className="tech-spec-header">
          <Terminal size={18} className="text-neon-blue" />
          <h3>System Architecture Description</h3>
        </div>
        <div className="tech-spec-body">
          <p>
            <strong>vSim-FACTORY</strong>는 스마트 팩토리의 핵심인 의장 공장 및 일반 자동화 가공 조립 라인의 물리적 움직임과 
            논리적 PLC 프로그램 동작을 디지털 공간에 구현한 <strong>디지털 트윈(Digital Twin) 프로토타입</strong>입니다. 
            의장(Assembly/Trim) 공장의 실시간 이송 체계, 도어 탈거/장착, 샤시 결합(Marriage) 및 최종 검사 공정의 흐름을 
            가상 PLC(vPLC) 논리 제어와 연결하여 가시화하며, 설비 모니터링의 핵심 뼈대인 SCADA(Supervisory Control and Data Acquisition) 감시 화면을 지원합니다.
          </p>
          <div className="tech-tags">
            <span>React.js</span>
            <span>TypeScript</span>
            <span>C++ Core (vPLC)</span>
            <span>HTML5 Canvas 2D/3D Context</span>
            <span>WebSockets</span>
            <span>State Machine Logic</span>
          </div>
        </div>
      </div>

      <style>{`
        .home-intro-container {
          display: flex;
          flex-direction: column;
          gap: 1.5rem;
          width: 100%;
          animation: fadeIn 0.8s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }

        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(15px); }
          to { opacity: 1; transform: translateY(0); }
        }

        .intro-animation-wrapper {
          position: relative;
          width: 100%;
          height: 480px;
          border-radius: 16px;
          border: 1px solid var(--border-color);
          overflow: hidden;
          background: radial-gradient(circle at center, rgba(13, 20, 38, 0.8) 0%, rgba(4, 6, 14, 0.95) 100%);
          box-shadow: 0 10px 40px rgba(0, 0, 0, 0.6);
        }

        .intro-canvas {
          position: absolute;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          z-index: 1;
        }

        .intro-content-overlay {
          position: absolute;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          z-index: 2;
          display: flex;
          flex-direction: column;
          justify-content: center;
          align-items: center;
          text-align: center;
          padding: 2rem;
          box-sizing: border-box;
          background: radial-gradient(circle at center, transparent 30%, rgba(7, 10, 19, 0.45) 80%);
          pointer-events: none;
        }

        .intro-content-overlay button, .intro-content-overlay .vsim-badge {
          pointer-events: auto;
        }

        .vsim-badge {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          background: rgba(56, 189, 248, 0.1);
          border: 1px solid rgba(56, 189, 248, 0.3);
          color: var(--color-cyber-blue);
          font-size: 0.7rem;
          font-weight: 700;
          letter-spacing: 1.5px;
          padding: 0.4rem 0.8rem;
          border-radius: 9999px;
          margin-bottom: 1.25rem;
          box-shadow: 0 0 12px rgba(56, 189, 248, 0.1);
          text-transform: uppercase;
        }

        .vsim-badge-icon {
          animation: pulse-glow 2s infinite ease-in-out;
        }

        .intro-title {
          font-size: 3.5rem;
          font-weight: 800;
          margin: 0;
          letter-spacing: -1.5px;
          text-shadow: 0 4px 20px rgba(0,0,0,0.5);
          color: #ffffff;
        }

        .intro-subtitle {
          font-size: 1.05rem;
          color: var(--text-secondary);
          max-width: 650px;
          margin: 0.75rem 0 2rem 0;
          line-height: 1.6;
        }

        .action-buttons {
          display: flex;
          gap: 1.25rem;
        }

        .glow-btn {
          display: flex;
          align-items: center;
          gap: 0.75rem;
          border: 1px solid transparent;
          color: #ffffff;
          padding: 0.85rem 1.75rem;
          font-size: 0.95rem;
          font-weight: 600;
          border-radius: 12px;
          cursor: pointer;
          transition: all 0.3s cubic-bezier(0.25, 0.8, 0.25, 1);
          position: relative;
          overflow: hidden;
        }

        .glow-btn::before {
          content: '';
          position: absolute;
          top: 0;
          left: -100%;
          width: 50%;
          height: 100%;
          background: linear-gradient(
            to right,
            rgba(255, 255, 255, 0) 0%,
            rgba(255, 255, 255, 0.13) 50%,
            rgba(255, 255, 255, 0) 100%
          );
          transform: skewX(-25deg);
          transition: 0.75s;
        }

        .glow-btn:hover::before {
          left: 150%;
        }

        .blue-glow {
          background: linear-gradient(135deg, #0284c7 0%, #0369a1 100%);
          border-color: rgba(56, 189, 248, 0.4);
          box-shadow: 0 4px 15px rgba(2, 132, 199, 0.3), 0 0 10px rgba(56, 189, 248, 0.15);
        }

        .blue-glow:hover {
          transform: translateY(-2px);
          box-shadow: 0 6px 20px rgba(2, 132, 199, 0.5), 0 0 15px rgba(56, 189, 248, 0.3);
          border-color: var(--color-cyber-blue);
        }

        .purple-glow {
          background: linear-gradient(135deg, rgba(168, 85, 247, 0.2) 0%, rgba(147, 51, 234, 0.3) 100%);
          border-color: rgba(168, 85, 247, 0.4);
          backdrop-filter: blur(8px);
          box-shadow: 0 4px 15px rgba(168, 85, 247, 0.15);
        }

        .purple-glow:hover {
          transform: translateY(-2px);
          background: linear-gradient(135deg, rgba(168, 85, 247, 0.3) 0%, rgba(147, 51, 234, 0.4) 100%);
          box-shadow: 0 6px 20px rgba(168, 85, 247, 0.3), 0 0 15px rgba(168, 85, 247, 0.2);
          border-color: var(--color-cyber-purple);
        }

        .amber-glow {
          background: linear-gradient(135deg, rgba(245, 158, 11, 0.2) 0%, rgba(217, 119, 6, 0.3) 100%);
          border-color: rgba(245, 158, 11, 0.4);
          backdrop-filter: blur(8px);
          box-shadow: 0 4px 15px rgba(245, 158, 11, 0.15);
        }

        .amber-glow:hover {
          transform: translateY(-2px);
          background: linear-gradient(135deg, rgba(245, 158, 11, 0.3) 0%, rgba(217, 119, 6, 0.4) 100%);
          box-shadow: 0 6px 20px rgba(245, 158, 11, 0.3), 0 0 15px rgba(245, 158, 11, 0.2);
          border-color: var(--color-warning-amber);
        }

        .crimson-glow {
          background: linear-gradient(135deg, rgba(239, 68, 68, 0.2) 0%, rgba(185, 28, 28, 0.3) 100%);
          border-color: rgba(239, 68, 68, 0.4);
          backdrop-filter: blur(8px);
          box-shadow: 0 4px 15px rgba(239, 68, 68, 0.15);
        }

        .crimson-glow:hover {
          transform: translateY(-2px);
          background: linear-gradient(135deg, rgba(239, 68, 68, 0.3) 0%, rgba(185, 28, 28, 0.4) 100%);
          box-shadow: 0 6px 20px rgba(239, 68, 68, 0.3), 0 0 15px rgba(239, 68, 68, 0.2);
          border-color: var(--color-error-crimson);
        }

        .cyan-glow {
          background: linear-gradient(135deg, rgba(6, 182, 212, 0.2) 0%, rgba(8, 145, 178, 0.3) 100%);
          border-color: rgba(6, 182, 212, 0.4);
          backdrop-filter: blur(8px);
          box-shadow: 0 4px 15px rgba(6, 182, 212, 0.15);
        }

        .cyan-glow:hover {
          transform: translateY(-2px);
          background: linear-gradient(135deg, rgba(6, 182, 212, 0.3) 0%, rgba(8, 145, 178, 0.4) 100%);
          box-shadow: 0 6px 20px rgba(6, 182, 212, 0.3), 0 0 15px rgba(6, 182, 212, 0.2);
          border-color: #06b6d4;
        }

        .lime-glow {
          background: linear-gradient(135deg, rgba(132, 204, 22, 0.2) 0%, rgba(101, 163, 13, 0.3) 100%);
          border-color: rgba(132, 204, 22, 0.4);
          backdrop-filter: blur(8px);
          box-shadow: 0 4px 15px rgba(132, 204, 22, 0.15);
        }

        .lime-glow:hover {
          transform: translateY(-2px);
          background: linear-gradient(135deg, rgba(132, 204, 22, 0.3) 0%, rgba(101, 163, 13, 0.4) 100%);
          box-shadow: 0 6px 20px rgba(132, 204, 22, 0.3), 0 0 15px rgba(132, 204, 22, 0.2);
          border-color: #84cc16;
        }

        .rose-glow {
          background: linear-gradient(135deg, rgba(244, 63, 94, 0.2) 0%, rgba(225, 29, 72, 0.3) 100%);
          border-color: rgba(244, 63, 94, 0.4);
          backdrop-filter: blur(8px);
          box-shadow: 0 4px 15px rgba(244, 63, 94, 0.15);
        }

        .rose-glow:hover {
          transform: translateY(-2px);
          background: linear-gradient(135deg, rgba(244, 63, 94, 0.3) 0%, rgba(225, 29, 72, 0.4) 100%);
          box-shadow: 0 6px 20px rgba(244, 63, 94, 0.3), 0 0 15px rgba(244, 63, 94, 0.2);
          border-color: #f43f5e;
        }

        .intro-features-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 1.25rem;
          width: 100%;
        }

        @media (max-width: 900px) {
          .intro-features-grid {
            grid-template-columns: 1fr;
          }
        }

        .intro-feature-card {
          padding: 1.75rem;
          position: relative;
          overflow: hidden;
          cursor: default;
          display: flex;
          flex-direction: column;
          gap: 0.85rem;
        }

        .feature-icon-wrapper {
          width: 48px;
          height: 48px;
          border-radius: 12px;
          background: rgba(255, 255, 255, 0.02);
          border: 1px solid rgba(255, 255, 255, 0.05);
          display: flex;
          align-items: center;
          justify-content: center;
          box-shadow: inset 0 2px 6px rgba(0, 0, 0, 0.3);
          transition: all 0.3s;
        }

        .intro-feature-card.hovered .feature-icon-wrapper {
          background: rgba(56, 189, 248, 0.08);
          border-color: rgba(56, 189, 248, 0.2);
          transform: scale(1.05);
        }

        .feature-title {
          font-size: 1.05rem;
          font-weight: 600;
          color: var(--text-primary);
          margin: 0;
        }

        .feature-desc {
          font-size: 0.85rem;
          color: var(--text-secondary);
          margin: 0;
          line-height: 1.5;
        }

        .feature-card-glow-bg {
          position: absolute;
          width: 150px;
          height: 150px;
          background: radial-gradient(circle, rgba(56, 189, 248, 0.03) 0%, transparent 70%);
          bottom: -75px;
          right: -75px;
          pointer-events: none;
          transition: transform 0.5s;
        }

        .intro-feature-card.hovered .feature-card-glow-bg {
          transform: scale(1.5);
          background: radial-gradient(circle, rgba(168, 85, 247, 0.06) 0%, transparent 70%);
        }

        .tech-spec-panel {
          padding: 1.5rem 1.75rem;
        }

        .tech-spec-header {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          margin-bottom: 0.75rem;
          border-bottom: 1px solid rgba(255, 255, 255, 0.05);
          padding-bottom: 0.5rem;
        }

        .tech-spec-header h3 {
          font-size: 0.95rem;
          font-weight: 700;
          letter-spacing: 1px;
          text-transform: uppercase;
          color: var(--text-primary);
          margin: 0;
        }

        .tech-spec-body {
          display: flex;
          flex-direction: column;
          gap: 1rem;
        }

        .tech-spec-body p {
          font-size: 0.88rem;
          color: var(--text-secondary);
          line-height: 1.6;
          margin: 0;
        }

        .tech-tags {
          display: flex;
          flex-wrap: wrap;
          gap: 0.5rem;
        }

        .tech-tags span {
          font-family: 'JetBrains Mono', monospace;
          font-size: 0.7rem;
          color: var(--text-muted);
          background: rgba(255,255,255,0.02);
          border: 1px solid rgba(255,255,255,0.05);
          padding: 0.25rem 0.5rem;
          border-radius: 4px;
        }
      `}</style>
    </div>
  );
};
