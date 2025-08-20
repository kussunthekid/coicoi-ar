'use client';

import React, { useEffect, useRef, useState } from 'react';
import { ArrowLeft, Camera, RotateCcw } from 'lucide-react';

declare global {
  interface Window {
    MINDAR: any;
    AFRAME: any;
  }
}

interface MarkerConfig {
  mindFile: string;
  modelFile: string;
  modelName: string;
}

const MarkerARFrame = () => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isInitialized, setIsInitialized] = useState(false);
  const [isStarted, setIsStarted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedMarker, setSelectedMarker] = useState<'coicoi' | 'wkwk'>('coicoi');

  const markerConfigs: Record<string, MarkerConfig> = {
    coicoi: {
      mindFile: '/targets.mind',
      modelFile: '/coicoi.glb',
      modelName: 'coicoi画像'
    },
    wkwk: {
      mindFile: '/targets.mind',
      modelFile: '/wkwk.glb',
      modelName: 'wkwk画像'
    }
  };

  useEffect(() => {
    const loadMindAR = async () => {
      try {
        if (!window.MINDAR || !window.AFRAME) {
          console.log('Loading MindAR and A-Frame libraries...');
          
          const scripts = [
            'https://aframe.io/releases/1.3.0/aframe.min.js',
            'https://cdn.jsdelivr.net/npm/mind-ar@1.2.5/dist/mindar-image-aframe.prod.js'
          ];

          for (const src of scripts) {
            await new Promise<void>((resolve, reject) => {
              const script = document.createElement('script');
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
        }
        
        setIsInitialized(true);
      } catch (err) {
        console.error('Failed to load libraries:', err);
        setError('ARライブラリの読み込みに失敗しました。');
      }
    };

    loadMindAR();
  }, []);

  const initializeAR = async () => {
    if (!containerRef.current) {
      setError('コンテナが見つかりません');
      return;
    }

    try {
      console.log('Starting AR initialization...');
      
      // Request camera permission first
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ 
          video: { 
            facingMode: 'environment',
            width: { ideal: 1920 },
            height: { ideal: 1080 }
          } 
        });
        console.log('Camera permission granted');
        // Stop the stream as MindAR will handle it
        stream.getTracks().forEach(track => track.stop());
      } catch (cameraErr) {
        console.error('Camera permission error:', cameraErr);
        setError('カメラへのアクセスが拒否されました。ブラウザの設定でカメラの使用を許可してください。');
        return;
      }
      
      const config = markerConfigs[selectedMarker];
      const targetIndex = selectedMarker === 'coicoi' ? 0 : 1;
      console.log('Using marker config:', config, 'Target index:', targetIndex);

      // Add global styles to force fullscreen
      const styleElement = document.createElement('style');
      styleElement.setAttribute('data-mindar-fullscreen', 'true');
      styleElement.textContent = `
        html, body {
          margin: 0 !important;
          padding: 0 !important;
          overflow: hidden !important;
          width: 100% !important;
          height: 100% !important;
        }
        .mindar-ui-overlay {
          position: fixed !important;
          top: 0 !important;
          left: 0 !important;
          width: 100% !important;
          height: 100% !important;
        }
        .mindar-ui-scanning {
          width: 100% !important;
          height: 100% !important;
        }
        a-scene {
          position: fixed !important;
          top: 0 !important;
          left: 0 !important;
          width: 100vw !important;
          height: 100vh !important;
          display: block !important;
          margin: 0 !important;
          padding: 0 !important;
        }
        a-scene canvas {
          position: fixed !important;
          top: 0 !important;
          left: 0 !important;
          width: 100% !important;
          height: 100% !important;
          display: block !important;
        }
        video {
          position: fixed !important;
          top: 0 !important;
          left: 0 !important;
          width: 100% !important;
          height: 100% !important;
          object-fit: cover !important;
        }
      `;
      document.head.appendChild(styleElement);

      // Create A-Frame scene HTML
      const sceneHTML = `
        <a-scene
          mindar-image="imageTargetSrc: /targets.mind; maxTrack: 2; showStats: false; uiLoading: yes; uiScanning: yes; uiError: yes; filterMinCF: 0.00001; filterBeta: 10000; warmupTolerance: 5; missTolerance: 5;"
          color-space="sRGB"
          renderer="colorManagement: true, physicallyCorrectLights"
          vr-mode-ui="enabled: false"
          device-orientation-permission-ui="enabled: false"
          embedded
          style="display: block; width: 100%; height: 100%;"
        >
          <a-camera
            position="0 0 0"
            look-controls="enabled: false"
            cursor="fuse: false; rayOrigin: mouse"
            raycaster="far: 10000; objects: .clickable"
          ></a-camera>
          
          <!-- Coicoi用アンカー (index 0) -->
          <a-anchor mindar-image-target="targetIndex: 0">
            <a-box 
              position="0 0.5 0" 
              material="color: red;" 
              scale="0.5 0.5 0.5"
              visible="true"
            ></a-box>
            <a-gltf-model
              src="/coicoi.glb"
              position="0 0 0"
              rotation="0 0 0"
              scale="1 1 1"
              animation-mixer=""
              visible="true"
            ></a-gltf-model>
          </a-anchor>
          
          <!-- WKWK用アンカー (index 1) -->
          <a-anchor mindar-image-target="targetIndex: 1">
            <a-box 
              position="0 0.5 0" 
              material="color: yellow;" 
              scale="0.5 0.5 0.5"
              visible="true"
            ></a-box>
            <a-gltf-model
              src="/wkwk.glb"
              position="0 0 0"
              rotation="0 0 0"
              scale="1 1 1"
              animation-mixer=""
              visible="true"
            ></a-gltf-model>
          </a-anchor>
          
          <a-light type="ambient" color="#ffffff" intensity="0.6"></a-light>
          <a-light type="directional" position="0 1 1" intensity="0.8"></a-light>
        </a-scene>
      `;

      containerRef.current.innerHTML = sceneHTML;
      
      // Wait for scene to initialize
      await new Promise<void>((resolve) => {
        const scene = containerRef.current?.querySelector('a-scene');
        if (scene) {
          // Force scene to fullscreen immediately
          scene.style.cssText = 'position: fixed !important; top: 0 !important; left: 0 !important; width: 100vw !important; height: 100vh !important; display: block !important; margin: 0 !important; padding: 0 !important;';
          
          scene.addEventListener('loaded', () => {
            console.log('A-Frame scene loaded successfully');
            
            // Add event listeners for image tracking
            const anchors = scene.querySelectorAll('a-anchor');
            console.log(`Found ${anchors.length} anchor(s) in scene`);
            
            anchors.forEach((anchor, index) => {
              anchor.addEventListener('targetFound', () => {
                console.log(`🎯 Target ${index} found! Showing 3D model...`);
                // Force visibility
                const model = anchor.querySelector('a-gltf-model');
                const box = anchor.querySelector('a-box');
                if (model) model.setAttribute('visible', 'true');
                if (box) box.setAttribute('visible', 'true');
              });
              
              anchor.addEventListener('targetLost', () => {
                console.log(`❌ Target ${index} lost!`);
              });
            });
            
            // Listen for MindAR events
            scene.addEventListener('arReady', () => {
              console.log('✅ MindAR is ready!');
            });
            
            scene.addEventListener('arError', (e) => {
              console.error('❌ MindAR error:', e);
            });
            
            // Force all canvases to fullscreen
            const canvases = scene.querySelectorAll('canvas');
            canvases.forEach((canvas: any) => {
              canvas.style.cssText = 'position: fixed !important; top: 0 !important; left: 0 !important; width: 100% !important; height: 100% !important; display: block !important;';
            });
            
            // Force video elements to fullscreen
            const videos = document.querySelectorAll('video');
            videos.forEach((video: any) => {
              video.style.cssText = 'position: fixed !important; top: 0 !important; left: 0 !important; width: 100% !important; height: 100% !important; object-fit: cover !important;';
            });
            
            // Force MindAR UI elements to fullscreen
            const mindarUI = document.querySelectorAll('.mindar-ui-overlay, .mindar-ui-scanning');
            mindarUI.forEach((element: any) => {
              element.style.cssText = 'position: fixed !important; top: 0 !important; left: 0 !important; width: 100% !important; height: 100% !important;';
            });
            
            // Force resize to ensure proper dimensions
            window.dispatchEvent(new Event('resize'));
            setTimeout(() => window.dispatchEvent(new Event('resize')), 100);
            
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
      setError('AR初期化に失敗しました');
    }
  };

  const stopAR = () => {
    if (containerRef.current) {
      containerRef.current.innerHTML = '';
      // Remove the style element we added
      const styleElement = document.querySelector('style[data-mindar-fullscreen]');
      if (styleElement) {
        styleElement.remove();
      }
      setIsStarted(false);
    }
  };

  const resetAR = () => {
    stopAR();
    setTimeout(() => initializeAR(), 500);
  };

  return (
    <div className="fixed inset-0 bg-black overflow-hidden">
      {/* AR Container */}
      <div 
        ref={containerRef} 
        className="fixed inset-0"
        style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', margin: 0, padding: 0 }}
      />

      {/* UI Overlay */}
      <div className="absolute top-0 left-0 right-0 p-4 bg-gradient-to-b from-black/50 to-transparent z-10">
        <div className="flex items-center justify-between text-white">
          <button
            onClick={() => window.history.back()}
            className="flex items-center gap-2 px-4 py-2 bg-black/50 rounded-lg backdrop-blur-sm hover:bg-black/70 transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
            戻る
          </button>
          
          <h1 className="text-lg font-semibold">画像認識AR</h1>
          
          <button
            onClick={resetAR}
            disabled={!isStarted}
            className="flex items-center gap-2 px-4 py-2 bg-black/50 rounded-lg backdrop-blur-sm hover:bg-black/70 transition-colors disabled:opacity-50"
          >
            <RotateCcw className="w-5 h-5" />
            リセット
          </button>
        </div>
      </div>

      {/* Instructions */}
      <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black/70 to-transparent z-10">
        <div className="text-white text-center space-y-2">
          <p className="text-sm opacity-90">
            認識させたい画像をカメラに向けてください
          </p>
          <div className="flex justify-center space-x-4 text-xs">
            <span className="bg-black/50 px-3 py-1 rounded">
              {selectedMarker === 'coicoi' ? 'coicoi画像' : 'wkwk画像'}を認識中
            </span>
          </div>
        </div>
      </div>

      {/* Start Button */}
      {isInitialized && !isStarted && !error && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/80 z-20">
          <div className="text-white text-center">
            <h2 className="text-xl font-semibold mb-4">認識する画像を選択</h2>
            <div className="flex gap-4 mb-6">
              <button
                onClick={() => setSelectedMarker('coicoi')}
                className={`px-6 py-3 rounded-lg transition-colors ${
                  selectedMarker === 'coicoi' 
                    ? 'bg-cyan-600 text-white' 
                    : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                }`}
              >
                coicoi画像
              </button>
              <button
                onClick={() => setSelectedMarker('wkwk')}
                className={`px-6 py-3 rounded-lg transition-colors ${
                  selectedMarker === 'wkwk' 
                    ? 'bg-purple-600 text-white' 
                    : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                }`}
              >
                wkwk画像
              </button>
            </div>
            <button
              onClick={initializeAR}
              className="flex items-center gap-3 px-8 py-4 bg-green-600 hover:bg-green-700 text-white rounded-lg text-lg font-semibold transition-colors mx-auto"
            >
              <Camera className="w-6 h-6" />
              ARを開始
            </button>
          </div>
        </div>
      )}

      {/* Loading State */}
      {!isInitialized && !error && (
        <div className="absolute inset-0 flex items-center justify-center bg-black z-20">
          <div className="text-white text-center">
            <div className="animate-spin w-8 h-8 border-2 border-cyan-600 border-t-transparent rounded-full mx-auto mb-4"></div>
            <p>ARライブラリを読み込み中...</p>
          </div>
        </div>
      )}

      {/* Error State */}
      {error && (
        <div className="absolute inset-0 flex items-center justify-center bg-black z-20">
          <div className="text-white text-center max-w-md mx-4">
            <div className="text-red-500 text-xl mb-4">⚠️</div>
            <h2 className="text-xl font-semibold mb-2">エラーが発生しました</h2>
            <p className="text-gray-300 mb-4">{error}</p>
            <button
              onClick={() => window.location.reload()}
              className="px-6 py-3 bg-cyan-600 hover:bg-cyan-700 text-white rounded-lg transition-colors"
            >
              再試行
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default MarkerARFrame;