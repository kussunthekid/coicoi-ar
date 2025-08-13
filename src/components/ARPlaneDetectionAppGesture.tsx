import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { GLTFLoader } from 'three-stdlib';
import { Camera, ArrowUp, ArrowDown, ArrowLeft, ArrowRight } from 'lucide-react';
import { useGesture } from '@use-gesture/react';

const ARPlaneDetectionAppGesture = () => {
  const mountRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const frameRef = useRef<number | null>(null);
  const objectsRef = useRef<THREE.Object3D[]>([]);
  const [isARActive, setIsARActive] = useState(false);
  const [showFlash, setShowFlash] = useState(false);
  const [detectedPlanes, setDetectedPlanes] = useState<Array<{ position: THREE.Vector3, normal: THREE.Vector3 }>>([]);
  
  const [rotationY, setRotationY] = useState(-100 * Math.PI / 180); // -100度をラジアンに変換
  const [rotationX, setRotationX] = useState(0);
  const [modelScale, setModelScale] = useState(2.4); // デフォルトのスケール
  const modelRef = useRef<THREE.Object3D | null>(null);

  // useGestureでジェスチャーハンドリング
  const bind = useGesture({
    onDrag: ({ xy: [x, y], movement: [mx, my], first, active }) => {
      if (!modelRef.current) return;
      
      if (first) {
        console.log('Drag started');
      }
      
      if (active) {
        // ドラッグでモデル移動
        modelRef.current.position.x += mx * 0.01;
        modelRef.current.position.z += my * 0.01;
      }
    },
    
    onPinch: ({ da: [distance, angle], origin: [ox, oy], first, memo }) => {
      if (!modelRef.current) return;
      
      if (first) {
        console.log('Pinch/Rotation started');
        return { 
          initialRotation: rotationY, 
          initialScale: modelScale 
        };
      }
      
      // 2本指の回転でモデルを水平回転
      const angleInRadians = (angle * Math.PI) / 180;
      const newRotationY = (memo?.initialRotation || rotationY) + angleInRadians;
      setRotationY(newRotationY);
      modelRef.current.rotation.y = newRotationY;
      
      // ピンチでスケール変更
      const scaleMultiplier = distance / 200; // 感度調整
      const newScale = Math.max(0.5, Math.min(10.0, (memo?.initialScale || modelScale) * scaleMultiplier));
      setModelScale(newScale);
      modelRef.current.scale.setScalar(newScale);
      
      console.log('Rotation:', Math.round((newRotationY * 180) / Math.PI), '° Scale:', newScale.toFixed(2));
      
      return memo;
    },
    
    onWheel: ({ delta: [, deltaY] }) => {
      if (!modelRef.current) return;
      
      // ホイールでスケール調整
      const scaleChange = 1 - deltaY * 0.001;
      const newScale = Math.max(0.5, Math.min(10.0, modelScale * scaleChange));
      setModelScale(newScale);
      modelRef.current.scale.setScalar(newScale);
    }
  }, {
    drag: {
      from: () => [0, 0]
    },
    pinch: {
      scaleBounds: { min: 0.5, max: 10 },
      rubberband: true
    }
  });

  useEffect(() => {
    if (!isARActive) return;

    // Three.jsのセットアップ
    const width = window.innerWidth;
    const height = window.innerHeight;

    // シーン作成
    const scene = new THREE.Scene();
    sceneRef.current = scene;

    // カメラ作成
    const camera = new THREE.PerspectiveCamera(75, width / height, 0.1, 1000);
    camera.position.z = 0;
    cameraRef.current = camera;

    // レンダラー作成
    const renderer = new THREE.WebGLRenderer({ 
      alpha: true,
      antialias: true,
      preserveDrawingBuffer: true 
    });
    renderer.setSize(width, height);
    renderer.setPixelRatio(window.devicePixelRatio);
    rendererRef.current = renderer;

    if (mountRef.current) {
      mountRef.current.appendChild(renderer.domElement);
    }

    // ライト追加
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.7);
    scene.add(ambientLight);
    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
    directionalLight.position.set(0, 10, 5);
    scene.add(directionalLight);

    // 床面検出のシミュレーション
    const detectFloorPlanes = () => {
      const floorPlanes = [
        { position: new THREE.Vector3(0, -2, -3), normal: new THREE.Vector3(0, 1, 0) }
      ];
      
      setDetectedPlanes(floorPlanes);
      placeObjectOnPlane(floorPlanes[0]);
    };

    // 平面上にGLBモデルを配置
    const placeObjectOnPlane = (plane: { position: THREE.Vector3, normal: THREE.Vector3 }) => {
      const loader = new GLTFLoader();
      loader.load(
        '/coicoi.glb',
        (gltf) => {
          const model = gltf.scene.clone();
          
          model.scale.setScalar(2.4);
          model.position.copy(plane.position);
          model.position.y += 0.1;
          
          // 初期回転を-100度に設定
          model.rotation.y = -100 * Math.PI / 180;
          
          // ふわふわアニメーション用のデータ
          (model as any).floatData = {
            baseY: plane.position.y + 0.1,
            amplitude: 0.3,
            speed: 0.02,
            time: 0
          };
          
          (model as any).isCoicoiModel = true;
          modelRef.current = model;
          
          scene.add(model);
          objectsRef.current.push(model);
        },
        (progress) => {
          console.log('Loading progress:', (progress.loaded / progress.total * 100) + '%');
        },
        (error) => {
          console.error('Error loading GLB model:', error);
        }
      );
    };

    // カメラアクセス
    navigator.mediaDevices.getUserMedia({ 
      video: { 
        facingMode: 'environment',
        width: { ideal: 1920 },
        height: { ideal: 1080 }
      } 
    })
    .then(stream => {
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
      }
      setTimeout(() => {
        detectFloorPlanes();
      }, 2000);
    })
    .catch(err => {
      console.error('カメラアクセスエラー:', err);
      setTimeout(() => {
        detectFloorPlanes();
      }, 1000);
    });

    // アニメーションループ
    const animate = () => {
      frameRef.current = requestAnimationFrame(animate);

      objectsRef.current.forEach((obj) => {
        if (obj && (obj as any).floatData) {
          const data = (obj as any).floatData;
          data.time += data.speed;
          obj.position.y = data.baseY + Math.sin(data.time) * data.amplitude;
        }
      });

      renderer.render(scene, camera);
    };
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
      window.removeEventListener('resize', handleResize);
      
      if (frameRef.current) {
        cancelAnimationFrame(frameRef.current);
      }
      if (mountRef.current && renderer.domElement) {
        mountRef.current.removeChild(renderer.domElement);
      }
      renderer.dispose();
      
      if (videoRef.current && videoRef.current.srcObject) {
        const stream = videoRef.current.srcObject as MediaStream;
        const tracks = stream.getTracks();
        tracks.forEach((track: MediaStreamTrack) => track.stop());
      }
    };
  }, [isARActive]);

  // 矢印ボタンによるモデル移動
  const moveModelUp = () => {
    if (modelRef.current) {
      modelRef.current.position.y += 0.2;
      if ((modelRef.current as any).floatData) {
        (modelRef.current as any).floatData.baseY += 0.2;
      }
    }
  };

  const moveModelDown = () => {
    if (modelRef.current) {
      modelRef.current.position.y -= 0.2;
      if ((modelRef.current as any).floatData) {
        (modelRef.current as any).floatData.baseY -= 0.2;
      }
    }
  };

  const moveModelLeft = () => {
    if (modelRef.current) {
      modelRef.current.position.x -= 0.3;
    }
  };

  const moveModelRight = () => {
    if (modelRef.current) {
      modelRef.current.position.x += 0.3;
    }
  };

  const capturePhoto = () => {
    if (!rendererRef.current || !videoRef.current) return;

    setShowFlash(true);
    setTimeout(() => setShowFlash(false), 150);

    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    ctx.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);

    const threeCanvas = rendererRef.current.domElement;
    ctx.drawImage(threeCanvas, 0, 0, canvas.width, canvas.height);

    const imageData = canvas.toDataURL('image/png');

    const link = document.createElement('a');
    link.download = `ar-photo-${Date.now()}.png`;
    link.href = imageData;
    link.click();
  };

  const startAR = () => {
    setIsARActive(true);
  };

  return (
    <div className="relative w-full h-screen overflow-hidden bg-black touch-none">
      {!isARActive ? (
        <div 
          onClick={startAR}
          className="flex items-center justify-center h-full cursor-pointer bg-gradient-to-br from-gray-900 to-black"
        >
          <div className="text-center">
            <div className="w-32 h-32 mx-auto mb-6 bg-gray-600 bg-opacity-30 rounded-full flex items-center justify-center backdrop-blur-sm transition-transform hover:scale-110">
              <Camera className="w-16 h-16 text-white" />
            </div>
            <p className="text-white text-lg font-light">タップして開始</p>
          </div>
        </div>
      ) : (
        <>
          {/* ビデオフィード */}
          <video
            ref={videoRef}
            className="absolute top-0 left-0 w-full h-full object-cover"
            playsInline
            muted
          />
          
          {/* Three.jsレンダリングエリア - ジェスチャーバインディング付き */}
          <div 
            ref={mountRef} 
            {...bind()}
            className="absolute top-0 left-0 w-full h-full touch-none"
            style={{ touchAction: 'none' }}
          />
          
          {/* 床面検出状態の表示 */}
          <div className="absolute top-4 left-4 bg-black bg-opacity-50 text-white p-3 rounded-lg">
            <div className="text-sm font-semibold mb-2">床面検出状況</div>
            <div className="text-xs">
              検出された床面: {detectedPlanes.length}個
            </div>
            {detectedPlanes.length > 0 && (
              <div className="text-xs mt-1 text-green-400">
                ✓ coicoi.glbが動作中
              </div>
            )}
          </div>

          {/* コンパクトなモデル制御UI */}
          {detectedPlanes.length > 0 && (
            <div className="absolute top-4 right-4 flex flex-col space-y-2">
              
              {/* ジョイスティック風の位置制御 */}
              <div className="w-20 h-20 bg-black bg-opacity-80 rounded-full flex items-center justify-center backdrop-blur-sm border border-gray-500">
                <div className="relative w-16 h-16">
                  {/* 中央の円 */}
                  <div className="absolute top-1/2 left-1/2 w-3 h-3 bg-white rounded-full transform -translate-x-1/2 -translate-y-1/2 opacity-50"></div>
                  
                  {/* 上矢印 */}
                  <button
                    type="button"
                    onClick={moveModelUp}
                    className="absolute top-0 left-1/2 w-6 h-6 bg-blue-500 bg-opacity-80 rounded-full flex items-center justify-center transform -translate-x-1/2 hover:bg-opacity-100 transition-all"
                    title="上に移動"
                  >
                    <ArrowUp className="w-3 h-3 text-white" />
                  </button>
                  
                  {/* 下矢印 */}
                  <button
                    type="button"
                    onClick={moveModelDown}
                    className="absolute bottom-0 left-1/2 w-6 h-6 bg-red-500 bg-opacity-80 rounded-full flex items-center justify-center transform -translate-x-1/2 hover:bg-opacity-100 transition-all"
                    title="下に移動"
                  >
                    <ArrowDown className="w-3 h-3 text-white" />
                  </button>
                  
                  {/* 左矢印 */}
                  <button
                    type="button"
                    onClick={moveModelLeft}
                    className="absolute left-0 top-1/2 w-6 h-6 bg-green-500 bg-opacity-80 rounded-full flex items-center justify-center transform -translate-y-1/2 hover:bg-opacity-100 transition-all"
                    title="左に移動"
                  >
                    <ArrowLeft className="w-3 h-3 text-white" />
                  </button>
                  
                  {/* 右矢印 */}
                  <button
                    type="button"
                    onClick={moveModelRight}
                    className="absolute right-0 top-1/2 w-6 h-6 bg-purple-500 bg-opacity-80 rounded-full flex items-center justify-center transform -translate-y-1/2 hover:bg-opacity-100 transition-all"
                    title="右に移動"
                  >
                    <ArrowRight className="w-3 h-3 text-white" />
                  </button>
                </div>
              </div>
              
              {/* サイズ制御 - 小さなスライダー */}
              <div className="w-20 h-8 bg-black bg-opacity-80 rounded-full flex items-center justify-center backdrop-blur-sm border border-gray-500 px-2">
                <input
                  type="range"
                  min={0.5}
                  max={10.0}
                  step={0.2}
                  value={modelScale}
                  onChange={(e) => {
                    const newScale = parseFloat(e.target.value);
                    setModelScale(newScale);
                    if (modelRef.current) {
                      modelRef.current.scale.setScalar(newScale);
                    }
                  }}
                  className="w-full h-1 bg-gray-600 rounded appearance-none cursor-pointer"
                  title="サイズ調整"
                />
              </div>
            </div>
          )}

          {/* カメラボタン - 画面下から15%の位置 */}
          <div className="absolute left-1/2 transform -translate-x-1/2" style={{ bottom: '15%' }}>
            <button
              type="button"
              onClick={capturePhoto}
              className="w-16 h-16 sm:w-20 sm:h-20 md:w-24 md:h-24 lg:w-28 lg:h-28 bg-gray-600 bg-opacity-70 backdrop-blur-md rounded-full flex items-center justify-center border-2 border-gray-400 shadow-xl transition-all hover:scale-110 active:scale-95"
              title="写真を撮影"
            >
              <Camera className="w-8 h-8 sm:w-10 sm:h-10 md:w-12 md:h-12 lg:w-14 lg:h-14 text-white drop-shadow-lg" />
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

export default ARPlaneDetectionAppGesture;