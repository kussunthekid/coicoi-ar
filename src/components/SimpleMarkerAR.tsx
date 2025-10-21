'use client';

import React, { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Camera } from 'lucide-react';
import dynamic from 'next/dynamic';
import { saveCollectedModels, loadCollectedModels } from '@/utils/indexedDB';

const ModelViewer3D = dynamic(() => import('./ModelViewer3D'), {
  ssr: false
});

const CompleteModal = dynamic(() => import('./CompleteModal'), {
  ssr: false
});

const SimpleMarkerAR = () => {
  const router = useRouter();
  const containerRef = useRef<HTMLDivElement>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [showFlash, setShowFlash] = useState(false);
  const [collectedModels, setCollectedModels] = useState<string[]>([]);
  const [selectedModel, setSelectedModel] = useState<string | null>(null);
  const [showComplete, setShowComplete] = useState(false);
  const scaleRef = useRef(0.5);

  const modelNames = ['wkwk_blue', 'wkwk_gold', 'wkwk_green', 'wkwk_pencil', 'wkwk_pink'];

  // IndexedDBからコレクションデータを読み込み
  useEffect(() => {
    const loadData = async () => {
      try {
        const savedModels = await loadCollectedModels();
        if (savedModels.length > 0) {
          setCollectedModels(savedModels);
          console.log('Loaded collected models from IndexedDB:', savedModels);
        }
      } catch (error) {
        console.error('Failed to load from IndexedDB:', error);
      }
    };
    loadData();
  }, []);

  // collectedModelsが変更されたらIndexedDBに保存
  useEffect(() => {
    if (collectedModels.length > 0) {
      saveCollectedModels(collectedModels)
        .then(() => {
          console.log('Saved to IndexedDB:', collectedModels);
        })
        .catch((error) => {
          console.error('Failed to save to IndexedDB:', error);
        });
    }
  }, [collectedModels]);

  useEffect(() => {
    let isMounted = true;

    // bodyのスタイルを設定（全画面表示）
    document.body.style.margin = '0';
    document.body.style.padding = '0';
    document.body.style.overflow = 'hidden';
    document.documentElement.style.margin = '0';
    document.documentElement.style.padding = '0';
    document.documentElement.style.overflow = 'hidden';

    // A-FrameとMindARのスクリプトを読み込み
    const loadScripts = async () => {
      if (!isMounted) return;

      try {
        // A-Frameを読み込み
        if (!document.getElementById('aframe-script')) {
          const aframeScript = document.createElement('script');
          aframeScript.id = 'aframe-script';
          aframeScript.src = 'https://aframe.io/releases/1.5.0/aframe.min.js';
          document.head.appendChild(aframeScript);
          await new Promise((resolve) => {
            aframeScript.onload = () => {
              console.log('A-Frame loaded');
              resolve(true);
            };
          });
        }

        if (!isMounted) return;

        // AFRAMEが利用可能になるまで待機
        await new Promise((resolve) => {
          const checkAframe = () => {
            if (typeof (window as any).AFRAME !== 'undefined') {
              console.log('AFRAME is ready');
              resolve(true);
            } else {
              setTimeout(checkAframe, 100);
            }
          };
          checkAframe();
        });

        if (!isMounted) return;

        // A-Frame Extrasを読み込み
        if (!document.getElementById('aframe-extras-script')) {
          const extrasScript = document.createElement('script');
          extrasScript.id = 'aframe-extras-script';
          extrasScript.src = 'https://cdn.jsdelivr.net/gh/donmccurdy/aframe-extras@v7.0.0/dist/aframe-extras.min.js';
          document.head.appendChild(extrasScript);
          await new Promise((resolve) => {
            extrasScript.onload = () => {
              console.log('A-Frame Extras loaded');
              resolve(true);
            };
          });
        }

        if (!isMounted) return;

        // MindARを読み込み
        if (!document.getElementById('mindar-script')) {
          const mindarScript = document.createElement('script');
          mindarScript.id = 'mindar-script';
          mindarScript.src = 'https://cdn.jsdelivr.net/npm/mind-ar@1.2.5/dist/mindar-image-aframe.prod.js';
          document.head.appendChild(mindarScript);
          await new Promise((resolve) => {
            mindarScript.onload = () => {
              console.log('MindAR loaded');
              resolve(true);
            };
          });
        }

        if (!isMounted) return;

        // A-Frameシーンを作成
        if (containerRef.current) {
          containerRef.current.innerHTML = `
            <a-scene
              mindar-image="imageTargetSrc: /targets.mind; maxTrack: 1; uiScanning: none; uiLoading: no; filterMinCF: 0.0001; filterBeta: 0.001; warmupTolerance: 5; missTolerance: 5"
              color-space="sRGB"
              renderer="colorManagement: true, physicallyCorrectLights: true"
              vr-mode-ui="enabled: false"
              device-orientation-permission-ui="enabled: false"
              style="position: fixed; top: 0; left: 0; width: 100vw; height: 100vh; margin: 0; padding: 0;"
            >
              <style>
                .a-canvas {
                  position: fixed !important;
                  top: 0 !important;
                  left: 0 !important;
                  width: 100vw !important;
                  height: 100vh !important;
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
                }
                a-scene {
                  pointer-events: none !important;
                }
              </style>
              <a-assets>
                <a-asset-item id="wkwk-blue-model" src="/wkwk_blue.glb"></a-asset-item>
                <a-asset-item id="wkwk-gold-model" src="/wkwk_gold.glb"></a-asset-item>
                <a-asset-item id="wkwk-green-model" src="/wkwk_green.glb"></a-asset-item>
                <a-asset-item id="wkwk-pencil-model" src="/wkwk_pencil.glb"></a-asset-item>
                <a-asset-item id="wkwk-pink-model" src="/wkwk_pink.glb"></a-asset-item>
              </a-assets>

              <a-camera position="0 0 0" look-controls="enabled: false"></a-camera>

              <!-- ライティング - より明るく -->
              <a-light type="ambient" color="#ffffff" intensity="2.0"></a-light>
              <a-light type="directional" color="#ffffff" intensity="2.5" position="2 3 1"></a-light>
              <a-light type="directional" color="#ffffff" intensity="1.8" position="-2 3 -1"></a-light>
              <a-light type="directional" color="#ffffff" intensity="1.5" position="0 3 2"></a-light>
              <a-light type="hemisphere" color="#ffffff" ground-color="#cccccc" intensity="1.5"></a-light>

              <a-entity mindar-image-target="targetIndex: 0">
                <a-gltf-model rotation="90 0 0" position="0 0 0" scale="0.5 0.5 0.5" src="#wkwk-blue-model" animation-mixer class="brightModel"></a-gltf-model>
              </a-entity>
              <a-entity mindar-image-target="targetIndex: 1">
                <a-gltf-model rotation="90 0 0" position="0 0 0" scale="0.5 0.5 0.5" src="#wkwk-gold-model" animation-mixer class="brightModel"></a-gltf-model>
              </a-entity>
              <a-entity mindar-image-target="targetIndex: 2">
                <a-gltf-model rotation="90 0 0" position="0 0 0" scale="0.5 0.5 0.5" src="#wkwk-green-model" animation-mixer class="brightModel"></a-gltf-model>
              </a-entity>
              <a-entity mindar-image-target="targetIndex: 3">
                <a-gltf-model rotation="90 0 0" position="0 0 0" scale="0.5 0.5 0.5" src="#wkwk-pencil-model" animation-mixer class="brightModel"></a-gltf-model>
              </a-entity>
              <a-entity mindar-image-target="targetIndex: 4">
                <a-gltf-model rotation="90 0 0" position="0 0 0" scale="0.5 0.5 0.5" src="#wkwk-pink-model" animation-mixer class="brightModel"></a-gltf-model>
              </a-entity>
            </a-scene>
          `;

          // A-Frameシーンが完全に読み込まれるまで待機
          await new Promise((resolve) => {
            const scene = document.querySelector('a-scene');
            if (scene) {
              // render-targetイベントでレンダラーを設定
              scene.addEventListener('render-target-loaded', () => {
                const sceneEl = scene as any;
                if (sceneEl.renderer) {
                  console.log('Setting up renderer for screenshot capability');
                  sceneEl.renderer.preserveDrawingBuffer = true;
                }
              });

              scene.addEventListener('loaded', () => {
                console.log('A-Frame scene loaded event');

                // 全てのモデルのマテリアルを明るく設定
                setTimeout(() => {
                  const models = document.querySelectorAll('a-gltf-model');
                  models.forEach((modelEl) => {
                    const model = (modelEl as any).object3D;
                    if (model) {
                      model.traverse((child: any) => {
                        if (child.isMesh && child.material) {
                          // マテリアルを明るく調整
                          if (Array.isArray(child.material)) {
                            child.material.forEach((mat: any) => {
                              mat.emissive = mat.emissive || new (window as any).THREE.Color(0x222222);
                              mat.emissiveIntensity = 0.3;
                              if (mat.color) {
                                mat.color.r = Math.min(1.0, mat.color.r * 1.4);
                                mat.color.g = Math.min(1.0, mat.color.g * 1.4);
                                mat.color.b = Math.min(1.0, mat.color.b * 1.4);
                              }
                              mat.needsUpdate = true;
                            });
                          } else {
                            child.material.emissive = child.material.emissive || new (window as any).THREE.Color(0x222222);
                            child.material.emissiveIntensity = 0.3;
                            if (child.material.color) {
                              child.material.color.r = Math.min(1.0, child.material.color.r * 1.4);
                              child.material.color.g = Math.min(1.0, child.material.color.g * 1.4);
                              child.material.color.b = Math.min(1.0, child.material.color.b * 1.4);
                            }
                            child.material.needsUpdate = true;
                          }
                        }
                      });
                    }
                  });
                  console.log('Models brightness enhanced');
                }, 1000);

                resolve(true);
              });

              // タイムアウトフォールバック
              setTimeout(() => {
                console.log('A-Frame scene timeout fallback');
                resolve(true);
              }, 3000);
            } else {
              console.warn('A-Frame scene not found');
              resolve(true);
            }
          });

          setIsLoading(false);

          // スケール調整のイベントリスナーを追加
          setTimeout(() => {
            const models = document.querySelectorAll('a-gltf-model');

            // ホイールイベント（PC）
            const handleWheel = (e: WheelEvent) => {
              e.preventDefault();
              const delta = e.deltaY > 0 ? -0.05 : 0.05;
              scaleRef.current = Math.max(0.1, Math.min(2.0, scaleRef.current + delta));
              models.forEach(model => {
                model.setAttribute('scale', `${scaleRef.current} ${scaleRef.current} ${scaleRef.current}`);
              });
            };

            // タッチイベント（モバイル）
            let lastDistance = 0;
            const handleTouchStart = (e: TouchEvent) => {
              if (e.touches.length === 2) {
                const dx = e.touches[0].clientX - e.touches[1].clientX;
                const dy = e.touches[0].clientY - e.touches[1].clientY;
                lastDistance = Math.sqrt(dx * dx + dy * dy);
              }
            };

            const handleTouchMove = (e: TouchEvent) => {
              if (e.touches.length === 2) {
                e.preventDefault();
                const dx = e.touches[0].clientX - e.touches[1].clientX;
                const dy = e.touches[0].clientY - e.touches[1].clientY;
                const distance = Math.sqrt(dx * dx + dy * dy);

                if (lastDistance > 0) {
                  const delta = (distance - lastDistance) * 0.01;
                  scaleRef.current = Math.max(0.1, Math.min(2.0, scaleRef.current + delta));
                  models.forEach(model => {
                    model.setAttribute('scale', `${scaleRef.current} ${scaleRef.current} ${scaleRef.current}`);
                  });
                }
                lastDistance = distance;
              }
            };

            window.addEventListener('wheel', handleWheel, { passive: false });
            window.addEventListener('touchstart', handleTouchStart);
            window.addEventListener('touchmove', handleTouchMove, { passive: false });

            // クリーンアップ用に保存
            (window as any)._arCleanupListeners = () => {
              window.removeEventListener('wheel', handleWheel);
              window.removeEventListener('touchstart', handleTouchStart);
              window.removeEventListener('touchmove', handleTouchMove);
            };
          }, 1000);
        }
      } catch (error) {
        console.error('Failed to load AR:', error);
      }
    };

    loadScripts();

    // クリーンアップ
    return () => {
      isMounted = false;

      // イベントリスナーをクリーンアップ
      if ((window as any)._arCleanupListeners) {
        (window as any)._arCleanupListeners();
        delete (window as any)._arCleanupListeners;
      }

      // A-Frameシーンを削除
      const scene = document.querySelector('a-scene');
      if (scene) {
        // MindARシステムを停止
        const mindarSystem = (scene as any).systems?.['mindar-image-system'];
        if (mindarSystem && typeof mindarSystem.stop === 'function') {
          try {
            mindarSystem.stop();
          } catch (e) {
            console.warn('Failed to stop MindAR:', e);
          }
        }

        // ビデオストリームを停止
        const video = scene.querySelector('video');
        if (video && video.srcObject) {
          const stream = video.srcObject as MediaStream;
          stream.getTracks().forEach(track => track.stop());
        }

        scene.remove();
      }

      // bodyのスタイルをリセット
      document.body.style.margin = '';
      document.body.style.padding = '';
      document.body.style.overflow = '';
      document.documentElement.style.margin = '';
      document.documentElement.style.padding = '';
      document.documentElement.style.overflow = '';
    };
  }, []);

  const handleBack = () => {
    router.push('/start');
  };

  const handleGetModel = () => {
    // 現在表示されているモデルを検出してコレクションに追加（1つだけ）
    const scene = document.querySelector('a-scene');
    if (scene) {
      const targets = scene.querySelectorAll('[mindar-image-target]');
      let foundModel = null;

      // 最初に見つかった表示中のモデルを取得
      for (let i = 0; i < targets.length; i++) {
        const target = targets[i] as any;
        if (target.object3D && target.object3D.visible) {
          const modelName = modelNames[i];
          if (!collectedModels.includes(modelName)) {
            foundModel = modelName;
            break; // 最初の1つだけで終了
          }
        }
      }

      if (foundModel) {
        setCollectedModels(prev => {
          const newCollection = [...prev, foundModel];
          console.log('Collected model:', foundModel);

          // 5つ全部集まったかチェック
          if (newCollection.length === 5) {
            setTimeout(() => {
              setShowComplete(true);
            }, 500); // 少し遅延させてアニメーションを自然に
          }

          return newCollection;
        });
      } else {
        console.log('No new model found or already collected');
      }
    }
  };

  const capturePhoto = () => {
    console.log('Capture photo clicked');

    // シーン、ビデオ、キャンバスを取得
    const scene = document.querySelector('a-scene');
    console.log('Scene:', scene);

    // ビデオ要素を複数の方法で検索
    let video = scene?.querySelector('video');
    if (!video) {
      video = document.querySelector('video');
    }
    console.log('Video:', video);
    console.log('Video dimensions:', video?.videoWidth, 'x', video?.videoHeight);

    // キャンバス要素を複数の方法で検索
    let aframeCanvas = scene?.querySelector('canvas');
    if (!aframeCanvas) {
      aframeCanvas = document.querySelector('canvas');
    }
    console.log('Canvas:', aframeCanvas);
    console.log('Canvas dimensions:', (aframeCanvas as HTMLCanvasElement)?.width, 'x', (aframeCanvas as HTMLCanvasElement)?.height);

    if (!video) {
      console.error('Video not found');
      alert('カメラが見つかりません。しばらく待ってから再試行してください。');
      return;
    }

    if (!aframeCanvas) {
      console.error('Canvas not found');
      alert('キャンバスが見つかりません。しばらく待ってから再試行してください。');
      return;
    }

    // ビデオが準備できているか確認
    if (video.videoWidth === 0 || video.videoHeight === 0) {
      console.error('Video not ready');
      alert('カメラがまだ準備できていません。しばらく待ってから再試行してください。');
      return;
    }

    setShowFlash(true);
    setTimeout(() => setShowFlash(false), 150);

    // 現在の画面サイズ（実際に表示されているサイズ）
    const displayWidth = window.visualViewport?.width || window.innerWidth;
    const displayHeight = window.visualViewport?.height || window.innerHeight;

    // ビデオの表示サイズ（object-cover適用後）
    const videoAspectRatio = video.videoWidth / video.videoHeight;
    const displayAspectRatio = displayWidth / displayHeight;

    let videoDisplayWidth, videoDisplayHeight;
    let videoOffsetX = 0, videoOffsetY = 0;

    // object-coverの計算（短い辺に合わせてクロップ）
    if (videoAspectRatio > displayAspectRatio) {
      // ビデオが横長：高さに合わせて幅をクロップ
      videoDisplayHeight = displayHeight;
      videoDisplayWidth = displayHeight * videoAspectRatio;
      videoOffsetX = (displayWidth - videoDisplayWidth) / 2;
    } else {
      // ビデオが縦長：幅に合わせて高さをクロップ
      videoDisplayWidth = displayWidth;
      videoDisplayHeight = displayWidth / videoAspectRatio;
      videoOffsetY = (displayHeight - videoDisplayHeight) / 2;
    }

    // 最終的なキャンバスサイズは画面サイズに合わせる
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    canvas.width = displayWidth;
    canvas.height = displayHeight;

    // 1. ビデオフレーム全体を描画
    ctx.drawImage(video, 0, 0, video.videoWidth, video.videoHeight,
                 videoOffsetX, videoOffsetY, videoDisplayWidth, videoDisplayHeight);

    // 2. Three.jsシーンを別のキャンバスにレンダリング
    const sceneEl = scene as any;
    if (sceneEl.renderer && sceneEl.camera) {
      try {
        // 一時的なキャンバスを作成してThree.jsシーンをレンダリング
        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = displayWidth * window.devicePixelRatio;
        tempCanvas.height = displayHeight * window.devicePixelRatio;

        const THREE = (window as any).THREE;
        const tempRenderer = new THREE.WebGLRenderer({
          canvas: tempCanvas,
          alpha: true,
          preserveDrawingBuffer: true,
          antialias: true
        });
        tempRenderer.setSize(displayWidth, displayHeight);
        tempRenderer.setClearColor(0x000000, 0);

        // シーンをレンダリング
        tempRenderer.render(sceneEl.object3D, sceneEl.camera);

        // 3Dシーンを合成
        ctx.globalCompositeOperation = 'source-over';
        ctx.drawImage(tempCanvas, 0, 0, displayWidth, displayHeight);

        // 一時レンダラーを破棄
        tempRenderer.dispose();

        console.log('3D scene rendered to temporary canvas');
      } catch (err) {
        console.error('Failed to render 3D scene:', err);
      }
    }

    // デバッグ情報
    console.log('Display size:', displayWidth, 'x', displayHeight);
    console.log('Video resolution:', video.videoWidth, 'x', video.videoHeight);
    console.log('Video display size:', videoDisplayWidth, 'x', videoDisplayHeight);
    console.log('Video offset:', videoOffsetX, 'x', videoOffsetY);

    // 画像データを取得してダウンロード
    const imageData = canvas.toDataURL('image/png');

    const link = document.createElement('a');
    link.download = `ar-marker-${Date.now()}.png`;
    link.href = imageData;
    link.click();

    console.log('Photo captured successfully');
  };

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      width: '100vw',
      height: '100vh',
      margin: 0,
      padding: 0,
      overflow: 'hidden',
      background: '#000'
    }}>
      {/* 戻るボタン */}
      <button
        onClick={handleBack}
        className="w-12 h-12 sm:w-14 sm:h-14"
        style={{
          position: 'fixed',
          bottom: '10%',
          left: '15%',
          zIndex: 99999,
          background: 'linear-gradient(135deg, rgba(75, 85, 99, 0.4), rgba(55, 65, 81, 0.2))',
          border: '1px solid rgba(156, 163, 175, 0.3)',
          borderRadius: '50%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'pointer',
          color: 'white',
          pointerEvents: 'auto',
          backdropFilter: 'blur(12px)',
          boxShadow: '0 8px 32px rgba(75, 85, 99, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.2)',
          transition: 'all 0.2s'
        }}
        onMouseEnter={(e) => e.currentTarget.style.transform = 'scale(1.05)'}
        onMouseLeave={(e) => e.currentTarget.style.transform = 'scale(1)'}
        title="戻る"
      >
        <ArrowLeft className="w-6 h-6 sm:w-7 sm:h-7" style={{ filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.3))' }} />
      </button>

      {/* カメラボタン */}
      <div style={{
        position: 'fixed',
        bottom: '10%',
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 99999,
        pointerEvents: 'auto'
      }}>
        <button
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            capturePhoto();
          }}
          className="w-20 h-20 sm:w-24 sm:h-24 md:w-28 md:h-28 lg:w-32 lg:h-32 xl:w-36 xl:h-36"
          style={{
            background: 'linear-gradient(135deg, rgba(59, 130, 246, 0.8), rgba(34, 197, 94, 0.8))',
            border: '2px solid rgba(255, 255, 255, 0.2)',
            borderRadius: '50%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            color: 'white',
            pointerEvents: 'auto',
            backdropFilter: 'blur(12px)',
            boxShadow: '0 8px 32px rgba(59, 130, 246, 0.6), inset 0 2px 0 rgba(255, 255, 255, 0.1)',
            transition: 'all 0.2s'
          }}
          onMouseEnter={(e) => e.currentTarget.style.transform = 'scale(1.1)'}
          onMouseLeave={(e) => e.currentTarget.style.transform = 'scale(1)'}
          title="写真を撮影"
        >
          <Camera className="w-10 h-10 sm:w-12 sm:h-12 md:w-14 md:h-14 lg:w-16 lg:h-16 xl:w-18 xl:h-18" style={{ filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.3))' }} />
        </button>
      </div>

      {/* GETボタン（カメラの右横） */}
      <button
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          handleGetModel();
        }}
        className="w-16 h-16 sm:w-20 sm:h-20"
        style={{
          position: 'fixed',
          bottom: '10%',
          right: '15%',
          zIndex: 99999,
          background: 'linear-gradient(135deg, rgba(239, 68, 68, 0.8), rgba(220, 38, 38, 0.8))',
          border: '2px solid rgba(255, 255, 255, 0.2)',
          borderRadius: '50%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'pointer',
          color: 'white',
          pointerEvents: 'auto',
          backdropFilter: 'blur(12px)',
          boxShadow: '0 8px 32px rgba(239, 68, 68, 0.6), inset 0 2px 0 rgba(255, 255, 255, 0.1)',
          transition: 'all 0.2s',
          fontSize: '14px',
          fontWeight: 'bold'
        }}
        onMouseEnter={(e) => e.currentTarget.style.transform = 'scale(1.05)'}
        onMouseLeave={(e) => e.currentTarget.style.transform = 'scale(1)'}
        title="モデルをGET"
      >
        GET
      </button>

      {/* 収集したモデルのアイコン表示 */}
      {collectedModels.length > 0 && (
        <div style={{
          position: 'fixed',
          top: '20px',
          left: '50%',
          transform: 'translateX(-50%)',
          zIndex: 99999,
          display: 'flex',
          gap: '10px',
          pointerEvents: 'auto'
        }}>
          {collectedModels.map((modelName) => (
            <button
              key={modelName}
              onClick={() => setSelectedModel(modelName)}
              style={{
                width: '60px',
                height: '60px',
                borderRadius: '12px',
                background: 'linear-gradient(135deg, rgba(255, 255, 255, 0.9), rgba(200, 200, 200, 0.9))',
                border: '2px solid rgba(255, 255, 255, 0.5)',
                backdropFilter: 'blur(10px)',
                boxShadow: '0 4px 16px rgba(0, 0, 0, 0.2)',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '10px',
                fontWeight: 'bold',
                color: '#333',
                transition: 'all 0.2s'
              }}
              onMouseEnter={(e) => e.currentTarget.style.transform = 'scale(1.1)'}
              onMouseLeave={(e) => e.currentTarget.style.transform = 'scale(1)'}
            >
              {modelName.replace('wkwk_', '').toUpperCase()}
            </button>
          ))}
        </div>
      )}

      {/* ローディング表示 */}
      {isLoading && (
        <div style={{
          position: 'fixed',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          zIndex: 999,
          color: 'white',
          textAlign: 'center'
        }}>
          <div style={{
            width: '48px',
            height: '48px',
            border: '4px solid rgba(255, 255, 255, 0.3)',
            borderTop: '4px solid white',
            borderRadius: '50%',
            animation: 'spin 1s linear infinite',
            margin: '0 auto 16px'
          }} />
          <p>ARを読み込み中...</p>
        </div>
      )}

      {/* A-Frameコンテナ */}
      <div ref={containerRef} style={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        margin: 0,
        padding: 0,
        pointerEvents: 'none'
      }} />

      {/* フラッシュエフェクト */}
      {showFlash && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          background: 'white',
          pointerEvents: 'none',
          zIndex: 99998
        }} />
      )}

      {/* 3Dモデル鑑賞モーダル */}
      {selectedModel && (
        <ModelViewer3D
          modelName={selectedModel}
          onClose={() => setSelectedModel(null)}
        />
      )}

      {/* 全コンプリート祝福モーダル */}
      {showComplete && (
        <CompleteModal
          onClose={() => setShowComplete(false)}
        />
      )}

      <style jsx>{`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
};

export default SimpleMarkerAR;
