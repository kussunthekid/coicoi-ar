'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

export default function Home() {
  const router = useRouter();

  useEffect(() => {
    // ホームページにアクセスしたら自動的にスタートページにリダイレクト
    router.push('/start');
  }, [router]);

  return (
    <div className="flex items-center justify-center min-h-screen">
      <p>リダイレクト中...</p>
    </div>
  );
}
