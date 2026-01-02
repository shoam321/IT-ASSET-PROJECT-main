import React, { useEffect, useState, useRef } from 'react';
import { Sparkles, Calendar, ArrowRight } from 'lucide-react';

export default function WelcomeAnimation({ userName, trialEndsAt, onComplete }) {
  const [showConfetti, setShowConfetti] = useState(true);
  const [countdown, setCountdown] = useState(3);
  const canvasRef = useRef(null);

  // Format trial end date
  const formatDate = (dateString) => {
    if (!dateString) return 'in 30 days';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { 
      month: 'long', 
      day: 'numeric', 
      year: 'numeric' 
    });
  };

  // Confetti animation
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    const particles = [];
    const colors = ['#3B82F6', '#8B5CF6', '#10B981', '#F59E0B', '#EF4444', '#EC4899'];

    // Create particles
    for (let i = 0; i < 150; i++) {
      particles.push({
        x: canvas.width / 2,
        y: canvas.height / 2,
        vx: (Math.random() - 0.5) * 20,
        vy: (Math.random() - 0.5) * 20 - 10,
        color: colors[Math.floor(Math.random() * colors.length)],
        size: Math.random() * 8 + 4,
        rotation: Math.random() * 360,
        rotationSpeed: (Math.random() - 0.5) * 10,
        gravity: 0.3,
        friction: 0.99,
        opacity: 1
      });
    }

    let animationId;
    const animate = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      particles.forEach((p, i) => {
        p.vy += p.gravity;
        p.vx *= p.friction;
        p.vy *= p.friction;
        p.x += p.vx;
        p.y += p.vy;
        p.rotation += p.rotationSpeed;
        p.opacity -= 0.008;

        if (p.opacity > 0) {
          ctx.save();
          ctx.translate(p.x, p.y);
          ctx.rotate((p.rotation * Math.PI) / 180);
          ctx.globalAlpha = p.opacity;
          ctx.fillStyle = p.color;
          ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size);
          ctx.restore();
        }
      });

      if (particles.some(p => p.opacity > 0)) {
        animationId = requestAnimationFrame(animate);
      }
    };

    animate();

    return () => {
      if (animationId) {
        cancelAnimationFrame(animationId);
      }
    };
  }, []);

  // Countdown and auto-redirect
  useEffect(() => {
    const timer = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) {
          clearInterval(timer);
          onComplete();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [onComplete]);

  return (
    <div className="fixed inset-0 z-50 bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 flex items-center justify-center">
      {/* Confetti Canvas */}
      <canvas
        ref={canvasRef}
        className="absolute inset-0 pointer-events-none"
      />

      {/* Content */}
      <div className="relative z-10 text-center px-6 max-w-lg mx-auto animate-fade-in">
        {/* Celebration Emoji */}
        <div className="text-6xl sm:text-7xl mb-6 animate-bounce-slow">
          🎉
        </div>

        {/* Welcome Message */}
        <h1 className="text-3xl sm:text-4xl font-bold text-white mb-4">
          Welcome to the team
          <span className="block bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent mt-2">
            {userName || 'there'}!
          </span>
        </h1>

        <p className="text-slate-400 text-lg mb-8">
          Your account is ready. Let's get you set up!
        </p>

        {/* Trial Info Card */}
        <div className="bg-slate-800/50 backdrop-blur-sm border border-slate-700 rounded-2xl p-6 mb-8">
          <div className="flex items-center justify-center gap-3 mb-4">
            <div className="bg-green-500/20 p-2 rounded-lg">
              <Sparkles className="w-5 h-5 text-green-400" />
            </div>
            <span className="text-green-400 font-semibold">30-Day Free Trial Active</span>
          </div>

          <div className="flex items-center justify-center gap-2 text-slate-400">
            <Calendar className="w-4 h-4" />
            <span>Trial expires: {formatDate(trialEndsAt)}</span>
          </div>

          {/* Progress Bar */}
          <div className="mt-4">
            <div className="h-2 bg-slate-700 rounded-full overflow-hidden">
              <div 
                className="h-full bg-gradient-to-r from-green-500 to-emerald-500 rounded-full transition-all duration-1000"
                style={{ width: '100%' }}
              />
            </div>
            <p className="text-slate-500 text-sm mt-2">30 days remaining</p>
          </div>
        </div>

        {/* Auto-redirect Info */}
        <div className="flex flex-col items-center gap-4">
          <button
            onClick={onComplete}
            className="bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400 text-white font-semibold px-8 py-3 rounded-xl transition-all shadow-lg shadow-blue-500/25 flex items-center gap-2"
          >
            Continue to Setup
            <ArrowRight className="w-5 h-5" />
          </button>

          <p className="text-slate-500 text-sm">
            Continuing automatically in {countdown}...
          </p>
        </div>
      </div>

      <style jsx>{`
        @keyframes fade-in {
          from {
            opacity: 0;
            transform: scale(0.95);
          }
          to {
            opacity: 1;
            transform: scale(1);
          }
        }
        .animate-fade-in {
          animation: fade-in 0.5s ease-out;
        }
        @keyframes bounce-slow {
          0%, 100% {
            transform: translateY(0);
          }
          50% {
            transform: translateY(-10px);
          }
        }
        .animate-bounce-slow {
          animation: bounce-slow 2s ease-in-out infinite;
        }
      `}</style>
    </div>
  );
}
