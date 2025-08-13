'use client';

import dynamic from 'next/dynamic';

// ARコンポーネントを動的インポート（SSRを回避）
const ARJSApp = dynamic(
  () => import('../components/ARJSApp'),
  { 
    ssr: false,
    loading: () => <div className="flex items-center justify-center min-h-screen">AR.jsアプリを読み込み中...</div>
  }
);

export default function Home() {
  return (
    <div className="w-full h-screen">
      <ARJSApp />
    </div>
  );
}
