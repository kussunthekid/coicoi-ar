import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { GLTFLoader } from 'three-stdlib';
import { Camera, ArrowUp, ArrowDown, ArrowLeft, ArrowRight, GripVertical, RotateCcw } from 'lucide-react';
import { useGesture } from '@use-gesture/react';

const ARZapparTrackingFixed = () => {
  const mountRef = useRef<HTMLDivElement>(null);
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
  const [wkwkScale, setWkwkScale] = useState(0.56); // 2/3サイズ（元の2倍）
  
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
    
    onPinch: ({ da: [, angle], first, memo }) => {
      if (!isPlaced) return;
      
      const currentState = getCurrentModelState();
      const currentModel = selectedModel === 'coicoi' ? coicoiModelRef.current : wkwkModelRef.current;
      
      if (!currentModel) return;
      
      if (first) {
        console.log('2-finger rotation started');
        return { 
          initialRotation: currentState.rotationY,
          initialAngle: angle
        };
      }
      
      // 2本指の回転でモデルを水平回転のみ
      const angleDiff = angle - (memo?.initialAngle || 0);
      const angleInRadians = (angleDiff * Math.PI) / 180;
      const newRotationY = (memo?.initialRotation || currentState.rotationY) + angleInRadians;
      currentState.setRotationY(newRotationY);
      currentModel.rotation.y = newRotationY;
      
      console.log('Rotation:', Math.round((newRotationY * 180) / Math.PI), '°');
      
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
        scene.background = new THREE.Color(0x000000); // 背景を黒に設定
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
        renderer.outputColorSpace = THREE.SRGBColorSpace; // 色空間を設定
        rendererRef.current = renderer;

        if (mountRef.current) {
          mountRef.current.appendChild(renderer.domElement);
        }

        // Webカメラの映像を背景に設定
        try {
          const stream = await navigator.mediaDevices.getUserMedia({ 
            video: { 
              facingMode: facingMode,
              width: { ideal: 1920 },
              height: { ideal: 1080 }
            },
            audio: false
          });
          
          const video = document.createElement('video');
          video.srcObject = stream;
          video.setAttribute('autoplay', '');
          video.setAttribute('muted', '');
          video.setAttribute('playsinline', ''); // iOS Safari用
          video.style.display = 'none'; // 非表示にする
          document.body.appendChild(video);
          
          // videoの準備ができるまで待つ
          await video.play();
          
          // ビデオの準備ができたらテクスチャとして設定
          const setVideoTexture = () => {
            const videoTexture = new THREE.VideoTexture(video);
            videoTexture.minFilter = THREE.LinearFilter;
            videoTexture.magFilter = THREE.LinearFilter;
            videoTexture.needsUpdate = true;
            scene.background = videoTexture;
            console.log('Camera background set successfully');
          };
          
          // loadedmetadataイベントを待つ
          if (video.readyState >= 2) {
            setVideoTexture();
          } else {
            video.addEventListener('loadedmetadata', setVideoTexture);
          }
          
          
          // クリーンアップ用にvideoとstreamを保存
          (renderer as any).videoElement = video;
          (renderer as any).videoStream = stream;
        } catch (cameraError) {
          console.warn('Camera access failed:', cameraError);
          // カメラアクセスに失敗した場合はグラデーション背景
          scene.background = new THREE.Color(0x404040);
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

        // シングルタップでモデル選択、ダブルタップで初期画面に戻る
        const handleTap = (event: MouseEvent | TouchEvent) => {
          event.preventDefault();
          const currentTime = Date.now();
          
          // マウス/タッチ座標を取得
          let clientX: number, clientY: number;
          if (event instanceof MouseEvent) {
            clientX = event.clientX;
            clientY = event.clientY;
          } else {
            const touch = event.changedTouches[0];
            clientX = touch.clientX;
            clientY = touch.clientY;
          }
          
          if (currentTime - lastTapTime < doubleTapDelay) {
            // ダブルタップ検出
            console.log('Double tap detected - returning to initial screen');
            
            // AR状態をリセット
            setIsARActive(false);
            setIsPlaced(false);
            setZapparLoaded(false);
            setInitError(null);
            setLastTapTime(0);
            
            // Three.jsリソースをクリーンアップ
            if (frameRef.current) {
              cancelAnimationFrame(frameRef.current);
              frameRef.current = null;
            }
            
            if (mountRef.current && renderer.domElement) {
              mountRef.current.removeChild(renderer.domElement);
            }
            
            renderer.dispose();
            
            // シーンとカメラの参照をクリア
            sceneRef.current = null;
            cameraRef.current = null;
            rendererRef.current = null;
            modelRef.current = null;
            anchorGroupRef.current = null;
          } else {
            // シングルタップでモデル選択
            const touchedModel = detectModelTouch(clientX, clientY);
            if (touchedModel && touchedModel !== selectedModel) {
              console.log(`Selecting ${touchedModel} model`);
              setSelectedModel(touchedModel as 'coicoi' | 'wkwk');
            }
            setLastTapTime(currentTime);
          }
        };

        renderer.domElement.addEventListener('click', handleTap);
        renderer.domElement.addEventListener('touchend', handleTap);

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

        return () => {
          window.removeEventListener('resize', handleResize);
          renderer.domElement.removeEventListener('click', handleTap);
          renderer.domElement.removeEventListener('touchend', handleTap);
          
          if (frameRef.current) {
            cancelAnimationFrame(frameRef.current);
            frameRef.current = null;
          }
          
          // ビデオとストリームのクリーンアップ（より徹底的に）
          if ((renderer as any).videoElement) {
            const video = (renderer as any).videoElement;
            video.pause();
            video.srcObject = null;
            video.load(); // 強制的にリセット
            if (video.parentNode) {
              video.parentNode.removeChild(video);
            }
            (renderer as any).videoElement = null;
          }
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
    if (!rendererRef.current) return;

    setShowFlash(true);
    setTimeout(() => setShowFlash(false), 150);

    const canvas = rendererRef.current.domElement;
    const imageData = canvas.toDataURL('image/png');

    const link = document.createElement('a');
    link.download = `ar-photo-${Date.now()}.png`;
    link.href = imageData;
    link.click();
  };

  const startAR = () => {
    setIsARActive(true);
  };

  const switchCamera = async () => {
    const newFacingMode = facingMode === 'environment' ? 'user' : 'environment';
    
    try {
      // 現在のビデオストリームを停止
      if (rendererRef.current && (rendererRef.current as any).videoStream) {
        const currentStream = (rendererRef.current as any).videoStream;
        currentStream.getTracks().forEach((track: MediaStreamTrack) => track.stop());
      }

      // 新しいストリームを取得
      const newStream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: newFacingMode,
          width: { ideal: 1920 },
          height: { ideal: 1080 }
        },
        audio: false
      });

      // 新しいビデオテクスチャを設定
      if (rendererRef.current && (rendererRef.current as any).videoElement && sceneRef.current) {
        const video = (rendererRef.current as any).videoElement;
        video.srcObject = newStream;
        await video.play();

        const videoTexture = new THREE.VideoTexture(video);
        videoTexture.minFilter = THREE.LinearFilter;
        videoTexture.magFilter = THREE.LinearFilter;
        videoTexture.needsUpdate = true;
        sceneRef.current.background = videoTexture;

        // 新しいストリームを保存
        (rendererRef.current as any).videoStream = newStream;
      }

      setFacingMode(newFacingMode);
      console.log(`Successfully switched to ${newFacingMode} camera`);
      
    } catch (error) {
      console.error('Failed to switch camera:', error);
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
          {/* Three.js/Zapparレンダリングエリア */}
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


          {/* カメラ切り替えボタン（右上） */}
          {zapparLoaded && (
            <button
              type="button"
              onClick={switchCamera}
              className="absolute top-4 right-4 w-12 h-12 sm:w-14 sm:h-14 backdrop-blur-xl rounded-full flex items-center justify-center border border-gray-400 border-opacity-30 shadow-2xl transition-all hover:scale-105 active:scale-95"
              title={`カメラ切り替え (現在: ${facingMode === 'environment' ? 'アウトカメラ' : 'インカメラ'})`}
              style={{
                background: 'linear-gradient(135deg, rgba(56, 189, 248, 0.4), rgba(14, 165, 233, 0.2))',
                boxShadow: '0 8px 32px rgba(56, 189, 248, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.2)'
              }}
            >
              <RotateCcw className="w-6 h-6 sm:w-7 sm:h-7 text-white drop-shadow-lg" />
            </button>
          )}

          {/* モデル選択インジケーター（カメラボタンの下） */}
          {zapparLoaded && (
            <div
              className="absolute top-20 right-4 w-10 h-10 sm:w-12 sm:h-12 backdrop-blur-xl rounded-full flex items-center justify-center border border-gray-400 border-opacity-30 shadow-2xl pointer-events-none"
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
              
              <div className="p-3 sm:p-4 md:p-5 lg:p-6 flex flex-col space-y-3 sm:space-y-4 md:space-y-5">
                {/* ジョイスティック風の位置制御（タブレット対応大型サイズ） */}
                <div className="w-20 h-20 sm:w-28 sm:h-28 md:w-32 md:h-32 lg:w-36 lg:h-36 backdrop-blur-lg bg-gray-900 bg-opacity-8 rounded-full flex items-center justify-center border border-gray-400 border-opacity-12 shadow-inner">
                  <div className="relative w-16 h-16 sm:w-24 sm:h-24 md:w-28 md:h-28 lg:w-32 lg:h-32">
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
                      className="absolute top-0 left-1/2 w-5 h-5 sm:w-7 sm:h-7 md:w-8 md:h-8 lg:w-9 lg:h-9 backdrop-blur-sm bg-blue-500 bg-opacity-40 rounded-full flex items-center justify-center transform -translate-x-1/2 hover:bg-opacity-60 transition-all duration-200 border border-gray-400 border-opacity-30 shadow-lg"
                      title="上に移動"
                    >
                      <ArrowUp className="w-2.5 h-2.5 sm:w-3.5 sm:h-3.5 md:w-4 md:h-4 lg:w-5 lg:h-5 text-white drop-shadow-sm" />
                    </button>
                    
                    <button
                      type="button"
                      onClick={moveModelDown}
                      className="absolute bottom-0 left-1/2 w-5 h-5 sm:w-7 sm:h-7 md:w-8 md:h-8 lg:w-9 lg:h-9 backdrop-blur-sm bg-red-500 bg-opacity-40 rounded-full flex items-center justify-center transform -translate-x-1/2 hover:bg-opacity-60 transition-all duration-200 border border-gray-400 border-opacity-30 shadow-lg"
                      title="下に移動"
                    >
                      <ArrowDown className="w-2.5 h-2.5 sm:w-3.5 sm:h-3.5 md:w-4 md:h-4 lg:w-5 lg:h-5 text-white drop-shadow-sm" />
                    </button>
                    
                    <button
                      type="button"
                      onClick={moveModelLeft}
                      className="absolute left-0 top-1/2 w-5 h-5 sm:w-7 sm:h-7 md:w-8 md:h-8 lg:w-9 lg:h-9 backdrop-blur-sm bg-green-500 bg-opacity-40 rounded-full flex items-center justify-center transform -translate-y-1/2 hover:bg-opacity-60 transition-all duration-200 border border-gray-400 border-opacity-30 shadow-lg"
                      title="左に移動"
                    >
                      <ArrowLeft className="w-2.5 h-2.5 sm:w-3.5 sm:h-3.5 md:w-4 md:h-4 lg:w-5 lg:h-5 text-white drop-shadow-sm" />
                    </button>
                    
                    <button
                      type="button"
                      onClick={moveModelRight}
                      className="absolute right-0 top-1/2 w-5 h-5 sm:w-7 sm:h-7 md:w-8 md:h-8 lg:w-9 lg:h-9 backdrop-blur-sm bg-purple-500 bg-opacity-40 rounded-full flex items-center justify-center transform -translate-y-1/2 hover:bg-opacity-60 transition-all duration-200 border border-gray-400 border-opacity-30 shadow-lg"
                      title="右に移動"
                    >
                      <ArrowRight className="w-2.5 h-2.5 sm:w-3.5 sm:h-3.5 md:w-4 md:h-4 lg:w-5 lg:h-5 text-white drop-shadow-sm" />
                    </button>
                  </div>
                </div>
                
                {/* サイズ制御（タブレット対応大型サイズ） */}
                <div className="w-20 h-7 sm:w-28 sm:h-9 md:w-32 md:h-10 lg:w-36 lg:h-11 backdrop-blur-lg bg-gray-800 bg-opacity-15 rounded-full flex items-center justify-center border border-gray-400 border-opacity-30 px-3 sm:px-4 shadow-inner">
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
              </div>
            </div>
          )}

          {/* カメラボタン（レスポンシブサイズ拡大） */}
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

export default ARZapparTrackingFixed;