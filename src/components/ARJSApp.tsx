import React, { useEffect, useRef, useState } from 'react';
import { Camera } from 'lucide-react';

const ARJSApp = () => {
  const containerRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isARActive, setIsARActive] = useState(false);
  const [modelScale, setModelScale] = useState(2.4);
  const [rotationY, setRotationY] = useState(0);
  const [rotationX, setRotationX] = useState(0);
  const [showFlash, setShowFlash] = useState(false);
  const [planeDetected, setPlaneDetected] = useState(false);
  const sceneRef = useRef<any>(null);
  const rendererRef = useRef<any>(null);
  const cameraRef = useRef<any>(null);
  const modelRef = useRef<any>(null);
  const frameRef = useRef<number | null>(null);

  useEffect(() => {
    if (!isARActive || !containerRef.current) return;

    // 平面検出ARの初期化
    const setupPlaneDetectionAR = async () => {
      // Three.jsスクリプトの動的読み込み
      const loadScript = (src: string): Promise<void> => {
        return new Promise((resolve, reject) => {
          if (document.querySelector(`script[src="${src}"]`)) {
            resolve();
            return;
          }
          
          const script = document.createElement('script');
          script.src = src;
          script.onload = () => resolve();
          script.onerror = () => reject(new Error(`Failed to load ${src}`));
          document.head.appendChild(script);
        });
      };

      try {
        // Three.jsの読み込み
        await loadScript('https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js');
        await loadScript('https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/loaders/GLTFLoader.js');

        // 平面検出ARの初期化
        initializePlaneDetectionAR();
      } catch (error) {
        console.error('Failed to load Three.js:', error);
        initializeFallback();
      }
    };

    const initializePlaneDetectionAR = async () => {
      // WebXR支援のチェック
      if ('xr' in navigator) {
        try {
          // @ts-ignore
          const isSupported = await navigator.xr.isSessionSupported('immersive-ar');
          if (isSupported) {
            initializeWebXRAR();
            return;
          }
        } catch (error) {
          console.log('WebXR not supported, falling back to camera-based solution');
        }
      }
      
      // WebXRが利用できない場合はカメラベースの平面検出
      initializeCameraBasedAR();
    };

    const initializeWebXRAR = () => {
      // WebXR平面検出の実装
      // @ts-ignore
      const scene = new THREE.Scene();
      sceneRef.current = scene;

      // @ts-ignore
      const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
      cameraRef.current = camera;

      // @ts-ignore
      const renderer = new THREE.WebGLRenderer({ 
        antialias: true, 
        alpha: true,
        preserveDrawingBuffer: true
      });
      renderer.setSize(window.innerWidth, window.innerHeight);
      renderer.xr.enabled = true;
      rendererRef.current = renderer;

      if (containerRef.current) {
        containerRef.current.appendChild(renderer.domElement);
      }

      // ライトの追加
      // @ts-ignore
      const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
      scene.add(ambientLight);

      // @ts-ignore
      const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
      directionalLight.position.set(1, 1, 1);
      scene.add(directionalLight);

      // WebXRセッションの開始
      startWebXRSession();

      // アニメーションループ
      renderer.setAnimationLoop(() => {
        if (modelRef.current) {
          modelRef.current.rotation.y = rotationY;
          modelRef.current.rotation.x = rotationX;
          modelRef.current.scale.setScalar(modelScale);
        }
        renderer.render(scene, camera);
      });
    };

    const startWebXRSession = async () => {
      try {
        // @ts-ignore
        const session = await navigator.xr.requestSession('immersive-ar', {
          requiredFeatures: ['plane-detection'],
          optionalFeatures: ['dom-overlay'],
          domOverlay: { root: document.body }
        });

        // @ts-ignore
        rendererRef.current.xr.setSession(session);
        
        session.addEventListener('select', onSelect);
        setPlaneDetected(true);
        
        // 3Dモデルの読み込み
        loadModel(sceneRef.current);
        
      } catch (error) {
        console.error('WebXR session failed:', error);
        initializeCameraBasedAR();
      }
    };

    const onSelect = (event: any) => {
      // タップした位置にモデルを配置
      if (modelRef.current && event.inputSource) {
        const frame = event.frame;
        const inputSource = event.inputSource;
        
        if (inputSource && frame) {
          const referenceSpace = rendererRef.current.xr.getReferenceSpace();
          const pose = frame.getPose(inputSource.targetRaySpace, referenceSpace);
          
          if (pose) {
            modelRef.current.position.copy(pose.transform.position);
            modelRef.current.position.y -= 1; // 少し下に配置
          }
        }
      }
    };

    const initializeCameraBasedAR = () => {
      console.log('Initializing camera-based AR with simulated plane detection');
      
      // @ts-ignore
      const scene = new THREE.Scene();
      sceneRef.current = scene;

      // @ts-ignore
      const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
      camera.position.z = 0;
      cameraRef.current = camera;

      // @ts-ignore
      const renderer = new THREE.WebGLRenderer({ 
        antialias: true, 
        alpha: true,
        preserveDrawingBuffer: true
      });
      renderer.setSize(window.innerWidth, window.innerHeight);
      renderer.domElement.style.position = 'absolute';
      renderer.domElement.style.top = '0';
      renderer.domElement.style.left = '0';
      rendererRef.current = renderer;

      if (containerRef.current) {
        containerRef.current.appendChild(renderer.domElement);
      }

      // カメラアクセス
      startCamera();

      // ライト
      // @ts-ignore
      const ambientLight = new THREE.AmbientLight(0xffffff, 0.7);
      scene.add(ambientLight);

      // @ts-ignore
      const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
      directionalLight.position.set(0, 10, 5);
      scene.add(directionalLight);

      // 即座にテストキューブを表示（デバッグ用）
      console.log('Creating immediate test cube...');
      createFallbackCube(scene);

      // 平面検出のシミュレーション（1秒後に検出）
      console.log('Starting plane detection simulation...');
      setTimeout(() => {
        console.log('Plane detection simulation triggered');
        setPlaneDetected(true);
        // 実際のモデル読み込みも試す
        simulatePlaneDetection();
      }, 1000);

      // アニメーションループ
      const animate = () => {
        frameRef.current = requestAnimationFrame(animate);

        if (modelRef.current) {
          modelRef.current.rotation.y = rotationY;
          modelRef.current.rotation.x = rotationX;
          modelRef.current.scale.setScalar(modelScale);
          
          // ふわふわアニメーション
          modelRef.current.position.y = -1.5 + Math.sin(Date.now() * 0.001) * 0.2;
        }

        renderer.render(scene, camera);
      };
      animate();
    };

    const startCamera = async () => {
      // MediaDevices APIの確認
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        console.error('MediaDevices API not supported');
        alert('このブラウザはカメラアクセスに対応していません。HTTPSでアクセスしてください。');
        return;
      }

      try {
        console.log('Requesting camera access...');
        
        // まず基本的な設定で試行
        let stream: MediaStream;
        
        try {
          // 最初に背面カメラを試す
          stream = await navigator.mediaDevices.getUserMedia({ 
            video: { 
              facingMode: { ideal: 'environment' },
              width: { ideal: 1280 },
              height: { ideal: 720 }
            } 
          });
        } catch (envError) {
          console.warn('Environment camera failed, trying any camera:', envError);
          
          // 背面カメラが失敗した場合は任意のカメラを試す
          stream = await navigator.mediaDevices.getUserMedia({ 
            video: {
              width: { ideal: 1280 },
              height: { ideal: 720 }
            }
          });
        }
        
        console.log('Camera access granted');
        
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          
          // 動画の再生を確実にする
          const playPromise = videoRef.current.play();
          
          if (playPromise !== undefined) {
            playPromise
              .then(() => {
                console.log('Video playback started');
              })
              .catch(playError => {
                console.error('Video play failed:', playError);
                // 再生に失敗した場合はユーザーの操作を待つ
                videoRef.current!.muted = true;
                videoRef.current!.play();
              });
          }
        }
        
      } catch (error) {
        console.error('Camera access failed:', error);
        
        let errorMessage = 'カメラアクセスに失敗しました。';
        
        if (error instanceof Error) {
          switch (error.name) {
            case 'NotAllowedError':
              errorMessage = 'カメラの許可が拒否されました。ブラウザの設定でカメラアクセスを許可してください。';
              break;
            case 'NotFoundError':
              errorMessage = 'カメラデバイスが見つかりません。';
              break;
            case 'NotReadableError':
              errorMessage = 'カメラが他のアプリケーションで使用中です。';
              break;
            case 'OverconstrainedError':
              errorMessage = '指定されたカメラ設定がサポートされていません。';
              break;
            case 'SecurityError':
              errorMessage = 'HTTPSでアクセスしてください。カメラはセキュアな接続でのみ利用可能です。';
              break;
            default:
              errorMessage = `カメラエラー: ${error.message}`;
          }
        }
        
        alert(errorMessage);
        
        // フォールバック：ダミーの背景色を表示
        if (videoRef.current) {
          videoRef.current.style.backgroundColor = '#333';
        }
      }
    };

    const simulatePlaneDetection = () => {
      console.log('Simulating plane detection and loading model...');
      // 床面を検出したとしてモデルを配置
      if (sceneRef.current) {
        loadModel(sceneRef.current);
      } else {
        console.error('Scene not available for model loading');
      }
    };

    const initializeFallback = () => {
      // フォールバック用の基本的な3Dシーン
      // @ts-ignore
      const scene = new THREE.Scene();
      sceneRef.current = scene;

      // @ts-ignore
      const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
      camera.position.z = 5;

      // @ts-ignore
      const renderer = new THREE.WebGLRenderer({ alpha: true });
      renderer.setSize(window.innerWidth, window.innerHeight);

      if (containerRef.current) {
        containerRef.current.appendChild(renderer.domElement);
      }

      // ライト
      // @ts-ignore
      const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
      scene.add(ambientLight);

      // @ts-ignore
      const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
      directionalLight.position.set(1, 1, 1);
      scene.add(directionalLight);

      // モデル読み込み
      loadModel(scene);

      // アニメーションループ
      const animate = () => {
        requestAnimationFrame(animate);

        if (modelRef.current) {
          modelRef.current.rotation.y = rotationY;
          modelRef.current.rotation.x = rotationX;
          modelRef.current.scale.setScalar(modelScale);
        }

        renderer.render(scene, camera);
      };
      animate();
    };

    const loadModel = (parent: any) => {
      console.log('Starting to load model...');
      
      // Three.jsのGLTFLoaderが利用可能かチェック
      // @ts-ignore
      if (typeof THREE.GLTFLoader === 'undefined') {
        console.error('GLTFLoader not available, creating fallback cube');
        createFallbackCube(parent);
        return;
      }

      // @ts-ignore
      const loader = new THREE.GLTFLoader();
      loader.load(
        '/coicoi.glb',
        (gltf: any) => {
          console.log('GLB model loaded successfully:', gltf);
          const model = gltf.scene;
          model.scale.setScalar(modelScale);
          model.position.set(0, -1.5, -3);
          
          modelRef.current = model;
          parent.add(model);
          
          console.log('Model added to scene');
          setPlaneDetected(true); // モデル読み込み成功で平面検出完了にする
        },
        (progress: any) => {
          console.log('Loading progress:', Math.round((progress.loaded / progress.total) * 100) + '%');
        },
        (error: any) => {
          console.error('Error loading GLB model:', error);
          console.log('Creating fallback cube instead');
          createFallbackCube(parent);
        }
      );
    };

    const createFallbackCube = (parent: any) => {
      console.log('Creating fallback cube...');
      // @ts-ignore
      const geometry = new THREE.BoxGeometry(0.5, 0.5, 0.5);
      // @ts-ignore
      const material = new THREE.MeshPhongMaterial({ 
        color: 0x00ff00,
        transparent: true,
        opacity: 0.8
      });
      // @ts-ignore
      const cube = new THREE.Mesh(geometry, material);
      cube.position.set(0, -2, -5); // より遠くに配置
      
      modelRef.current = cube;
      parent.add(cube);
      setPlaneDetected(true);
      
      console.log('Fallback cube created and added to scene at position:', cube.position);
    };

    setupPlaneDetectionAR();
  }, [isARActive, rotationY, rotationX, modelScale]);

  const capturePhoto = () => {
    setShowFlash(true);
    setTimeout(() => setShowFlash(false), 150);

    // キャンバスと動画を合成して画像をキャプチャ
    const canvas = containerRef.current?.querySelector('canvas');
    const video = videoRef.current;
    
    if (canvas) {
      // 新しいキャンバスを作成して合成
      const compositeCanvas = document.createElement('canvas');
      const ctx = compositeCanvas.getContext('2d');
      
      compositeCanvas.width = canvas.width;
      compositeCanvas.height = canvas.height;
      
      if (ctx) {
        // 背景に動画フレームを描画
        if (video && video.videoWidth > 0) {
          ctx.drawImage(video, 0, 0, compositeCanvas.width, compositeCanvas.height);
        }
        
        // Three.jsレンダリング結果を重ねる
        ctx.drawImage(canvas, 0, 0);
        
        const imageData = compositeCanvas.toDataURL('image/png');
        const link = document.createElement('a');
        link.download = `ar-photo-${Date.now()}.png`;
        link.href = imageData;
        link.click();
      }
    }
  };

  const startAR = () => {
    setIsARActive(true);
  };

  if (!isARActive) {
    return (
      <div className="relative w-full h-screen overflow-hidden bg-black">
        <div 
          onClick={startAR}
          className="flex items-center justify-center h-full cursor-pointer bg-gradient-to-br from-gray-900 to-black"
        >
          <div className="text-center">
            <div className="w-32 h-32 mx-auto mb-6 bg-white bg-opacity-10 rounded-full flex items-center justify-center backdrop-blur-sm transition-transform hover:scale-110">
              <Camera className="w-16 h-16 text-white" />
            </div>
            <p className="text-white text-lg font-light mb-2">AR体験を開始</p>
            <p className="text-white text-sm opacity-80">床面を向けて平面検出を開始</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="relative w-full h-screen overflow-hidden bg-black">
      {/* カメラ映像（背景） */}
      <video
        ref={videoRef}
        className="absolute top-0 left-0 w-full h-full object-cover"
        playsInline
        muted
        autoPlay
      />
      
      {/* AR表示エリア */}
      <div ref={containerRef} className="absolute inset-0" />
      
      {/* 制御スライダー */}
      <div className="absolute top-4 right-4 w-52 bg-black bg-opacity-70 text-white p-3 rounded-lg text-xs">
        <div className="text-sm font-semibold mb-3">モデル制御</div>
        
        {/* 水平回転 */}
        <div className="mb-3">
          <div className="flex items-center justify-between mb-1">
            <label className="text-xs">水平回転 {Math.round((rotationY * 180) / Math.PI)}°</label>
          </div>
          <input
            type="range"
            min={-Math.PI}
            max={Math.PI}
            step={0.05}
            value={rotationY}
            onChange={(e) => setRotationY(parseFloat(e.target.value))}
            className="w-full h-1 bg-gray-600 rounded appearance-none cursor-pointer"
          />
        </div>
        
        {/* 垂直回転 */}
        <div className="mb-3">
          <div className="flex items-center justify-between mb-1">
            <label className="text-xs">垂直回転 {Math.round((rotationX * 180) / Math.PI)}°</label>
          </div>
          <input
            type="range"
            min={-Math.PI/2}
            max={Math.PI/2}
            step={0.05}
            value={rotationX}
            onChange={(e) => setRotationX(parseFloat(e.target.value))}
            className="w-full h-1 bg-gray-600 rounded appearance-none cursor-pointer"
          />
        </div>
        
        {/* サイズ */}
        <div>
          <div className="flex items-center justify-between mb-1">
            <label className="text-xs">サイズ {Math.round(modelScale * 100) / 100}x</label>
          </div>
          <input
            type="range"
            min={0.1}
            max={5.0}
            step={0.1}
            value={modelScale}
            onChange={(e) => setModelScale(parseFloat(e.target.value))}
            className="w-full h-1 bg-gray-600 rounded appearance-none cursor-pointer"
          />
        </div>
      </div>

      {/* 使用説明 */}
      <div className="absolute top-4 left-4 bg-black bg-opacity-70 text-white p-3 rounded-lg text-xs max-w-xs">
        <div className="text-sm font-semibold mb-2">平面検出AR</div>
        <div className="space-y-1">
          <div>状態: {planeDetected ? '平面検出完了✓' : '平面を検出中...'}</div>
          <div>1. 床面や机にカメラを向ける</div>
          <div>2. 平面が検出されると3Dモデルが表示</div>
          <div>3. 右側のスライダーで調整可能</div>
        </div>
      </div>

      {/* 撮影ボタン */}
      <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2">
        <button
          type="button"
          onClick={capturePhoto}
          className="w-16 h-16 bg-white bg-opacity-20 backdrop-blur-md rounded-full flex items-center justify-center border-3 border-white transition-all hover:scale-110 active:scale-95"
          title="AR写真を撮影"
        >
          <Camera className="w-8 h-8 text-white" />
        </button>
      </div>

      {/* フラッシュエフェクト */}
      {showFlash && (
        <div className="absolute inset-0 bg-white pointer-events-none animate-pulse" />
      )}
    </div>
  );
};

export default ARJSApp;