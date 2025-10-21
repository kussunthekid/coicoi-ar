'use client';

import { useEffect, useRef } from 'react';
import Script from 'next/script';

export default function SimpleTestPage() {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const init = () => {
      if (typeof (window as any).AFRAME === 'undefined') {
        setTimeout(init, 100);
        return;
      }

      if (!containerRef.current) return;

      // 超シンプルなMindARテスト - targets.mindなし
      containerRef.current.innerHTML = `
        <div style="position: fixed; top: 10px; left: 10px; right: 10px; background: rgba(0,0,0,0.8); color: #0f0; padding: 10px; z-index: 9999; font-size: 12px;">
          Simple camera test (no AR tracking)<br>
          Camera should appear below
        </div>
        <video id="test-video" autoplay playsinline style="width: 100vw; height: 100vh; object-fit: cover;"></video>
      `;

      // カメラを直接起動
      navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: 'environment',
          width: { ideal: 1280 },
          height: { ideal: 720 }
        }
      })
        .then((stream) => {
          const video = document.getElementById('test-video') as HTMLVideoElement;
          if (video) {
            video.srcObject = stream;
            console.log('Camera started:', stream.getVideoTracks()[0].getSettings());
          }
        })
        .catch((err) => {
          console.error('Camera error:', err);
          const msg = document.createElement('div');
          msg.style.cssText = 'position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%); background: red; color: white; padding: 20px; z-index: 99999;';
          msg.textContent = 'Camera Error: ' + err.message;
          document.body.appendChild(msg);
        });
    };

    init();
  }, []);

  return (
    <>
      <Script src="https://aframe.io/releases/1.5.0/aframe.min.js" strategy="beforeInteractive" />
      <div ref={containerRef} style={{ width: '100vw', height: '100vh', margin: 0, padding: 0 }} />
    </>
  );
}
