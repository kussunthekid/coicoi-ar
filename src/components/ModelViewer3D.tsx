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

    // レンダラー作成
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setClearColor(0xe8e8e8);
    containerRef.current.appendChild(renderer.domElement);

    // ライト追加
    const light1 = new THREE.DirectionalLight(0xffffff, 1);
    light1.position.set(1, 1, 1);
    scene.add(light1);

    const light2 = new THREE.DirectionalLight(0xffffff, 0.5);
    light2.position.set(-1, -1, -1);
    scene.add(light2);

    const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
    scene.add(ambientLight);

    // モデル読み込み
    const loader = new GLTFLoader();
    let model: THREE.Group | null = null;

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

    // アニメーション
    const animate = () => {
      requestAnimationFrame(animate);

      if (model) {
        model.rotation.y += 0.01;
      }

      renderer.render(scene, camera);
    };
    animate();

    // リサイズ対応
    const handleResize = () => {
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(window.innerWidth, window.innerHeight);
    };
    window.addEventListener('resize', handleResize);

    // クリーンアップ
    return () => {
      window.removeEventListener('resize', handleResize);
      if (containerRef.current && renderer.domElement) {
        containerRef.current.removeChild(renderer.domElement);
      }
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
