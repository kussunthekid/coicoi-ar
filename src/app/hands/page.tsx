'use client';

import dynamic from 'next/dynamic';

const HandTrackingBubbles = dynamic(() => import('../../components/HandTrackingBubbles'), {
  ssr: false,
});

export default function HandsPage() {
  return <HandTrackingBubbles />;
}