'use client';

import dynamic from 'next/dynamic';

// ARコンポーネントを動的インポート（SSRを回避）
const ARPlaneDetectionApp = dynamic(
  () => import('../components/ARZapparTracking'),
  { 
    ssr: false,
    loading: () => <div className="flex items-center justify-center min-h-screen">ARアプリを読み込み中...</div>
  }
);

export default function Home() {
  return (
    <div className="w-full h-screen">
      <ARPlaneDetectionApp />
    </div>
  );
}
