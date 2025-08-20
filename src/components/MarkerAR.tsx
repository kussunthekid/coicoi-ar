'use client';

import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { GLTFLoader } from 'three-stdlib';
import { ArrowLeft, Camera, RotateCcw } from 'lucide-react';

declare global {
  interface Window {
    MINDAR: any;
  }
}

interface MarkerConfig {
  mindFile: string;
  modelFile: string;
  modelName: string;
}

const MarkerAR = () => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isInitialized, setIsInitialized] = useState(false);
  const [isStarted, setIsStarted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedMarker, setSelectedMarker] = useState<'coicoi' | 'wkwk'>('coicoi');
  const mindArRef = useRef<any>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const cameraRef = useRef<THREE.Camera | null>(null);

  const markerConfigs: Record<string, MarkerConfig> = {
    coicoi: {
      mindFile: '/targets_coicoi.mind',
      modelFile: '/coicoi.glb',
      modelName: 'coicoi'
    },
    wkwk: {
      mindFile: '/targets_wkwk.mind',
      modelFile: '/wkwk.glb',
      modelName: 'wkwk'
    }
  };

  useEffect(() => {
    const loadMindAR = async () => {
      try {
        // Load MindAR scripts dynamically
        if (!window.MINDAR) {
          console.log('Loading MindAR libraries...');
          
          // Use the AFRAME version which includes everything bundled
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

          // Wait a bit for the scripts to initialize
          await new Promise(resolve => setTimeout(resolve, 100));

          // Check if MINDAR is available
          if (window.MINDAR) {
            console.log('MINDAR loaded successfully');
            console.log('MINDAR components:', {
              IMAGE: !!window.MINDAR.IMAGE,
              MindARThree: !!window.MINDAR.IMAGE?.MindARThree
            });
          } else {
            throw new Error('MINDAR not available after loading scripts');
          }
        }
        
        setIsInitialized(true);
      } catch (err) {
        console.error('Failed to load MindAR:', err);
        setError('ARライブラリの読み込みに失敗しました。ページを再読み込みしてください。');
      }
    };

    loadMindAR();
  }, []);

  const checkCameraPermission = async () => {
    try {
      console.log('Checking camera permission...');
      
      // Check if getUserMedia is available
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('getUserMedia is not supported in this browser');
      }

      // Check permission state
      if (navigator.permissions) {
        const permission = await navigator.permissions.query({ name: 'camera' as PermissionName });
        console.log('Camera permission state:', permission.state);
        
        if (permission.state === 'denied') {
          throw new Error('Camera permission denied. Please enable camera access in browser settings.');
        }
      }

      // Test camera access
      console.log('Testing camera access...');
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { 
          facingMode: 'environment',
          width: { ideal: 1280 },
          height: { ideal: 720 }
        } 
      });
      
      console.log('Camera access successful:', stream);
      
      // Stop the test stream
      stream.getTracks().forEach(track => track.stop());
      
      return true;
    } catch (err) {
      console.error('Camera permission check failed:', err);
      throw err;
    }
  };

  const initializeAR = async () => {
    if (!containerRef.current) {
      console.error('Container ref not found');
      setError('コンテナが初期化されていません');
      return;
    }
    
    if (!window.MINDAR) {
      console.error('MINDAR library not loaded');
      setError('ARライブラリが読み込まれていません');
      return;
    }

    try {
      console.log('Starting AR initialization...');
      console.log('MINDAR available:', !!window.MINDAR);
      console.log('MINDAR.IMAGE available:', !!window.MINDAR?.IMAGE);
      console.log('MindARThree available:', !!window.MINDAR?.IMAGE?.MindARThree);
      
      // First check camera permissions
      await checkCameraPermission();
      console.log('Camera permission check passed');

      // Check if we're running on HTTPS or localhost
      if (location.protocol !== 'https:' && location.hostname !== 'localhost') {
        throw new Error('Camera access requires HTTPS or localhost');
      }

      console.log('Creating MindAR instance...');
      
      // Get selected marker configuration
      const config = markerConfigs[selectedMarker];
      console.log('Using marker config:', config);
      
      // First, check if the mind file exists
      try {
        const response = await fetch(config.mindFile);
        if (!response.ok) {
          throw new Error(`Failed to load mind file: ${response.status}`);
        }
        console.log('Mind file loaded successfully');
      } catch (err) {
        console.error('Mind file check failed:', err);
        throw new Error(`Mind file not found: ${config.mindFile}`);
      }
      
      // Initialize MindAR with custom mind file
      console.log('Initializing MindARThree...');
      const mindarThree = new window.MINDAR.IMAGE.MindARThree({
        container: containerRef.current,
        imageTargetSrc: config.mindFile,
        maxTrack: 1,
        uiLoading: 'yes',
        uiScanning: 'yes',
        uiError: 'yes'
      });

      console.log('MindAR instance created');

      const { renderer, scene, camera } = mindarThree;
      rendererRef.current = renderer;
      sceneRef.current = scene;
      cameraRef.current = camera;
      mindArRef.current = mindarThree;

      console.log('Loading 3D models...');

      // Load 3D models
      const loader = new GLTFLoader();
      
      // Load 3D model for the selected marker
      try {
        const gltf = await new Promise<any>((resolve, reject) => {
          loader.load(config.modelFile, resolve, undefined, reject);
        });
        
        const model = gltf.scene;
        model.scale.set(0.1, 0.1, 0.1);
        model.position.set(0, 0, 0);
        
        const anchor = mindarThree.addAnchor(0);
        anchor.group.add(model);
        console.log(`${config.modelName} model loaded`);
      } catch (err) {
        console.error(`Failed to load ${config.modelName} model:`, err);
      }

      // Add lighting
      const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
      scene.add(ambientLight);
      
      const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
      directionalLight.position.set(0, 1, 1);
      scene.add(directionalLight);

      console.log('Starting MindAR...');
      console.log('Starting MindAR (this may take a moment)...');
      await mindarThree.start();
      console.log('MindAR started successfully');
      setIsStarted(true);
      
    } catch (err) {
      console.error('AR initialization failed:', err);
      console.error('Error stack:', err instanceof Error ? err.stack : 'No stack trace');
      
      // Provide more specific error messages
      let errorMessage = 'Failed to initialize AR';
      if (err instanceof Error) {
        if (err.message.includes('getUserMedia')) {
          errorMessage = 'カメラにアクセスできません。ブラウザの設定でカメラの許可を確認してください。';
        } else if (err.message.includes('permission')) {
          errorMessage = 'カメラの許可が必要です。ブラウザの設定を確認してください。';
        } else if (err.message.includes('HTTPS')) {
          errorMessage = 'カメラアクセスにはHTTPS接続が必要です。';
        } else if (err.message.includes('mind file') || err.message.includes('Mind file')) {
          errorMessage = `マーカーファイルの読み込みエラー: ${err.message}`;
        } else if (err.message.includes('WebGL')) {
          errorMessage = 'WebGLがサポートされていません。別のブラウザを試してください。';
        } else {
          errorMessage = `初期化エラー: ${err.message}`;
        }
      }
      
      setError(errorMessage);
    }
  };

  const stopAR = async () => {
    if (mindArRef.current) {
      await mindArRef.current.stop();
      setIsStarted(false);
    }
  };

  const resetAR = async () => {
    await stopAR();
    setTimeout(() => initializeAR(), 500);
  };

  return (
    <div className="fixed inset-0 bg-black">
      {/* AR Container */}
      <div 
        ref={containerRef} 
        className="w-full h-full"
        style={{ position: 'relative' }}
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
          
          <h1 className="text-lg font-semibold">マーカーAR</h1>
          
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
            マーカーをカメラに向けてください
          </p>
          <div className="flex justify-center space-x-4 text-xs">
            <span className="bg-black/50 px-3 py-1 rounded">
              {selectedMarker === 'coicoi' ? 'coicoi_maker_1' : 'wkwk_maker_1'}を認識
            </span>
          </div>
        </div>
      </div>

      {/* Start Button */}
      {isInitialized && !isStarted && !error && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/80 z-20">
          <div className="text-white text-center">
            <h2 className="text-xl font-semibold mb-4">マーカーを選択</h2>
            <div className="flex gap-4 mb-6">
              <button
                onClick={() => setSelectedMarker('coicoi')}
                className={`px-6 py-3 rounded-lg transition-colors ${
                  selectedMarker === 'coicoi' 
                    ? 'bg-cyan-600 text-white' 
                    : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                }`}
              >
                coicoi_maker_1
              </button>
              <button
                onClick={() => setSelectedMarker('wkwk')}
                className={`px-6 py-3 rounded-lg transition-colors ${
                  selectedMarker === 'wkwk' 
                    ? 'bg-purple-600 text-white' 
                    : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                }`}
              >
                wkwk_maker_1
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

export default MarkerAR;