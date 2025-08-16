'use client';

import dynamic from 'next/dynamic';

// ARコンポーネントを動的インポート（SSRを回避）
const ARZapparTrackingFixed = dynamic(
  () => import('../../components/ARZapparTrackingFixed'),
  { 
    ssr: false,
    loading: () => <div className="flex items-center justify-center min-h-screen">ARアプリを読み込み中...</div>
  }
);

export default function ARPage() {
  return (
    <div className="w-full h-screen">
      <ARZapparTrackingFixed />
    </div>
  );
}