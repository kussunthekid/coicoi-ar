'use client';

import React, { useEffect, useRef, useState } from 'react';
import { ArrowLeft, Camera } from 'lucide-react';
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

    // クリーンアップ関数
    return () => {
      if (isStarted) {
        stopAR();
      }
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
          z-index: 1 !important;
          pointer-events: auto !important;
        }
        a-scene canvas {
          position: fixed !important;
          top: 0 !important;
          left: 0 !important;
          width: 100% !important;
          height: 100% !important;
          display: block !important;
          z-index: 1 !important;
          pointer-events: auto !important;
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

      // Create A-Frame scene HTML - 公式例に基づいた正しい実装
      const sceneHTML = `
        <a-scene
          mindar-image="imageTargetSrc: /targets.mind;"
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
                  
                  // より大きなスケールにして確実に見えるようにする
                  gltfModel.setAttribute('scale', '2 2 2');
                  gltfModel.setAttribute('position', '0 0 0');
                  
                  console.log(`✅ GLTF model ${index} should now be VISIBLE with scale 2x2x2`);
                }
                
                console.log(`✅ All elements in anchor ${index} should be visible now`);
              });
              
              anchor.addEventListener('targetLost', () => {
                console.log(`❌ Target ${index} lost!`);
                const model = anchor.querySelector('a-gltf-model');
                const box = anchor.querySelector('a-box');
                const cylinder = anchor.querySelector('a-cylinder');
                const sphere = anchor.querySelector('a-sphere');
                
                if (model) {
                  model.setAttribute('visible', 'false');
                }
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
      
      // ピンチジェスチャーの処理を追加
      const handleTouchStart = (e: TouchEvent) => {
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
      
      // イベントリスナーを追加
      document.addEventListener('touchstart', handleTouchStart);
      document.addEventListener('touchmove', handleTouchMove);
      document.addEventListener('touchend', handleTouchEnd);
      
    } catch (err) {
      console.error('AR initialization failed:', err);
      setError('AR初期化に失敗しました');
    }
  };

  const stopAR = async () => {
    console.log('Stopping AR session...');
    
    try {
      // MindARを停止
      const scene = containerRef.current?.querySelector('a-scene');
      if (scene && (scene as any).systems && (scene as any).systems['mindar-image-system']) {
        console.log('Stopping MindAR system...');
        const mindarSystem = (scene as any).systems['mindar-image-system'];
        if (mindarSystem.stop) {
          await mindarSystem.stop();
        }
      }

      // すべてのvideo要素を停止
      const videos = document.querySelectorAll('video');
      videos.forEach(video => {
        console.log('Stopping video stream...');
        if (video.srcObject) {
          const stream = video.srcObject as MediaStream;
          stream.getTracks().forEach(track => {
            track.stop();
            console.log('Video track stopped');
          });
          video.srcObject = null;
        }
        video.pause();
        video.remove();
      });

      // A-Frameシーンを完全に削除
      if (containerRef.current) {
        containerRef.current.innerHTML = '';
      }

      // 追加したスタイルを削除
      const styleElement = document.querySelector('style[data-mindar-fullscreen]');
      if (styleElement) {
        styleElement.remove();
      }

      // MindAR UIオーバーレイを削除
      const mindarOverlays = document.querySelectorAll('.mindar-ui-overlay, .mindar-ui-scanning, .mindar-ui-loading');
      mindarOverlays.forEach(overlay => {
        overlay.remove();
      });

      // body/htmlスタイルをリセット
      document.body.style.cssText = '';
      document.documentElement.style.cssText = '';

      // タッチイベントリスナーを削除
      document.removeEventListener('touchstart', () => {});
      document.removeEventListener('touchmove', () => {});
      document.removeEventListener('touchend', () => {});

      setIsStarted(false);
      console.log('AR session stopped successfully');
      
    } catch (error) {
      console.error('Error stopping AR:', error);
      setIsStarted(false);
    }
  };


  return (
    <div className="fixed inset-0 bg-black overflow-hidden">
      {/* AR Container */}
      <div 
        ref={containerRef} 
        className="fixed inset-0"
        style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', margin: 0, padding: 0, zIndex: 1 }}
      />

      {/* ボタン専用コンテナ - 最前面に配置 */}
      <div 
        className="fixed inset-0 pointer-events-none"
        style={{ zIndex: 2147483647 }}
      >
        {/* 戻るボタン - 円形グラスモーフィズムデザイン - 常に表示 */}
        <button
        type="button"
        onMouseDown={async (e) => {
          e.preventDefault();
          e.stopPropagation();
          console.log('Back button mouse down (PC)!');
          
          try {
            // ARが開始されている場合は停止
            if (isStarted) {
              await stopAR();
              // 少し待ってからナビゲーション
              setTimeout(() => {
                console.log('Navigating to /start');
                router.push('/start');
              }, 200);
            } else {
              // ARが開始されていない場合は直接ナビゲーション
              console.log('Direct navigation to /start');
              router.push('/start');
            }
          } catch (error) {
            console.error('Error during cleanup:', error);
            // エラーが発生してもナビゲーションは実行
            router.push('/start');
          }
        }}
        onTouchStart={async (e) => {
          e.preventDefault();
          e.stopPropagation();
          console.log('Back button touch start (Mobile)!');
          
          try {
            // ARが開始されている場合は停止
            if (isStarted) {
              await stopAR();
              // 少し待ってからナビゲーション
              setTimeout(() => {
                console.log('Navigating to /start');
                router.push('/start');
              }, 200);
            } else {
              // ARが開始されていない場合は直接ナビゲーション
              console.log('Direct navigation to /start');
              router.push('/start');
            }
          } catch (error) {
            console.error('Error during cleanup:', error);
            // エラーが発生してもナビゲーションは実行
            router.push('/start');
          }
        }}
        onClick={async (e) => {
          e.preventDefault();
          e.stopPropagation();
          console.log('Back button clicked (Fallback)!');
          
          try {
            // ARが開始されている場合は停止
            if (isStarted) {
              await stopAR();
              // 少し待ってからナビゲーション
              setTimeout(() => {
                console.log('Navigating to /start');
                router.push('/start');
              }, 200);
            } else {
              // ARが開始されていない場合は直接ナビゲーション
              console.log('Direct navigation to /start');
              router.push('/start');
            }
          } catch (error) {
            console.error('Error during cleanup:', error);
            // エラーが発生してもナビゲーションは実行
            router.push('/start');
          }
        }}
          className="fixed bottom-6 left-6 w-16 h-16 rounded-full flex items-center justify-center backdrop-blur-md border-2 border-white/50 transition-all duration-200 active:scale-90 hover:scale-110 hover:border-white/70 pointer-events-auto cursor-pointer"
          style={{
            pointerEvents: 'auto',
            touchAction: 'manipulation',
            WebkitTapHighlightColor: 'transparent',
            userSelect: 'none',
            background: 'linear-gradient(135deg, rgba(75, 85, 99, 0.8), rgba(55, 65, 81, 0.6))',
            boxShadow: '0 12px 40px rgba(75, 85, 99, 0.6), inset 0 1px 0 rgba(255, 255, 255, 0.4)',
            WebkitUserSelect: 'none',
            MozUserSelect: 'none'
          }}
          aria-label="戻る"
        >
          <ArrowLeft className="w-7 h-7 text-white" />
        </button>
      </div>


      {/* Instructions - AR中のみ表示 */}
      {isStarted && (
        <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black/70 to-transparent pointer-events-none" style={{ zIndex: 10 }}>
          <div className="text-white text-center space-y-2">
            <p className="text-sm opacity-90">
              認識させたい画像をカメラに向けてください
            </p>
            <div className="flex justify-center space-x-4 text-xs">
              <span className="bg-black/50 px-3 py-1 rounded">
                両方の画像を認識中
              </span>
            </div>
          </div>
        </div>
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