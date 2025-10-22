'use client';

import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { GLTFLoader } from 'three-stdlib';
import { X } from 'lucide-react';

interface ModelViewer3DProps {
  modelName: string;
  onClose: () => void;
}

const ModelViewer3D: React.FC<ModelViewer3DProps> = ({ modelName, onClose }) => {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    // シーン作成
    const scene = new THREE.Scene();

    // カメラ作成
    const camera = new THREE.PerspectiveCamera(
      75,
      window.innerWidth / window.innerHeight,
      0.1,
      1000
    );
    camera.position.z = 3;

    // レンダラー作成（パフォーマンス最適化）
    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      powerPreference: 'high-performance', // 高パフォーマンスモード
      alpha: false, // 透明度不要
    });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2)); // ピクセル比を制限
    renderer.setClearColor(0xe8e8e8);
    containerRef.current.appendChild(renderer.domElement);

    // ライト追加（最小限に）
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.8);
    scene.add(ambientLight);

    const directionalLight = new THREE.DirectionalLight(0xffffff, 1.2);
    directionalLight.position.set(1, 1, 1);
    scene.add(directionalLight);

    // モデル読み込み
    const loader = new GLTFLoader();
    let model: THREE.Group | null = null;
    let animationFrameId: number;

    loader.load(
      `/${modelName}.glb`,
      (gltf) => {
        model = gltf.scene;

        // バウンディングボックス計算
        const box = new THREE.Box3().setFromObject(model);
        const size = box.getSize(new THREE.Vector3());

        // スケール調整（画面に収まるように）
        const maxSize = Math.max(size.x, size.y, size.z);
        const scale = 2 / maxSize;
        model.scale.setScalar(scale);

        // スケール適用後に再度バウンディングボックスを計算してセンタリング
        box.setFromObject(model);
        const scaledCenter = box.getCenter(new THREE.Vector3());

        // モデルを中央に配置
        model.position.x = -scaledCenter.x;
        model.position.y = -scaledCenter.y;
        model.position.z = -scaledCenter.z;

        scene.add(model);
      },
      undefined,
      (error) => {
        console.error('Model load error:', error);
      }
    );

    // アニメーション（最適化版）
    let lastTime = performance.now();
    const targetFPS = 60;
    const frameInterval = 1000 / targetFPS;

    const animate = (currentTime: number) => {
      animationFrameId = requestAnimationFrame(animate);

      const deltaTime = currentTime - lastTime;

      // フレームレート制限
      if (deltaTime >= frameInterval) {
        lastTime = currentTime - (deltaTime % frameInterval);

        if (model) {
          model.rotation.y += 0.01;
        }

        renderer.render(scene, camera);
      }
    };
    animationFrameId = requestAnimationFrame(animate);

    // リサイズ対応（デバウンス）
    let resizeTimeout: NodeJS.Timeout;
    const handleResize = () => {
      clearTimeout(resizeTimeout);
      resizeTimeout = setTimeout(() => {
        camera.aspect = window.innerWidth / window.innerHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(window.innerWidth, window.innerHeight);
        renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
      }, 100);
    };
    window.addEventListener('resize', handleResize);

    // クリーンアップ
    return () => {
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener('resize', handleResize);
      clearTimeout(resizeTimeout);

      if (containerRef.current && renderer.domElement.parentNode === containerRef.current) {
        containerRef.current.removeChild(renderer.domElement);
      }

      // メモリ解放
      scene.traverse((object) => {
        if (object instanceof THREE.Mesh) {
          object.geometry?.dispose();
          if (object.material) {
            if (Array.isArray(object.material)) {
              object.material.forEach(mat => mat.dispose());
            } else {
              object.material.dispose();
            }
          }
        }
      });

      renderer.dispose();
    };
  }, [modelName]);

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      width: '100vw',
      height: '100vh',
      zIndex: 100000,
      background: 'linear-gradient(135deg, #e0e0e0 0%, #f5f5f5 50%, #e8e8e8 100%)'
    }}>
      {/* 閉じるボタン */}
      <button
        onClick={onClose}
        style={{
          position: 'absolute',
          top: '20px',
          right: '20px',
          width: '48px',
          height: '48px',
          borderRadius: '50%',
          background: 'rgba(0, 0, 0, 0.6)',
          border: 'none',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'pointer',
          color: 'white',
          zIndex: 100001
        }}
      >
        <X size={24} />
      </button>

      {/* モデル名 */}
      <div style={{
        position: 'absolute',
        top: '20px',
        left: '50%',
        transform: 'translateX(-50%)',
        background: 'rgba(255, 255, 255, 0.9)',
        padding: '12px 24px',
        borderRadius: '24px',
        fontSize: '18px',
        fontWeight: 'bold',
        color: '#333',
        zIndex: 100001
      }}>
        {modelName.replace('wkwk_', '').toUpperCase()}
      </div>

      {/* Three.jsコンテナ */}
      <div ref={containerRef} style={{ width: '100%', height: '100%' }} />
    </div>
  );
};

export default ModelViewer3D;
