'use client';

import React from 'react';
import { Trophy } from 'lucide-react';

interface CompleteModalProps {
  onClose: () => void;
}

const CompleteModal: React.FC<CompleteModalProps> = ({ onClose }) => {
  return (
    <>
      <div
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: '100vw',
          height: '100vh',
          background: 'rgba(0, 0, 0, 0.8)',
          zIndex: 200000,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          animation: 'fadeIn 0.5s ease-out'
        }}
        onClick={onClose}
      >
        <div
          style={{
            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            borderRadius: '24px',
            padding: '48px 32px',
            textAlign: 'center',
            maxWidth: '90%',
            boxShadow: '0 20px 60px rgba(0, 0, 0, 0.5)',
            animation: 'scaleIn 0.6s cubic-bezier(0.68, -0.55, 0.265, 1.55)'
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* トロフィーアイコン */}
          <div
            style={{
              width: '120px',
              height: '120px',
              margin: '0 auto 24px',
              background: 'linear-gradient(135deg, #ffd700 0%, #ffed4e 100%)',
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 10px 30px rgba(255, 215, 0, 0.5)',
              animation: 'bounce 1s ease-in-out infinite'
            }}
          >
            <Trophy size={64} color="#fff" strokeWidth={2.5} />
          </div>

          {/* おめでとうメッセージ */}
          <h1
            style={{
              fontSize: '32px',
              fontWeight: 'bold',
              color: '#fff',
              margin: '0 0 16px 0',
              textShadow: '0 2px 10px rgba(0, 0, 0, 0.3)',
              animation: 'slideDown 0.8s ease-out'
            }}
          >
            おめでとう！
          </h1>

          <p
            style={{
              fontSize: '20px',
              color: '#fff',
              margin: '0 0 32px 0',
              lineHeight: '1.6',
              textShadow: '0 1px 5px rgba(0, 0, 0, 0.3)',
              animation: 'slideDown 1s ease-out'
            }}
          >
            全てのwkwkを<br />集めました！
          </p>

          {/* 完了ボタン */}
          <button
            onClick={onClose}
            style={{
              background: '#fff',
              color: '#667eea',
              border: 'none',
              borderRadius: '12px',
              padding: '16px 48px',
              fontSize: '18px',
              fontWeight: 'bold',
              cursor: 'pointer',
              boxShadow: '0 4px 15px rgba(0, 0, 0, 0.2)',
              transition: 'transform 0.2s, box-shadow 0.2s',
              animation: 'slideUp 1.2s ease-out'
            }}
            onMouseDown={(e) => {
              e.currentTarget.style.transform = 'scale(0.95)';
            }}
            onMouseUp={(e) => {
              e.currentTarget.style.transform = 'scale(1)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'scale(1)';
            }}
          >
            閉じる
          </button>
        </div>

        {/* 紙吹雪アニメーション */}
        {[...Array(50)].map((_, i) => (
          <div
            key={i}
            style={{
              position: 'absolute',
              width: '10px',
              height: '10px',
              background: ['#ff6b6b', '#4ecdc4', '#45b7d1', '#ffd700', '#ff8ed4'][i % 5],
              top: '-10px',
              left: `${Math.random() * 100}%`,
              opacity: 0.8,
              animation: `confetti ${2 + Math.random() * 3}s linear ${Math.random() * 0.5}s infinite`,
              transform: `rotate(${Math.random() * 360}deg)`
            }}
          />
        ))}
      </div>

      <style jsx>{`
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }

        @keyframes scaleIn {
          from {
            transform: scale(0.5);
            opacity: 0;
          }
          to {
            transform: scale(1);
            opacity: 1;
          }
        }

        @keyframes bounce {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-20px); }
        }

        @keyframes slideDown {
          from {
            transform: translateY(-30px);
            opacity: 0;
          }
          to {
            transform: translateY(0);
            opacity: 1;
          }
        }

        @keyframes slideUp {
          from {
            transform: translateY(30px);
            opacity: 0;
          }
          to {
            transform: translateY(0);
            opacity: 1;
          }
        }

        @keyframes confetti {
          0% {
            transform: translateY(-10px) rotate(0deg);
            opacity: 1;
          }
          100% {
            transform: translateY(100vh) rotate(720deg);
            opacity: 0;
          }
        }
      `}</style>
    </>
  );
};

export default CompleteModal;
