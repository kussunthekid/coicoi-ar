import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { GLTFLoader } from 'three-stdlib';
import { Camera, ArrowUp, ArrowDown, ArrowLeft, ArrowRight, GripVertical, RotateCcw, ArrowLeft as BackArrow, RefreshCw } from 'lucide-react';
import { useGesture } from '@use-gesture/react';

const ARCameraApp = () => {
  const mountRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const cameraRef = useRef<any>(null);
  const frameRef = useRef<number | null>(null);
  const [isARActive, setIsARActive] = useState(false);
  const [showFlash, setShowFlash] = useState(false);
  const [isPlaced, setIsPlaced] = useState(false);
  const [zapparLoaded, setZapparLoaded] = useState(false);
  const [initError, setInitError] = useState<string | null>(null);
  const [lastTapTime, setLastTapTime] = useState(0);
  const doubleTapDelay = 300; // 300ms以内のタップをダブルタップとみなす
  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment');
  
  // コントロールパネルの位置状態（初期位置をカメラボタンの右横に設定）
  const [panelPosition, setPanelPosition] = useState({ x: 0, y: 0 });
  
  // coicoiモデル用の状態
  const [coicoiRotationY, setCoicoiRotationY] = useState(0);
  const [coicoiRotationX, setCoicoiRotationX] = useState(0);
  const [coicoiScale, setCoicoiScale] = useState(0.83);
  
  // wkwkモデル用の状態
  const [wkwkRotationY, setWkwkRotationY] = useState(0);
  const [wkwkRotationX, setWkwkRotationX] = useState(0);
  const [wkwkScale, setWkwkScale] = useState(0.56);
  
  // 現在選択中のモデルの状態を取得するヘルパー関数
  const getCurrentModelState = () => {
    if (selectedModel === 'coicoi') {
      return {
        rotationY: coicoiRotationY,
        rotationX: coicoiRotationX,
        scale: coicoiScale,
        setRotationY: setCoicoiRotationY,
        setRotationX: setCoicoiRotationX,
        setScale: setCoicoiScale
      };
    } else {
      return {
        rotationY: wkwkRotationY,
        rotationX: wkwkRotationX,
        scale: wkwkScale,
        setRotationY: setWkwkRotationY,
        setRotationX: setWkwkRotationX,
        setScale: setWkwkScale
      };
    }
  };
  const [selectedModel, setSelectedModel] = useState<'coicoi' | 'wkwk'>('coicoi'); // 操作対象のモデル選択
  const [showModelIndicator, setShowModelIndicator] = useState(false); // モデル選択インジケーターの表示状態
  const coicoiModelRef = useRef<THREE.Object3D | null>(null);
  const wkwkModelRef = useRef<THREE.Object3D | null>(null);
  const modelRef = useRef<THREE.Object3D | null>(null); // 現在操作中のモデル
  const anchorGroupRef = useRef<THREE.Group | null>(null);
  const raycasterRef = useRef<THREE.Raycaster>(new THREE.Raycaster());
  const mouseRef = useRef<THREE.Vector2>(new THREE.Vector2());

  // クリック時にどのモデルがタッチされたかを検出
  const detectModelTouch = (clientX: number, clientY: number) => {
    if (!cameraRef.current || !rendererRef.current) return null;
    
    const rect = rendererRef.current.domElement.getBoundingClientRect();
    mouseRef.current.x = ((clientX - rect.left) / rect.width) * 2 - 1;
    mouseRef.current.y = -((clientY - rect.top) / rect.height) * 2 + 1;
    
    raycasterRef.current.setFromCamera(mouseRef.current, cameraRef.current);
    
    // 両方のモデルをチェック
    const objects = [];
    if (coicoiModelRef.current) {
      objects.push({ model: coicoiModelRef.current, type: 'coicoi' });
    }
    if (wkwkModelRef.current) {
      objects.push({ model: wkwkModelRef.current, type: 'wkwk' });
    }
    
    // レイキャスティングでモデルをチェック
    for (const { model, type } of objects) {
      const intersects = raycasterRef.current.intersectObject(model, true);
      if (intersects.length > 0) {
        console.log(`Selected ${type} model`);
        return type;
      }
    }
    
    return null;
  };

  // 特定のモデルの位置を更新する関数
  const updateModelPositionForModel = (model: THREE.Object3D, clientX: number, clientY: number) => {
    if (!model || !cameraRef.current || !rendererRef.current) return;
    
    const rect = rendererRef.current.domElement.getBoundingClientRect();
    mouseRef.current.x = ((clientX - rect.left) / rect.width) * 2 - 1;
    mouseRef.current.y = -((clientY - rect.top) / rect.height) * 2 + 1;
    
    raycasterRef.current.setFromCamera(mouseRef.current, cameraRef.current);
    
    // 床面の高さで位置を計算
    const floorY = 0;
    const direction = raycasterRef.current.ray.direction;
    const origin = raycasterRef.current.ray.origin;
    const distance = (floorY - origin.y) / direction.y;
    
    if (distance > 0) {
      const newPosition = origin.clone().add(direction.clone().multiplyScalar(distance));
      model.position.x = newPosition.x;
      model.position.z = newPosition.z;
      
      // ふわふわアニメーションのベース位置も更新
      if ((model as any).floatData) {
        (model as any).floatData.baseY = floorY + 0.1;
      }
    }
  };

  // マウス座標を正規化してレイキャスティングで3D位置を計算（後方互換性のため）
  const updateModelPosition = (clientX: number, clientY: number) => {
    if (!modelRef.current) return;
    updateModelPositionForModel(modelRef.current, clientX, clientY);
  };

  // コントロールパネルのドラッグ用のジェスチャー
  const panelBind = useGesture({
    onDrag: ({ offset: [x, y] }) => {
      setPanelPosition({ x, y });
    }
  });

  // モデルをリセットする関数
  const resetModel = (modelType: 'coicoi' | 'wkwk' | 'both') => {
    if (modelType === 'coicoi' || modelType === 'both') {
      if (coicoiModelRef.current) {
        setCoicoiRotationY(0);
        setCoicoiRotationX(0);
        setCoicoiScale(0.83);
        
        coicoiModelRef.current.rotation.y = 0;
        coicoiModelRef.current.rotation.x = 0;
        coicoiModelRef.current.scale.setScalar(0.83);
        coicoiModelRef.current.position.set(-2, 0, 0);
        
        if ((coicoiModelRef.current as any).floatData) {
          (coicoiModelRef.current as any).floatData.baseY = 0;
        }
        console.log('Reset coicoi model');
      }
    }
    
    if (modelType === 'wkwk' || modelType === 'both') {
      if (wkwkModelRef.current) {
        setWkwkRotationY(0);
        setWkwkRotationX(0);
        setWkwkScale(0.56);
        
        wkwkModelRef.current.rotation.y = 0;
        wkwkModelRef.current.rotation.x = 0;
        wkwkModelRef.current.scale.setScalar(0.56);
        wkwkModelRef.current.position.set(2, 0, 0);
        
        if ((wkwkModelRef.current as any).floatData) {
          (wkwkModelRef.current as any).floatData.baseY = 0;
        }
        console.log('Reset wkwk model');
      }
    }
  };

  // useGestureでジェスチャーハンドリング
  const bind = useGesture({
    onDrag: ({ xy: [x, y], first, active, memo }) => {
      if (!active || !isPlaced) return;
      
      if (first) {
        console.log('Drag started');
        // ドラッグ開始時にモデル選択を確認
        const touchedModel = detectModelTouch(x, y);
        if (touchedModel && touchedModel !== selectedModel) {
          console.log(`Switching to ${touchedModel} model`);
          setSelectedModel(touchedModel as 'coicoi' | 'wkwk');
          // モデル選択インジケーターを10秒間表示
          setShowModelIndicator(true);
          setTimeout(() => setShowModelIndicator(false), 10000);
        }
        
        // ドラッグ対象のモデルを memo に保存
        const targetModel = touchedModel || selectedModel;
        const targetModelRef = targetModel === 'coicoi' ? coicoiModelRef.current : wkwkModelRef.current;
        return { dragModel: targetModelRef, dragModelType: targetModel };
      }
      
      // memo に保存されたモデルを使用してドラッグ
      if (memo?.dragModel) {
        updateModelPositionForModel(memo.dragModel, x, y);
      }
      
      return memo;
    },
    
    onPinch: ({ da: [distance, angle], first, memo, active }) => {
      if (!isPlaced || !active) return;
      
      const currentState = getCurrentModelState();
      const currentModel = selectedModel === 'coicoi' ? coicoiModelRef.current : wkwkModelRef.current;
      
      if (!currentModel) return;
      
      if (first) {
        console.log('Pinch gesture started');
        return { 
          initialRotation: currentState.rotationY,
          initialScale: currentState.scale,
          initialAngle: angle,
          initialDistance: distance
        };
      }
      
      // ピンチで拡大縮小
      const distanceRatio = distance / (memo?.initialDistance || distance);
      const minScale = selectedModel === 'wkwk' ? 0.1 : 0.5;
      const maxScale = 10.0;
      const newScale = Math.max(minScale, Math.min(maxScale, (memo?.initialScale || currentState.scale) * distanceRatio));
      
      currentState.setScale(newScale);
      currentModel.scale.setScalar(newScale);
      
      // 同時に回転も可能（オプション）
      const angleDiff = angle - (memo?.initialAngle || 0);
      const angleInRadians = (angleDiff * Math.PI) / 180;
      const newRotationY = (memo?.initialRotation || currentState.rotationY) + angleInRadians;
      currentState.setRotationY(newRotationY);
      currentModel.rotation.y = newRotationY;
      
      console.log('Scale:', newScale.toFixed(2), 'Rotation:', Math.round((newRotationY * 180) / Math.PI), '°');
      
      return memo;
    },
    
    onWheel: ({ delta: [, deltaY], shiftKey, altKey }) => {
      if (!isPlaced) return;
      
      const currentState = getCurrentModelState();
      const currentModel = selectedModel === 'coicoi' ? coicoiModelRef.current : wkwkModelRef.current;
      
      if (!currentModel) return;
      
      if (shiftKey) {
        // Shift+スクロールで水平回転
        const rotationChange = deltaY * 0.01;
        const newRotationY = currentState.rotationY + rotationChange;
        currentState.setRotationY(newRotationY);
        currentModel.rotation.y = newRotationY;
        console.log('Shift+Scroll Rotation Y:', Math.round((newRotationY * 180) / Math.PI), '°');
      } else if (altKey) {
        // Alt+スクロールで垂直回転
        const rotationChange = deltaY * 0.01;
        const newRotationX = currentState.rotationX + rotationChange;
        currentState.setRotationX(newRotationX);
        currentModel.rotation.x = newRotationX;
        console.log('Alt+Scroll Rotation X:', Math.round((newRotationX * 180) / Math.PI), '°');
      } else {
        // 通常のホイールでスケール調整
        const scaleChange = 1 - deltaY * 0.001;
        const minScale = selectedModel === 'wkwk' ? 0.1 : 0.5; // wkwkはより小さく
        const newScale = Math.max(minScale, Math.min(10.0, currentState.scale * scaleChange));
        currentState.setScale(newScale);
        currentModel.scale.setScalar(newScale);
      }
    }
  }, {
    pinch: {
      scaleBounds: { min: 0.1, max: 5 },
      rubberband: true
    }
  });

  useEffect(() => {
    if (!isARActive) return;

    const initBasicAR = async () => {
      try {
        // 基本的なThree.js設定
        const width = window.innerWidth;
        const height = window.innerHeight;

        // シーン作成
        const scene = new THREE.Scene();
        sceneRef.current = scene;

        // カメラ作成（平行投影のOrthographicCamera）
        const frustumSize = 10;
        const aspect = width / height;
        const camera = new THREE.OrthographicCamera(
          frustumSize * aspect / -2,  // left
          frustumSize * aspect / 2,   // right
          frustumSize / 2,            // top
          frustumSize / -2,           // bottom
          -100,                       // near（負の値で前方も表示）
          100                         // far
        );
        camera.position.set(0, 2, 5);
        camera.lookAt(0, 0, 0);
        cameraRef.current = camera;

        // レンダラー作成
        const renderer = new THREE.WebGLRenderer({ 
          alpha: true,
          antialias: true,
          preserveDrawingBuffer: true,
          logarithmicDepthBuffer: true // 深度バッファの精度を向上
        });
        renderer.setSize(width, height);
        renderer.setPixelRatio(window.devicePixelRatio);
        renderer.setClearColor(0x000000, 0); // 完全透明な背景
        renderer.outputColorSpace = THREE.SRGBColorSpace; // 色空間を設定
        rendererRef.current = renderer;

        if (mountRef.current) {
          mountRef.current.appendChild(renderer.domElement);
        }

        // カメラの初期化
        const video = videoRef.current;
        if (video) {
          console.log('=== CAMERA INITIALIZATION ===');
          
          // カメラストリームを取得
          const stream = await navigator.mediaDevices.getUserMedia({
            video: {
              facingMode: facingMode,
              width: { ideal: 640 },
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
          (renderer as any).videoStream = stream;
          
          console.log('Camera started successfully');
        }

        // シンプルなグループを作成（AR風の配置用）
        const anchorGroup = new THREE.Group();
        anchorGroupRef.current = anchorGroup;
        scene.add(anchorGroup);

        // ライト追加（複数の光源で見栄えを改善）
        
        // 1. 環境光源（AmbientLight）- ベースとなる光源（明るめ）
        const ambientLight = new THREE.AmbientLight(0xffffff, 0.9); // さらに明るく
        scene.add(ambientLight);
        
        // 2. 平行光源（DirectionalLight）- メインの光源、太陽光のようなイメージ（明るく）
        const directionalLight = new THREE.DirectionalLight(0xffffff, 1.8); // さらに明るく
        directionalLight.position.set(5, 10, 5);
        directionalLight.castShadow = true; // 影を有効化
        directionalLight.shadow.camera.near = 0.1;
        directionalLight.shadow.camera.far = 50;
        directionalLight.shadow.camera.left = -10;
        directionalLight.shadow.camera.right = 10;
        directionalLight.shadow.camera.top = 10;
        directionalLight.shadow.camera.bottom = -10;
        directionalLight.shadow.mapSize.width = 2048;
        directionalLight.shadow.mapSize.height = 2048;
        scene.add(directionalLight);
        
        // 3. 半球光源（HemisphereLight）- 影の部分を柔らかく照らす
        const hemisphereLight = new THREE.HemisphereLight(
          0x87ceeb, // 空の色（スカイブルー）
          0x8b7355, // 地面の色（アースブラウン）
          0.8 // 高めの強度でさらに明るく
        );
        hemisphereLight.position.set(0, 10, 0);
        scene.add(hemisphereLight);
        
        // レンダラーの影を有効化
        renderer.shadowMap.enabled = true;
        renderer.shadowMap.type = THREE.PCFSoftShadowMap; // ソフトな影

        setZapparLoaded(true);
        console.log('Basic AR initialized successfully');

        // 両方のモデルを読み込み
        const loadBothModels = () => {
          const loader = new GLTFLoader();
          
          // coicoiモデルを読み込み
          loader.load(
            '/coicoi.glb',
            (gltf) => {
              const model = gltf.scene.clone();
              
              // 影の設定を有効化
              model.traverse((child) => {
                if ((child as any).isMesh) {
                  (child as any).castShadow = true;
                  (child as any).receiveShadow = true;
                }
              });
              
              model.scale.setScalar(coicoiScale);
              model.position.set(-2, 0, 0); // 左側に配置
              model.rotation.y = coicoiRotationY;
              model.rotation.x = coicoiRotationX;
              
              // ふわふわアニメーション用のデータを設定
              (model as any).floatData = {
                baseY: 0,
                amplitude: 0.3,
                speed: 0.02,
                time: 0
              };
              (model as any).modelType = 'coicoi';
              
              coicoiModelRef.current = model;
              anchorGroup.add(model);
              console.log('coicoi model loaded');
            },
            undefined,
            (error) => {
              console.error('Error loading coicoi GLB model:', error);
            }
          );
          
          // wkwkモデルを読み込み
          loader.load(
            '/wkwk.glb',
            (gltf) => {
              const model = gltf.scene.clone();
              
              // 影の設定を有効化
              model.traverse((child) => {
                if ((child as any).isMesh) {
                  (child as any).castShadow = true;
                  (child as any).receiveShadow = true;
                }
              });
              
              model.scale.setScalar(wkwkScale);
              model.position.set(2, 0, 0); // 右側に配置
              model.rotation.y = wkwkRotationY;
              model.rotation.x = wkwkRotationX;
              
              // ふわふわアニメーション用のデータを設定
              (model as any).floatData = {
                baseY: 0,
                amplitude: 0.3,
                speed: 0.02,
                time: Math.PI // 位相をずらす
              };
              (model as any).modelType = 'wkwk';
              
              wkwkModelRef.current = model;
              anchorGroup.add(model);
              setIsPlaced(true);
              console.log('wkwk model loaded');
            },
            undefined,
            (error) => {
              console.error('Error loading wkwk GLB model:', error);
            }
          );
        };

        // 両方のモデルを読み込み
        loadBothModels();
        
        // 操作対象のモデルを設定
        modelRef.current = selectedModel === 'coicoi' ? coicoiModelRef.current : wkwkModelRef.current;

        // 3本指タップでリセット検出用
        const handleTouchStart = (event: TouchEvent) => {
          if (event.touches.length >= 3) {
            console.log('3-finger touch detected - resetting both models');
            event.preventDefault();
            event.stopPropagation();
            resetModel('both');
          }
        };

        // シングルタップでモデル選択
        const handleTap = (event: MouseEvent | TouchEvent) => {
          event.preventDefault();
          event.stopPropagation();
          
          // タッチイベントの場合はclickイベントを防ぐ
          if (event.type === 'touchend') {
            (event.target as any).ignoreClick = true;
            setTimeout(() => {
              if (event.target) {
                (event.target as any).ignoreClick = false;
              }
            }, 350);
          }
          
          // clickイベントで、touchendからのものは無視
          if (event.type === 'click' && (event.target as any).ignoreClick) {
            return;
          }
          
          // マウス/タッチ座標を取得
          let clientX: number, clientY: number;
          if (event instanceof MouseEvent) {
            clientX = event.clientX;
            clientY = event.clientY;
          } else {
            const touch = event.changedTouches[0];
            if (!touch) return; // changedTouchesが空の場合は処理しない
            clientX = touch.clientX;
            clientY = touch.clientY;
          }
          
          // シングルタップでモデル選択
          const touchedModel = detectModelTouch(clientX, clientY);
          if (touchedModel && touchedModel !== selectedModel) {
            console.log(`Selecting ${touchedModel} model`);
            setSelectedModel(touchedModel as 'coicoi' | 'wkwk');
            // モデル選択インジケーターを10秒間表示
            setShowModelIndicator(true);
            setTimeout(() => setShowModelIndicator(false), 10000);
          }
        };

        renderer.domElement.addEventListener('click', handleTap);
        renderer.domElement.addEventListener('touchend', handleTap);
        renderer.domElement.addEventListener('touchstart', handleTouchStart);

        // アニメーションループ
        const animate = () => {
          frameRef.current = requestAnimationFrame(animate);

          // 両方のモデルのふわふわアニメーション
          if (coicoiModelRef.current && (coicoiModelRef.current as any).floatData) {
            const data = (coicoiModelRef.current as any).floatData;
            data.time += data.speed;
            coicoiModelRef.current.position.y = data.baseY + Math.sin(data.time) * data.amplitude;
          }
          
          if (wkwkModelRef.current && (wkwkModelRef.current as any).floatData) {
            const data = (wkwkModelRef.current as any).floatData;
            data.time += data.speed;
            wkwkModelRef.current.position.y = data.baseY + Math.sin(data.time) * data.amplitude;
          }
          
          // 操作対象のモデルを更新
          modelRef.current = selectedModel === 'coicoi' ? coicoiModelRef.current : wkwkModelRef.current;

          renderer.render(scene, camera);
        };
        animate();

        // リサイズハンドラー
        const handleResize = () => {
          const width = window.innerWidth;
          const height = window.innerHeight;
          const aspect = width / height;
          const frustumSize = 10;
          
          // OrthographicCameraのアスペクト比を更新
          camera.left = frustumSize * aspect / -2;
          camera.right = frustumSize * aspect / 2;
          camera.top = frustumSize / 2;
          camera.bottom = frustumSize / -2;
          camera.updateProjectionMatrix();
          
          renderer.setSize(width, height);
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
          renderer.domElement.removeEventListener('click', handleTap);
          renderer.domElement.removeEventListener('touchend', handleTap);
          renderer.domElement.removeEventListener('touchstart', handleTouchStart);
          
          if (frameRef.current) {
            cancelAnimationFrame(frameRef.current);
            frameRef.current = null;
          }
          
          // ビデオストリームを停止
          if ((renderer as any).videoStream) {
            const stream = (renderer as any).videoStream;
            stream.getTracks().forEach((track: MediaStreamTrack) => {
              track.stop();
              track.enabled = false;
            });
            (renderer as any).videoStream = null;
          }
          
          // Three.jsのリソースをクリーンアップ
          if (scene) {
            scene.traverse((object) => {
              if ((object as any).geometry) {
                (object as any).geometry.dispose();
              }
              if ((object as any).material) {
                if (Array.isArray((object as any).material)) {
                  (object as any).material.forEach((material: any) => material.dispose());
                } else {
                  (object as any).material.dispose();
                }
              }
            });
            scene.clear();
          }
          
          if (mountRef.current && renderer.domElement) {
            mountRef.current.removeChild(renderer.domElement);
          }
          renderer.dispose();
          
          // 参照をクリア
          sceneRef.current = null;
          cameraRef.current = null;
          rendererRef.current = null;
          anchorGroupRef.current = null;
          coicoiModelRef.current = null;
          wkwkModelRef.current = null;
          modelRef.current = null;
        };

      } catch (error) {
        console.error('Failed to initialize basic AR:', error);
        setInitError('初期化エラー: ' + (error as Error).message);
        setZapparLoaded(true);
      }
    };

    initBasicAR();
  }, [isARActive]); // facingModeを依存配列から除外


  // 矢印ボタンによるモデル移動
  const moveModelUp = () => {
    const currentModel = selectedModel === 'coicoi' ? coicoiModelRef.current : wkwkModelRef.current;
    if (currentModel && isPlaced) {
      currentModel.position.y += 0.2;
      if ((currentModel as any).floatData) {
        (currentModel as any).floatData.baseY += 0.2;
      }
    }
  };

  const moveModelDown = () => {
    const currentModel = selectedModel === 'coicoi' ? coicoiModelRef.current : wkwkModelRef.current;
    if (currentModel && isPlaced) {
      currentModel.position.y -= 0.2;
      if ((currentModel as any).floatData) {
        (currentModel as any).floatData.baseY -= 0.2;
      }
    }
  };

  const moveModelLeft = () => {
    const currentModel = selectedModel === 'coicoi' ? coicoiModelRef.current : wkwkModelRef.current;
    if (currentModel && isPlaced) {
      currentModel.position.x -= 0.3;
    }
  };

  const moveModelRight = () => {
    const currentModel = selectedModel === 'coicoi' ? coicoiModelRef.current : wkwkModelRef.current;
    if (currentModel && isPlaced) {
      currentModel.position.x += 0.3;
    }
  };

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
    link.download = `ar-photo-${Date.now()}.png`;
    link.href = imageData;
    link.click();
  };

  const startAR = () => {
    setIsARActive(true);
  };

  const goBack = () => {
    // スタートページに戻る
    window.location.href = '/start';
  };

  const switchCamera = async () => {
    const newFacingMode = facingMode === 'environment' ? 'user' : 'environment';
    
    try {
      // 現在のビデオストリームを確実に停止
      if (rendererRef.current && (rendererRef.current as any).videoStream) {
        const currentStream = (rendererRef.current as any).videoStream;
        currentStream.getTracks().forEach((track: MediaStreamTrack) => {
          track.stop();
          track.enabled = false;
        });
        (rendererRef.current as any).videoStream = null;
      }

      // 少し待機してから新しいストリームを取得
      await new Promise(resolve => setTimeout(resolve, 100));

      // 新しいストリームを取得（exactを使用してより確実に）
      const newStream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { exact: newFacingMode },
          width: { ideal: 640 },
          height: { ideal: 480 }
        },
        audio: false
      });

      // ビデオ要素を確実に更新
      if (videoRef.current && rendererRef.current) {
        const video = videoRef.current;
        
        // 古いビデオを一旦停止
        video.pause();
        video.srcObject = null;
        
        // 新しいストリームを設定
        video.srcObject = newStream;
        await video.play();

        // 新しいストリームを保存
        (rendererRef.current as any).videoStream = newStream;
        
        // 状態を更新
        setFacingMode(newFacingMode);
        console.log(`Successfully switched to ${newFacingMode} camera`);
      }
      
    } catch (error) {
      console.error('Failed to switch camera:', error);
      
      // エラー時は元のfacingModeを維持またはフォールバック
      try {
        // facingMode指定なしで再試行
        const fallbackStream = await navigator.mediaDevices.getUserMedia({
          video: {
            width: { ideal: 640 },
            height: { ideal: 480 }
          },
          audio: false
        });
        
        if (videoRef.current && rendererRef.current) {
          const video = videoRef.current;
          video.srcObject = fallbackStream;
          await video.play();
          
          (rendererRef.current as any).videoStream = fallbackStream;
        }
      } catch (fallbackError) {
        console.error('Fallback camera access also failed:', fallbackError);
      }
    }
  };

  return (
    <div className="relative w-full h-screen overflow-hidden bg-black touch-none">
      {!isARActive ? (
        <div 
          onClick={startAR}
          className="relative flex items-center justify-center h-full cursor-pointer overflow-hidden"
          style={{
            background: 'linear-gradient(135deg, #0891b2 0%, #065f46 25%, #0d9488 50%, #0891b2 75%, #065f46 100%)',
            backgroundSize: '400% 400%',
            animation: 'waveGradient 15s ease infinite'
          }}
        >
          {/* 波状の装飾的な背景エフェクト */}
          <div className="absolute inset-0">
            <div 
              className="absolute w-[200%] h-[200%] -top-1/2 -left-1/2 opacity-30"
              style={{
                background: 'radial-gradient(circle at 30% 50%, rgba(34, 211, 238, 0.4) 0%, transparent 50%)',
                animation: 'rotate 20s linear infinite'
              }}
            />
            <div 
              className="absolute w-[200%] h-[200%] -bottom-1/2 -right-1/2 opacity-30"
              style={{
                background: 'radial-gradient(circle at 70% 50%, rgba(16, 185, 129, 0.4) 0%, transparent 50%)',
                animation: 'rotate 25s linear infinite reverse'
              }}
            />
          </div>
          
          <div className="text-center relative z-10">
            <div className="mb-6">
              <Camera className="w-20 h-20 sm:w-24 sm:h-24 md:w-28 md:h-28 text-white drop-shadow-2xl animate-bounce mx-auto" />
            </div>
            <p className="text-white text-lg sm:text-xl font-light drop-shadow-lg mb-4">タップしてカメラを起動</p>
            <p className="text-white text-sm opacity-75 drop-shadow-lg">モデルをタッチして選択・操作</p>
          </div>
        </div>
      ) : (
        <>
          {/* カメラビデオ（背景として表示） */}
          <video
            ref={videoRef}
            className="absolute top-0 left-0 w-full h-full object-cover pointer-events-none"
            playsInline
            muted
            autoPlay
          />

          {/* Three.jsマウント（透明背景でビデオの上に重ねる） */}
          <div 
            ref={mountRef} 
            {...bind()}
            className="absolute top-0 left-0 w-full h-full touch-none"
            style={{ touchAction: 'none' }}
          />
          
          {/* 初期化中またはエラーの表示 */}
          {!zapparLoaded && (
            <div className="absolute top-4 left-1/2 transform -translate-x-1/2 bg-black bg-opacity-70 text-white px-4 py-2 rounded-lg">
              <div className="text-sm text-center">ARカメラを初期化中...</div>
            </div>
          )}
          
          {zapparLoaded && initError && (
            <div className="absolute top-4 left-1/2 transform -translate-x-1/2 bg-red-600 bg-opacity-80 text-white px-4 py-2 rounded-lg">
              <div className="text-sm text-center">{initError}</div>
              <div className="text-xs text-center mt-1">基本モードで続行</div>
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
            <BackArrow className="w-6 h-6 sm:w-7 sm:h-7 text-white drop-shadow-lg" />
          </button>

          {/* カメラボタン（HandTrackingBubblesと同じ位置） */}
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


          {/* モデル選択インジケーター（切り替え時に2秒間表示） */}
          {zapparLoaded && showModelIndicator && (
            <div
              className="absolute top-20 right-4 w-10 h-10 sm:w-12 sm:h-12 backdrop-blur-xl rounded-full flex items-center justify-center border border-gray-400 border-opacity-30 shadow-2xl pointer-events-none animate-pulse"
              title={`現在選択中: ${selectedModel === 'coicoi' ? 'coicoi' : 'wkwk'}モデル`}
              style={{
                background: selectedModel === 'coicoi' 
                  ? 'linear-gradient(135deg, rgba(239, 68, 68, 0.4), rgba(220, 38, 38, 0.2))'
                  : 'linear-gradient(135deg, rgba(251, 191, 36, 0.4), rgba(245, 158, 11, 0.2))',
                boxShadow: selectedModel === 'coicoi'
                  ? '0 8px 32px rgba(239, 68, 68, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.2)'
                  : '0 8px 32px rgba(251, 191, 36, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.2)'
              }}
            >
              <div className="text-white text-xs font-bold">
                {selectedModel === 'coicoi' ? 'C' : 'W'}
              </div>
            </div>
          )}

          

          {/* ドラッグ可能なモデル制御UI（カメラボタンの右横・グラスモーフィズム） */}
          {isPlaced && (
            <div 
              className="absolute backdrop-blur-xl bg-black bg-opacity-20 rounded-3xl border border-gray-400 border-opacity-30 shadow-2xl"
              style={{
                bottom: '12%',
                left: '60%',
                transform: `translate(${panelPosition.x}px, ${panelPosition.y}px)`,
                cursor: 'move',
                background: 'linear-gradient(135deg, rgba(0, 0, 0, 0.3), rgba(0, 0, 0, 0.1))',
                boxShadow: '0 8px 32px rgba(0, 0, 0, 0.6), inset 0 1px 0 rgba(255, 255, 255, 0.1)'
              }}
            >
              {/* ドラッグハンドル */}
              <div 
                {...panelBind()}
                className="flex items-center justify-center p-3 border-b border-gray-500 border-opacity-20 cursor-grab active:cursor-grabbing"
                title="ドラッグして移動"
              >
                <GripVertical className="w-4 h-4 text-gray-300 text-opacity-80" />
              </div>
              
              <div className="p-2 sm:p-3 md:p-4 lg:p-3 xl:p-4 flex flex-col space-y-2 sm:space-y-3 md:space-y-4 lg:space-y-3 xl:space-y-4">
                {/* ジョイスティック風の位置制御（PC画面では小さめに調整） */}
                <div className="w-16 h-16 sm:w-20 sm:h-20 md:w-24 md:h-24 lg:w-20 lg:h-20 xl:w-24 xl:h-24 backdrop-blur-lg bg-gray-900 bg-opacity-8 rounded-full flex items-center justify-center border border-gray-400 border-opacity-12 shadow-inner">
                  <div className="relative w-12 h-12 sm:w-16 sm:h-16 md:w-20 md:h-20 lg:w-16 lg:h-16 xl:w-20 xl:h-20">
                    <div 
                      className="absolute top-1/2 left-1/2 w-3 h-3 sm:w-4 sm:h-4 md:w-5 md:h-5 rounded-full transform -translate-x-1/2 -translate-y-1/2 shadow-sm"
                      style={{
                        background: 'radial-gradient(circle, rgba(255, 255, 255, 0.4), rgba(255, 255, 255, 0.1))',
                        backdropFilter: 'blur(2px)',
                        boxShadow: '0 0 8px rgba(255, 255, 255, 0.2), inset 0 0 4px rgba(255, 255, 255, 0.1)'
                      }}
                    ></div>
                    
                    <button
                      type="button"
                      onClick={moveModelUp}
                      className="absolute top-0 left-1/2 w-4 h-4 sm:w-5 sm:h-5 md:w-6 md:h-6 lg:w-5 lg:h-5 xl:w-6 xl:h-6 backdrop-blur-sm bg-blue-500 bg-opacity-40 rounded-full flex items-center justify-center transform -translate-x-1/2 hover:bg-opacity-60 transition-all duration-200 border border-gray-400 border-opacity-30 shadow-lg"
                      title="上に移動"
                    >
                      <ArrowUp className="w-2 h-2 sm:w-2.5 sm:h-2.5 md:w-3 md:h-3 lg:w-2.5 lg:h-2.5 xl:w-3 xl:h-3 text-white drop-shadow-sm" />
                    </button>
                    
                    <button
                      type="button"
                      onClick={moveModelDown}
                      className="absolute bottom-0 left-1/2 w-4 h-4 sm:w-5 sm:h-5 md:w-6 md:h-6 lg:w-5 lg:h-5 xl:w-6 xl:h-6 backdrop-blur-sm bg-red-500 bg-opacity-40 rounded-full flex items-center justify-center transform -translate-x-1/2 hover:bg-opacity-60 transition-all duration-200 border border-gray-400 border-opacity-30 shadow-lg"
                      title="下に移動"
                    >
                      <ArrowDown className="w-2 h-2 sm:w-2.5 sm:h-2.5 md:w-3 md:h-3 lg:w-2.5 lg:h-2.5 xl:w-3 xl:h-3 text-white drop-shadow-sm" />
                    </button>
                    
                    <button
                      type="button"
                      onClick={moveModelLeft}
                      className="absolute left-0 top-1/2 w-4 h-4 sm:w-5 sm:h-5 md:w-6 md:h-6 lg:w-5 lg:h-5 xl:w-6 xl:h-6 backdrop-blur-sm bg-green-500 bg-opacity-40 rounded-full flex items-center justify-center transform -translate-y-1/2 hover:bg-opacity-60 transition-all duration-200 border border-gray-400 border-opacity-30 shadow-lg"
                      title="左に移動"
                    >
                      <ArrowLeft className="w-2 h-2 sm:w-2.5 sm:h-2.5 md:w-3 md:h-3 lg:w-2.5 lg:h-2.5 xl:w-3 xl:h-3 text-white drop-shadow-sm" />
                    </button>
                    
                    <button
                      type="button"
                      onClick={moveModelRight}
                      className="absolute right-0 top-1/2 w-4 h-4 sm:w-5 sm:h-5 md:w-6 md:h-6 lg:w-5 lg:h-5 xl:w-6 xl:h-6 backdrop-blur-sm bg-purple-500 bg-opacity-40 rounded-full flex items-center justify-center transform -translate-y-1/2 hover:bg-opacity-60 transition-all duration-200 border border-gray-400 border-opacity-30 shadow-lg"
                      title="右に移動"
                    >
                      <ArrowRight className="w-2 h-2 sm:w-2.5 sm:h-2.5 md:w-3 md:h-3 lg:w-2.5 lg:h-2.5 xl:w-3 xl:h-3 text-white drop-shadow-sm" />
                    </button>
                  </div>
                </div>
                
                {/* サイズ制御（PC画面では小さめに調整） */}
                <div className="w-16 h-6 sm:w-20 sm:h-7 md:w-24 md:h-8 lg:w-20 lg:h-7 xl:w-24 xl:h-8 backdrop-blur-lg bg-gray-800 bg-opacity-15 rounded-full flex items-center justify-center border border-gray-400 border-opacity-30 px-2 sm:px-3 md:px-4 lg:px-3 xl:px-4 shadow-inner">
                  <input
                    type="range"
                    min={selectedModel === 'wkwk' ? 0.1 : 0.5}
                    max={10.0}
                    step={0.1}
                    value={getCurrentModelState().scale}
                    onChange={(e) => {
                      const newScale = parseFloat(e.target.value);
                      const currentState = getCurrentModelState();
                      currentState.setScale(newScale);
                      const currentModel = selectedModel === 'coicoi' ? coicoiModelRef.current : wkwkModelRef.current;
                      if (currentModel) {
                        currentModel.scale.setScalar(newScale);
                      }
                    }}
                    className="w-full h-1 sm:h-1.5 md:h-2 rounded appearance-none cursor-pointer slider-thumb"
                    title="サイズ調整"
                    style={{
                      background: 'linear-gradient(to right, rgba(255, 255, 255, 0.2), rgba(255, 255, 255, 0.05))',
                      backdropFilter: 'blur(4px)'
                    }}
                  />
                </div>
                
                {/* カメラ切り替えボタン */}
                <button
                  type="button"
                  onClick={switchCamera}
                  className="w-16 h-8 sm:w-20 sm:h-10 md:w-24 md:h-12 lg:w-20 lg:h-10 xl:w-24 xl:h-12 backdrop-blur-lg bg-blue-500 bg-opacity-20 rounded-full flex items-center justify-center border border-gray-400 border-opacity-30 shadow-lg transition-all hover:bg-opacity-30 active:scale-95"
                  title={`カメラ切り替え (現在: ${facingMode === 'environment' ? 'アウトカメラ' : 'インカメラ'})`}
                  style={{
                    background: 'linear-gradient(135deg, rgba(56, 189, 248, 0.3), rgba(14, 165, 233, 0.1))',
                    boxShadow: '0 4px 16px rgba(56, 189, 248, 0.2), inset 0 1px 0 rgba(255, 255, 255, 0.1)'
                  }}
                >
                  <RefreshCw className="w-3 h-3 sm:w-4 sm:h-4 md:w-5 md:h-5 lg:w-4 lg:h-4 xl:w-5 xl:h-5 text-white drop-shadow-sm" />
                </button>
              </div>
            </div>
          )}


          {/* フラッシュエフェクト */}
          {showFlash && (
            <div className="absolute inset-0 bg-white pointer-events-none animate-pulse" />
          )}
        </>
      )}
    </div>
  );
};

export default ARCameraApp;