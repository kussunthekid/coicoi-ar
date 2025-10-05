import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { GLTFLoader } from 'three-stdlib';
import { Camera, ArrowLeft } from 'lucide-react';
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
  rotationSpeed: THREE.Vector3; // 回転速度を追加
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

    // より自然な泳ぐような動きを生成
    const angle = Math.random() * Math.PI * 2; // ランダムな角度
    const speed = 0.008 + Math.random() * 0.015; // より穏やかな初期速度
    const swimDirection = Math.random() * Math.PI * 2; // 泳ぐ方向
    
    const bubble: Bubble = {
      id: Math.random().toString(36).substr(2, 9),
      model: wkwkModelRef.current.clone(),
      velocity: new THREE.Vector3(
        Math.cos(angle) * speed + Math.cos(swimDirection) * 0.005, // X方向：ランダムドリフト追加
        Math.random() * 0.015 + 0.012, // Y方向：ゆるやかな上昇
        Math.sin(angle) * speed + Math.sin(swimDirection) * 0.005  // Z方向：ランダムドリフト追加
      ),
      life: 0,
      maxLife: 6 + Math.random() * 4, // 6-10秒でさらに長い寿命
      scale: 0,
      targetScale: 0.05 + Math.random() * 0.1, // 0.05-0.15のランダムサイズ
      rotationSpeed: new THREE.Vector3(
        (Math.random() - 0.5) * 0.02, // X軸回転速度（-0.01～0.01）
        (Math.random() - 0.5) * 0.016, // Y軸回転速度（-0.008～0.008）
        (Math.random() - 0.5) * 0.01  // Z軸回転速度（-0.005～0.005）
      )
    };

    // モデルの設定
    bubble.model.position.copy(position);
    bubble.model.scale.setScalar(0);
    bubble.model.traverse((child) => {
      if ((child as any).isMesh) {
        (child as any).material = (child as any).material.clone();
        (child as any).material.transparent = true;
        (child as any).material.opacity = 0.9;
        
        // より明るく鮮やかにする設定
        (child as any).material.emissive.setHex(0x222222); // 自己発光を追加
        (child as any).material.emissiveIntensity = 0.1;
        
        // 色を明るく強調
        if ((child as any).material.color) {
          const color = (child as any).material.color;
          color.r = Math.min(1.0, color.r * 1.3); // 赤を30%強化
          color.g = Math.min(1.0, color.g * 1.3); // 緑を30%強化
          color.b = Math.min(1.0, color.b * 1.3); // 青を30%強化
        }
        
        // より鮮やかさを追加
        (child as any).material.metalness = 0.1;
        (child as any).material.roughness = 0.7;
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
      bubble.life += 0.015; // さらに遅めのアニメーション速度

      // より自然な泳ぐような動きの実装
      const time = bubble.life;
      
      // 蛇行するような動きを追加
      const swayX = Math.sin(time * 2.5) * 0.003; // X軸のゆらぎ
      const swayZ = Math.cos(time * 1.8) * 0.004; // Z軸のゆらぎ
      
      // 重力の影響でY方向の速度を少しずつ減少
      bubble.velocity.y *= 0.998;
      
      // 水中の抵抗でX, Z方向の速度も減衰
      bubble.velocity.x *= 0.995;
      bubble.velocity.z *= 0.995;
      
      // 新しいランダムな方向転換（魚のような動き）
      if (Math.random() < 0.02) { // 2%の確率で方向転換
        bubble.velocity.x += (Math.random() - 0.5) * 0.01;
        bubble.velocity.z += (Math.random() - 0.5) * 0.01;
      }
      
      // 位置更新（蛇行を加味）
      bubble.model.position.x += bubble.velocity.x + swayX;
      bubble.model.position.y += bubble.velocity.y;
      bubble.model.position.z += bubble.velocity.z + swayZ;
      
      // ランダムな回転速度で回転
      bubble.model.rotation.x += bubble.rotationSpeed.x;
      bubble.model.rotation.y += bubble.rotationSpeed.y;
      bubble.model.rotation.z += bubble.rotationSpeed.z;
      
      // スケールアニメーション（より滑らかに）
      if (bubble.life < 0.4) {
        // 出現時（ゆるやかに出現）
        bubble.scale = THREE.MathUtils.lerp(0, bubble.targetScale, bubble.life * 2.5);
      } else if (bubble.life > bubble.maxLife - 1.5) {
        // 消失時（より遅く消失）
        const fadeRatio = (bubble.maxLife - bubble.life) / 1.5;
        bubble.scale = THREE.MathUtils.lerp(0, bubble.targetScale, Math.max(0, fadeRatio));
      } else {
        bubble.scale = bubble.targetScale;
      }
      
      bubble.model.scale.setScalar(bubble.scale);
      
      // 透明度の更新（より遅い消失）
      if (bubble.life > bubble.maxLife - 2.0) {
        const alpha = (bubble.maxLife - bubble.life) / 2.0;
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
      // 手のひらの中心をより正確に計算
      // より多くのランドマークを使用して手のひらの中心を特定
      // 手のひらの主要ポイント：0（手首）、1（手首の付け根）、5,9,13,17（各指の付け根）
      const palmLandmarks = [
        landmarks[0],  // 手首
        landmarks[1],  // 手首の付け根
        landmarks[5],  // 人差し指の付け根
        landmarks[9],  // 中指の付け根
        landmarks[13], // 薬指の付け根
        landmarks[17], // 小指の付け根
        landmarks[2],  // 親指の付け根も追加
      ];
      
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
      // 両手の場合は生成確率を調整
      const bubbleChance = results.multiHandLandmarks.length === 2 ? 0.15 : 0.2;
      if (Math.random() < bubbleChance) {
        // 手のひらの中心から少しランダムにずらした位置から生成
        const offsetPosition = position.clone();
        offsetPosition.x += (Math.random() - 0.5) * 0.1;
        offsetPosition.y += (Math.random() - 0.5) * 0.1;
        createBubble(offsetPosition);
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

        // Three.jsシーンの初期化（真のビューポートサイズを取得）
        const containerWidth = window.visualViewport?.width || window.innerWidth;
        const containerHeight = window.visualViewport?.height || window.innerHeight;

        const scene = new THREE.Scene();
        sceneRef.current = scene;

        // カメラのアスペクト比を画面全体に設定
        const camera = new THREE.PerspectiveCamera(75, containerWidth / containerHeight, 0.1, 1000);
        camera.position.z = 3;
        cameraRef.current = camera;

        const renderer = new THREE.WebGLRenderer({ 
          alpha: true,
          antialias: true,
          preserveDrawingBuffer: true  // 写真撮影のために描画バッファを保持
        });
        
        // 全画面サイズに設定
        renderer.setSize(containerWidth, containerHeight);
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
          maxNumHands: 2, // 両手を検出
          modelComplexity: 1, // より正確なモデルを使用
          minDetectionConfidence: 0.5, // 検出感度を上げて手を見つけやすく
          minTrackingConfidence: 0.5 // トラッキング感度も調整
        });

        hands.onResults(onResults);
        handsRef.current = hands;

        // カメラの初期化
        const video = videoRef.current;
        if (video) {
          console.log('=== CAMERA INITIALIZATION ===');
          
          // 先にgetUserMediaでカメラアクセスを取得
          const stream = await navigator.mediaDevices.getUserMedia({
            video: {
              facingMode: 'user',
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
              if (handsRef.current) {
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

        // リサイズハンドラー（モバイルのビューポート変更に対応）
        const handleResize = () => {
          const newWidth = window.visualViewport?.width || window.innerWidth;
          const newHeight = window.visualViewport?.height || window.innerHeight;
          
          // カメラとレンダラーを全画面サイズに統一
          camera.aspect = newWidth / newHeight;
          camera.updateProjectionMatrix();
          renderer.setSize(newWidth, newHeight);
        };

        window.addEventListener('resize', handleResize);
        // モバイルのビューポート変更も監視
        if (window.visualViewport) {
          window.visualViewport.addEventListener('resize', handleResize);
        }

        return () => {
          window.removeEventListener('resize', handleResize);
          if (window.visualViewport) {
            window.visualViewport.removeEventListener('resize', handleResize);
          }
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
  }, [isActive, isLoaded, onResults]);

  const capturePhoto = () => {
    if (!rendererRef.current || !videoRef.current) return;

    setShowFlash(true);
    setTimeout(() => setShowFlash(false), 150);

    // Three.jsのシーンを再レンダリングして最新の状態をキャプチャ
    const renderer = rendererRef.current;
    const scene = sceneRef.current;
    const camera = cameraRef.current;
    
    if (!scene || !camera) return;

    const video = videoRef.current;
    const threeCanvas = renderer.domElement;
    
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

    // 2. Three.jsキャンバスを同じサイズで合成
    ctx.globalCompositeOperation = 'source-over';
    ctx.drawImage(threeCanvas, 0, 0, threeCanvas.width, threeCanvas.height,
                 0, 0, displayWidth, displayHeight);

    // デバッグ情報
    console.log('Display size:', displayWidth, 'x', displayHeight);
    console.log('Video resolution:', video.videoWidth, 'x', video.videoHeight);
    console.log('Video display size:', videoDisplayWidth, 'x', videoDisplayHeight);
    console.log('Video offset:', videoOffsetX, 'x', videoOffsetY);
    console.log('Three.js canvas size:', threeCanvas.width, 'x', threeCanvas.height);

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

  const goBack = () => {
    // スタートページに戻る
    window.location.href = '/start';
  };


  return (
    <div className="relative w-screen h-screen overflow-hidden bg-black" style={{ 
      position: 'fixed', 
      top: 0, 
      left: 0,
      width: '100vw',
      height: '100vh'
    }}>
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
            className="absolute top-0 left-0 w-full h-full pointer-events-none"
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


          {/* 戻るボタン */}
          <button
            type="button"
            onClick={goBack}
            className="absolute bottom-[10%] left-[15%] w-12 h-12 sm:w-14 sm:h-14 backdrop-blur-xl rounded-full flex items-center justify-center border border-gray-400 border-opacity-30 shadow-2xl transition-all hover:scale-105 active:scale-95"
            title="戻る"
            style={{
              background: 'linear-gradient(135deg, rgba(75, 85, 99, 0.4), rgba(55, 65, 81, 0.2))',
              boxShadow: '0 8px 32px rgba(75, 85, 99, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.2)'
            }}
          >
            <ArrowLeft className="w-6 h-6 sm:w-7 sm:h-7 text-white drop-shadow-lg" />
          </button>

          {/* 撮影ボタン（画面中央） */}
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

        </>
      )}
    </div>
  );
};

export default HandTrackingBubbles;