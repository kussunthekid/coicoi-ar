'use client';

import { useRouter } from 'next/navigation';
import { Camera } from 'lucide-react';

export default function StartPage() {
  const router = useRouter();

  const handleStart = () => {
    router.push('/ar');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-600 via-purple-600 to-pink-600 flex items-center justify-center p-4">
      <div className="text-center">
        {/* ロゴエリア */}
        <div className="mb-12">
          <h1 className="text-6xl md:text-8xl font-bold text-white mb-4 tracking-wider drop-shadow-2xl">
            coicoi
          </h1>
          <p className="text-xl md:text-2xl text-white/90 font-light">
            ARで特別な瞬間を撮影しよう
          </p>
        </div>

        {/* スタートボタン */}
        <button
          onClick={handleStart}
          className="group relative px-12 py-6 bg-white/20 backdrop-blur-xl rounded-full border-2 border-white/30 transition-all duration-300 hover:scale-105 hover:bg-white/30 active:scale-95"
        >
          <div className="flex items-center gap-4">
            <Camera className="w-8 h-8 text-white drop-shadow-lg group-hover:rotate-12 transition-transform duration-300" />
            <div className="text-left">
              <p className="text-2xl font-bold text-white drop-shadow-lg">
                coicoiと写真を撮ろう！
              </p>
              <p className="text-sm text-white/80 mt-1">
                タップしてARカメラを起動
              </p>
            </div>
          </div>
          
          {/* 光るエフェクト */}
          <div className="absolute inset-0 rounded-full bg-gradient-to-r from-transparent via-white/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none animate-pulse" />
        </button>

        {/* 装飾的な要素 */}
        <div className="mt-16 flex justify-center gap-2">
          <div className="w-2 h-2 bg-white/40 rounded-full animate-bounce" style={{ animationDelay: '0s' }} />
          <div className="w-2 h-2 bg-white/40 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }} />
          <div className="w-2 h-2 bg-white/40 rounded-full animate-bounce" style={{ animationDelay: '0.4s' }} />
        </div>
      </div>

      {/* 背景の装飾的な円 */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-pink-400/20 rounded-full blur-3xl animate-pulse" />
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-blue-400/20 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }} />
        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-purple-400/10 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '2s' }} />
      </div>
    </div>
  );
}