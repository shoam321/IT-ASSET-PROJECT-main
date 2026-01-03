import React, { useEffect, useRef } from 'react';
import { Monitor } from 'lucide-react';

export default function VhsGlitchLogo({ width = "auto", height = "auto", className = "" }) {
  const textRef = useRef(null);

  useEffect(() => {
    const text = textRef.current;
    if (!text) return;

    const glitchInterval = setInterval(() => {
      if (Math.random() > 0.7) {
        text.classList.add('glitch-active');
        setTimeout(() => text.classList.remove('glitch-active'), 100 + Math.random() * 200);
      }
    }, 2000 + Math.random() * 3000);

    return () => clearInterval(glitchInterval);
  }, []);

  return (
    <div className={`vhs-glitch-logo ${className}`} style={{ width, height }}>
      <style>{`
        .vhs-glitch-logo {
          position: relative;
          display: inline-flex;
          align-items: center;
          gap: 0.75rem;
        }

        .vhs-glitch-text {
          position: relative;
          font-size: 1.25rem;
          font-weight: 700;
          color: #3b82f6;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          animation: vhs-scanline 8s linear infinite;
        }

        @keyframes vhs-scanline {
          0%, 100% { text-shadow: 0 0 1px rgba(59, 130, 246, 0.5); }
          50% { text-shadow: 0 0 3px rgba(59, 130, 246, 0.8); }
        }

        .vhs-glitch-text.glitch-active {
          animation: vhs-glitch 0.3s cubic-bezier(0.25, 0.46, 0.45, 0.94) both,
                     vhs-rgb-shift 0.3s cubic-bezier(0.25, 0.46, 0.45, 0.94) both;
        }

        @keyframes vhs-glitch {
          0%, 100% { transform: translate(0); }
          20% { transform: translate(-2px, 1px); }
          40% { transform: translate(2px, -1px); }
          60% { transform: translate(-1px, 2px); }
          80% { transform: translate(1px, -2px); }
        }

        @keyframes vhs-rgb-shift {
          0%, 100% {
            text-shadow: 0 0 1px rgba(59, 130, 246, 0.5);
          }
          25% {
            text-shadow: 
              -2px 0 0 #ff00ff,
              2px 0 0 #00ffff,
              0 0 5px rgba(59, 130, 246, 0.8);
          }
          50% {
            text-shadow: 
              2px 0 0 #ff00ff,
              -2px 0 0 #00ffff,
              0 0 10px rgba(59, 130, 246, 1);
          }
          75% {
            text-shadow: 
              -1px 0 0 #ff00ff,
              1px 0 0 #00ffff,
              0 0 5px rgba(59, 130, 246, 0.8);
          }
        }

        .vhs-glitch-text::before {
          content: attr(data-text);
          position: absolute;
          left: 0;
          top: 0;
          width: 100%;
          height: 100%;
          opacity: 0;
        }

        .vhs-glitch-text.glitch-active::before {
          opacity: 0.8;
          animation: vhs-glitch-before 0.3s cubic-bezier(0.25, 0.46, 0.45, 0.94) both;
        }

        @keyframes vhs-glitch-before {
          0%, 100% { clip-path: inset(0 0 0 0); transform: translate(0); }
          20% { clip-path: inset(20% 0 60% 0); transform: translate(-3px, 0); }
          40% { clip-path: inset(60% 0 20% 0); transform: translate(3px, 0); }
          60% { clip-path: inset(40% 0 40% 0); transform: translate(-2px, 0); }
          80% { clip-path: inset(10% 0 70% 0); transform: translate(2px, 0); }
        }

        .vhs-icon-container {
          position: relative;
          background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%);
          padding: 0.625rem;
          border-radius: 0.75rem;
          box-shadow: 0 4px 14px 0 rgba(59, 130, 246, 0.2);
          animation: vhs-icon-pulse 3s ease-in-out infinite;
        }

        @keyframes vhs-icon-pulse {
          0%, 100% {
            box-shadow: 0 4px 14px 0 rgba(59, 130, 246, 0.2);
            transform: scale(1);
          }
          50% {
            box-shadow: 0 4px 20px 0 rgba(59, 130, 246, 0.4);
            transform: scale(1.05);
          }
        }

        @media (max-width: 640px) {
          .vhs-glitch-text {
            font-size: 1.125rem;
          }
        }
      `}</style>
      
      <div className="vhs-icon-container">
        <Monitor className="w-6 h-6 text-white" />
      </div>
      <span ref={textRef} className="vhs-glitch-text" data-text="IT ASSET MANAGER">
        IT ASSET MANAGER
      </span>
    </div>
  );
}

