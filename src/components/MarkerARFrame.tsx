'use client';

import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ArrowLeft, Camera, X } from 'lucide-react';
import { useRouter } from 'next/navigation';

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
  const router = useRouter();
  const containerRef = useRef<HTMLDivElement>(null);
  const [isInitialized, setIsInitialized] = useState(false);
  const [isStarted, setIsStarted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [coicoiScale, setCoicoiScale] = useState(0.114); // 0.019 * 6
  const [wkwkScale, setWkwkScale] = useState(0.0095); // 0.019 * 0.5
  const touchStartDistance = useRef<number | null>(null);
  const currentCoicoiScale = useRef(0.114);
  const currentWkwkScale = useRef(0.0095);
  const [isMounted, setIsMounted] = useState(false);
  
  
  // タッチハンドラの参照を保持
  const touchHandlersRef = useRef<{
    handleTouchStart?: (e: TouchEvent) => void;
    handleTouchMove?: (e: TouchEvent) => void;
    handleTouchEnd?: (e: TouchEvent) => void;
  }>({});

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
    setIsMounted(true);
    
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

    // ページ非表示・ブラウザバック時のクリーンアップ
    const handlePageHide = async () => {
      console.log('🔄 Page hide detected, cleaning up AR...');
      await stopAR();
    };

    const handleVisibilityChange = async () => {
      if (document.hidden) {
        console.log('🔄 Page became hidden, cleaning up AR...');
        await stopAR();
      }
    };

    const handleBeforeUnload = async () => {
      console.log('🔄 Page unloading, cleaning up AR...');
      await stopAR();
    };

    const handlePopstate = async () => {
      console.log('🔄 Browser back detected, cleaning up AR...');
      await stopAR();
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
      
      // 非同期で停止処理を実行
      (async () => {
        await stopAR();
      })();
    };
  }, []);

  const initializeAR = async () => {
    if (!containerRef.current) {
      setError('コンテナが見つかりません');
      return;
    }

    try {
      console.log('Starting AR initialization...');
      
      // カメラ権限を事前に要求
      console.log('Requesting camera permission...');
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ 
          video: { 
            facingMode: 'environment',
            width: { ideal: 1280 },
            height: { ideal: 720 }
          } 
        });
        console.log('✅ Camera permission granted');
        // ストリームを停止（MindARが再度開く）
        stream.getTracks().forEach(track => track.stop());
      } catch (err) {
        console.error('Camera permission denied:', err);
        setError('カメラへのアクセスが拒否されました。ブラウザの設定を確認してください。');
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
          width: 100% !important;
          height: 100% !important;
          object-fit: cover !important;
          pointer-events: none !important;
        }
      `;
      document.head.appendChild(styleElement);


      // Create A-Frame scene HTML - 公式例に基づいた正しい実装
      const sceneHTML = `
        <a-scene
          mindar-image="imageTargetSrc: /targets.mind; autoStart: no; uiScanning: no; uiLoading: no; uiError: no; showStats: no; filterMinCF: 0.0001; filterBeta: 1000;"
          color-space="sRGB"
          renderer="colorManagement: true, physicallyCorrectLights"
          vr-mode-ui="enabled: false"
          device-orientation-permission-ui="enabled: false"
          style="display: block; width: 100vw; height: 100vh;"
        >
          <a-assets>
            <a-asset-item id="coicoi-model" src="/coicoi.glb"></a-asset-item>
            <a-asset-item id="wkwk-model" src="/wkwk.glb"></a-asset-item>
          </a-assets>
          
          <a-camera position="0 0 0" look-controls="enabled: false"></a-camera>
          
          <!-- Coicoi用 (index 0) -->
          <a-entity mindar-image-target="targetIndex: 0">
            <a-gltf-model
              id="model-coicoi"
              rotation="0 0 0"
              position="0 0 0"
              scale="${coicoiScale} ${coicoiScale} ${coicoiScale}"
              src="#coicoi-model"
              animation-mixer
            ></a-gltf-model>
          </a-entity>
          
          <!-- WKWK用 (index 1) -->
          <a-entity mindar-image-target="targetIndex: 1">
            <a-gltf-model
              id="model-wkwk"
              rotation="0 0 0"
              position="0 0 0"
              scale="${wkwkScale} ${wkwkScale} ${wkwkScale}"
              src="#wkwk-model"
              animation-mixer
            ></a-gltf-model>
          </a-entity>
          
          <a-light type="ambient" color="#ffffff" intensity="0.6"></a-light>
          <a-light type="directional" position="0 1 1" intensity="0.8"></a-light>
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
                console.log(`🎯🎯🎯 Target ${index} FOUND! Image recognized successfully!`);
                console.log(`Target ${index} event:`, event);
                
                // アンカー全体を表示
                const entity = anchor.querySelector('a-entity');
                if (entity) {
                  entity.setAttribute('visible', 'true');
                  // アニメーションを追加
                  entity.setAttribute('animation', 'property: rotation; to: 0 360 0; dur: 2000; loop: true');
                  console.log(`✅ Entity ${index} is now visible and rotating`);
                }
                
                // 全ての子要素を明示的に表示
                const allElements = anchor.querySelectorAll('a-box, a-text, a-sphere, a-cylinder, a-gltf-model');
                allElements.forEach((el, elemIndex) => {
                  el.setAttribute('visible', 'true');
                  console.log(`Setting element ${elemIndex} (${el.tagName}) visible in anchor ${index}`);
                });
                
                // GLTFモデルを特別に処理
                const gltfModel = anchor.querySelector('a-gltf-model');
                if (gltfModel) {
                  console.log(`🎯 Forcing GLTF model visibility for anchor ${index}`);
                  gltfModel.setAttribute('visible', 'true');
                  (gltfModel as any).object3D.visible = true;
                  
                  // モデルのスケールとポジションを確認・調整
                  const currentScale = gltfModel.getAttribute('scale');
                  const currentPosition = gltfModel.getAttribute('position');
                  console.log(`Model ${index} current scale: ${currentScale}, position: ${currentPosition}`);
                  
                  // 初期設定のスケールを維持（coicoiとwkwkで異なるスケール）
                  if (index === 0) {
                    // Coicoi model
                    gltfModel.setAttribute('scale', `${coicoiScale} ${coicoiScale} ${coicoiScale}`);
                  } else if (index === 1) {
                    // WKWK model  
                    gltfModel.setAttribute('scale', `${wkwkScale} ${wkwkScale} ${wkwkScale}`);
                  }
                  gltfModel.setAttribute('position', '0 0 0');
                  
                  console.log(`✅ GLTF model ${index} should now be VISIBLE with proper scale`);
                }
                
                console.log(`✅ All elements in anchor ${index} should be visible now`);
              });
              
              anchor.addEventListener('targetLost', () => {
                console.log(`❌ Target ${index} lost! (but keeping model visible for simultaneous display)`);
                // モデルの非表示処理を削除 - 2つのモデルが同時に表示できるように
                // const model = anchor.querySelector('a-gltf-model');
                // if (model) {
                //   model.setAttribute('visible', 'false');
                // }
                
                // デバッグ用の色変更のみ実行
                const box = anchor.querySelector('a-box');
                const cylinder = anchor.querySelector('a-cylinder');
                const sphere = anchor.querySelector('a-sphere');
                
                if (box) {
                  box.setAttribute('material', index === 0 ? 'color: red' : 'color: yellow');
                }
                if (cylinder) {
                  cylinder.setAttribute('material', 'color: cyan');
                }
                if (sphere) {
                  sphere.setAttribute('material', 'color: purple');
                }
              });
            });
            
            // MindARシステムの詳細な状態を監視
            console.log('⏳ Waiting for MindAR to initialize...');
            
            // MindARシステムを直接確認
            setTimeout(() => {
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
              if (mindarSystem && mindarSystem.controller) {
                console.log('MindAR controller found:', mindarSystem.controller);
                console.log('Number of targets:', mindarSystem.controller.maxTrack || 'unknown');
                
                // MindARのデフォルトUIを強制的に削除
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
                
                
                // 手動でARシステムを開始
                if (mindarSystem.start) {
                  console.log('Starting MindAR system manually...');
                  mindarSystem.start();
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
      
      // ピンチジェスチャーの処理を追加
      const handleTouchStart = (e: TouchEvent) => {
        // ピンチジェスチャーのみ処理（他のタッチイベントは妨げない）
        if (e.touches.length === 2) {
          const touch1 = e.touches[0];
          const touch2 = e.touches[1];
          const distance = Math.hypot(
            touch2.clientX - touch1.clientX,
            touch2.clientY - touch1.clientY
          );
          touchStartDistance.current = distance;
        }
      };
      
      const handleTouchMove = (e: TouchEvent) => {
        if (e.touches.length === 2 && touchStartDistance.current) {
          const touch1 = e.touches[0];
          const touch2 = e.touches[1];
          const currentDistance = Math.hypot(
            touch2.clientX - touch1.clientX,
            touch2.clientY - touch1.clientY
          );
          
          const scale = currentDistance / touchStartDistance.current;
          
          // それぞれのモデルを個別にスケール
          const newCoicoiScale = Math.max(0.01, Math.min(0.5, currentCoicoiScale.current * scale));
          const newWkwkScale = Math.max(0.01, Math.min(0.5, currentWkwkScale.current * scale));
          
          // モデルのスケールを更新
          const modelCoicoi = document.querySelector('#model-coicoi');
          const modelWkwk = document.querySelector('#model-wkwk');
          
          if (modelCoicoi) {
            modelCoicoi.setAttribute('scale', `${newCoicoiScale} ${newCoicoiScale} ${newCoicoiScale}`);
          }
          if (modelWkwk) {
            modelWkwk.setAttribute('scale', `${newWkwkScale} ${newWkwkScale} ${newWkwkScale}`);
          }
          
          currentCoicoiScale.current = newCoicoiScale;
          currentWkwkScale.current = newWkwkScale;
          setCoicoiScale(newCoicoiScale);
          setWkwkScale(newWkwkScale);
          touchStartDistance.current = currentDistance;
        }
      };
      
      const handleTouchEnd = () => {
        touchStartDistance.current = null;
      };
      
      // タッチハンドラの参照を保存
      touchHandlersRef.current = {
        handleTouchStart,
        handleTouchMove,
        handleTouchEnd
      };
      
      // イベントリスナーを追加（passive化でスクロール競合を回避）
      document.addEventListener('touchstart', handleTouchStart, { passive: true });
      document.addEventListener('touchmove', handleTouchMove, { passive: true });
      document.addEventListener('touchend', handleTouchEnd, { passive: true });
      
    } catch (err) {
      console.error('AR initialization failed:', err);
      setError('AR初期化に失敗しました');
    }
  };

  const stopAR = async () => {
    console.log('Stopping AR session...');
    
    try {
      // MindARシステムを適切に停止
      const scene = containerRef.current?.querySelector('a-scene');
      if (scene && (scene as any).systems && (scene as any).systems['mindar-image-system']) {
        console.log('Stopping MindAR system...');
        const mindarSystem = (scene as any).systems['mindar-image-system'];
        
        // stop()メソッドを呼び出し
        if (mindarSystem.stop) {
          try {
            await mindarSystem.stop();
            console.log('MindAR system stopped');
          } catch (err) {
            console.error('Error stopping MindAR:', err);
          }
        }
        
        // pause()も呼び出して確実に停止
        if (mindarSystem.pause) {
          try {
            mindarSystem.pause();
            console.log('MindAR system paused');
          } catch (err) {
            console.error('Error pausing MindAR:', err);
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
            el.style.position === 'fixed' && el.style.zIndex === '10000') {
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

      // タッチイベントリスナーを正しく削除（passive化に対応）
      if (touchHandlersRef.current.handleTouchStart) {
        document.removeEventListener('touchstart', touchHandlersRef.current.handleTouchStart, { passive: true } as any);
      }
      if (touchHandlersRef.current.handleTouchMove) {
        document.removeEventListener('touchmove', touchHandlersRef.current.handleTouchMove, { passive: true } as any);
      }
      if (touchHandlersRef.current.handleTouchEnd) {
        document.removeEventListener('touchend', touchHandlersRef.current.handleTouchEnd, { passive: true } as any);
      }
      
      // 参照をクリア
      touchHandlersRef.current = {};

      setIsStarted(false);
      console.log('AR session stopped successfully');
      
    } catch (error) {
      console.error('Error stopping AR:', error);
      setIsStarted(false);
    }
  };


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
      const handleTouchStart = (e: TouchEvent) => {
        console.log('🟢 Back button touchstart!');
        handleBackClick(e);
      };

      const handleClick = (e: MouseEvent) => {
        console.log('🟢 Back button click!');
        handleBackClick(e);
      };

      const handlePointerDown = (e: PointerEvent) => {
        console.log('🟢 Back button pointerdown!');
        handleBackClick(e);
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
    }, [isStarted]); // isStartedに依存させてAR状態の変化を監視

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

  return (
    <div className="fixed inset-0 bg-black overflow-hidden">
      {/* AR Container */}
      <div 
        ref={containerRef} 
        className="fixed inset-0"
        style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', margin: 0, padding: 0, zIndex: 1 }}
      />

      {/* 戻るボタンをポータルでbody直下に描画 */}
      {isMounted && typeof document !== 'undefined' && createPortal(
        <BackButton />,
        document.body
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