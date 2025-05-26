'use client';

import dynamic from 'next/dynamic';
import { useState } from 'react';
import FileUpload from '@/components/FileUpload';
import type { MapComponentProps } from '@/components/MapComponent';

// Leaflet 컴포넌트를 클라이언트 사이드에서만 로드
const MapComponent = dynamic(() => import('@/components/MapComponent'), {
  ssr: false,
});

export default function Home() {
  const [markers, setMarkers] = useState<MapComponentProps['markers']>([]);

  return (
    <div className="relative h-screen">
      <div className="absolute top-4 left-4 z-[9999] bg-white/95 backdrop-blur-sm px-6 py-3 rounded-lg shadow-xl border border-gray-200 flex items-center gap-6">
        <h1 className="text-xl font-bold whitespace-nowrap">주소 지도 시각화</h1>
        <div className="flex items-center gap-4">
          <FileUpload setMarkers={setMarkers} />
        </div>
      </div>
      <div className="h-full w-full">
        <MapComponent markers={markers} />
      </div>
    </div>
  );
}
