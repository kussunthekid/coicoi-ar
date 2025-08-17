import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { GLTFLoader } from 'three-stdlib';
import { Camera, SwitchCamera } from 'lucide-react';
import { Hands, Results } from '@mediapipe/hands';
import { Camera as MediaPipeCamera } from '@mediapipe/camera_utils';

interface Bubble {
  id: string;
  model: THREE.Object3D;
  velocity: THREE.Vector3;
  life: number;
  maxLife: number;
  scale: number;
  targetScale: number;
}

const HandTrackingBubbles = () => {
  const mountRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const frameRef = useRef<number | null>(null);
  const handsRef = useRef<Hands | null>(null);
  const mediaPipeCameraRef = useRef<MediaPipeCamera | null>(null);
  const videoStreamRef = useRef<MediaStream | null>(null);
  
  const [isActive, setIsActive] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);
  const [showFlash, setShowFlash] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('user');
  const [isSwitching, setIsSwitching] = useState(false);
  
  const bubblesRef = useRef<Bubble[]>([]);
  const wkwkModelRef = useRef<THREE.Object3D | null>(null);
  const handPositionsRef = useRef<THREE.Vector3[]>([]);


  // wkwkモデルを読み込み
  useEffect(() => {
    const loader = new GLTFLoader();
    loader.load(
      '/wkwk.glb',
      (gltf) => {
        wkwkModelRef.current = gltf.scene.clone();
        console.log('wkwk model loaded for bubbles');
      },
      undefined,
      (error) => {
        console.error('Error loading wkwk GLB model:', error);
        setError('モデル読み込みエラー');
      }
    );
  }, []);

  // 泡を作成する関数
  const createBubble = (position: THREE.Vector3) => {
    if (!wkwkModelRef.current || !sceneRef.current) return;

    // 放射状に広がる速度を生成
    const angle = Math.random() * Math.PI * 2; // ランダムな角度
    const speed = 0.01 + Math.random() * 0.02; // 速度のランダム性
    
    const bubble: Bubble = {
      id: Math.random().toString(36).substr(2, 9),
      model: wkwkModelRef.current.clone(),
      velocity: new THREE.Vector3(
        Math.cos(angle) * speed, // X方向：円状に広がる
        Math.random() * 0.015 + 0.01, // Y方向：上昇
        Math.sin(angle) * speed  // Z方向：円状に広がる
      ),
      life: 0,
      maxLife: 3 + Math.random() * 2, // 3-5秒の寿命
      scale: 0,
      targetScale: 0.05 + Math.random() * 0.1 // 0.05-0.15のランダムサイズ
    };

    // モデルの設定
    bubble.model.position.copy(position);
    bubble.model.scale.setScalar(0);
    bubble.model.traverse((child) => {
      if ((child as any).isMesh) {
        (child as any).material = (child as any).material.clone();
        (child as any).material.transparent = true;
        (child as any).material.opacity = 0.8;
      }
    });

    sceneRef.current.add(bubble.model);
    bubblesRef.current.push(bubble);
  };

  // 泡をアップデートする関数
  const updateBubbles = () => {
    const bubbles = bubblesRef.current;
    
    for (let i = bubbles.length - 1; i >= 0; i--) {
      const bubble = bubbles[i];
      bubble.life += 0.016; // 60FPSで約0.016秒/フレーム

      // 位置とスケールの更新
      bubble.model.position.add(bubble.velocity);
      
      // スケールアニメーション
      if (bubble.life < 0.5) {
        // 出現時
        bubble.scale = THREE.MathUtils.lerp(0, bubble.targetScale, bubble.life * 2);
      } else if (bubble.life > bubble.maxLife - 1) {
        // 消失時
        const fadeRatio = (bubble.maxLife - bubble.life);
        bubble.scale = THREE.MathUtils.lerp(0, bubble.targetScale, fadeRatio);
      } else {
        bubble.scale = bubble.targetScale;
      }
      
      bubble.model.scale.setScalar(bubble.scale);
      
      // 透明度の更新
      if (bubble.life > bubble.maxLife - 1) {
        const alpha = (bubble.maxLife - bubble.life);
        bubble.model.traverse((child) => {
          if ((child as any).isMesh) {
            (child as any).material.opacity = alpha * 0.8;
          }
        });
      }

      // 寿命が尽きた泡を削除
      if (bubble.life >= bubble.maxLife) {
        sceneRef.current?.remove(bubble.model);
        bubbles.splice(i, 1);
      }
    }
  };

  // MediaPipeの結果を処理
  const onResults = (results: Results) => {
    if (!results.multiHandLandmarks) return;

    const newHandPositions: THREE.Vector3[] = [];
    
    results.multiHandLandmarks.forEach((landmarks) => {
      // 手のひらの中心を計算
      // ランドマーク0（手首）、5（人差し指の付け根）、9（中指の付け根）、13（薬指の付け根）、17（小指の付け根）の中心
      const palmLandmarks = [landmarks[0], landmarks[5], landmarks[9], landmarks[13], landmarks[17]];
      
      let palmX = 0, palmY = 0, palmZ = 0;
      palmLandmarks.forEach(landmark => {
        palmX += landmark.x;
        palmY += landmark.y;
        palmZ += landmark.z;
      });
      
      // 平均を計算
      palmX /= palmLandmarks.length;
      palmY /= palmLandmarks.length;
      palmZ /= palmLandmarks.length;
      
      // MediaPipeの座標をThree.jsの座標に変換
      const x = (palmX - 0.5) * 4; // -2 to 2
      const y = -(palmY - 0.5) * 3; // -1.5 to 1.5 (反転)
      const z = -palmZ * 2; // 深度
      
      const position = new THREE.Vector3(x, y, z);
      newHandPositions.push(position);
      
      // 一定確率で泡を生成（手のひらから放射状に）
      if (Math.random() < 0.2) { // 20%に確率を下げてパフォーマンス向上
        // 泡の数も1個に減らす
        createBubble(position);
      }
    });

    handPositionsRef.current = newHandPositions;
  };

  useEffect(() => {
    if (!isActive) return;

    console.log('useEffect triggered with isActive:', isActive, 'isLoaded:', isLoaded);

    const initHandTracking = async () => {
      try {
        console.log('Starting hand tracking initialization');
        
        // 既存のリソースをクリーンアップ（再初期化の場合）
        if (rendererRef.current) {
          console.log('Cleaning up existing renderer');
          rendererRef.current.dispose();
          if (mountRef.current && rendererRef.current.domElement.parentNode) {
            mountRef.current.removeChild(rendererRef.current.domElement);
          }
          rendererRef.current = null;
        }

        // Three.jsシーンの初期化
        const width = window.innerWidth;
        const height = window.innerHeight;

        const scene = new THREE.Scene();
        sceneRef.current = scene;

        const camera = new THREE.PerspectiveCamera(75, width / height, 0.1, 1000);
        camera.position.z = 3;
        cameraRef.current = camera;

        const renderer = new THREE.WebGLRenderer({ 
          alpha: true,
          antialias: true,
          preserveDrawingBuffer: true  // 写真撮影のために描画バッファを保持
        });
        renderer.setSize(width, height);
        renderer.setPixelRatio(window.devicePixelRatio);
        renderer.setClearColor(0x000000, 0); // 完全透明な背景
        rendererRef.current = renderer;

        if (mountRef.current) {
          mountRef.current.appendChild(renderer.domElement);
        }

        // ライティング
        const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
        scene.add(ambientLight);
        
        const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
        directionalLight.position.set(1, 1, 1);
        scene.add(directionalLight);

        // MediaPipe Handsの初期化
        const hands = new Hands({
          locateFile: (file) => {
            return `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`;
          }
        });

        hands.setOptions({
          maxNumHands: 1, // モバイルでは1つの手のみ検出
          modelComplexity: 0, // 軽量モデルを使用
          minDetectionConfidence: 0.7, // 検出精度を上げて誤検知を減らす
          minTrackingConfidence: 0.7 // トラッキング精度を上げて処理を安定化
        });

        hands.onResults(onResults);
        handsRef.current = hands;

        // カメラの初期化
        const video = videoRef.current;
        if (video) {
          console.log('=== CAMERA INITIALIZATION ===');
          console.log('Initializing camera with facingMode:', facingMode);
          
          // 先にgetUserMediaでカメラアクセスを取得
          const stream = await navigator.mediaDevices.getUserMedia({
            video: {
              facingMode: facingMode,
              width: { ideal: 640 }, // 解像度を下げてパフォーマンス向上
              height: { ideal: 480 }
            },
            audio: false
          });
          
          const track = stream.getVideoTracks()[0];
          const settings = track.getSettings();
          console.log('Camera stream obtained with settings:', settings);
          console.log('Actual facing mode used:', settings.facingMode);
          
          video.srcObject = stream;
          await video.play();
          
          // ストリームを保存
          videoStreamRef.current = stream;
          
          // MediaPipeのカメラヘルパーを使用
          const mediaCamera = new MediaPipeCamera(video, {
            onFrame: async () => {
              if (handsRef.current && !isSwitching) {
                await handsRef.current.send({ image: video });
              }
            },
            width: 640, // 解像度を下げる
            height: 480
          });
          
          await mediaCamera.start();
          mediaPipeCameraRef.current = mediaCamera;
          
          console.log('MediaPipe camera started successfully');
        }

        setIsLoaded(true);

        // アニメーションループ
        const animate = () => {
          frameRef.current = requestAnimationFrame(animate);
          updateBubbles();
          renderer.render(scene, camera);
        };
        animate();

        // リサイズハンドラー
        const handleResize = () => {
          const newWidth = window.innerWidth;
          const newHeight = window.innerHeight;
          
          camera.aspect = newWidth / newHeight;
          camera.updateProjectionMatrix();
          renderer.setSize(newWidth, newHeight);
        };

        window.addEventListener('resize', handleResize);

        return () => {
          window.removeEventListener('resize', handleResize);
          if (frameRef.current) {
            cancelAnimationFrame(frameRef.current);
          }
          
          // MediaPipe Handsを適切にクローズ
          if (handsRef.current) {
            try {
              handsRef.current.close();
            } catch (error) {
              console.warn('Error closing hands during cleanup:', error);
            }
            handsRef.current = null;
          }
          
          // MediaPipeカメラを停止
          if (mediaPipeCameraRef.current) {
            try {
              mediaPipeCameraRef.current.stop();
            } catch (error) {
              console.warn('Error stopping MediaPipe camera during cleanup:', error);
            }
            mediaPipeCameraRef.current = null;
          }
          
          // ビデオストリームを停止
          if (videoStreamRef.current) {
            videoStreamRef.current.getTracks().forEach(track => track.stop());
            videoStreamRef.current = null;
          }
          
          renderer.dispose();
        };

      } catch (error) {
        console.error('Failed to initialize hand tracking:', error);
        setError('初期化エラー: ' + (error as Error).message);
        setIsLoaded(true);
      }
    };

    // 初回のみ初期化
    if (!isLoaded) {
      console.log('Triggering initHandTracking because isLoaded is false');
      initHandTracking();
    }
  }, [isActive, isLoaded, onResults, facingMode, isSwitching]);

  const capturePhoto = () => {
    if (!rendererRef.current || !videoRef.current) return;

    setShowFlash(true);
    setTimeout(() => setShowFlash(false), 150);

    // Three.jsのシーンを再レンダリングして最新の状態をキャプチャ
    const renderer = rendererRef.current;
    const scene = sceneRef.current;
    const camera = cameraRef.current;
    
    if (!scene || !camera) return;

    // Three.jsの現在のフレームをレンダリング
    renderer.render(scene, camera);

    // キャンバスを作成してビデオとThree.jsの画面を合成
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const video = videoRef.current;
    const threeCanvas = renderer.domElement;
    
    // ビデオの実際のアスペクト比を保持
    const videoAspectRatio = video.videoWidth / video.videoHeight;
    const screenAspectRatio = window.innerWidth / window.innerHeight;
    
    let canvasWidth, canvasHeight;
    let videoDrawWidth, videoDrawHeight;
    let videoX = 0, videoY = 0;
    
    // ビデオの実際の解像度をベースにキャンバスサイズを決定
    if (videoAspectRatio > screenAspectRatio) {
      // ビデオが横長の場合：幅を基準にする
      canvasWidth = video.videoWidth;
      canvasHeight = video.videoWidth / screenAspectRatio;
      videoDrawWidth = video.videoWidth;
      videoDrawHeight = video.videoHeight;
    } else {
      // ビデオが縦長の場合：高さを基準にする
      canvasWidth = video.videoHeight * screenAspectRatio;
      canvasHeight = video.videoHeight;
      videoDrawWidth = video.videoWidth;
      videoDrawHeight = video.videoHeight;
    }
    
    canvas.width = canvasWidth;
    canvas.height = canvasHeight;

    // 1. ビデオフレームを中央に配置して描画（アスペクト比を保持）
    videoX = (canvasWidth - videoDrawWidth) / 2;
    videoY = (canvasHeight - videoDrawHeight) / 2;
    ctx.drawImage(video, videoX, videoY, videoDrawWidth, videoDrawHeight);

    // 2. Three.jsのキャンバスを上に合成（キャンバス全体にフィット）
    ctx.globalCompositeOperation = 'source-over';
    ctx.drawImage(threeCanvas, 0, 0, canvasWidth, canvasHeight);

    // デバッグ情報
    console.log('Video resolution:', video.videoWidth, 'x', video.videoHeight);
    console.log('Video aspect ratio:', videoAspectRatio);
    console.log('Screen aspect ratio:', screenAspectRatio);
    console.log('Canvas size:', canvasWidth, 'x', canvasHeight);
    console.log('Video draw size:', videoDrawWidth, 'x', videoDrawHeight);

    // 画像データを取得してダウンロード
    const imageData = canvas.toDataURL('image/png');

    const link = document.createElement('a');
    link.download = `hand-bubbles-${Date.now()}.png`;
    link.href = imageData;
    link.click();
  };

  const startTracking = () => {
    setIsActive(true);
  };

  const switchCamera = async () => {
    if (isSwitching || !videoRef.current || !handsRef.current) return;
    
    try {
      console.log('Switching camera from', facingMode);
      setIsSwitching(true);
      setError('カメラを切り替え中...');
      
      // MediaPipe Handsインスタンスを完全に停止・破棄
      if (handsRef.current) {
        try {
          await handsRef.current.close();
        } catch (closeError) {
          console.warn('Error closing hands:', closeError);
        }
        handsRef.current = null;
      }
      
      // MediaPipeカメラを完全に停止
      if (mediaPipeCameraRef.current) {
        try {
          await mediaPipeCameraRef.current.stop();
        } catch (stopError) {
          console.warn('Error stopping MediaPipe camera:', stopError);
        }
        mediaPipeCameraRef.current = null;
      }
      
      // 現在のストリームを停止
      if (videoStreamRef.current) {
        videoStreamRef.current.getTracks().forEach(track => {
          track.stop();
          console.log('Stopped track:', track.label);
        });
        videoStreamRef.current = null;
      }
      
      // ビデオ要素のストリームをクリア
      const video = videoRef.current;
      video.srcObject = null;
      
      const newFacingMode = facingMode === 'user' ? 'environment' : 'user';
      
      // 新しいストリームを取得（exactを使用）
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { exact: newFacingMode },
          width: { ideal: 640 },
          height: { ideal: 480 }
        },
        audio: false
      });
      
      // ビデオ要素を更新
      video.srcObject = stream;
      await video.play();
      
      // ストリームを保存
      videoStreamRef.current = stream;
      
      // MediaPipe Handsを完全に再作成
      const hands = new Hands({
        locateFile: (file) => {
          return `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`;
        }
      });

      hands.setOptions({
        maxNumHands: 1,
        modelComplexity: 0,
        minDetectionConfidence: 0.7,
        minTrackingConfidence: 0.7
      });

      hands.onResults(onResults);
      handsRef.current = hands;
      
      // MediaPipeカメラを再作成
      const mediaCamera = new MediaPipeCamera(video, {
        onFrame: async () => {
          if (handsRef.current && !isSwitching) {
            await handsRef.current.send({ image: video });
          }
        },
        width: 640,
        height: 480
      });
      
      await mediaCamera.start();
      mediaPipeCameraRef.current = mediaCamera;
      
      // 状態を更新
      setFacingMode(newFacingMode);
      setError(null);
      setIsSwitching(false);
      
      console.log(`Camera switched to ${newFacingMode} mode`);
    } catch (error) {
      console.error('Camera switch error:', error);
      setError('カメラ切り替えエラー: ' + (error as Error).message);
      setIsSwitching(false);
    }
  };

  return (
    <div className="relative w-full h-screen overflow-hidden bg-black">
      {!isActive ? (
        <div 
          onClick={startTracking}
          className="relative flex items-center justify-center h-full cursor-pointer overflow-hidden"
          style={{
            background: 'linear-gradient(135deg, #1e1b4b 0%, #312e81 25%, #3730a3 50%, #1e1b4b 75%, #312e81 100%)',
            backgroundSize: '400% 400%',
            animation: 'waveGradient 15s ease infinite'
          }}
        >
          <div className="text-center relative z-10">
            <div className="mb-6">
              <Camera className="w-20 h-20 sm:w-24 sm:h-24 md:w-28 md:h-28 text-white drop-shadow-2xl animate-bounce mx-auto" />
            </div>
            <p className="text-white text-lg sm:text-xl font-light drop-shadow-lg mb-4">タップして手追跡を開始</p>
            <p className="text-white text-sm opacity-75 drop-shadow-lg">手を動かして泡のようなwkwkを生成</p>
          </div>
        </div>
      ) : (
        <>
          {/* カメラビデオ（背景として表示） */}
          <video
            ref={videoRef}
            className="absolute top-0 left-0 w-full h-full object-cover"
            playsInline
            muted
            autoPlay
          />

          {/* Three.jsマウント（透明背景でビデオの上に重ねる） */}
          <div 
            ref={mountRef}
            className="absolute top-0 left-0 w-full h-full"
          />

          {/* 初期化中またはエラーの表示 */}
          {!isLoaded && (
            <div className="absolute top-4 left-1/2 transform -translate-x-1/2 bg-black bg-opacity-70 text-white px-4 py-2 rounded-lg">
              <div className="text-sm text-center">手追跡を初期化中...</div>
            </div>
          )}
          
          {isLoaded && error && (
            <div className="absolute top-4 left-1/2 transform -translate-x-1/2 bg-red-600 bg-opacity-80 text-white px-4 py-2 rounded-lg">
              <div className="text-sm text-center">{error}</div>
            </div>
          )}

          {/* カメラ切り替えボタン（右上・統一デザイン） */}
          {isLoaded && (
            <button
              type="button"
              onClick={switchCamera}
              className="absolute top-4 right-4 w-12 h-12 sm:w-14 sm:h-14 backdrop-blur-xl rounded-full flex items-center justify-center border border-gray-400 border-opacity-30 shadow-2xl transition-all hover:scale-110 active:scale-95"
              title={facingMode === 'environment' ? 'インカメラに切り替え' : 'アウトカメラに切り替え'}
              style={{
                background: 'linear-gradient(135deg, rgba(59, 130, 246, 0.4), rgba(37, 99, 235, 0.2))',
                boxShadow: '0 8px 32px rgba(59, 130, 246, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.2)'
              }}
            >
              <SwitchCamera className="w-6 h-6 sm:w-7 sm:h-7 text-white drop-shadow-lg" />
            </button>
          )}

          {/* 撮影ボタン */}
          <div className="absolute left-1/2 transform -translate-x-1/2" style={{ bottom: '10%' }}>
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
          </div>

          {/* フラッシュエフェクト */}
          {showFlash && (
            <div className="absolute inset-0 bg-white pointer-events-none animate-pulse" />
          )}

          {/* 説明テキスト */}
          {isLoaded && !error && (
            <div className="absolute top-4 left-4 bg-black bg-opacity-50 text-white px-3 py-2 rounded-lg">
              <div className="text-sm">手を動かして泡を生成しよう！</div>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default HandTrackingBubbles;