'use client';

import React, { useEffect, useRef, useState } from 'react';
import { ArrowLeft, Camera, RotateCcw } from 'lucide-react';

declare global {
  interface Window {
    MINDAR: any;
    THREE: any;
  }
}

interface MarkerConfig {
  mindFile: string;
  modelFile: string;
  modelName: string;
}

const ThreeARFrame = () => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isInitialized, setIsInitialized] = useState(false);
  const [isStarted, setIsStarted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedMarker, setSelectedMarker] = useState<'coicoi' | 'wkwk'>('coicoi');
  
  // Three.js関連の参照
  const mindarRef = useRef<any>(null);
  const rendererRef = useRef<any>(null);
  const sceneRef = useRef<any>(null);
  const cameraRef = useRef<any>(null);
  const mixersRef = useRef<any[]>([]);

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
    const loadLibraries = async () => {
      try {
        if (!window.THREE || !window.MINDAR) {
          console.log('Loading Three.js and MindAR libraries...');
          
          // Load Three.js first
          if (!window.THREE) {
            await new Promise<void>((resolve, reject) => {
              const script = document.createElement('script');
              script.src = 'https://unpkg.com/three@0.147.0/build/three.min.js';
              script.onload = () => {
                console.log('Three.js loaded');
                resolve();
              };
              script.onerror = () => {
                console.error('Failed to load Three.js');
                reject(new Error('Failed to load Three.js'));
              };
              document.head.appendChild(script);
            });
          }

          // Load GLTFLoader
          if (!window.THREE.GLTFLoader) {
            await new Promise<void>((resolve, reject) => {
              const script = document.createElement('script');
              script.src = 'https://unpkg.com/three@0.147.0/examples/js/loaders/GLTFLoader.js';
              script.onload = () => {
                console.log('GLTFLoader loaded');
                resolve();
              };
              script.onerror = () => {
                console.error('Failed to load GLTFLoader');
                reject(new Error('Failed to load GLTFLoader'));
              };
              document.head.appendChild(script);
            });
          }

          // Load MindAR
          if (!window.MINDAR) {
            await new Promise<void>((resolve, reject) => {
              const script = document.createElement('script');
              script.src = 'https://unpkg.com/mind-ar@1.2.5/dist/mindar-image-three.prod.js';
              script.onload = () => {
                console.log('MindAR loaded');
                resolve();
              };
              script.onerror = () => {
                console.error('Failed to load MindAR');
                reject(new Error('Failed to load MindAR'));
              };
              document.head.appendChild(script);
            });
          }

          await new Promise(resolve => setTimeout(resolve, 1000));
          console.log('All libraries loaded successfully');
        }
        
        setIsInitialized(true);
      } catch (err) {
        console.error('Failed to load libraries:', err);
        setError('ARライブラリの読み込みに失敗しました。ページを再読み込みしてください。');
      }
    };

    loadLibraries();
  }, []);

  const initializeAR = async () => {
    if (!containerRef.current) {
      setError('コンテナが見つかりません');
      return;
    }

    try {
      console.log('Starting Three.js AR initialization...');

      const config = markerConfigs[selectedMarker];
      console.log('Using marker config:', config);

      // Initialize MindAR
      const mindarThree = new window.MINDAR.IMAGE.MindARThree({
        container: containerRef.current,
        imageTargetSrc: config.mindFile,
        filterMinCF: 0.0001,
        filterBeta: 1000,
        missTolerance: 5,
        warmupTolerance: 5,
      });

      mindarRef.current = mindarThree;
      const { renderer, scene, camera } = mindarThree;
      
      rendererRef.current = renderer;
      sceneRef.current = scene;
      cameraRef.current = camera;

      console.log('MindAR Three.js initialized');

      // Add lights
      const ambientLight = new window.THREE.AmbientLight(0xffffff, 0.6);
      scene.add(ambientLight);

      const directionalLight = new window.THREE.DirectionalLight(0xffffff, 0.8);
      directionalLight.position.set(0, 1, 1);
      scene.add(directionalLight);

      // Load both models
      const loader = new window.THREE.GLTFLoader();
      
      // Coicoi model (target index 0)
      const coicoiAnchor = mindarThree.addAnchor(0);
      
      // Test box for coicoi
      const coicoiBoxGeometry = new window.THREE.BoxGeometry(0.5, 0.5, 0.5);
      const coicoiBoxMaterial = new window.THREE.MeshBasicMaterial({ color: 0xff0000 });
      const coicoiBox = new window.THREE.Mesh(coicoiBoxGeometry, coicoiBoxMaterial);
      coicoiBox.position.set(0, 0.5, 0);
      coicoiAnchor.group.add(coicoiBox);

      // Load coicoi 3D model
      loader.load('/coicoi.glb', (gltf) => {
        console.log('Coicoi model loaded');
        const model = gltf.scene;
        model.scale.set(1, 1, 1);
        model.position.set(0, 0, 0);
        coicoiAnchor.group.add(model);

        // Animation mixer if the model has animations
        if (gltf.animations && gltf.animations.length > 0) {
          const mixer = new window.THREE.AnimationMixer(model);
          gltf.animations.forEach((clip) => {
            mixer.clipAction(clip).play();
          });
          mixersRef.current.push(mixer);
        }
      }, undefined, (error) => {
        console.error('Error loading coicoi model:', error);
      });

      // WKWK model (target index 1)
      const wkwkAnchor = mindarThree.addAnchor(1);
      
      // Test box for wkwk
      const wkwkBoxGeometry = new window.THREE.BoxGeometry(0.5, 0.5, 0.5);
      const wkwkBoxMaterial = new window.THREE.MeshBasicMaterial({ color: 0xffff00 });
      const wkwkBox = new window.THREE.Mesh(wkwkBoxGeometry, wkwkBoxMaterial);
      wkwkBox.position.set(0, 0.5, 0);
      wkwkAnchor.group.add(wkwkBox);

      // Load wkwk 3D model
      loader.load('/wkwk.glb', (gltf) => {
        console.log('WKWK model loaded');
        const model = gltf.scene;
        model.scale.set(1, 1, 1);
        model.position.set(0, 0, 0);
        wkwkAnchor.group.add(model);

        // Animation mixer if the model has animations
        if (gltf.animations && gltf.animations.length > 0) {
          const mixer = new window.THREE.AnimationMixer(model);
          gltf.animations.forEach((clip) => {
            mixer.clipAction(clip).play();
          });
          mixersRef.current.push(mixer);
        }
      }, undefined, (error) => {
        console.error('Error loading wkwk model:', error);
      });

      // Event listeners
      coicoiAnchor.onTargetFound = () => {
        console.log('🎯 Coicoi target found!');
      };
      
      coicoiAnchor.onTargetLost = () => {
        console.log('❌ Coicoi target lost!');
      };

      wkwkAnchor.onTargetFound = () => {
        console.log('🎯 WKWK target found!');
      };
      
      wkwkAnchor.onTargetLost = () => {
        console.log('❌ WKWK target lost!');
      };

      // Start AR
      await mindarThree.start();
      console.log('✅ MindAR Three.js started successfully');

      // Animation loop
      const clock = new window.THREE.Clock();
      const animate = () => {
        requestAnimationFrame(animate);
        
        // Update animation mixers
        const delta = clock.getDelta();
        mixersRef.current.forEach((mixer) => {
          mixer.update(delta);
        });
        
        renderer.render(scene, camera);
      };
      animate();

      setIsStarted(true);
      
    } catch (err) {
      console.error('AR initialization failed:', err);
      setError('AR初期化に失敗しました: ' + err.message);
    }
  };

  const stopAR = async () => {
    try {
      if (mindarRef.current) {
        await mindarRef.current.stop();
        mindarRef.current = null;
      }
      
      // Clear animation mixers
      mixersRef.current = [];
      
      if (containerRef.current) {
        containerRef.current.innerHTML = '';
      }
      
      setIsStarted(false);
      console.log('AR stopped');
    } catch (err) {
      console.error('Error stopping AR:', err);
    }
  };

  const resetAR = async () => {
    await stopAR();
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
            onClick={() => {
              stopAR();
              window.location.href = '/start';
            }}
            className="flex items-center gap-2 px-4 py-2 bg-black/50 rounded-lg backdrop-blur-sm hover:bg-black/70 transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
            戻る
          </button>
          
          <h1 className="text-lg font-semibold">Three.js画像認識AR</h1>
          
          <button
            onClick={resetAR}
            className="flex items-center gap-2 px-4 py-2 bg-black/50 rounded-lg backdrop-blur-sm hover:bg-black/70 transition-colors"
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
              Three.js版で動作中
            </span>
          </div>
        </div>
      </div>

      {/* Start Button */}
      {isInitialized && !isStarted && !error && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/80 z-20">
          <div className="text-white text-center">
            <h2 className="text-xl font-semibold mb-4">Three.js AR開始</h2>
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
              Three.js ARを開始
            </button>
          </div>
        </div>
      )}

      {/* Loading State */}
      {!isInitialized && !error && (
        <div className="absolute inset-0 flex items-center justify-center bg-black z-20">
          <div className="text-white text-center">
            <div className="animate-spin w-8 h-8 border-2 border-cyan-600 border-t-transparent rounded-full mx-auto mb-4"></div>
            <p>Three.js & MindARライブラリを読み込み中...</p>
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
            <div className="space-y-3">
              <button
                onClick={() => window.location.reload()}
                className="block w-full px-6 py-3 bg-cyan-600 hover:bg-cyan-700 text-white rounded-lg transition-colors"
              >
                再試行
              </button>
              <button
                onClick={() => {
                  window.location.href = '/start';
                }}
                className="block w-full px-6 py-3 bg-gray-600 hover:bg-gray-700 text-white rounded-lg transition-colors"
              >
                スタート画面に戻る
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ThreeARFrame;