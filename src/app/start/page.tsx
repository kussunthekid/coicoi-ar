'use client';

import { useRouter } from 'next/navigation';
import { Camera, Hand, QrCode } from 'lucide-react';

export default function StartPage() {
  const router = useRouter();

  const handleStart = () => {
    router.push('/ar');
  };

  const handleHandTracking = () => {
    router.push('/hands');
  };

  const handleMarkerAR = () => {
    router.push('/marker');
  };


  return (
    <div className="min-h-screen bg-gradient-to-br from-green-500 via-blue-500 to-teal-500 overflow-y-auto overflow-x-hidden relative">
      <div className="container mx-auto px-4 py-8 min-h-screen flex flex-col justify-center relative z-10">
        <div className="text-center flex-grow flex flex-col justify-center">
          {/* ロゴエリア */}
          <div className="mb-8 md:mb-12">
            <h1 className="text-4xl sm:text-5xl md:text-6xl lg:text-8xl font-bold text-white mb-4 tracking-wider drop-shadow-2xl">
              COICOIフェス AR
            </h1>
            <p className="text-lg sm:text-xl md:text-2xl text-white/90 font-light">
              ARで特別な瞬間を撮影しよう
            </p>
          </div>

          {/* ボタンエリア - レスポンシブグリッド */}
          <div className="max-w-4xl mx-auto">
            {/* 縦画面: 1列、横画面: 2列 */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 md:gap-8">
              {/* メインARカメラボタン - 横画面では2列にスパン */}
              <button
                type="button"
                onClick={handleStart}
                className="group relative lg:col-span-2 w-full px-6 py-6 bg-white/20 backdrop-blur-xl rounded-3xl border-2 border-white/30 transition-all duration-300 hover:scale-105 hover:bg-white/30 active:scale-95"
              >
                <div className="flex items-center justify-center gap-4">
                  <Camera className="w-8 h-8 text-white drop-shadow-lg group-hover:rotate-12 transition-transform duration-300 flex-shrink-0" />
                  <div className="text-center">
                    <p className="text-lg sm:text-xl font-bold text-white drop-shadow-lg">
                      coicoi＆wkwkと写真を撮ろう
                    </p>
                    <p className="text-sm text-white/80 mt-1">
                      タップしてARカメラを起動
                    </p>
                  </div>
                </div>
                
                {/* 光るエフェクト */}
                <div className="absolute inset-0 rounded-3xl bg-gradient-to-r from-transparent via-white/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none animate-pulse" />
              </button>

              {/* 手追跡ボタン */}
              <button
                type="button"
                onClick={handleHandTracking}
                className="group relative w-full px-6 py-6 bg-green-500/20 backdrop-blur-xl rounded-3xl border-2 border-green-300/30 transition-all duration-300 hover:scale-105 hover:bg-green-500/30 active:scale-95"
              >
                <div className="flex items-center justify-center gap-4">
                  <Hand className="w-8 h-8 text-white drop-shadow-lg group-hover:rotate-12 transition-transform duration-300 flex-shrink-0" />
                  <div className="text-center">
                    <p className="text-lg sm:text-xl font-bold text-white drop-shadow-lg">
                      手からwkwkを出そう！
                    </p>
                    <p className="text-sm text-white/80 mt-1">
                      AIでハンドトラッキング
                    </p>
                  </div>
                </div>
                
                {/* 光るエフェクト */}
                <div className="absolute inset-0 rounded-3xl bg-gradient-to-r from-transparent via-green-300/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none animate-pulse" />
              </button>

              {/* 画像認識ARボタン */}
              <button
                type="button"
                onClick={handleMarkerAR}
                className="group relative w-full px-6 py-6 bg-purple-500/20 backdrop-blur-xl rounded-3xl border-2 border-purple-300/30 transition-all duration-300 hover:scale-105 hover:bg-purple-500/30 active:scale-95"
              >
                <div className="flex items-center justify-center gap-4">
                  <QrCode className="w-8 h-8 text-white drop-shadow-lg group-hover:rotate-12 transition-transform duration-300 flex-shrink-0" />
                  <div className="text-center">
                    <p className="text-lg sm:text-xl font-bold text-white drop-shadow-lg">
                      画像認識でARを体験
                    </p>
                    <p className="text-sm text-white/80 mt-1">
                      画像を認識してARモデルを表示
                    </p>
                  </div>
                </div>
                
                {/* 光るエフェクト */}
                <div className="absolute inset-0 rounded-3xl bg-gradient-to-r from-transparent via-purple-300/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none animate-pulse" />
              </button>
            </div>
          </div>

          {/* 装飾的な要素 */}
          <div className="mt-8 md:mt-16 flex justify-center gap-2">
            <div className="w-2 h-2 bg-white/40 rounded-full animate-bounce" style={{ animationDelay: '0s' }} />
            <div className="w-2 h-2 bg-white/40 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }} />
            <div className="w-2 h-2 bg-white/40 rounded-full animate-bounce" style={{ animationDelay: '0.4s' }} />
          </div>
        </div>
      </div>

      {/* 背景の装飾的な円 */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-green-400/20 rounded-full blur-3xl animate-pulse" />
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-blue-400/20 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }} />
        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-teal-400/10 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '2s' }} />
      </div>
    </div>
  );
}