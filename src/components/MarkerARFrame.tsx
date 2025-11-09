'use client';

import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ArrowLeft, Camera } from 'lucide-react';
import { useRouter } from 'next/navigation';

declare global {
  interface Window {
    MINDAR: any;
    AFRAME: any;
    __MARKER_AR_INITIALIZED__?: boolean;
  }
}

const MarkerARFrame = () => {
  const router = useRouter();
  const containerRef = useRef<HTMLDivElement>(null);
  const [isInitialized, setIsInitialized] = useState(false);
  const [isStarted, setIsStarted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isMounted, setIsMounted] = useState(false);
  const [detectedMarkers, setDetectedMarkers] = useState<{[key: number]: boolean}>({});
  const [showFlash, setShowFlash] = useState(false);

  useEffect(() => {
    setIsMounted(true);

    const loadMindAR = async () => {
      // React Strict Modeでの二重実行を防ぐ
      if (window.__MARKER_AR_INITIALIZED__) {
        console.log('Already initializing, skipping...');
        setIsInitialized(true);
        return;
      }
      window.__MARKER_AR_INITIALIZED__ = true;

      try {
        // 既存のA-Frameシーンを完全に削除
        const existingScenes = document.querySelectorAll('a-scene');
        if (existingScenes.length > 0) {
          console.log(`🗑️ Removing ${existingScenes.length} existing A-Frame scene(s)...`);
          existingScenes.forEach(scene => scene.remove());
          await new Promise(resolve => setTimeout(resolve, 100));
        }

        if (!window.MINDAR || !window.AFRAME) {
          console.log('Loading MindAR and A-Frame libraries...');

          const scripts = [
            { src: 'https://aframe.io/releases/1.5.0/aframe.min.js', id: 'aframe-script' },
            { src: 'https://cdn.jsdelivr.net/npm/mind-ar@1.2.5/dist/mindar-image-aframe.prod.js', id: 'mindar-script' }
          ];

          for (const { src, id } of scripts) {
            if (document.getElementById(id)) {
              console.log(`Script already loaded: ${src}`);
              continue;
            }

            await new Promise<void>((resolve, reject) => {
              const script = document.createElement('script');
              script.id = id;
              script.src = src;
              script.async = false;
              script.onload = () => {
                console.log(`Loaded: ${src}`);
                resolve();
              };
              script.onerror = () => {
                console.error(`Failed to load: ${src}`);
                reject(new Error(`Failed to load ${src}`));
              };
              document.head.appendChild(script);
            });
          }

          await new Promise(resolve => setTimeout(resolve, 500));
          console.log('All libraries loaded');
        } else {
          console.log('✅ MindAR and A-Frame already loaded');
        }

        setIsInitialized(true);
      } catch (err) {
        console.error('Failed to load libraries:', err);
        setError('ライブラリの読み込みに失敗しました');
      }
    };

    loadMindAR();

    return () => {
      // クリーンアップ: コンポーネントがアンマウントされる時に既存のシーンを削除
      const existingScenes = document.querySelectorAll('a-scene');
      existingScenes.forEach(scene => scene.remove());
      window.__MARKER_AR_INITIALIZED__ = false;
    };
  }, []);

  const initializeAR = async () => {
    if (!containerRef.current) return;

    try {
      console.log('Initializing AR...');

      // シンプルなa-sceneのHTML - ar-official.htmlと同じ構造
      const sceneHTML = `
        <a-scene mindar-image="imageTargetSrc: /targets/targets.mind;" color-space="sRGB" renderer="colorManagement: true, physicallyCorrectLights" vr-mode-ui="enabled: false" device-orientation-permission-ui="enabled: false">
          <a-assets>
            <a-asset-item id="wkwk-blue-model" src="/wkwk_blue.glb"></a-asset-item>
            <a-asset-item id="wkwk-gold-model" src="/wkwk_gold.glb"></a-asset-item>
            <a-asset-item id="wkwk-green-model" src="/wkwk_green.glb"></a-asset-item>
            <a-asset-item id="wkwk-pencil-model" src="/wkwk_pencil.glb"></a-asset-item>
            <a-asset-item id="wkwk-pink-model" src="/wkwk_pink.glb"></a-asset-item>
          </a-assets>

          <a-camera position="0 0 0" look-controls="enabled: false"></a-camera>

          <a-entity mindar-image-target="targetIndex: 0">
            <a-gltf-model rotation="0 0 0" position="0 0 0" scale="0.5 0.5 0.5" src="#wkwk-blue-model"></a-gltf-model>
          </a-entity>
          <a-entity mindar-image-target="targetIndex: 1">
            <a-gltf-model rotation="0 0 0" position="0 0 0" scale="0.5 0.5 0.5" src="#wkwk-gold-model"></a-gltf-model>
          </a-entity>
          <a-entity mindar-image-target="targetIndex: 2">
            <a-gltf-model rotation="0 0 0" position="0 0 0" scale="0.5 0.5 0.5" src="#wkwk-green-model"></a-gltf-model>
          </a-entity>
          <a-entity mindar-image-target="targetIndex: 3">
            <a-gltf-model rotation="0 0 0" position="0 0 0" scale="0.5 0.5 0.5" src="#wkwk-pencil-model"></a-gltf-model>
          </a-entity>
          <a-entity mindar-image-target="targetIndex: 4">
            <a-gltf-model rotation="0 0 0" position="0 0 0" scale="0.5 0.5 0.5" src="#wkwk-pink-model"></a-gltf-model>
          </a-entity>
        </a-scene>
      `;

      // A-Frame sceneをHTMLに追加
      containerRef.current.innerHTML = sceneHTML;

      // 少し待ってからイベントリスナーを設定
      await new Promise(resolve => setTimeout(resolve, 100));

      console.log('Checking for video element...');
      const video = document.querySelector('video');
      console.log('Video element found:', !!video);
      if (video) {
        console.log('Video details:', {
          width: video.videoWidth,
          height: video.videoHeight,
          readyState: video.readyState,
          paused: video.paused
        });
      }

      // シンプルなイベントリスナー
      await new Promise<void>((resolve) => {
        const scene = containerRef.current?.querySelector('a-scene');
        if (scene) {
          scene.addEventListener('loaded', () => {
            console.log('✅ A-Frame scene loaded');

            // ターゲット検出イベントリスナー
            const targets = scene.querySelectorAll('[mindar-image-target]');
            targets.forEach((target, index) => {
              target.addEventListener('targetFound', () => {
                const modelNames = ['wkwk_blue', 'wkwk_gold', 'wkwk_green', 'wkwk_pencil', 'wkwk_pink'];
                console.log(`🎯 Target ${index} (${modelNames[index]}) FOUND!`);
                setDetectedMarkers(prev => ({ ...prev, [index]: true }));
              });

              target.addEventListener('targetLost', () => {
                console.log(`❌ Target ${index} lost`);
                setDetectedMarkers(prev => ({ ...prev, [index]: false }));
              });
            });

            // カメラ確認
            setTimeout(() => {
              const videoCheck = document.querySelector('video');
              console.log('Video check after scene loaded:', !!videoCheck);
              if (videoCheck) {
                console.log('Video style:', videoCheck.style.cssText);
                console.log('Video display:', window.getComputedStyle(videoCheck).display);
                console.log('Video visibility:', window.getComputedStyle(videoCheck).visibility);
              }
            }, 1000);

            resolve();
          });
        } else {
          setTimeout(resolve, 1000);
        }
      });

      setIsStarted(true);
      console.log('AR initialized successfully');

    } catch (err) {
      console.error('AR initialization failed:', err);
      setError(`AR初期化に失敗しました: ${(err as Error).message || '不明なエラー'}`);
    }
  };

  const capturePhoto = async () => {
    setShowFlash(true);
    setTimeout(() => setShowFlash(false), 150);

    const video = document.querySelector('video');
    const scene = containerRef.current?.querySelector('a-scene');

    if (!video || !scene) {
      console.error('Required elements not found for photo capture');
      return;
    }

    const displayWidth = window.innerWidth;
    const displayHeight = window.innerHeight;

    const captureCanvas = document.createElement('canvas');
    const ctx = captureCanvas.getContext('2d');
    if (!ctx) return;

    captureCanvas.width = displayWidth;
    captureCanvas.height = displayHeight;

    // ビデオを描画
    ctx.drawImage(video, 0, 0, video.videoWidth, video.videoHeight, 0, 0, displayWidth, displayHeight);

    // 画像をダウンロード
    const imageData = captureCanvas.toDataURL('image/png');
    const link = document.createElement('a');
    link.download = `marker-ar-photo-${Date.now()}.png`;
    link.href = imageData;
    link.click();

    console.log('✅ Photo captured');
  };

  const handleBack = () => {
    router.replace('/start');
  };

  return (
    <div className="fixed inset-0 bg-black overflow-hidden">
      {/* AR Container */}
      <div
        ref={containerRef}
        className="fixed inset-0"
        style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', zIndex: 1 }}
      />

      {/* 戻るボタン */}
      {isMounted && typeof document !== 'undefined' && createPortal(
        <button
          type="button"
          onClick={handleBack}
          className="fixed bottom-6 left-6 w-16 h-16 rounded-full flex items-center justify-center backdrop-blur-md border-2 border-white/50 transition-all duration-200 active:scale-90 hover:scale-110"
          style={{
            zIndex: 2147483647,
            background: 'linear-gradient(135deg, rgba(75, 85, 99, 0.8), rgba(55, 65, 81, 0.6))',
            boxShadow: '0 12px 40px rgba(75, 85, 99, 0.6)',
          }}
          aria-label="戻る"
        >
          <ArrowLeft className="w-7 h-7 text-white" />
        </button>,
        document.body
      )}

      {/* カメラボタン */}
      {isMounted && typeof document !== 'undefined' && isStarted && createPortal(
        <div className="absolute left-1/2 transform -translate-x-1/2" style={{ bottom: '10%', zIndex: 2147483647 }}>
          <button
            type="button"
            onClick={capturePhoto}
            className="w-20 h-20 backdrop-blur-xl rounded-full flex items-center justify-center border-2 border-white/20 shadow-xl transition-all hover:scale-110 active:scale-95"
            title="写真を撮影"
            style={{
              background: 'linear-gradient(135deg, rgba(59, 130, 246, 0.8), rgba(34, 197, 94, 0.8))',
            }}
          >
            <Camera className="w-10 h-10 text-white" />
          </button>
        </div>,
        document.body
      )}

      {/* フラッシュエフェクト */}
      {showFlash && isMounted && typeof document !== 'undefined' && createPortal(
        <div className="fixed inset-0 bg-white pointer-events-none" style={{ zIndex: 2147483648 }} />,
        document.body
      )}

      {/* Start Button */}
      {isInitialized && !isStarted && !error && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/80" style={{ zIndex: 20 }}>
          <button
            type="button"
            onClick={initializeAR}
            className="flex items-center gap-3 px-8 py-4 bg-green-600 hover:bg-green-700 text-white rounded-lg text-lg font-semibold transition-colors"
          >
            <Camera className="w-6 h-6" />
            ARを開始
          </button>
        </div>
      )}

      {/* Loading State */}
      {!isInitialized && !error && (
        <div className="absolute inset-0 flex items-center justify-center bg-black" style={{ zIndex: 20 }}>
          <div className="text-white text-center">
            <div className="animate-spin w-8 h-8 border-2 border-cyan-600 border-t-transparent rounded-full mx-auto mb-4"></div>
            <p>ARライブラリを読み込み中...</p>
          </div>
        </div>
      )}

      {/* Error State */}
      {error && (
        <div className="absolute inset-0 flex items-center justify-center bg-black" style={{ zIndex: 20 }}>
          <div className="text-white text-center p-8">
            <p className="text-red-500 mb-4">{error}</p>
            <button
              type="button"
              onClick={handleBack}
              className="px-6 py-3 bg-gray-700 hover:bg-gray-600 text-white rounded-lg"
            >
              戻る
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default MarkerARFrame;
