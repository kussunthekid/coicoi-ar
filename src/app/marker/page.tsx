'use client';

import dynamic from 'next/dynamic';

const ThreeAR = dynamic(() => import('@/components/ThreeARFrame'), {
  ssr: false,
  loading: () => (
    <div className="fixed inset-0 bg-black flex items-center justify-center">
      <div className="text-white text-center">
        <div className="animate-spin w-8 h-8 border-2 border-cyan-600 border-t-transparent rounded-full mx-auto mb-4"></div>
        <p>Three.js ARを読み込み中...</p>
      </div>
    </div>
  )
});

export default function MarkerPage() {
  return <ThreeAR />;
}