'use client';

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { ArrowLeft, Camera, X } from 'lucide-react';
import { useRouter } from 'next/navigation';
import * as THREE from 'three';
import { GLTFLoader } from 'three-stdlib';

declare global {
  interface Window {
    MINDAR: any;
    AFRAME: any;
    Stats?: any;
    __MARKER_AR_INITIALIZED__?: boolean;
  }
}

interface MarkerConfig {
  mindFile: string;
  modelFile: string;
  modelName: string;
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
  const [collectedModels, setCollectedModels] = useState<string[]>(() => {
    // localStorageから収集済みモデルを読み込み
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('collectedARModels');
      return saved ? JSON.parse(saved) : [];
    }
    return [];
  });
  const [showGetMessage, setShowGetMessage] = useState(false);
  const [show3DViewer, setShow3DViewer] = useState<string | null>(null);
  
  // collectedModelsが変更されたらlocalStorageに保存
  useEffect(() => {
    if (typeof window !== 'undefined' && collectedModels.length > 0) {
      localStorage.setItem('collectedARModels', JSON.stringify(collectedModels));
    }
  }, [collectedModels]);
  
  
  const markerConfigs: Record<string, MarkerConfig> = {
    wkwk_gold: {
      mindFile: '/targets.mind',
      modelFile: '/wkwk_gold.glb',
      modelName: 'wkwk_gold画像'
    },
    wkwk_pink: {
      mindFile: '/targets.mind',
      modelFile: '/wkwk_pink.glb',
      modelName: 'wkwk_pink画像'
    },
    wkwk_green: {
      mindFile: '/targets.mind',
      modelFile: '/wkwk_green.glb',
      modelName: 'wkwk_green画像'
    },
    wkwk_pencil: {
      mindFile: '/targets.mind',
      modelFile: '/wkwk_pencil.glb',
      modelName: 'wkwk_pencil画像'
    },
    wkwk_blue: {
      mindFile: '/targets.mind',
      modelFile: '/wkwk_blue.glb',
      modelName: 'wkwk_blue画像'
    }
  };

  useEffect(() => {
    setIsMounted(true);

    const loadMindAR = async () => {
      // React Strict Modeでの二重実行を防ぐ
      if (window.__MARKER_AR_INITIALIZED__) {
        console.log('Already initializing, skipping...');
        return;
      }
      window.__MARKER_AR_INITIALIZED__ = true;

      try {
        // 既存のA-Frameシーンを完全に削除
        const existingScene = document.querySelector('a-scene');
        if (existingScene) {
          console.log('🗑️ Removing existing A-Frame scene...');
          existingScene.remove();
          await new Promise(resolve => setTimeout(resolve, 100));
        }

        if (!window.MINDAR || !window.AFRAME) {
          console.log('Loading MindAR and A-Frame libraries...');

          const scripts = [
            { src: 'https://aframe.io/releases/1.3.0/aframe.min.js', id: 'aframe-script' },
            { src: 'https://cdn.jsdelivr.net/npm/mind-ar@1.2.5/dist/mindar-image-aframe.prod.js', id: 'mindar-script' }
          ];

          for (const { src, id } of scripts) {
            // 既にスクリプトが読み込まれているかチェック
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

          // MindARとA-Frameのグローバルオブジェクトを確認
          console.log('MINDAR available:', !!window.MINDAR);
          console.log('AFRAME available:', !!window.AFRAME);
        } else {
          console.log('✅ MindAR and A-Frame already loaded');
        }

        // Statsオブジェクトが未定義の場合の対策
        if (window.AFRAME && !window.AFRAME.components.stats) {
          console.log('Adding dummy stats component');
          window.AFRAME.registerComponent('stats', {
            init: function() {
              // 何もしない空のstatsコンポーネント
            }
          });
        }

        // カスタムノイズエフェクトシェーダーを登録
        if (window.AFRAME && !window.AFRAME.shaders['noise-effect']) {
          window.AFRAME.registerShader('noise-effect', {
            schema: {
              timeMSec: {type: 'time', is: 'uniform'},
              intensity: {type: 'number', is: 'uniform', default: 0.5},
              speed: {type: 'number', is: 'uniform', default: 1.0},
              pattern: {type: 'number', is: 'uniform', default: 0}
            },
            vertexShader: `
                varying vec2 vUv;
                varying vec3 vPosition;
                void main() {
                  vUv = uv;
                  vPosition = position;
                  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
                }
              `,
              fragmentShader: `
                uniform float timeMSec;
                uniform float intensity;
                uniform float speed;
                uniform float pattern;
                varying vec2 vUv;
                varying vec3 vPosition;
                
                float random(vec2 st) {
                  return fract(sin(dot(st.xy, vec2(12.9898,78.233))) * 43758.5453123);
                }
                
                float noise(vec2 st) {
                  vec2 i = floor(st);
                  vec2 f = fract(st);
                  float a = random(i);
                  float b = random(i + vec2(1.0, 0.0));
                  float c = random(i + vec2(0.0, 1.0));
                  float d = random(i + vec2(1.0, 1.0));
                  vec2 u = f * f * (3.0 - 2.0 * f);
                  return mix(a, b, u.x) + (c - a)* u.y * (1.0 - u.x) + (d - b) * u.x * u.y;
                }
                
                void main() {
                  vec2 st = vUv * 10.0;
                  float time = timeMSec * 0.001 * speed;
                  
                  vec3 color = vec3(0.8, 0.9, 1.0); // ベースカラー
                  
                  if (pattern < 0.5) {
                    // ノイズパターン
                    float n = noise(st + time);
                    color += vec3(n * intensity);
                  } else if (pattern < 1.5) {
                    // ストライプパターン
                    float stripes = sin(st.x * 20.0 + time * 5.0) * 0.5 + 0.5;
                    color += vec3(stripes * intensity);
                  } else {
                    // グリッチエフェクト
                    float glitch = random(vec2(floor(st.x * 20.0), floor(time * 10.0)));
                    if (glitch > 0.8) {
                      color = vec3(1.0, 0.2, 0.2);
                    }
                  }
                  
                  gl_FragColor = vec4(color, 0.8);
                }
              `
          });
          console.log('Custom noise shader registered');
        }

        // A-FrameのStats表示を完全に無効化
        if (window.AFRAME && window.AFRAME.utils && window.AFRAME.utils.device) {
          // デバッグ用のstats表示を強制的に無効化
          const originalDevice = window.AFRAME.utils.device;
          if (originalDevice.checkHeadsetConnected) {
            console.log('Disabling A-Frame stats display');
          }
        }

        // グローバルなStats関数を無効化
        if (typeof window.Stats !== 'undefined') {
          console.log('Disabling global Stats function');
          window.Stats = function() {
            return {
              setMode: function() {},
              begin: function() {},
              end: function() {},
              update: function() {},
              domElement: document.createElement('div')
            };
          } as any;
        }

        // Three.jsのStats表示を無効化
        if (typeof (window as any).THREE !== 'undefined') {
          console.log('Disabling THREE.js Stats');
          const THREE = (window as any).THREE;
          if (THREE.Stats) {
            THREE.Stats = function() {
              return {
                setMode: function() {},
                begin: function() {},
                end: function() {},
                update: function() {},
                domElement: document.createElement('div')
              };
            };
          }
        }
        
        setIsInitialized(true);
      } catch (err) {
        console.error('Failed to load libraries:', err);
        setError('ARライブラリの読み込みに失敗しました。');
      }
    };

    // ページ非表示・ブラウザバック時のクリーンアップ
    const handlePageHide = async () => {
      console.log('🔄 Page hide detected, cleaning up AR...');
      await stopAR();
    };

    const handleVisibilityChange = () => {
      if (document.hidden) {
        console.log('🔄 Page became hidden, cleaning up AR...');
        stopAR().catch(err => console.error('Error in visibility change handler:', err));
      }
    };

    const handleBeforeUnload = () => {
      console.log('🔄 Page unloading, cleaning up AR...');
      stopAR().catch(err => console.error('Error in beforeunload handler:', err));
    };

    const handlePopstate = () => {
      console.log('🔄 Browser back detected, cleaning up AR...');
      stopAR().catch(err => console.error('Error in popstate handler:', err));
    };

    // イベントリスナーを登録
    window.addEventListener('pagehide', handlePageHide);
    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('beforeunload', handleBeforeUnload);
    window.addEventListener('popstate', handlePopstate);

    loadMindAR();

    // クリーンアップ関数 - コンポーネントのアンマウント時に必ず実行
    return () => {
      console.log('MarkerARFrame component unmounting, cleaning up...');
      setIsMounted(false);

      // イベントリスナーを削除
      window.removeEventListener('pagehide', handlePageHide);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('beforeunload', handleBeforeUnload);
      window.removeEventListener('popstate', handlePopstate);

      // グローバルフラグをリセット
      window.__MARKER_AR_INITIALIZED__ = false;

      // 非同期で停止処理を実行
      (async () => {
        await stopAR();

        // 既存のシーンを削除
        const existingScene = document.querySelector('a-scene');
        if (existingScene) {
          console.log('🗑️ Removing A-Frame scene during cleanup...');
          existingScene.remove();
        }
      })();
    };
  }, []);

  const initializeAR = async () => {
    console.log('=== initializeAR called ===');
    console.log('containerRef.current:', containerRef.current);

    if (!containerRef.current) {
      console.error('Container ref is null');
      setError('コンテナが見つかりません');
      return;
    }

    try {
      console.log('Starting AR initialization...');
      console.log('Navigator.mediaDevices available:', !!navigator.mediaDevices);
      console.log('getUserMedia available:', !!navigator.mediaDevices?.getUserMedia);

      // カメラ権限を事前に要求
      console.log('Requesting camera permission...');
      try {
        // モバイル端末に適したカメラアクセスを試す
        console.log('Calling getUserMedia...');
        const stream = await navigator.mediaDevices.getUserMedia({ 
          video: { 
            facingMode: { ideal: 'environment' },
            width: { ideal: window.innerWidth, min: 320 },
            height: { ideal: window.innerHeight, min: 240 },
            frameRate: { ideal: 30, min: 15 }
          },
          audio: false
        });
        console.log('✅ Camera permission granted, stream:', stream);
        console.log('Camera tracks:', stream.getTracks().map(track => ({ 
          kind: track.kind, 
          label: track.label,
          enabled: track.enabled,
          ready: track.readyState 
        })));
        // ストリームを停止（MindARが再度開く）
        stream.getTracks().forEach(track => track.stop());
      } catch (err) {
        console.error('Camera permission denied:', err);
        console.error('Error name:', (err as Error).name);
        console.error('Error message:', (err as Error).message);
        
        // より詳細なエラーメッセージ
        let errorMessage = 'カメラへのアクセスが拒否されました。';
        if ((err as Error).name === 'NotAllowedError') {
          errorMessage += 'ブラウザでカメラの使用を許可してください。';
        } else if ((err as Error).name === 'NotFoundError') {
          errorMessage += 'カメラが見つかりません。';
        } else if ((err as Error).name === 'NotReadableError') {
          errorMessage += 'カメラが他のアプリで使用中です。';
        }
        
        setError(errorMessage);
        return;
      }
      
      console.log('Starting AR initialization with both targets');
      
      console.log('Checking targets.mind file...');
      // targets.mindファイルの存在確認
      try {
        const response = await fetch('/targets.mind');
        if (!response.ok) {
          throw new Error(`targets.mind not found: ${response.status}`);
        }
        console.log('✅ targets.mind file found');
      } catch (err) {
        console.error('targets.mind check failed:', err);
        setError('ターゲットファイルが見つかりません');
        return;
      }

      // Add global styles to force fullscreen and hide MindAR UI
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
        /* 標準 UI は完全に隠す - より強力な設定 */
        .mindar-ui-overlay,
        .mindar-ui-scanning,
        .mindar-ui-loading,
        .mindar-ui-compatibility,
        .mindar-ui-control,
        [class*="mindar-ui-"],
        [class*="mindar-ui"] {
          display: none !important;
          visibility: hidden !important;
          opacity: 0 !important;
          pointer-events: none !important;
          position: absolute !important;
          top: -9999px !important;
          left: -9999px !important;
          width: 0 !important;
          height: 0 !important;
        }
        
        /* MindARが生成する可能性のあるスキャナー要素も隠す */
        div[style*="position: fixed"][style*="border"],
        div[style*="position: absolute"][style*="border"],
        div[style*="white"],
        div[style*="rgb(255, 255, 255)"] {
          display: none !important;
        }
        
        /* スマホでのフレームレート表示のみを隠す（カメラ映像は除外） */
        #stats,
        .stats,
        div[id*="stats"],
        div[class*="stats"] {
          display: none !important;
          visibility: hidden !important;
          opacity: 0 !important;
        }
        
        /* モバイルでのフレームレート表示のみを特定して非表示（カメラビデオは除外） */
        @media (max-width: 768px) {
          /* statsに関連する小さいサイズの要素のみを非表示 */
          div[style*="position: fixed"][style*="width: 80px"],
          div[style*="position: fixed"][style*="height: 48px"],
          div[style*="position: absolute"][style*="width: 80px"],
          div[style*="position: absolute"][style*="height: 48px"] {
            display: none !important;
          }
        }
        
        /* Three.jsとA-Frame statsの強制非表示 */
        [class*="stats"], [id*="stats"], .stats-panel, #stats-panel,
        div[style*="font-family: monospace"][style*="position: fixed"],
        div[style*="font-family: monospace"][style*="position: absolute"],
        div[style*="background: rgb(0"][style*="position: fixed"],
        div[style*="background: rgba(0"][style*="position: fixed"],
        div[style*="z-index: 9999"][style*="position: fixed"] {
          display: none !important;
          visibility: hidden !important;
          opacity: 0 !important;
          pointer-events: none !important;
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
          z-index: 1 !important;
        }
        a-scene canvas {
          position: fixed !important;
          top: 0 !important;
          left: 0 !important;
          width: 100% !important;
          height: 100% !important;
          display: block !important;
          z-index: 1 !important;
          pointer-events: none !important;
        }
        video {
          position: fixed !important;
          top: 0 !important;
          left: 0 !important;
          width: 100vw !important;
          height: 100vh !important;
          object-fit: cover !important;
          pointer-events: none !important;
          z-index: 0 !important;
          display: block !important;
          visibility: visible !important;
        }
      `;
      document.head.appendChild(styleElement);


      // targets.mindファイルの存在確認
      console.log('🔍 Checking if /targets.mind exists...');
      try {
        const response = await fetch('/targets.mind', { method: 'HEAD' });
        console.log('✅ targets.mind HEAD response:', response.status, response.statusText);
        if (!response.ok) {
          console.error('❌ targets.mind file not accessible:', response.status);
        }
      } catch (e) {
        console.error('❌ Error checking targets.mind:', e);
      }

      // Create A-Frame scene HTML - テスト用に公式サンプルのtargets.mindを使用
      const sceneHTML = `
        <a-scene
          mindar-image="imageTargetSrc: https://cdn.jsdelivr.net/gh/hiukim/mind-ar-js@1.2.5/examples/image-tracking/assets/card-example/card.mind; autoStart: no; uiScanning: no; uiLoading: no; uiError: no; showStats: false; maxTrack: 5; filterMinCF: 0.001; filterBeta: 0.001; warmupTolerance: 5; missTolerance: 5;"
          color-space="sRGB"
          renderer="colorManagement: true; antialias: true; preserveDrawingBuffer: true; outputColorSpace: srgb; physicallyCorrectLights: true; toneMapping: ACESFilmic; toneMappingExposure: 1.2"
          vr-mode-ui="enabled: false"
          device-orientation-permission-ui="enabled: false"
          stats="false"
          debug="false"
          inspector="false"
          style="display: block; width: 100vw; height: 100vh;"
        >
          <a-assets>
            <a-asset-item id="wkwk-gold-model" src="/wkwk_gold.glb"></a-asset-item>
            <a-asset-item id="wkwk-pink-model" src="/wkwk_pink.glb"></a-asset-item>
            <a-asset-item id="wkwk-green-model" src="/wkwk_green.glb"></a-asset-item>
            <a-asset-item id="wkwk-pencil-model" src="/wkwk_pencil.glb"></a-asset-item>
            <a-asset-item id="wkwk-blue-model" src="/wkwk_blue.glb"></a-asset-item>
          </a-assets>

          <!-- ライティング設定 - 金属質感のために複数の光源を配置 -->
          <a-light type="ambient" intensity="0.8" color="#ffffff"></a-light>
          <a-light type="directional" intensity="1.2" position="1 1 1" color="#ffffff"></a-light>
          <a-light type="directional" intensity="0.8" position="-1 1 -1" color="#ffffff"></a-light>
          <a-light type="hemisphere" intensity="0.6" color="#ffffff" groundColor="#888888"></a-light>

          <a-camera position="0 0 0" look-controls="enabled: false"></a-camera>

          <!-- WKWK Blue用 (index 0 - アルファベット順) -->
          <a-entity mindar-image-target="targetIndex: 0">
            <a-gltf-model rotation="0 0 0" position="0 0 0" scale="0.5 0.5 0.5" src="#wkwk-blue-model" animation-mixer></a-gltf-model>
          </a-entity>

          <!-- WKWK Gold用 (index 1 - アルファベット順) -->
          <a-entity mindar-image-target="targetIndex: 1">
            <a-gltf-model rotation="0 0 0" position="0 0 0" scale="0.5 0.5 0.5" src="#wkwk-gold-model" animation-mixer></a-gltf-model>
          </a-entity>

          <!-- WKWK Green用 (index 2 - アルファベット順) -->
          <a-entity mindar-image-target="targetIndex: 2">
            <a-gltf-model rotation="0 0 0" position="0 0 0" scale="0.5 0.5 0.5" src="#wkwk-green-model" animation-mixer></a-gltf-model>
          </a-entity>

          <!-- WKWK Pencil用 (index 3 - アルファベット順) -->
          <a-entity mindar-image-target="targetIndex: 3">
            <a-gltf-model rotation="0 0 0" position="0 0 0" scale="0.5 0.5 0.5" src="#wkwk-pencil-model" animation-mixer></a-gltf-model>
          </a-entity>

          <!-- WKWK Pink用 (index 4 - アルファベット順) -->
          <a-entity mindar-image-target="targetIndex: 4">
            <a-gltf-model rotation="0 0 0" position="0 0 0" scale="0.5 0.5 0.5" src="#wkwk-pink-model" animation-mixer></a-gltf-model>
          </a-entity>

          <!-- 強化されたライティング設定 -->
          <a-light type="ambient" color="#ffffff" intensity="1.5"></a-light>
          <a-light type="directional" position="1 1 1" intensity="1.2" castShadow="false"></a-light>
          <a-light type="directional" position="-1 1 -1" intensity="0.8" castShadow="false"></a-light>
          <a-light type="directional" position="0 -1 0" intensity="0.6" castShadow="false"></a-light>
          <a-light type="hemisphere" color="#ffffff" groundColor="#888888" intensity="1.0"></a-light>
        </a-scene>
      `;

      // A-Frame sceneをHTMLに追加
      containerRef.current.innerHTML = sceneHTML;
      
      // Wait for scene to initialize
      await new Promise<void>((resolve) => {
        const scene = containerRef.current?.querySelector('a-scene');
        if (scene) {
          console.log('Setting up A-Frame scene...');
          
          scene.addEventListener('loaded', () => {
            console.log('✅ A-Frame scene loaded successfully');
            console.log('Scene element:', scene);
            console.log('Scene innerHTML preview:', scene.innerHTML.substring(0, 200));
            
            
            // Test basic A-Frame rendering
            const testBox = scene.querySelector('a-box');
            console.log('Test box found:', testBox);
            
            // Add event listeners for image tracking - 公式例に基づく正しいセレクタ
            const targets = scene.querySelectorAll('[mindar-image-target]');
            console.log(`Found ${targets.length} target(s) in scene`);
            
            targets.forEach((target, index) => {
              const anchor = target;
              console.log(`Setting up anchor ${index}:`, anchor);
              
              // GLTFモデルのロードイベントを監視
              const model = anchor.querySelector('a-gltf-model');
              if (model) {
                console.log(`Found GLTF model ${index}:`, model.getAttribute('src'));
                console.log(`Model ${index} element:`, model);
                console.log(`Model ${index} attributes:`, Array.from(model.attributes).map(attr => `${attr.name}="${attr.value}"`));
                
                // Test GLB file accessibility
                const modelSrc = model.getAttribute('src');
                fetch(modelSrc || '')
                  .then(response => {
                    if (response.ok) {
                      console.log(`✅ GLB file ${modelSrc} is accessible (status: ${response.status})`);
                      return response.blob();
                    } else {
                      throw new Error(`HTTP ${response.status}`);
                    }
                  })
                  .then(blob => {
                    console.log(`✅ GLB file ${modelSrc} downloaded successfully, size: ${blob.size} bytes`);
                  })
                  .catch(err => {
                    console.error(`❌ GLB file ${modelSrc} fetch failed:`, err);
                  });
                
                model.addEventListener('model-loaded', (e) => {
                  console.log(`🎉 GLTF Model ${index} LOADED successfully from ${model.getAttribute('src')}`);
                  console.log(`Model ${index} loaded event:`, e);
                  // A-Frameのentityエレメントから3Dオブジェクトを取得
                  const entity = model as any;
                  if (entity.object3D) {
                    console.log(`✅ Model ${index} object3D available:`, entity.object3D);
                    console.log(`Model ${index} children count:`, entity.object3D.children.length);

                    // 軽量なDataTextureで環境マップを作成
                    try {
                      const sceneEl = document.querySelector('a-scene') as any;
                      if (sceneEl && sceneEl.renderer) {
                        const renderer = sceneEl.renderer;

                        console.log(`🌍 Creating enhanced DataTexture environment map for model ${index}...`);

                        // 高解像度のグラデーション環境マップを作成
                        const width = 1024;
                        const height = 512;
                        const data = new Uint8Array(width * height * 4);

                        // 各ピクセルに色を設定（Equirectangular形式）
                        for (let y = 0; y < height; y++) {
                          for (let x = 0; x < width; x++) {
                            const i = (y * width + x) * 4;

                            // 縦方向の位置（0=上, 1=下）
                            const v = y / height;

                            // 上半分：明るい空（白→水色のグラデーション）
                            if (v < 0.5) {
                              const t = v / 0.5; // 0-1の範囲
                              // 上部：純白（255, 255, 255）
                              // 中部：明るい青空（200, 230, 255）
                              data[i] = 255 - t * 55;      // R: 255 → 200
                              data[i + 1] = 255 - t * 25;  // G: 255 → 230
                              data[i + 2] = 255;           // B: 255
                              data[i + 3] = 255;           // A
                            }
                            // 下半分：地面（グレー）
                            else {
                              const t = (v - 0.5) / 0.5; // 0-1の範囲
                              // 中部：明るいグレー（180, 180, 180）
                              // 下部：少し暗いグレー（120, 120, 120）
                              const gray = 180 - t * 60;
                              data[i] = gray;     // R
                              data[i + 1] = gray; // G
                              data[i + 2] = gray; // B
                              data[i + 3] = 255;  // A
                            }
                          }
                        }

                        const texture = new THREE.DataTexture(data, width, height, THREE.RGBAFormat);
                        texture.mapping = THREE.EquirectangularReflectionMapping;
                        texture.needsUpdate = true;

                        console.log(`✅ Enhanced DataTexture created (${width}x${height}) for model ${index}`);

                        // PMREMGeneratorで環境マップを生成
                        const pmremGenerator = new THREE.PMREMGenerator(renderer);
                        const envMap = pmremGenerator.fromEquirectangular(texture).texture;

                        console.log(`✅ PMREM environment map generated for model ${index}`);

                        // モデルの全マテリアルに環境マップを適用
                        entity.object3D.traverse((child: any) => {
                          if (child.isMesh) {
                            if (child.material) {
                              const material = child.material;

                              // マテリアルの基本設定を確認・修正
                              if (material.color) {
                                const isBlack = material.color.r === 0 && material.color.g === 0 && material.color.b === 0;
                                const isVeryDark = material.color.r < 0.1 && material.color.g < 0.1 && material.color.b < 0.1;

                                if (isBlack || isVeryDark) {
                                  // 黒いまたは非常に暗いマテリアルを白/ゴールドに修正
                                  if (index === 2) {
                                    // wkwk-goldの場合はゴールド色に
                                    material.color.setHex(0xFFD700);
                                    console.log(`🎨 Fixed black/dark material to gold color for model ${index}`);
                                  } else {
                                    material.color.setHex(0xFFFFFF);
                                    console.log(`🎨 Fixed black/dark material to white for model ${index}`);
                                  }
                                }
                              }

                              // wkwk-goldモデルの場合、追加の設定
                              if (index === 2) {
                                // 金属感を強調
                                if (material.metalness !== undefined) {
                                  material.metalness = Math.max(material.metalness, 0.9);
                                }
                                if (material.roughness !== undefined) {
                                  material.roughness = Math.min(material.roughness, 0.3);
                                }
                              }

                              material.envMap = envMap;

                              // 金属マテリアルの場合は非常に高い強度
                              if (material.metalness !== undefined && material.metalness > 0.5) {
                                material.envMapIntensity = 3.0;
                                console.log(`🌟 Metallic material detected, setting envMap intensity to 3.0`);
                              } else {
                                material.envMapIntensity = 1.5;
                              }

                              material.needsUpdate = true;

                              console.log(`Applied environment map to mesh ${child.name || 'unnamed'} (color: ${material.color ? material.color.getHexString() : 'N/A'}, metalness: ${material.metalness}, roughness: ${material.roughness}, envMapIntensity: ${material.envMapIntensity})`);
                            }
                          }
                        });

                        // クリーンアップ
                        texture.dispose();
                        pmremGenerator.dispose();

                        console.log(`✅ Environment map applied to model ${index}`);
                      }
                    } catch (envError) {
                      console.warn(`⚠️ Failed to apply environment map to model ${index}:`, envError);
                      // 環境マップの適用に失敗してもモデルは表示されるべき
                    }
                  }
                });
                
                model.addEventListener('model-error', (e) => {
                  console.error(`❌ GLTF Model ${index} FAILED to load from ${model.getAttribute('src')}:`);
                  console.error('Model error details:', e);
                });
                
                // Force model visibility and properties
                setTimeout(() => {
                  console.log(`Checking model ${index} status after 3 seconds...`);
                  const entity = model as any;

                  if (entity.object3D) {
                    console.log(`✅ Model ${index} has object3D:`, entity.object3D);
                    console.log(`Model ${index} visible:`, entity.object3D.visible);
                    console.log(`Model ${index} children:`, entity.object3D.children);

                    // Force visibility
                    entity.object3D.visible = true;
                    entity.setAttribute('visible', 'true');

                    // Check if model is actually loaded
                    if (entity.object3D.children.length > 0) {
                      console.log(`🎯 Model ${index} has ${entity.object3D.children.length} children - model should be visible!`);
                    } else {
                      console.warn(`⚠️ Model ${index} object3D has no children - model may not be loaded`);
                    }
                  } else {
                    console.warn(`❌ Model ${index} has no object3D after 3 seconds`);
                  }
                }, 3000);
              }
              
              // ターゲット認識イベントを監視
              anchor.addEventListener('targetFound', (event) => {
                const modelNames = ['wkwk_blue', 'wkwk_gold', 'wkwk_green', 'wkwk_pencil', 'wkwk_pink'];
                console.log(`🎯🎯🎯 Target ${index} (${modelNames[index]}) FOUND! Image recognized successfully!`);

                // マーカー検出状態を更新
                setDetectedMarkers(prev => ({ ...prev, [index]: true }));

                // モデルの状態を確認
                const model = anchor.querySelector('a-gltf-model');
                console.log(`📦 Checking model for target ${index}:`, model);
                if (model) {
                  const obj3D = (model as any).object3D;
                  console.log(`📦 Model object3D:`, obj3D);
                  console.log(`📦 Model visible:`, obj3D?.visible);
                  console.log(`📦 Model position:`, obj3D?.position);
                  console.log(`📦 Model scale:`, obj3D?.scale);
                  console.log(`📦 Model children count:`, obj3D?.children?.length);

                  // 親エンティティの状態も確認
                  const parentObj3D = (anchor as any).object3D;
                  console.log(`📦 Parent (anchor) visible:`, parentObj3D?.visible);
                  console.log(`📦 Parent (anchor) position:`, parentObj3D?.position);

                  // 強制的に表示
                  if (obj3D) {
                    obj3D.visible = true;
                    obj3D.traverse((child: any) => {
                      child.visible = true;
                    });
                    console.log(`✅ Forced model ${index} to be visible`);
                  }
                } else {
                  console.error(`❌ Model NOT FOUND for target ${index}!`);
                }
              });
              
              anchor.addEventListener('targetLost', () => {
                console.log(`❌ Target ${index} lost! With multi-track, model stays visible if still being tracked`);
                
                // マーカー検出状態を更新
                setDetectedMarkers(prev => ({ ...prev, [index]: false }));
                
                // マルチトラック対応：他のターゲットが追跡中でも、このターゲットが失われた場合のみ非表示
                const model = anchor.querySelector('a-gltf-model');
                if (model) {
                  // マルチトラック環境では、targetLostでも即座に非表示にしない
                  // MindARが自動的に管理するため、モデルの表示状態はそのまま
                  console.log(`Model ${index} visibility managed by MindAR multi-track system`);
                  
                  // 透明度を少し下げて「非アクティブ」状態を示すこともできる
                  // model.setAttribute('material', 'opacity: 0.7');
                }
                
                // デバッグ用の色変更
                const box = anchor.querySelector('a-box');
                const cylinder = anchor.querySelector('a-cylinder');
                const sphere = anchor.querySelector('a-sphere');
                
                if (box) {
                  box.setAttribute('material', index === 0 ? 'color: darkred' : 'color: orange');
                }
                if (cylinder) {
                  cylinder.setAttribute('material', 'color: darkcyan');
                }
                if (sphere) {
                  sphere.setAttribute('material', 'color: darkmagenta');
                }
              });
            });
            
            // MindARシステムの詳細な状態を監視
            console.log('⏳ Waiting for MindAR to initialize...');
            
            // MindARシステムを直接確認
            setTimeout(async () => {
              const mindarSystem = (scene as any).systems['mindar-image-system'];
              if (mindarSystem) {
                console.log('✅ MindAR system found:', mindarSystem);
                console.log('MindAR system initialized:', mindarSystem.el);
                console.log('MindAR system data:', mindarSystem.data);
              } else {
                console.error('❌ MindAR system NOT found!');
              }
            }, 2000);
            
            // Listen for MindAR events - より詳細な監視
            scene.addEventListener('arReady', () => {
              console.log('🎯🎯🎯 MindAR is READY! AR system initialized successfully!');
              
              // MindARの内部状態を確認
              const mindarSystem = (scene as any).systems['mindar-image-system'];
              if (mindarSystem) {
                console.log('🎯 MindAR system found:', mindarSystem);
                console.log('🎯 Multi-track configuration: maxTrack = 2 (simultaneous tracking enabled)');
                if (mindarSystem.controller) {
                  console.log('🎯 MindAR controller found:', mindarSystem.controller);
                  console.log('🎯 Max simultaneous targets:', mindarSystem.controller.maxTrack || 'unknown');
                  console.log('🎯 Current target count:', mindarSystem.controller.targetInfos?.length || 'unknown');

                  // ターゲット情報を詳しく表示
                  if (mindarSystem.controller.targetInfos) {
                    console.log('🎯 Target infos:', mindarSystem.controller.targetInfos);
                    mindarSystem.controller.targetInfos.forEach((targetInfo: any, idx: number) => {
                      console.log(`🎯 Target ${idx}: width=${targetInfo.width}, height=${targetInfo.height}, dpi=${targetInfo.dpi}`);
                    });
                  }
                } else {
                  console.log('🎯 MindAR controller not yet available, will check later');
                }
                
                // MindARのデフォルトUIとStatsを強制的に削除
                const removeMindARUI = () => {
                  // 全てのMindAR UI要素を検索して削除
                  const uiElements = document.querySelectorAll(
                    '.mindar-ui-overlay, .mindar-ui-scanning, .mindar-ui-loading, ' +
                    '.mindar-ui-compatibility, .mindar-ui-control, ' +
                    '[class*="mindar-ui"], [class*="mindar-ui-"], ' +
                    'div[style*="border: 4px solid white"], ' +
                    'div[style*="border: 4px solid rgb(255, 255, 255)"]'
                  );
                  
                  uiElements.forEach(el => {
                    console.log('Removing MindAR UI element:', el);
                    el.remove();
                  });
                  
                  // スマホでのStats要素のみを削除（カメラ映像を除外）
                  const statsElements = document.querySelectorAll(
                    '#stats, .stats, div[id*="stats"], div[class*="stats"]'
                  );
                  
                  statsElements.forEach(el => {
                    console.log('Removing Stats element:', el);
                    el.remove();
                  });
                  
                  // モバイル専用：フレームレート表示のみを削除（カメラビデオは保護）
                  const mobileStats = document.querySelectorAll('div');
                  mobileStats.forEach(div => {
                    const style = div.getAttribute('style');
                    const hasVideo = div.querySelector('video') !== null;
                    const isVideoContainer = div.tagName === 'VIDEO' || hasVideo;
                    
                    if (style && !isVideoContainer &&
                        style.includes('position: fixed') && 
                        style.includes('top: 0px') &&
                        style.includes('left: 0px') &&
                        (style.includes('width: 80px') || style.includes('height: 48px') || div.textContent?.includes('fps'))) {
                      console.log('Removing mobile stats element:', div);
                      div.remove();
                    }
                  });
                  
                  // インラインスタイルで白い枠線を持つ要素も削除
                  const allDivs = document.querySelectorAll('div');
                  allDivs.forEach(div => {
                    const style = div.getAttribute('style');
                    if (style && (style.includes('border') && (style.includes('white') || style.includes('255, 255, 255')))) {
                      // 戻るボタンは除外
                      if (!div.closest('[aria-label="戻る"]')) {
                        console.log('Removing div with white border:', div);
                        div.remove();
                      }
                    }
                  });
                };
                
                // 即座に実行
                removeMindARUI();
                
                // 遅延実行でも削除
                setTimeout(removeMindARUI, 100);
                setTimeout(removeMindARUI, 500);
                setTimeout(removeMindARUI, 1000);
                setTimeout(removeMindARUI, 3000);
                
                // スマホでのstats表示対策：定期的に削除処理を実行（カメラビデオは保護）
                const removeStatsInterval = setInterval(() => {
                  const mobileStatsCheck = document.querySelectorAll('div');
                  let found = false;
                  mobileStatsCheck.forEach(div => {
                    const hasVideo = div.querySelector('video') !== null;
                    const isVideoContainer = div.tagName === 'VIDEO' || hasVideo;
                    
                    if (!isVideoContainer && div.textContent && (div.textContent.includes('fps') || div.textContent.includes('ms') || div.textContent.includes('FPS'))) {
                      console.log('Removing periodic mobile stats:', div);
                      div.remove();
                      found = true;
                    }
                    
                    // スタイルベースでstats要素を検出
                    const style = div.getAttribute('style');
                    if (style && !isVideoContainer && 
                        (style.includes('position: fixed') || style.includes('position: absolute')) &&
                        (style.includes('top: 0') || style.includes('left: 0')) &&
                        (style.includes('z-index: 9999') || style.includes('font-family: monospace') || 
                         style.includes('background: rgb(0') || style.includes('background: rgba(0'))) {
                      console.log('Removing stats element by style:', div);
                      div.remove();
                      found = true;
                    }
                  });
                  
                  // Three.jsのstatsパネルも削除
                  const threeStatsElements = document.querySelectorAll('[class*="stats"], [id*="stats"], .stats-panel');
                  threeStatsElements.forEach(el => {
                    console.log('Removing Three.js stats element:', el);
                    el.remove();
                    found = true;
                  });
                  
                  if (!found) {
                    clearInterval(removeStatsInterval);
                  }
                }, 1000);
                
                // 10秒後にインターバルをクリア
                setTimeout(() => {
                  clearInterval(removeStatsInterval);
                }, 10000);
                
                
                // グローバルなターゲット検出イベントを追加（デバッグ用）
                scene.addEventListener('targetFound', (e: any) => {
                  console.log('🎯🎯🎯 GLOBAL TARGET FOUND EVENT:', e);
                  console.log('Target detail:', e.detail);
                });

                scene.addEventListener('targetLost', (e: any) => {
                  console.log('❌ GLOBAL TARGET LOST EVENT:', e);
                  console.log('Target detail:', e.detail);
                });

                // 手動でARシステムを開始
                if (mindarSystem.start) {
                  console.log('Starting MindAR system manually...');
                  console.log('mindarSystem.start type:', typeof mindarSystem.start);
                  try {
                    const startResult = mindarSystem.start();
                    console.log('✅ MindAR system start() called, result:', startResult);

                    // Promiseの場合とそうでない場合の両方に対応
                    const handleStartSuccess = () => {
                      console.log('✅ MindAR system started successfully');

                      // MindAR起動後、少し待ってからターゲット情報を再確認
                      setTimeout(() => {
                        console.log('🔍 Checking MindAR state after startup...');
                        const controller = mindarSystem.controller;
                        if (controller) {
                          console.log('🎯 Controller state:', controller);
                          console.log('🎯 Controller intTargets:', controller.intTargets);
                          console.log('🎯 Controller trackingStates:', controller.trackingStates);

                          if (controller.targetInfos && controller.targetInfos.length > 0) {
                            console.log(`✅ Found ${controller.targetInfos.length} targets in controller`);
                            controller.targetInfos.forEach((targetInfo: any, idx: number) => {
                              console.log(`🎯 Target ${idx}:`, targetInfo);
                            });

                            // フレームごとに追跡状態を監視
                            let frameCount = 0;
                            const monitorTracking = () => {
                              frameCount++;

                              // 30フレームごと（約1秒ごと）にログ出力
                              if (frameCount % 30 === 0) {
                                const states = controller.trackingStates;
                                if (states) {
                                  const activeTargets = states.filter((s: any) => s !== null);
                                  if (activeTargets.length > 0) {
                                    console.log(`📊 Frame ${frameCount}: ${activeTargets.length} target(s) detected!`, activeTargets);
                                  }
                                }
                              }

                              if (frameCount < 600) { // 20秒間監視
                                requestAnimationFrame(monitorTracking);
                              }
                            };

                            console.log('📊 Starting tracking state monitor for 20 seconds...');
                            requestAnimationFrame(monitorTracking);

                          } else {
                            console.warn('⚠️ No target infos found in controller!');
                            console.warn('This means targets.mind file may not be loaded correctly');
                          }
                        } else {
                          console.error('❌ Controller is still null after MindAR start');
                        }
                      }, 2000);
                    };

                    // Promiseかどうかチェック
                    if (startResult && typeof startResult.then === 'function') {
                      console.log('start() returned a Promise, waiting...');
                      startResult.then(handleStartSuccess).catch((err: Error) => {
                        console.error('❌ MindAR start promise rejected:', err);
                      });
                    } else {
                      // 同期的に完了
                      handleStartSuccess();
                    }

                  } catch (err) {
                    console.error('❌ MindAR start failed:', err);
                    console.error('Error details:', {
                      name: (err as Error).name,
                      message: (err as Error).message,
                      stack: (err as Error).stack
                    });
                    // リトライ機構
                    setTimeout(() => {
                      try {
                        if (mindarSystem.start) {
                          mindarSystem.start();
                          console.log('✅ MindAR start() called on retry');
                        }
                      } catch (retryErr) {
                        console.error('❌ MindAR start retry failed:', retryErr);
                      }
                    }, 1000);
                  }
                }
              }
              
              // すぐにカメラ要素を確認
              const video = document.querySelector('video');
              const canvas = document.querySelector('canvas');
              console.log('Initial check - Video:', !!video, 'Canvas:', !!canvas);
              
              // さらに詳細な確認を数秒後に
              setTimeout(() => {
                const videoElements = document.querySelectorAll('video');
                const canvasElements = document.querySelectorAll('canvas');
                console.log(`Found ${videoElements.length} video element(s)`);
                console.log(`Found ${canvasElements.length} canvas element(s)`);
                
                videoElements.forEach((video, index) => {
                  console.log(`Video ${index}:`, {
                    src: video.src || 'no src',
                    width: video.videoWidth || 0,
                    height: video.videoHeight || 0,
                    readyState: video.readyState,
                    paused: video.paused,
                    ended: video.ended,
                    playing: !video.paused && !video.ended && video.readyState > 2
                  });
                });
                
                // A-Frameのシステム情報
                if (window.AFRAME && window.AFRAME.scenes && window.AFRAME.scenes[0]) {
                  const aframeScene = window.AFRAME.scenes[0];
                  console.log('A-Frame scene systems:', Object.keys(aframeScene.systems));
                }
              }, 3000);
            });
            
            scene.addEventListener('arError', (e: any) => {
              console.error('❌ MindAR error:', e.detail || e);
              setError('カメラ初期化に失敗しました');
            });
            
            // Force pointer-events: none on canvases and videos
            const canvases = scene.querySelectorAll('canvas');
            canvases.forEach((canvas: any) => {
              canvas.style.pointerEvents = 'none';
            });
            
            const videos = document.querySelectorAll('video');
            videos.forEach((video: any) => {
              video.style.pointerEvents = 'none';
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

      // グローバル関数として stopAR を公開（カスタムUIから呼び出すため）
      (window as any).stopAR = stopAR;
      
      setIsStarted(true);
      console.log('AR initialized successfully');

    } catch (err) {
      console.error('AR initialization failed:', err);
      console.error('Error details:', {
        name: (err as Error).name,
        message: (err as Error).message,
        stack: (err as Error).stack
      });
      setError(`AR初期化に失敗しました: ${(err as Error).message || '不明なエラー'}`);
    }
  };

  const stopAR = useCallback(async () => {
    console.log('Stopping AR session...');

    try {
      // MindARシステムを適切に停止
      const scene = containerRef.current?.querySelector('a-scene');
      if (scene && (scene as any).systems && (scene as any).systems['mindar-image-system']) {
        console.log('Stopping MindAR system...');
        const mindarSystem = (scene as any).systems['mindar-image-system'];

        // stop()メソッドを呼び出し（nullチェックを追加）
        if (mindarSystem && typeof mindarSystem.stop === 'function' && mindarSystem.controller) {
          try {
            await mindarSystem.stop();
            console.log('MindAR system stopped');
          } catch (err) {
            console.warn('Error stopping MindAR (non-critical):', err);
            // エラーでも続行
          }
        }

        // pause()も呼び出して確実に停止（nullチェックを追加）
        if (mindarSystem && typeof mindarSystem.pause === 'function' && mindarSystem.controller) {
          try {
            mindarSystem.pause();
            console.log('MindAR system paused');
          } catch (err) {
            console.warn('Error pausing MindAR (non-critical):', err);
            // エラーでも続行
          }
        }
      }

      // ARコンテナ内のvideo要素のみを対象にして停止
      const containerVideos = containerRef.current?.querySelectorAll('video') || [];
      containerVideos.forEach(video => {
        console.log('Stopping AR video stream...');
        if (video.srcObject) {
          const stream = video.srcObject as MediaStream;
          // 各トラックを個別に停止
          stream.getTracks().forEach(track => {
            console.log(`Stopping ${track.kind} track...`);
            track.stop();
            track.enabled = false;
          });
          video.srcObject = null;
        }
        video.pause();
        video.src = '';
        video.load();
      });

      // グローバルに残留しているARカメラvideo要素を削除
      const globalVideos = document.querySelectorAll('video');
      globalVideos.forEach(video => {
        // ARカメラらしい特徴を持つvideo要素のみ削除
        if (video.autoplay && video.muted && video.playsInline &&
            (video.width > 100 || video.height > 100)) {
          console.log('Removing AR camera video element');
          if (video.srcObject) {
            const stream = video.srcObject as MediaStream;
            stream.getTracks().forEach(track => track.stop());
          }
          video.remove();
        }
      });

      // メディアデバイスの全ストリームを停止
      if (navigator.mediaDevices) {
        try {
          const devices = await navigator.mediaDevices.enumerateDevices();
          console.log('Found media devices:', devices.length);
        } catch (err) {
          console.error('Error enumerating devices:', err);
        }
      }

      // 先にvideo/canvas要素を処理してからコンテナを削除
      // A-Frameシーンを完全に削除
      if (containerRef.current) {
        // 先にイベントリスナーを削除
        const sceneEl = containerRef.current.querySelector('a-scene');
        if (sceneEl) {
          sceneEl.removeEventListener('loaded', () => {});
          sceneEl.removeEventListener('arReady', () => {});
          sceneEl.removeEventListener('arError', () => {});
        }
        // コンテナの内容を削除
        containerRef.current.innerHTML = '';
      }

      // 追加したスタイルを削除
      const styleElement = document.querySelector('style[data-mindar-fullscreen]');
      if (styleElement) {
        styleElement.remove();
      }


      // MindAR UIオーバーレイを強制削除
      const mindarOverlays = document.querySelectorAll('.mindar-ui-overlay, .mindar-ui-scanning, .mindar-ui-loading, .mindar-ui, .mindar-camera');
      mindarOverlays.forEach(overlay => {
        console.log('Removing MindAR UI element:', overlay.className);
        overlay.remove();
      });

      // A-Frame関連の要素をすべて削除
      const aframeElements = document.querySelectorAll('a-scene, a-assets, a-camera, a-entity');
      aframeElements.forEach(el => {
        console.log('Removing A-Frame element:', el.tagName);
        el.remove();
      });

      // MindARのスタイルとオーバーレイを強制削除
      const allElements = document.querySelectorAll('*');
      allElements.forEach(el => {
        if (el.classList.contains('mindar-ui-overlay') ||
            el.classList.contains('mindar-ui-scanning') ||
            el.classList.contains('mindar-ui-loading') ||
            ((el as HTMLElement).style.position === 'fixed' && (el as HTMLElement).style.zIndex === '10000')) {
          console.log('Force removing MindAR overlay:', el);
          el.remove();
        }
      });

      // 残留するcanvas要素を削除
      const canvasElements = document.querySelectorAll('canvas');
      canvasElements.forEach(canvas => {
        if (canvas.width > 100 && canvas.height > 100) { // ARカメラのcanvasを想定
          console.log('Removing AR canvas element');
          canvas.remove();
        }
      });

      // body/htmlスタイルをリセット
      document.body.style.cssText = '';
      document.documentElement.style.cssText = '';

      setIsStarted(false);
      console.log('AR session stopped successfully');

    } catch (error) {
      console.error('Error stopping AR:', error);
      setIsStarted(false);
    }
  }, []); // refとstate setterは安定した参照なので依存配列は空でOK


  // 戻る処理関数
  const handleBackNavigation = async () => {
    console.log('🔙 Back button activated!');
    
    try {
      // ARが開始されている場合は停止
      if (isStarted) {
        console.log('🔄 Stopping AR before navigation...');
        await stopAR();
      }
      
      // 強制的にMindARの残留要素を削除
      console.log('🧹 Force cleaning MindAR elements...');
      setTimeout(() => {
        // すべてのMindAR関連要素を強制削除
        const mindarElements = document.querySelectorAll('[class*="mindar"], [id*="mindar"]');
        mindarElements.forEach(el => el.remove());
        
        // ARに関連するcanvas要素を削除
        const canvases = document.querySelectorAll('canvas');
        canvases.forEach(canvas => {
          if (canvas.width > 100 && canvas.height > 100) {
            canvas.remove();
          }
        });
        
        // 固定位置の要素で高いz-indexを持つものを削除（戻るボタンは除外）
        const fixedElements = document.querySelectorAll('*');
        fixedElements.forEach(el => {
          const style = getComputedStyle(el);
          if (style.position === 'fixed' && parseInt(style.zIndex) > 1000 && 
              el !== document.querySelector('[aria-label="戻る"]') &&
              !el.matches('[class*="back-button"]') &&
              !el.closest('[aria-label="戻る"]')) {
            console.log('Removing high z-index element:', el);
            el.remove();
          }
        });
      }, 100);
      
      // 直接ナビゲーション（履歴を増やさない）
      router.replace('/start');
    } catch (error) {
      console.error('Error during cleanup:', error);
      // エラーが発生してもナビゲーションは実行（履歴を増やさない）
      router.replace('/start');
    }
  };

  const capturePhoto = async () => {
    if (!containerRef.current) return;

    // 現在検出中のマーカーのモデルを収集
    const detectedModelNames: string[] = [];
    Object.entries(detectedMarkers).forEach(([indexStr, isDetected]) => {
      if (isDetected) {
        const index = parseInt(indexStr);
        const modelName = index === 0 ? 'coicoi' : index === 1 ? 'wkwk' : 'wkwk_gold';
        if (!collectedModels.includes(modelName)) {
          detectedModelNames.push(modelName);
        }
      }
    });

    // 新しく検出したモデルがあればGetメッセージを表示
    if (detectedModelNames.length > 0) {
      setCollectedModels(prev => [...prev, ...detectedModelNames]);
      setShowGetMessage(true);
      setTimeout(() => setShowGetMessage(false), 2000);
      console.log('🎉 New models collected:', detectedModelNames);
    }

    setShowFlash(true);
    setTimeout(() => setShowFlash(false), 150);

    console.log('🔄 Starting photo capture process...');

    const scene = containerRef.current.querySelector('a-scene');
    const video = document.querySelector('video');
    
    if (!scene || !video) {
      console.error('Required elements not found for photo capture');
      return;
    }

    console.log('📷 Found scene and video elements');
    console.log('Video dimensions:', video.videoWidth, 'x', video.videoHeight);

    // MindAR/A-Frameの環境での特別な処理
    const aframeScene = scene as any;
    
    // まず、Three.jsの世界を確認
    console.log('🔍 Checking A-Frame scene object:', {
      hasRenderer: !!aframeScene.renderer,
      hasObject3D: !!aframeScene.object3D,
      hasCamera: !!aframeScene.camera,
      hasCanvas: !!aframeScene.canvas,
      rendererType: aframeScene.renderer?.constructor?.name
    });

    // A-Frameが完全に読み込まれるまで待つ
    if (!aframeScene.renderer) {
      console.log('⏳ Waiting for A-Frame renderer to initialize...');
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    let threeCanvas = null;
    let renderer = null;

    // 複数の方法でcanvasとrendererを取得
    if (aframeScene.renderer && aframeScene.renderer.domElement) {
      threeCanvas = aframeScene.renderer.domElement;
      renderer = aframeScene.renderer;
      console.log('✅ Found renderer canvas via scene.renderer');
    } 
    
    // window.AFRAMEから直接取得を試行
    if (!threeCanvas && (window as any).AFRAME && (window as any).AFRAME.scenes?.[0]) {
      const aframeSceneGlobal = (window as any).AFRAME.scenes[0];
      if (aframeSceneGlobal.renderer) {
        threeCanvas = aframeSceneGlobal.renderer.domElement;
        renderer = aframeSceneGlobal.renderer;
        console.log('✅ Found renderer canvas via AFRAME.scenes[0]');
      }
    }

    // フォールバック: DOM検索
    if (!threeCanvas) {
      console.log('🔍 Searching for canvas in DOM...');
      const allCanvases = document.querySelectorAll('canvas');
      console.log(`Found ${allCanvases.length} canvas elements`);
      
      allCanvases.forEach((canvas, index) => {
        console.log(`Canvas ${index}:`, {
          width: canvas.width,
          height: canvas.height,
          clientWidth: canvas.clientWidth,
          clientHeight: canvas.clientHeight,
          style: canvas.style.cssText,
          parent: canvas.parentElement?.tagName
        });
      });
      
      // A-Frameシーン内のcanvasを優先
      threeCanvas = scene.querySelector('canvas');
      if (!threeCanvas && allCanvases.length > 0) {
        // 最大のcanvasを選択
        let largestCanvas = allCanvases[0];
        let largestArea = largestCanvas.width * largestCanvas.height;
        
        allCanvases.forEach(canvas => {
          const area = canvas.width * canvas.height;
          if (area > largestArea && area > 10000) { // 最小サイズフィルター
            largestArea = area;
            largestCanvas = canvas;
          }
        });
        
        threeCanvas = largestCanvas;
        console.log('✅ Selected largest canvas for capture');
      }
    }
    
    if (!threeCanvas) {
      console.error('❌ No suitable canvas found for photo capture');
      // ビデオのみの撮影にフォールバック
      const captureCanvas = document.createElement('canvas');
      const ctx = captureCanvas.getContext('2d');
      if (!ctx) return;
      
      const displayWidth = window.visualViewport?.width || window.innerWidth;
      const displayHeight = window.visualViewport?.height || window.innerHeight;
      
      captureCanvas.width = displayWidth;
      captureCanvas.height = displayHeight;
      
      ctx.drawImage(video, 0, 0, video.videoWidth, video.videoHeight, 
                   0, 0, displayWidth, displayHeight);
      
      const imageData = captureCanvas.toDataURL('image/png');
      const link = document.createElement('a');
      link.download = `marker-ar-photo-video-only-${Date.now()}.png`;
      link.href = imageData;
      link.click();
      
      console.log('📷 Captured video-only photo as fallback');
      return;
    }

    console.log('🎯 Using canvas for capture:', {
      width: threeCanvas.width,
      height: threeCanvas.height,
      clientWidth: threeCanvas.clientWidth,
      clientHeight: threeCanvas.clientHeight,
      hasContext: !!threeCanvas.getContext,
      parentElement: threeCanvas.parentElement?.tagName
    });

    // レンダラーが利用可能な場合、明示的にレンダリングを実行
    if (renderer && aframeScene.object3D && aframeScene.camera) {
      console.log('🔄 Manually rendering scene before capture...');
      try {
        renderer.render(aframeScene.object3D, aframeScene.camera);
        console.log('✅ Manual render completed');
      } catch (renderError) {
        console.error('❌ Manual render failed:', renderError);
      }
    }

    // 画面サイズの計算
    const displayWidth = window.visualViewport?.width || window.innerWidth;
    const displayHeight = window.visualViewport?.height || window.innerHeight;
    
    console.log('📐 Display dimensions:', displayWidth, 'x', displayHeight);
    
    const videoAspectRatio = video.videoWidth / video.videoHeight;
    const displayAspectRatio = displayWidth / displayHeight;
    
    let videoDisplayWidth, videoDisplayHeight;
    let videoOffsetX = 0, videoOffsetY = 0;
    
    if (videoAspectRatio > displayAspectRatio) {
      videoDisplayHeight = displayHeight;
      videoDisplayWidth = displayHeight * videoAspectRatio;
      videoOffsetX = (displayWidth - videoDisplayWidth) / 2;
    } else {
      videoDisplayWidth = displayWidth;
      videoDisplayHeight = displayWidth / videoAspectRatio;
      videoOffsetY = (displayHeight - videoDisplayHeight) / 2;
    }

    console.log('📐 Video positioning:', {
      videoDisplayWidth,
      videoDisplayHeight,
      videoOffsetX,
      videoOffsetY
    });

    // キャプチャ用のキャンバス作成
    const captureCanvas = document.createElement('canvas');
    const ctx = captureCanvas.getContext('2d');
    if (!ctx) {
      console.error('❌ Failed to get 2D context for capture canvas');
      return;
    }
    
    captureCanvas.width = displayWidth;
    captureCanvas.height = displayHeight;

    console.log('📷 Created capture canvas:', displayWidth, 'x', displayHeight);

    // 1. ビデオを背景として描画
    try {
      ctx.drawImage(video, 0, 0, video.videoWidth, video.videoHeight, 
                   videoOffsetX, videoOffsetY, videoDisplayWidth, videoDisplayHeight);
      console.log('✅ Video background drawn successfully');
    } catch (videoError) {
      console.error('❌ Failed to draw video:', videoError);
      return;
    }

    // 2. A-Frame/Three.jsの3Dコンテンツを合成
    ctx.globalCompositeOperation = 'source-over';
    
    console.log('🔄 Attempting to composite 3D canvas...');
    
    try {
      // Three.jsキャンバスの内容をデバッグ
      const testCtx = threeCanvas.getContext('2d') || threeCanvas.getContext('webgl') || threeCanvas.getContext('webgl2');
      console.log('🔍 Three.js canvas context:', testCtx?.constructor?.name);
      
      // キャンバスが空でないかチェック
      const tempCanvas = document.createElement('canvas');
      const tempCtx = tempCanvas.getContext('2d');
      tempCanvas.width = 100;
      tempCanvas.height = 100;
      if (tempCtx) {
        try {
          tempCtx.drawImage(threeCanvas, 0, 0, 100, 100);
          const imageData = tempCtx.getImageData(0, 0, 100, 100);
          const hasContent = imageData.data.some((value, index) => index % 4 === 3 && value > 0);
          console.log('🔍 Canvas has visible content:', hasContent);
        } catch (testError) {
          console.log('🔍 Canvas test failed:', testError);
        }
      }

      // 実際の合成処理
      ctx.drawImage(threeCanvas, 0, 0, threeCanvas.width, threeCanvas.height,
                   0, 0, displayWidth, displayHeight);
      console.log('✅ Successfully composited 3D canvas');
      
    } catch (error) {
      console.error('❌ Error compositing 3D canvas:', error);
      const err = error as Error;
      console.log('📝 Error details:', {
        name: err.name,
        message: err.message,
        canvasWidth: threeCanvas?.width,
        canvasHeight: threeCanvas?.height
      });
      
      // WebGLキャンバスの場合の特別処理
      if (err.name === 'SecurityError' || err.message?.includes('tainted')) {
        console.log('🔄 Attempting WebGL readPixels fallback...');
        
        if (renderer && renderer.getContext) {
          try {
            const gl = renderer.getContext();
            if (gl) {
              // WebGL特有の読み取り方法を試す
              const pixels = new Uint8Array(displayWidth * displayHeight * 4);
              gl.readPixels(0, 0, displayWidth, displayHeight, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
              
              // ImageDataに変換して描画
              const imageData = new ImageData(new Uint8ClampedArray(pixels), displayWidth, displayHeight);
              
              // Y座標を反転（WebGLとCanvasでY軸が逆）
              const tempCanvas = document.createElement('canvas');
              const tempCtx = tempCanvas.getContext('2d');
              if (tempCtx) {
                tempCanvas.width = displayWidth;
                tempCanvas.height = displayHeight;
                tempCtx.putImageData(imageData, 0, 0);
                tempCtx.scale(1, -1);
                tempCtx.drawImage(tempCanvas, 0, -displayHeight);
                
                ctx.drawImage(tempCanvas, 0, 0);
                console.log('✅ WebGL readPixels fallback successful');
              }
            }
          } catch (webglError) {
            console.error('❌ WebGL fallback also failed:', webglError);
          }
        }
      }
    }

    // 3. 最終画像の生成とダウンロード
    const imageData = captureCanvas.toDataURL('image/png', 1.0);
    
    // デバッグ：キャプチャ画像のサイズを確認
    console.log('📊 Final image data size:', imageData.length, 'characters');

    const link = document.createElement('a');
    link.download = `marker-ar-photo-${Date.now()}.png`;
    link.href = imageData;
    link.click();

    console.log('✅ Photo capture completed successfully');
    
    // 現在検出されているマーカーに基づいてモデルを収集
    Object.entries(detectedMarkers).forEach(([markerIndex, detected]) => {
      if (detected) {
        const modelName = markerIndex === '0' ? 'coicoi' : 'wkwk';
        if (!collectedModels.includes(modelName)) {
          setCollectedModels(prev => [...prev, modelName]);
          console.log(`🎁 Collected ${modelName} model!`);
        }
      }
    });
    
    // Getメッセージを表示
    setShowGetMessage(true);
    setTimeout(() => setShowGetMessage(false), 2000);
  };


  // 戻るボタンコンポーネント
  const BackButton = () => {
    const buttonRef = useRef<HTMLButtonElement>(null);

    useEffect(() => {
      const button = buttonRef.current;
      if (!button) return;

      // シンプルな戻る処理（AR状態に関係なく動作）
      const handleBackClick = async (e: Event) => {
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
        console.log('🟢 Back button activated (simple)!');

        // ARが開始されている場合は停止
        if (isStarted) {
          console.log('🔄 Stopping AR before navigation...');
          await stopAR();
        }

        // 直接ナビゲーション（履歴を増やさない）
        router.replace('/start');
      };

      // ネイティブイベントリスナーを登録 - より確実な方法
      const handleTouchStart = async (e: TouchEvent) => {
        console.log('🟢 Back button touchstart!');
        await handleBackClick(e);
      };

      const handleClick = async (e: MouseEvent) => {
        console.log('🟢 Back button click!');
        await handleBackClick(e);
      };

      const handlePointerDown = async (e: PointerEvent) => {
        console.log('🟢 Back button pointerdown!');
        await handleBackClick(e);
      };

      // より高い優先度でイベントリスナーを登録
      button.addEventListener('touchstart', handleTouchStart, { passive: false, capture: true });
      button.addEventListener('click', handleClick, { passive: false, capture: true });
      button.addEventListener('pointerdown', handlePointerDown, { passive: false, capture: true });

      return () => {
        // クリーンアップ
        button.removeEventListener('touchstart', handleTouchStart, { capture: true } as any);
        button.removeEventListener('click', handleClick, { capture: true } as any);
        button.removeEventListener('pointerdown', handlePointerDown, { capture: true } as any);
      };
    }, [isStarted, router, stopAR]); // 依存配列を完全にする

    return (
      <button
        ref={buttonRef}
        type="button"
        className="fixed bottom-6 left-6 w-16 h-16 rounded-full flex items-center justify-center backdrop-blur-md border-2 border-white/50 transition-all duration-200 active:scale-90 hover:scale-110 hover:border-white/70 cursor-pointer"
        style={{
          zIndex: 2147483647,
          background: 'linear-gradient(135deg, rgba(75, 85, 99, 0.8), rgba(55, 65, 81, 0.6))',
          boxShadow: '0 12px 40px rgba(75, 85, 99, 0.6), inset 0 1px 0 rgba(255, 255, 255, 0.4)',
          position: 'fixed',
          pointerEvents: 'auto',
          display: 'flex',
          visibility: 'visible'
        }}
        aria-label="戻る"
        onClick={async (e) => {
          e.preventDefault();
          e.stopPropagation();
          console.log('🟢 React onClick triggered!');
          if (isStarted) {
            await stopAR();
          }
          router.replace('/start');
        }}
      >
        <ArrowLeft className="w-7 h-7 text-white" />
      </button>
    );
  };


  // マーカー検出UI
  const MarkerDetectionOverlay = () => {
    const hasDetectedMarker = Object.values(detectedMarkers).some(detected => detected);
    
    if (!hasDetectedMarker) return null;
    
    return (
      <div className="fixed inset-0 pointer-events-none" style={{ zIndex: 10 }}>
        {/* 検出されたマーカーに白枠を表示 */}
        {Object.entries(detectedMarkers).map(([markerIndex, detected]) => {
          if (!detected) return null;
          
          const markerName = markerIndex === '0' ? 'coicoi' : 'wkwk';
          const position = markerIndex === '0' ? 
            { top: '25%', left: '25%', width: '50%', height: '50%' } :
            { top: '30%', left: '30%', width: '40%', height: '40%' };
          
          return (
            <div
              key={markerIndex}
              className="absolute border-4 border-white rounded-lg animate-pulse"
              style={{
                ...position,
                boxShadow: '0 0 20px rgba(255, 255, 255, 0.7), inset 0 0 20px rgba(255, 255, 255, 0.1)',
                borderStyle: 'dashed',
                animation: 'pulse 1.5s ease-in-out infinite'
              }}
            >
              {/* マーカー名表示 */}
              <div 
                className="absolute -top-8 left-0 bg-white text-black px-2 py-1 rounded text-sm font-bold"
                style={{ fontSize: '12px' }}
              >
                {markerName} detected
              </div>
              
              {/* コーナーマーカー */}
              <div className="absolute -top-2 -left-2 w-4 h-4 border-t-4 border-l-4 border-white"></div>
              <div className="absolute -top-2 -right-2 w-4 h-4 border-t-4 border-r-4 border-white"></div>
              <div className="absolute -bottom-2 -left-2 w-4 h-4 border-b-4 border-l-4 border-white"></div>
              <div className="absolute -bottom-2 -right-2 w-4 h-4 border-b-4 border-r-4 border-white"></div>
            </div>
          );
        })}
      </div>
    );
  };

  // 3Dビューアーコンポーネント
  const Model3DViewer = ({ modelName, onClose }: { modelName: string; onClose: () => void }) => {
    const mountRef = useRef<HTMLDivElement>(null);
    const sceneRef = useRef<THREE.Scene | null>(null);
    const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
    const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
    const modelRef = useRef<THREE.Object3D | null>(null);
    const frameIdRef = useRef<number | null>(null);
    
    // インタラクション用のref（状態更新を避けてパフォーマンス向上）
    const modelRotation = useRef({ x: 0, y: 0 });
    const modelScale = useRef(1);
    const isDragging = useRef(false);
    const dragStart = useRef({ x: 0, y: 0 });
    const rotationStart = useRef({ x: 0, y: 0 });
    const touchStartDistance = useRef<number | null>(null);
    const initialScale = useRef(1);
    
    useEffect(() => {
      if (!mountRef.current) return;
      
      const width = window.innerWidth;
      const height = window.innerHeight;
      const aspect = width / height;
      
      // シーン作成
      const scene = new THREE.Scene();

      // 明るいグレーの背景色を設定
      scene.background = new THREE.Color(0xe0e0e0); // 明るいグレー
      sceneRef.current = scene;

      // パースペクティブカメラ作成（視野角を広く、カメラを遠くに配置）
      const camera = new THREE.PerspectiveCamera(45, aspect, 0.1, 2000);
      camera.position.set(0, 0, 8);
      camera.lookAt(0, 0, 0);
      cameraRef.current = camera;
      console.log('Camera created at position:', camera.position);

      // レンダラー作成（パフォーマンス最適化）
      const renderer = new THREE.WebGLRenderer({
        antialias: true,
        alpha: false,
        powerPreference: 'high-performance'
      });
      renderer.setSize(width, height);
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2)); // 高解像度デバイスでのパフォーマンス向上
      renderer.shadowMap.enabled = false; // シャドウ無効でパフォーマンス向上
      renderer.outputColorSpace = THREE.SRGBColorSpace; // 正しい色空間

      // canvasのスタイルを明示的に設定
      renderer.domElement.style.width = '100%';
      renderer.domElement.style.height = '100%';
      renderer.domElement.style.display = 'block';
      renderer.domElement.style.touchAction = 'none'; // タッチイベントの干渉を防ぐ

      mountRef.current.appendChild(renderer.domElement);
      rendererRef.current = renderer;
      console.log('Renderer created and mounted');

      // ライト追加 - より明るく、あらゆる角度から照らす
      const ambientLight = new THREE.AmbientLight(0xffffff, 2.0);
      scene.add(ambientLight);
      console.log('Ambient light added');

      const directionalLight1 = new THREE.DirectionalLight(0xffffff, 1.5);
      directionalLight1.position.set(5, 5, 5);
      scene.add(directionalLight1);

      const directionalLight2 = new THREE.DirectionalLight(0xffffff, 1.5);
      directionalLight2.position.set(-5, 5, -5);
      scene.add(directionalLight2);

      const directionalLight3 = new THREE.DirectionalLight(0xffffff, 1.0);
      directionalLight3.position.set(0, -5, 0);
      scene.add(directionalLight3);
      console.log('All lights added');

      // モデル読み込み
      const modelPath = `/${modelName}.glb`;
      console.log('=== Starting to load model ===');
      console.log('Model name:', modelName);
      console.log('Model path:', modelPath);
      console.log('Full URL:', window.location.origin + modelPath);

      const loader = new GLTFLoader();
      loader.load(
        modelPath,
        (gltf) => {
          console.log('=== ✅ GLB loaded successfully ===');
          console.log('Model name:', modelName);
          console.log('GLTF object:', gltf);
          console.log('GLTF scene:', gltf.scene);

          const model = gltf.scene;
          console.log('Model scene:', model);
          console.log('Model children count:', model.children.length);

          // バウンディングボックスを計算
          const box = new THREE.Box3().setFromObject(model);
          const size = box.getSize(new THREE.Vector3());
          const center = box.getCenter(new THREE.Vector3());

          console.log('Model size:', size.x, size.y, size.z);
          console.log('Model center:', center.x, center.y, center.z);

          // モデルを中央に配置
          const wrapper = new THREE.Group();
          wrapper.add(model);

          // モデルを中心に配置
          model.position.set(-center.x, -center.y, -center.z);
          console.log('Model centered at:', model.position);

          // モデルのサイズに基づいてスケールを調整
          const maxSize = Math.max(size.x, size.y, size.z);
          const targetSize = 2.5; // 画面に収まるサイズ
          const scale = targetSize / maxSize;
          wrapper.scale.setScalar(scale);
          console.log('Wrapper scale set to:', scale, 'maxSize:', maxSize, 'targetSize:', targetSize);

          // baseScaleを保存
          wrapper.userData.baseScale = scale;

          // 初期回転を設定（モデルを見やすい角度に）
          wrapper.rotation.x = 0.2;
          wrapper.rotation.y = 0.5;

          // モデルのマテリアルを確認し、必要に応じて修正
          let meshCount = 0;
          model.traverse((child: any) => {
            if (child.isMesh) {
              meshCount++;
              console.log('Mesh found:', child.name, 'Material:', child.material?.type);

              // マテリアルが存在し、正しく設定されているか確認
              if (child.material) {
                // Double-sidedにして確実に見えるようにする
                child.material.side = THREE.DoubleSide;
                // マテリアルを更新
                child.material.needsUpdate = true;
              }
            }
          });
          console.log('Total meshes found:', meshCount);

          // wrapperをシーンに追加
          modelRef.current = wrapper;
          scene.add(wrapper);
          console.log('=== ✅ Model wrapper added to scene ===');
          console.log('Scene children count:', scene.children.length);
          console.log('Wrapper position:', wrapper.position);
          console.log('Wrapper rotation:', wrapper.rotation);
          console.log('Wrapper scale:', wrapper.scale);
        },
        (progress) => {
          const percent = progress.total > 0 ? (progress.loaded / progress.total * 100).toFixed(2) : '0';
          console.log(`Loading ${modelName}: ${percent}%`);
        },
        (error) => {
          console.error('=== ❌ Error loading model ===');
          console.error('Model name:', modelName);
          console.error('Error details:', error);
          console.error('Error message:', error.message);
          console.error('Model path attempted:', modelPath);

          // エラーテキストを画面に表示
          alert(`モデルのロードに失敗しました: ${modelName}\nパス: ${modelPath}\nエラー: ${error.message}`);
        }
      );
      
      // マウスドラッグイベント（直接refを更新してパフォーマンス向上）
      const handleMouseDown = (e: MouseEvent) => {
        console.log('Mouse down event');
        e.preventDefault();
        isDragging.current = true;
        dragStart.current = { x: e.clientX, y: e.clientY };
        rotationStart.current = { x: modelRotation.current.x, y: modelRotation.current.y };
      };
      
      const handleMouseMove = (e: MouseEvent) => {
        if (!isDragging.current) return;
        e.preventDefault();
        
        const deltaX = e.clientX - dragStart.current.x;
        const deltaY = e.clientY - dragStart.current.y;
        
        // 直接refを更新
        modelRotation.current = {
          x: rotationStart.current.x + deltaY * 0.008,
          y: rotationStart.current.y + deltaX * 0.008
        };
      };
      
      const handleMouseUp = (e: MouseEvent) => {
        e.preventDefault();
        isDragging.current = false;
      };
      
      // タッチイベント（直接refを更新）
      const handleTouchStart = (e: TouchEvent) => {
        console.log('Touch start event, touches:', e.touches.length);
        e.preventDefault();
        if (e.touches.length === 1) {
          // シングルタッチ：回転
          const touch = e.touches[0];
          isDragging.current = true;
          dragStart.current = { x: touch.clientX, y: touch.clientY };
          rotationStart.current = { x: modelRotation.current.x, y: modelRotation.current.y };
        } else if (e.touches.length === 2) {
          // ピンチ開始
          isDragging.current = false; // ピンチ中は回転を無効に
          const touch1 = e.touches[0];
          const touch2 = e.touches[1];
          const distance = Math.hypot(
            touch2.clientX - touch1.clientX,
            touch2.clientY - touch1.clientY
          );
          touchStartDistance.current = distance;
          initialScale.current = modelScale.current;
        }
      };
      
      const handleTouchMove = (e: TouchEvent) => {
        e.preventDefault();
        if (e.touches.length === 1 && isDragging.current) {
          // シングルタッチ：回転
          const touch = e.touches[0];
          const deltaX = touch.clientX - dragStart.current.x;
          const deltaY = touch.clientY - dragStart.current.y;
          
          modelRotation.current = {
            x: rotationStart.current.x + deltaY * 0.006,
            y: rotationStart.current.y + deltaX * 0.006
          };
        } else if (e.touches.length === 2 && touchStartDistance.current) {
          // ピンチ：拡大縮小
          const touch1 = e.touches[0];
          const touch2 = e.touches[1];
          const currentDistance = Math.hypot(
            touch2.clientX - touch1.clientX,
            touch2.clientY - touch1.clientY
          );

          const scale = currentDistance / touchStartDistance.current;
          modelScale.current = Math.max(0.2, Math.min(4, initialScale.current * scale));
        }
      };
      
      const handleTouchEnd = (e: TouchEvent) => {
        e.preventDefault();
        isDragging.current = false;
        touchStartDistance.current = null;
      };
      
      // ホイールイベント（直接refを更新）
      const handleWheel = (e: WheelEvent) => {
        e.preventDefault();
        const delta = e.deltaY * -0.002;
        modelScale.current = Math.max(0.2, Math.min(4, modelScale.current + delta));
      };
      
      // イベントリスナー登録
      console.log('Registering event listeners on canvas');
      renderer.domElement.addEventListener('mousedown', handleMouseDown);
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
      renderer.domElement.addEventListener('touchstart', handleTouchStart, { passive: false });
      renderer.domElement.addEventListener('touchmove', handleTouchMove, { passive: false });
      renderer.domElement.addEventListener('touchend', handleTouchEnd);
      renderer.domElement.addEventListener('wheel', handleWheel, { passive: false });
      console.log('Event listeners registered successfully');
      
      // アニメーションループ（継続的にレンダリング）
      let frameCount = 0;
      const animate = () => {
        frameIdRef.current = requestAnimationFrame(animate);

        // モデルが存在する場合は回転とスケールを更新
        if (modelRef.current) {
          modelRef.current.rotation.x = modelRotation.current.x;
          modelRef.current.rotation.y = modelRotation.current.y;
          // スケールはモデル読み込み時に設定された値にmodelScale.currentを掛ける
          const currentScale = modelRef.current.userData.baseScale || 1;
          modelRef.current.scale.setScalar(currentScale * modelScale.current);
        }

        renderer.render(scene, camera);

        // 最初の10フレームで詳細なログ出力
        frameCount++;
        if (frameCount <= 10) {
          console.log(`Frame ${frameCount}:`);
          console.log('  - Model present:', !!modelRef.current);
          console.log('  - Scene children:', scene.children.length);
          console.log('  - Camera position:', camera.position);
          if (modelRef.current) {
            console.log('  - Model position:', modelRef.current.position);
            console.log('  - Model scale:', modelRef.current.scale);
            console.log('  - Model visible:', modelRef.current.visible);
          }
        }
      };

      console.log('Starting animation loop');
      console.log('Initial scene children:', scene.children.length);
      animate();

      // リサイズハンドラー
      const handleResize = () => {
        const width = window.innerWidth;
        const height = window.innerHeight;

        camera.aspect = width / height;
        camera.updateProjectionMatrix();

        renderer.setSize(width, height);
      };
      window.addEventListener('resize', handleResize);
      
      return () => {
        renderer.domElement.removeEventListener('mousedown', handleMouseDown);
        window.removeEventListener('mousemove', handleMouseMove);
        window.removeEventListener('mouseup', handleMouseUp);
        renderer.domElement.removeEventListener('touchstart', handleTouchStart);
        renderer.domElement.removeEventListener('touchmove', handleTouchMove);
        renderer.domElement.removeEventListener('touchend', handleTouchEnd);
        renderer.domElement.removeEventListener('wheel', handleWheel);
        window.removeEventListener('resize', handleResize);
        
        if (frameIdRef.current) {
          cancelAnimationFrame(frameIdRef.current);
        }
        if (mountRef.current && renderer.domElement) {
          mountRef.current.removeChild(renderer.domElement);
        }
        renderer.dispose();
      };
    }, [modelName]); // modelNameのみに依存
    
    return (
      <div className="fixed inset-0 z-50" style={{ backgroundColor: '#e0e0e0' }}>
        <div ref={mountRef} className="w-full h-full" />
        <button
          type="button"
          onClick={onClose}
          className="absolute top-4 right-4 w-12 h-12 bg-black/20 backdrop-blur-lg rounded-full flex items-center justify-center hover:bg-black/30 transition-colors"
          title="閉じる"
        >
          <X className="w-6 h-6 text-black" />
        </button>
        <div className="absolute bottom-8 left-1/2 transform -translate-x-1/2 text-black text-center pointer-events-none">
          <h2 className="text-2xl font-bold mb-2">{modelName.toUpperCase()} Model</h2>
          <p className="text-sm opacity-75">ドラッグで回転 • ピンチ/スクロールで拡大</p>
        </div>
      </div>
    );
  };

  return (
    <div className="fixed inset-0 bg-black overflow-hidden">
      {/* AR Container */}
      <div 
        ref={containerRef} 
        className="fixed inset-0"
        style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', margin: 0, padding: 0, zIndex: 1 }}
      />

      {/* マーカー検出UI */}
      {isMounted && isStarted && (
        <MarkerDetectionOverlay />
      )}


      {/* 戻るボタンをポータルでbody直下に描画（3Dビューアー表示中は非表示） */}
      {isMounted && typeof document !== 'undefined' && !show3DViewer && createPortal(
        <BackButton />,
        document.body
      )}

      {/* カメラボタン（写真撮影機能）- 他のページと同じデザイン（3Dビューアー表示中は非表示） */}
      {isMounted && typeof document !== 'undefined' && isStarted && !show3DViewer && createPortal(
        <div className="absolute left-1/2 transform -translate-x-1/2" style={{ bottom: '10%', zIndex: 2147483647 }}>
          <button
            type="button"
            onClick={capturePhoto}
            className="w-20 h-20 sm:w-24 sm:h-24 md:w-28 md:h-28 lg:w-32 lg:h-32 xl:w-36 xl:h-36 backdrop-blur-xl rounded-full flex items-center justify-center border-2 border-white border-opacity-20 shadow-xl transition-all hover:scale-110 active:scale-95"
            title="写真を撮影"
            style={{
              background: 'linear-gradient(135deg, rgba(59, 130, 246, 0.8), rgba(34, 197, 94, 0.8))',
              boxShadow: '0 8px 32px rgba(59, 130, 246, 0.6), inset 0 2px 0 rgba(255, 255, 255, 0.1)'
            }}
          >
            <Camera className="w-10 h-10 sm:w-12 sm:h-12 md:w-14 md:h-14 lg:w-16 lg:h-16 xl:w-18 xl:h-18 text-white drop-shadow-lg" />
          </button>
        </div>,
        document.body
      )}

      {/* フラッシュエフェクト */}
      {showFlash && isMounted && typeof document !== 'undefined' && createPortal(
        <div className="fixed inset-0 bg-white pointer-events-none animate-pulse" style={{ zIndex: 2147483648 }} />,
        document.body
      )}

      {/* Getメッセージ */}
      {showGetMessage && isMounted && typeof document !== 'undefined' && createPortal(
        <div className="fixed inset-0 flex items-center justify-center pointer-events-none" style={{ zIndex: 2147483649 }}>
          <div className="bg-gradient-to-r from-purple-600 to-pink-600 text-white px-8 py-4 rounded-2xl shadow-2xl animate-bounce">
            <h2 className="text-3xl font-bold">Getしました！</h2>
          </div>
        </div>,
        document.body
      )}

      {/* 収集したモデルのアイコン */}
      {collectedModels.length > 0 && isMounted && typeof document !== 'undefined' && createPortal(
        <div className="fixed top-4 left-1/2 transform -translate-x-1/2 flex gap-4 items-center" style={{ zIndex: 2147483647 }}>
          {collectedModels.map((modelName) => (
            <button
              key={modelName}
              type="button"
              onClick={() => setShow3DViewer(modelName)}
              className="w-16 h-16 bg-gradient-to-br from-purple-500 to-pink-500 rounded-2xl shadow-lg hover:scale-110 transition-transform flex items-center justify-center relative overflow-hidden group"
              title={`${modelName} 3Dビュー`}
            >
              <div className="absolute inset-0 bg-white opacity-0 group-hover:opacity-20 transition-opacity" />
              <div className="text-white font-bold text-lg">
                {modelName === 'coicoi' ? '🔴' : modelName === 'wkwk' ? '🟡' : '🏆'}
              </div>
              <div className="absolute -bottom-1 text-xs text-white font-semibold bg-black/30 px-2 rounded">
                {modelName}
              </div>
            </button>
          ))}
          {/* デバッグ用：データクリアボタン（開発時のみ表示） */}
          {process.env.NODE_ENV === 'development' && (
            <button
              type="button"
              onClick={() => {
                localStorage.removeItem('collectedARModels');
                setCollectedModels([]);
              }}
              className="ml-4 px-3 py-1 bg-red-500 text-white text-xs rounded"
              title="収集データをクリア"
            >
              Clear
            </button>
          )}
        </div>,
        document.body
      )}

      {/* 3Dビューアー */}
      {show3DViewer && isMounted && (
        <Model3DViewer 
          modelName={show3DViewer} 
          onClose={() => setShow3DViewer(null)} 
        />
      )}

      {/* Start Button */}
      {isInitialized && !isStarted && !error && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/80" style={{ zIndex: 20 }}>
          <div className="text-white text-center">
            <button
              type="button"
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