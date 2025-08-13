import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { GLTFLoader } from 'three-stdlib';
import { Camera } from 'lucide-react';

const ARPlaneDetectionApp = () => {
  const mountRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const frameRef = useRef<number | null>(null);
  const objectsRef = useRef<THREE.Object3D[]>([]);
  const planesRef = useRef<THREE.Mesh[]>([]);
  const [isARActive, setIsARActive] = useState(false);
  const [showFlash, setShowFlash] = useState(false);
  const [detectedPlanes, setDetectedPlanes] = useState<Array<{ position: THREE.Vector3, normal: THREE.Vector3 }>>([]);
  const raycasterRef = useRef<THREE.Raycaster>(new THREE.Raycaster());
  const mouseRef = useRef<THREE.Vector2>(new THREE.Vector2());
  const isDraggingRef = useRef(false);
  const isRotatingRef = useRef(false);
  const selectedObjectRef = useRef<THREE.Object3D | null>(null);
  const [rotationY, setRotationY] = useState(0);
  const [rotationX, setRotationX] = useState(0);
  const [modelScale, setModelScale] = useState(2.4); // デフォルトのスケール
  const [lastTouchX, setLastTouchX] = useState(0);
  const [lastTouchY, setLastTouchY] = useState(0);
  const [lastMouseX, setLastMouseX] = useState(0);
  const [lastMouseY, setLastMouseY] = useState(0);
  const [currentMode, setCurrentMode] = useState<'待機' | '移動中' | '回転中'>('待機');
  const modelRef = useRef<THREE.Object3D | null>(null);

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
      // 実際のAR環境では、床の高さを-2に設定（1体だけ）
      const floorPlanes = [
        { position: new THREE.Vector3(0, -2, -3), normal: new THREE.Vector3(0, 1, 0) }
      ];
      
      setDetectedPlanes(floorPlanes);
      
      // 床面上にcoicoi.glbモデルを配置（1体だけ）
      placeObjectOnPlane(floorPlanes[0]);
    };

    // 平面上にGLBモデルを配置
    const placeObjectOnPlane = (plane: { position: THREE.Vector3, normal: THREE.Vector3 }) => {
      const loader = new GLTFLoader();
      loader.load(
        '/coicoi.glb',
        (gltf) => {
          const model = gltf.scene.clone();
          
          // モデルのサイズを調整（8倍に変更 = 元の4倍の2倍）
          model.scale.setScalar(2.4);
          
          // モデルの位置を平面上に設定
          model.position.copy(plane.position);
          model.position.y += 0.1; // 平面の少し上に配置
          
          
          // ふわふわアニメーション用のデータを設定
          (model as any).floatData = {
            baseY: plane.position.y + 0.1,
            amplitude: 0.3, // 上下の振れ幅
            speed: 0.02,
            time: 0
          };
          
          // モデルに簡単な識別子を追加
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
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      console.error('MediaDevices API not supported');
      alert('お使いのブラウザはカメラアクセスに対応していません。HTTPSでアクセスしているか確認してください。');
      // カメラが使えない場合でも床面検出をシミュレート
      setTimeout(() => {
        detectFloorPlanes();
      }, 1000);
      return;
    }

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
      // カメラ起動後、自動的に床面検出をシミュレート
      setTimeout(() => {
        detectFloorPlanes();
      }, 2000);
    })
    .catch(err => {
      console.error('カメラアクセスエラー:', err);
      alert('カメラへのアクセスが拒否されました。HTTPSでアクセスしているか確認してください。');
      // カメラが使えない場合でも床面検出をシミュレート
      setTimeout(() => {
        detectFloorPlanes();
      }, 1000);
    });



    // アニメーションループ
    const animate = () => {
      frameRef.current = requestAnimationFrame(animate);

      // オブジェクトのふわふわアニメーションと回転
      objectsRef.current.forEach((obj) => {
        if (obj && (obj as any).floatData) {
          const data = (obj as any).floatData;
          
          // 時間を進める
          data.time += data.speed;
          
          // 上下のふわふわアニメーション
          obj.position.y = data.baseY + Math.sin(data.time) * data.amplitude;
          
          // 3D回転とスケールを適用（アニメーションループでは上書きしない）
          if ((obj as any).isCoicoiModel && !obj.userData.sliderControlled) {
            obj.rotation.y = rotationY;
            obj.rotation.x = rotationX;
            obj.scale.setScalar(modelScale);
          }
        }
      });

      renderer.render(scene, camera);
    };
    animate();

    // ドラッグ機能とズーム機能の実装
    let lastPinchDistance = 0;
    
    const handleZoom = (delta: number) => {
      const zoomSpeed = 0.1;
      camera.position.z += delta * zoomSpeed;
      camera.position.z = Math.max(1, Math.min(10, camera.position.z)); // 1-10の範囲に制限
    };

    // マウス/タッチ座標を正規化
    const getMousePosition = (clientX: number, clientY: number) => {
      const rect = renderer.domElement.getBoundingClientRect();
      mouseRef.current.x = ((clientX - rect.left) / rect.width) * 2 - 1;
      mouseRef.current.y = -((clientY - rect.top) / rect.height) * 2 + 1;
    };

    // モデルをクリック検出（シンプル版）
    const getIntersectedModel = (clientX: number, clientY: number) => {
      getMousePosition(clientX, clientY);
      raycasterRef.current.setFromCamera(mouseRef.current, camera);
      const intersects = raycasterRef.current.intersectObjects(scene.children, true);
      
      if (intersects.length > 0) {
        for (const intersect of intersects) {
          let obj = intersect.object;
          while (obj.parent && obj.parent !== scene) {
            obj = obj.parent;
          }
          
          if (objectsRef.current.includes(obj)) {
            console.log('Model detected:', obj);
            return obj;
          }
        }
      }
      
      // フォールバック: 最初のオブジェクトを返す
      if (objectsRef.current.length > 0) {
        return objectsRef.current[0];
      }
      
      return null;
    };

    // オブジェクトの位置を更新
    const updateObjectPosition = (clientX: number, clientY: number) => {
      if (!selectedObjectRef.current) return;
      
      getMousePosition(clientX, clientY);
      raycasterRef.current.setFromCamera(mouseRef.current, camera);
      
      // 床面の高さで位置を計算
      const floorY = -2;
      const direction = raycasterRef.current.ray.direction;
      const origin = raycasterRef.current.ray.origin;
      const distance = (floorY - origin.y) / direction.y;
      
      if (distance > 0) {
        const newPosition = origin.clone().add(direction.clone().multiplyScalar(distance));
        selectedObjectRef.current.position.x = newPosition.x;
        selectedObjectRef.current.position.z = newPosition.z;
        
        // ふわふわアニメーションのベース位置も更新
        if ((selectedObjectRef.current as any).floatData) {
          (selectedObjectRef.current as any).floatData.baseY = floorY + 0.1;
        }
        
        console.log('Object position updated:', selectedObjectRef.current.position);
      }
    };

    // マウスイベント（PC）
    const handleMouseDown = (event: MouseEvent) => {
      const model = getIntersectedModel(event.clientX, event.clientY);
      
      if (model) {
        selectedObjectRef.current = model;
        
        // Shiftキーまたは右クリックで回転モード
        if (event.shiftKey || event.button === 2) {
          isRotatingRef.current = true;
          setCurrentMode('回転中');
          console.log('Mouse rotation mode started');
        } else {
          // 通常の左クリックは移動モード
          isDraggingRef.current = true;
          setCurrentMode('移動中');
          console.log('Mouse drag mode started');
        }
        
        setLastMouseX(event.clientX);
        setLastMouseY(event.clientY);
      }
    };

    const handleMouseMove = (event: MouseEvent) => {
      if (selectedObjectRef.current) {
        const deltaX = event.clientX - lastMouseX;
        const deltaY = event.clientY - lastMouseY;
        
        if (isDraggingRef.current) {
          // ドラッグモード - 位置移動
          updateObjectPosition(event.clientX, event.clientY);
        } else if (isRotatingRef.current) {
          // 回転モード - 直接回転
          const newRotationY = rotationY + deltaX * 0.02;
          const newRotationX = rotationX - deltaY * 0.02;
          const clampedRotationX = Math.max(-Math.PI/2, Math.min(Math.PI/2, newRotationX));
          
          setRotationY(newRotationY);
          setRotationX(clampedRotationX);
          
          // 直接モデルを回転
          if (selectedObjectRef.current) {
            selectedObjectRef.current.rotation.y = newRotationY;
            selectedObjectRef.current.rotation.x = clampedRotationX;
          }
          
          console.log('Rotation updated - Y:', Math.round((newRotationY * 180) / Math.PI), 'X:', Math.round((clampedRotationX * 180) / Math.PI));
        }
        
        setLastMouseX(event.clientX);
        setLastMouseY(event.clientY);
      }
    };

    const handleMouseUp = () => {
      isDraggingRef.current = false;
      isRotatingRef.current = false;
      selectedObjectRef.current = null;
      setCurrentMode('待機');
      console.log('Mouse interaction ended');
    };

    // マウスホイールズーム（PC）
    const handleMouseWheel = (event: WheelEvent) => {
      event.preventDefault();
      handleZoom(event.deltaY * 0.01);
    };

    // タッチイベント（モバイル）
    const handleTouchStart = (event: TouchEvent) => {
      console.log('Touch start:', event.touches.length, 'touches');
      
      if (event.touches.length === 1) {
        // 1本指タッチ - 移動モード
        const touch = event.touches[0];
        const model = getIntersectedModel(touch.clientX, touch.clientY);
        
        if (model) {
          selectedObjectRef.current = model;
          isDraggingRef.current = true;
          setCurrentMode('移動中');
          setLastTouchX(touch.clientX);
          setLastTouchY(touch.clientY);
          console.log('Touch drag mode started');
        }
      } else if (event.touches.length === 2) {
        // 2本指タッチ - 回転モード
        const touch1 = event.touches[0];
        const touch2 = event.touches[1];
        const centerX = (touch1.clientX + touch2.clientX) / 2;
        const centerY = (touch1.clientY + touch2.clientY) / 2;
        const model = getIntersectedModel(centerX, centerY);
        
        if (model) {
          selectedObjectRef.current = model;
          isDraggingRef.current = false;
          isRotatingRef.current = true;
          setCurrentMode('回転中');
          setLastTouchX(centerX);
          setLastTouchY(centerY);
          console.log('Touch rotation mode started');
        }
        
        // ピンチズーム距離も計算
        lastPinchDistance = Math.sqrt(
          Math.pow(touch2.clientX - touch1.clientX, 2) + 
          Math.pow(touch2.clientY - touch1.clientY, 2)
        );
        // isPinching = false; // 回転優先（削除済み変数）
      }
    };

    const handleTouchMove = (event: TouchEvent) => {
      if (event.touches.length === 1 && selectedObjectRef.current && isDraggingRef.current) {
        // 1本指 - 移動モード
        event.preventDefault();
        const touch = event.touches[0];
        updateObjectPosition(touch.clientX, touch.clientY);
      } else if (event.touches.length === 2 && selectedObjectRef.current && isRotatingRef.current) {
        // 2本指 - 回転モード
        event.preventDefault();
        const touch1 = event.touches[0];
        const touch2 = event.touches[1];
        const centerX = (touch1.clientX + touch2.clientX) / 2;
        const centerY = (touch1.clientY + touch2.clientY) / 2;
        
        const deltaX = centerX - lastTouchX;
        const deltaY = centerY - lastTouchY;
        
        // 直接回転を適用
        const newRotationY = rotationY + deltaX * 0.02;
        const newRotationX = rotationX - deltaY * 0.02;
        const clampedRotationX = Math.max(-Math.PI/2, Math.min(Math.PI/2, newRotationX));
        
        setRotationY(newRotationY);
        setRotationX(clampedRotationX);
        
        if (selectedObjectRef.current) {
          selectedObjectRef.current.rotation.y = newRotationY;
          selectedObjectRef.current.rotation.x = clampedRotationX;
        }
        
        setLastTouchX(centerX);
        setLastTouchY(centerY);
        
        console.log('Touch rotation - Y:', Math.round((newRotationY * 180) / Math.PI), 'X:', Math.round((clampedRotationX * 180) / Math.PI));
      } else if (event.touches.length === 2 && !selectedObjectRef.current) {
        // ピンチズームのみ（モデルが選択されていない場合）
        event.preventDefault();
        const touch1 = event.touches[0];
        const touch2 = event.touches[1];
        const pinchDistance = Math.sqrt(
          Math.pow(touch2.clientX - touch1.clientX, 2) + 
          Math.pow(touch2.clientY - touch1.clientY, 2)
        );
        
        if (lastPinchDistance > 0) {
          const delta = (lastPinchDistance - pinchDistance) * 0.01;
          handleZoom(delta);
        }
        lastPinchDistance = pinchDistance;
      }
    };

    const handleTouchEnd = (event: TouchEvent) => {
      console.log('Touch end:', event.touches.length, 'touches remaining');
      
      // タッチが完全に終了した場合のみリセット
      if (event.touches.length === 0) {
        isDraggingRef.current = false;
        isRotatingRef.current = false;
        selectedObjectRef.current = null;
        setCurrentMode('待機');
        lastPinchDistance = 0;
        console.log('All touch interactions ended');
      } else if (event.touches.length === 1 && isRotatingRef.current) {
        // 2本指から1本指になった場合は移動モードに切り替え
        isRotatingRef.current = false;
        isDraggingRef.current = true;
        setCurrentMode('移動中');
        const touch = event.touches[0];
        setLastTouchX(touch.clientX);
        setLastTouchY(touch.clientY);
        console.log('Switched to drag mode');
      }
    };

    // リサイズハンドラー
    const handleResize = () => {
      const width = window.innerWidth;
      const height = window.innerHeight;
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      renderer.setSize(width, height);
    };

    // 右クリックメニューを無効化
    const handleContextMenu = (event: Event) => {
      event.preventDefault();
    };

    // イベントリスナーの追加
    window.addEventListener('resize', handleResize);
    renderer.domElement.addEventListener('wheel', handleMouseWheel, { passive: false });
    renderer.domElement.addEventListener('contextmenu', handleContextMenu);
    renderer.domElement.addEventListener('mousedown', handleMouseDown);
    renderer.domElement.addEventListener('mousemove', handleMouseMove);
    renderer.domElement.addEventListener('mouseup', handleMouseUp);
    renderer.domElement.addEventListener('touchstart', handleTouchStart, { passive: false });
    renderer.domElement.addEventListener('touchmove', handleTouchMove, { passive: false });
    renderer.domElement.addEventListener('touchend', handleTouchEnd, { passive: false });

    return () => {
      window.removeEventListener('resize', handleResize);
      renderer.domElement.removeEventListener('wheel', handleMouseWheel);
      renderer.domElement.removeEventListener('contextmenu', handleContextMenu);
      renderer.domElement.removeEventListener('mousedown', handleMouseDown);
      renderer.domElement.removeEventListener('mousemove', handleMouseMove);
      renderer.domElement.removeEventListener('mouseup', handleMouseUp);
      renderer.domElement.removeEventListener('touchstart', handleTouchStart);
      renderer.domElement.removeEventListener('touchmove', handleTouchMove);
      renderer.domElement.removeEventListener('touchend', handleTouchEnd);
      
      if (frameRef.current) {
        cancelAnimationFrame(frameRef.current);
      }
      if (mountRef.current && renderer.domElement) {
        mountRef.current.removeChild(renderer.domElement);
      }
      renderer.dispose();
      
      // カメラストリームの停止
      if (videoRef.current && videoRef.current.srcObject) {
        const stream = videoRef.current.srcObject as MediaStream;
        const tracks = stream.getTracks();
        tracks.forEach((track: MediaStreamTrack) => track.stop());
      }
    };
  }, [isARActive]);

  const capturePhoto = () => {
    if (!rendererRef.current || !videoRef.current) return;

    // フラッシュエフェクト
    setShowFlash(true);
    setTimeout(() => setShowFlash(false), 150);

    // キャンバスを作成して合成
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    // ビデオフレームを描画
    ctx.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);

    // Three.jsレンダリング結果を重ねる
    const threeCanvas = rendererRef.current.domElement;
    ctx.drawImage(threeCanvas, 0, 0, canvas.width, canvas.height);

    // 画像として保存
    const imageData = canvas.toDataURL('image/png');

    // ダウンロード
    const link = document.createElement('a');
    link.download = `ar-photo-${Date.now()}.png`;
    link.href = imageData;
    link.click();
  };

  const startAR = () => {
    setIsARActive(true);
  };

  return (
    <div className="relative w-full h-screen overflow-hidden bg-black">
      {!isARActive ? (
        <div 
          onClick={startAR}
          className="flex items-center justify-center h-full cursor-pointer bg-gradient-to-br from-gray-900 to-black"
        >
          <div className="text-center">
            <div className="w-32 h-32 mx-auto mb-6 bg-white bg-opacity-10 rounded-full flex items-center justify-center backdrop-blur-sm transition-transform hover:scale-110">
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
          
          {/* Three.jsレンダリングエリア */}
          <div ref={mountRef} className="absolute top-0 left-0 w-full h-full" />
          
          {/* 床面検出状態の表示 */}
          <div className="absolute top-4 left-4 bg-black bg-opacity-50 text-white p-3 rounded-lg">
            <div className="text-sm font-semibold mb-2">床面検出状況</div>
            <div className="text-xs">
              検出された床面: {detectedPlanes.length}個
            </div>
            {detectedPlanes.length > 0 && (
              <div className="text-xs mt-1 text-green-400">
                ✓ coicoi.glbが床面上で動いています
              </div>
            )}
          </div>

          
          {/* 位置・回転・サイズ制御UI */}
          {detectedPlanes.length > 0 && (
            <div className="absolute top-20 right-4 w-60 bg-black bg-opacity-70 text-white p-3 rounded-lg text-xs backdrop-blur-sm">
              <div className="text-sm font-semibold mb-3 text-center">モデル制御</div>
              
              {/* 位置制御 */}
              <div className="mb-3">
                <div className="text-xs font-semibold mb-2 text-yellow-300">位置調整</div>
                
                {/* X軸位置 */}
                <div className="mb-2">
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-xs">左右 ({modelRef.current?.position.x.toFixed(1) || '0.0'})</label>
                  </div>
                  <input
                    type="range"
                    min={-5}
                    max={5}
                    step={0.1}
                    value={modelRef.current?.position.x || 0}
                    onChange={(e) => {
                      const newX = parseFloat(e.target.value);
                      if (modelRef.current) {
                        modelRef.current.position.x = newX;
                      }
                    }}
                    className="w-full h-1 bg-gray-600 rounded appearance-none cursor-pointer"
                    title="左右位置調整"
                  />
                </div>
                
                {/* Z軸位置 */}
                <div className="mb-2">
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-xs">前後 ({modelRef.current?.position.z.toFixed(1) || '0.0'})</label>
                  </div>
                  <input
                    type="range"
                    min={-6}
                    max={0}
                    step={0.1}
                    value={modelRef.current?.position.z || -3}
                    onChange={(e) => {
                      const newZ = parseFloat(e.target.value);
                      if (modelRef.current) {
                        modelRef.current.position.z = newZ;
                      }
                    }}
                    className="w-full h-1 bg-gray-600 rounded appearance-none cursor-pointer"
                    title="前後位置調整"
                  />
                </div>
              </div>
              
              {/* 回転制御 */}
              <div className="mb-3">
                <div className="text-xs font-semibold mb-2 text-blue-300">回転調整</div>
                
                {/* Y軸回転スライダー */}
                <div className="mb-2">
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-xs">水平回転 {Math.round((rotationY * 180) / Math.PI)}°</label>
                  </div>
                  <input
                    type="range"
                    min={-Math.PI}
                    max={Math.PI}
                    step={0.05}
                    value={rotationY}
                    onChange={(e) => {
                      const newRotationY = parseFloat(e.target.value);
                      setRotationY(newRotationY);
                      
                      objectsRef.current.forEach((obj) => {
                        if (obj && (obj as any).isCoicoiModel) {
                          obj.userData.sliderControlled = true;
                          obj.rotation.y = newRotationY;
                        }
                      });
                    }}
                    className="w-full h-1 bg-gray-600 rounded appearance-none cursor-pointer"
                    title="水平回転調整"
                  />
                </div>
                
                {/* X軸回転スライダー */}
                <div className="mb-2">
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-xs">垂直回転 {Math.round((rotationX * 180) / Math.PI)}°</label>
                  </div>
                  <input
                    type="range"
                    min={-Math.PI/2}
                    max={Math.PI/2}
                    step={0.05}
                    value={rotationX}
                    onChange={(e) => {
                      const newRotationX = parseFloat(e.target.value);
                      setRotationX(newRotationX);
                      
                      objectsRef.current.forEach((obj) => {
                        if (obj && (obj as any).isCoicoiModel) {
                          obj.userData.sliderControlled = true;
                          obj.rotation.x = newRotationX;
                        }
                      });
                    }}
                    className="w-full h-1 bg-gray-600 rounded appearance-none cursor-pointer"
                    title="垂直回転調整"
                  />
                </div>
              </div>
              
              {/* サイズ制御 */}
              <div>
                <div className="text-xs font-semibold mb-2 text-green-300">サイズ調整</div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs">サイズ {Math.round(modelScale * 100) / 100}x</label>
                </div>
                <input
                  type="range"
                  min={0.5}
                  max={30.0}
                  step={0.5}
                  value={modelScale}
                  onChange={(e) => {
                    const newScale = parseFloat(e.target.value);
                    setModelScale(newScale);
                    
                    objectsRef.current.forEach((obj) => {
                      if (obj && (obj as any).isCoicoiModel) {
                        obj.userData.sliderControlled = true;
                        obj.scale.setScalar(newScale);
                      }
                    });
                  }}
                  className="w-full h-1 bg-gray-600 rounded appearance-none cursor-pointer"
                  title="サイズ調整"
                />
              </div>
            </div>
          )}
          
          {/* カメラボタンのみ - モバイル最適化位置 */}
          <div className="absolute bottom-2 left-1/2 transform -translate-x-1/2">
            <button
              type="button"
              onClick={capturePhoto}
              className="w-16 h-16 bg-white bg-opacity-20 backdrop-blur-md rounded-full flex items-center justify-center border-3 border-white transition-all hover:scale-110 active:scale-95"
              title="写真を撮影"
            >
              <Camera className="w-7 h-7 text-white" />
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

export default ARPlaneDetectionApp;