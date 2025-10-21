'use client';

import { useEffect, useRef, useState } from 'react';
import Script from 'next/script';

export default function TestSamplePage() {
  const [logs, setLogs] = useState<string[]>(['Loading...']);
  const containerRef = useRef<HTMLDivElement>(null);

  const addLog = (msg: string) => {
    setLogs(prev => {
      const newLogs = [...prev, `${new Date().toLocaleTimeString()} ${msg}`];
      return newLogs.slice(-15);
    });
  };

  useEffect(() => {
    const init = () => {
      if (typeof (window as any).AFRAME === 'undefined') {
        setTimeout(init, 100);
        return;
      }

      addLog('A-Frame loaded');

      if (!containerRef.current) return;

      containerRef.current.innerHTML = `
        <a-scene
          mindar-image="imageTargetSrc: /targets-sample.mind"
          vr-mode-ui="enabled: false"
          device-orientation-permission-ui="enabled: false">

          <a-camera position="0 0 0" look-controls="enabled: false"></a-camera>

          <a-entity mindar-image-target="targetIndex: 0">
            <a-box position="0 0 0" scale="0.5 0.5 0.5" color="#00ff00" rotation="0 45 0"></a-box>
            <a-text value="SAMPLE\\nMARKER" position="0 0.7 0" align="center" color="white" scale="2 2 2"></a-text>
          </a-entity>
        </a-scene>
      `;

      setTimeout(() => {
        const scene = document.querySelector('a-scene');
        if (!scene) {
          addLog('❌ Scene not found');
          return;
        }

        scene.addEventListener('arReady', () => {
          addLog('✓ AR Ready!');
        });

        scene.addEventListener('arError', (e: any) => {
          addLog('❌ AR Error: ' + e.detail);
        });

        const target = document.querySelector('[mindar-image-target]');
        if (target) {
          target.addEventListener('targetFound', () => {
            addLog('🎯 MARKER FOUND!');
          });
          target.addEventListener('targetLost', () => {
            addLog('Marker lost');
          });
        }

        // Video check
        let count = 0;
        const check = setInterval(() => {
          count++;
          const video = document.querySelector('video') as HTMLVideoElement;
          if (video && video.videoWidth > 0) {
            addLog(`✓ Video: ${video.videoWidth}x${video.videoHeight}`);
            clearInterval(check);
          } else if (count >= 10) {
            addLog('❌ No video');
            clearInterval(check);
          }
        }, 1000);
      }, 1000);
    };

    init();
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
          maxHeight: '150px',
          overflowY: 'auto',
          background: 'rgba(0,0,0,0.9)',
          color: '#0f0',
          padding: '10px',
          borderRadius: '5px',
          zIndex: 9999,
          fontSize: '11px'
        }}>
          <div style={{ marginBottom: '5px', color: '#ff0' }}>
            TEST: Sample Marker (250KB)
          </div>
          {logs.map((log, i) => (
            <div key={i}>{log}</div>
          ))}
        </div>

        <div style={{
          position: 'fixed',
          bottom: '10px',
          left: '10px',
          right: '10px',
          background: 'rgba(0,0,0,0.9)',
          color: 'white',
          padding: '10px',
          borderRadius: '5px',
          zIndex: 9999,
          fontSize: '10px'
        }}>
          📷 Point at sample marker image<br/>
          Download: https://cdn.jsdelivr.net/gh/hiukim/mind-ar-js@1.2.5/examples/image-tracking/assets/card-example/card.png
        </div>

        <div ref={containerRef} style={{ width: '100vw', height: '100vh' }} />
      </div>
    </>
  );
}
