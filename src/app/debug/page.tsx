'use client';

import { useEffect, useRef, useState } from 'react';
import Script from 'next/script';

export default function DebugPage() {
  const [logs, setLogs] = useState<string[]>(['Loading...']);
  const containerRef = useRef<HTMLDivElement>(null);

  const addLog = (msg: string) => {
    const time = new Date().toLocaleTimeString();
    setLogs(prev => {
      const newLogs = [...prev, `[${time}] ${msg}`];
      return newLogs.slice(-20);
    });
    console.log(msg);
  };

  useEffect(() => {
    addLog('DOM Ready');

    const initAR = () => {
      if (typeof (window as any).AFRAME === 'undefined') {
        setTimeout(initAR, 100);
        return;
      }

      addLog('A-Frame loaded');

      if (!containerRef.current) return;

      containerRef.current.innerHTML = `
        <a-scene
          mindar-image="imageTargetSrc: /targets.mind; showStats: true; filterMinCF: 0.0001; filterBeta: 0.001"
          vr-mode-ui="enabled: false"
          device-orientation-permission-ui="enabled: false">

          <a-camera position="0 0 0" look-controls="enabled: false" user-height="0"></a-camera>

          <a-entity mindar-image-target="targetIndex: 0">
            <a-box position="0 0 0" scale="0.5 0.5 0.5" color="#4299e1"></a-box>
            <a-text value="TARGET 0" position="0 0.5 0" align="center" color="white" scale="2 2 2"></a-text>
          </a-entity>

          <a-entity mindar-image-target="targetIndex: 1">
            <a-box position="0 0 0" scale="0.5 0.5 0.5" color="#f59e0b"></a-box>
            <a-text value="TARGET 1" position="0 0.5 0" align="center" color="white" scale="2 2 2"></a-text>
          </a-entity>

          <a-entity mindar-image-target="targetIndex: 2">
            <a-box position="0 0 0" scale="0.5 0.5 0.5" color="#10b981"></a-box>
            <a-text value="TARGET 2" position="0 0.5 0" align="center" color="white" scale="2 2 2"></a-text>
          </a-entity>

          <a-entity mindar-image-target="targetIndex: 3">
            <a-box position="0 0 0" scale="0.5 0.5 0.5" color="#8b5cf6"></a-box>
            <a-text value="TARGET 3" position="0 0.5 0" align="center" color="white" scale="2 2 2"></a-text>
          </a-entity>

          <a-entity mindar-image-target="targetIndex: 4">
            <a-box position="0 0 0" scale="0.5 0.5 0.5" color="#ec4899"></a-box>
            <a-text value="TARGET 4" position="0 0.5 0" align="center" color="white" scale="2 2 2"></a-text>
          </a-entity>
        </a-scene>
      `;

      setTimeout(() => {
        const sceneEl = document.querySelector('a-scene');
        if (!sceneEl) {
          addLog('❌ Scene not found');
          return;
        }

        addLog('Scene element found');

        // カメラ権限チェック
        navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } })
          .then((stream) => {
            addLog('✓ Camera permission OK');
            const track = stream.getVideoTracks()[0];
            const settings = track.getSettings();
            addLog(`Camera: ${settings.width}x${settings.height}`);
            stream.getTracks().forEach(t => t.stop());
          })
          .catch((err) => {
            addLog(`❌ Camera error: ${err.name} - ${err.message}`);
          });

        sceneEl.addEventListener('loaded', () => {
          addLog('✓ Scene loaded');
        });

        sceneEl.addEventListener('arReady', () => {
          addLog('✓✓ AR Ready!');

          const video = sceneEl.querySelector('video');
          if (video) {
            const v = video as HTMLVideoElement;
            addLog(`Video: ${v.videoWidth}x${v.videoHeight}`);
            addLog(`ReadyState: ${v.readyState}`);
          } else {
            addLog('No video element');
          }
        });

        sceneEl.addEventListener('arError', (e: any) => {
          addLog(`❌ AR Error: ${JSON.stringify(e.detail)}`);
        });

        const targets = document.querySelectorAll('[mindar-image-target]');
        targets.forEach((target, i) => {
          target.addEventListener('targetFound', () => {
            addLog(`🎯 Target ${i} FOUND!`);
          });
          target.addEventListener('targetLost', () => {
            addLog(`Target ${i} lost`);
          });
        });

        addLog(`Monitoring ${targets.length} targets`);

        // ビデオ要素の定期チェック
        let count = 0;
        const checkVideo = setInterval(() => {
          count++;
          const video = document.querySelector('video') as HTMLVideoElement;
          if (video) {
            addLog(`Video ${count}: ${video.videoWidth}x${video.videoHeight} ready:${video.readyState}`);
            if (count >= 3) clearInterval(checkVideo);
          } else {
            addLog(`Video ${count}: Not found yet`);
            if (count >= 10) {
              addLog('❌ Video never appeared');
              clearInterval(checkVideo);
            }
          }
        }, 1000);
      }, 1000);
    };

    initAR();
  }, []);

  return (
    <>
      <Script src="https://aframe.io/releases/1.5.0/aframe.min.js" strategy="beforeInteractive" />
      <Script src="https://cdn.jsdelivr.net/npm/mind-ar@1.2.5/dist/mindar-image-aframe.prod.js" strategy="beforeInteractive" />

      <div style={{ margin: 0, overflow: 'hidden', fontFamily: 'monospace' }}>
        <div style={{
          position: 'fixed',
          top: '10px',
          left: '10px',
          right: '10px',
          maxHeight: '200px',
          overflowY: 'auto',
          background: 'rgba(0,0,0,0.8)',
          color: '#0f0',
          padding: '10px',
          borderRadius: '5px',
          zIndex: 9999,
          fontSize: '10px'
        }}>
          {logs.map((log, i) => (
            <div key={i}>{log}</div>
          ))}
        </div>

        <div ref={containerRef} style={{ width: '100vw', height: '100vh' }} />
      </div>
    </>
  );
}
