'use client';

import Image from 'next/image';
import { ArrowLeft } from 'lucide-react';
import { useRouter } from 'next/navigation';

export default function ImagesPage() {
  const router = useRouter();

  return (
    <div className="min-h-screen bg-gray-100 p-4">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center mb-6">
          <button
            onClick={() => router.back()}
            className="flex items-center gap-2 px-4 py-2 bg-white rounded-lg shadow hover:shadow-md transition-shadow"
          >
            <ArrowLeft className="w-5 h-5" />
            戻る
          </button>
          <h1 className="text-2xl font-bold text-gray-800 ml-4">認識用画像</h1>
        </div>

        <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
          <p className="text-gray-600 mb-4">
            以下の画像を印刷するか、別のデバイスで表示して、ARカメラで認識させてください。
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-6">
          {/* Coicoi Image */}
          <div className="bg-white rounded-lg shadow-lg overflow-hidden">
            <div className="bg-cyan-600 text-white p-4">
              <h2 className="text-xl font-semibold">Coicoi画像</h2>
              <p className="text-sm opacity-90 mt-1">この画像を認識するとcoicoiモデルが表示されます</p>
            </div>
            <div className="p-6 bg-gray-50">
              <div className="border-4 border-gray-300 rounded-lg overflow-hidden">
                <img
                  src="/coicoi__maker_1.png"
                  alt="Coicoi認識用画像"
                  className="w-full h-auto"
                />
              </div>
              <p className="text-center text-gray-500 text-sm mt-4">
                クリックして拡大表示 →
              </p>
              <a
                href="/coicoi__maker_1.png"
                target="_blank"
                rel="noopener noreferrer"
                className="block mt-2 text-center text-cyan-600 hover:text-cyan-700 font-medium"
              >
                画像を開く
              </a>
            </div>
          </div>

          {/* WKWK Image */}
          <div className="bg-white rounded-lg shadow-lg overflow-hidden">
            <div className="bg-purple-600 text-white p-4">
              <h2 className="text-xl font-semibold">WKWK画像</h2>
              <p className="text-sm opacity-90 mt-1">この画像を認識するとwkwkモデルが表示されます</p>
            </div>
            <div className="p-6 bg-gray-50">
              <div className="border-4 border-gray-300 rounded-lg overflow-hidden">
                <img
                  src="/wkwk_maker_1.png"
                  alt="WKWK認識用画像"
                  className="w-full h-auto"
                />
              </div>
              <p className="text-center text-gray-500 text-sm mt-4">
                クリックして拡大表示 →
              </p>
              <a
                href="/wkwk_maker_1.png"
                target="_blank"
                rel="noopener noreferrer"
                className="block mt-2 text-center text-purple-600 hover:text-purple-700 font-medium"
              >
                画像を開く
              </a>
            </div>
          </div>
        </div>

        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mt-6">
          <h3 className="font-semibold text-blue-900 mb-2">使い方</h3>
          <ol className="list-decimal list-inside text-blue-800 space-y-1">
            <li>上記の画像をスマートフォンやタブレットで表示するか、印刷します</li>
            <li>ARカメラを起動し、認識したい画像を選択します</li>
            <li>カメラを画像に向けると、3Dモデルが表示されます</li>
          </ol>
        </div>

        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mt-4">
          <h3 className="font-semibold text-amber-900 mb-2">⚠️ 重要な設定情報</h3>
          <div className="text-amber-800 space-y-2">
            <p>現在、画像認識が正常に動作しない場合は、以下の手順で.mindファイルを生成してください：</p>
            <ol className="list-decimal list-inside space-y-1 ml-4">
              <li>
                <a 
                  href="https://hiukim.github.io/mind-ar-js/examples/image-tracking/compile.html" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-amber-700 underline hover:text-amber-900"
                >
                  MindAR Image Compiler
                </a>
                を開きます
              </li>
              <li>上記の画像（coicoi__maker_1.png, wkwk_maker_1.png）をコンパイラーにアップロード</li>
              <li>「Start」ボタンをクリックして処理を実行</li>
              <li>生成された.mindファイルをダウンロード</li>
              <li>開発者に.mindファイルを提供して、アプリに組み込んでもらってください</li>
            </ol>
          </div>
        </div>
      </div>
    </div>
  );
}