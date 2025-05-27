'use client';

import React, { useState } from 'react';
import dynamic from 'next/dynamic';
import FileUpload from '@/components/FileUpload';
import type { MapComponentProps } from '@/components/MapComponent';

// Leaflet 컴포넌트를 클라이언트 사이드에서만 로드
const MapComponent = dynamic(() => import('@/components/MapComponent'), {
  ssr: false,
});

export default function Home() {
  const [markers, setMarkers] = useState<MapComponentProps['markers']>([]);
  const [address, setAddress] = useState('');
  const [result, setResult] = useState<{ lat: number; lng: number } | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const mapRef = React.useRef<L.Map | null>(null);

  const handleSearch = async () => {
    if (!address) return;

    setIsLoading(true);
    setError(null);
    
    try {
      const encodedAddress = encodeURIComponent(address);
      const response = await fetch(`/api/geocode?address=${encodedAddress}`, {
        method: 'GET',
        headers: {
          'Accept': 'application/json'
        }
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || '주소를 찾을 수 없습니다.');
      }

      const data = await response.json();
      setResult({ lat: data.lat, lng: data.lng });
      
      if (mapRef.current) {
        mapRef.current.setView([data.lat, data.lng], 17);
      }
    } catch (error) {
      console.error('Search error:', error);
      setError(error instanceof Error ? error.message : '알 수 없는 오류가 발생했습니다.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="relative h-screen">
      <div className="absolute top-4 left-4 z-[9999] bg-white/95 backdrop-blur-sm px-6 py-3 rounded-lg shadow-xl border border-gray-200">
        <h1 className="text-xl font-bold whitespace-nowrap mb-4">주소 지도 시각화</h1>
        <div className="flex flex-col gap-4">
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
              placeholder="주소를 입력하세요"
              className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 w-80"
            />
            <button
              onClick={handleSearch}
              disabled={isLoading}
              className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:bg-gray-400"
            >
              {isLoading ? '검색 중...' : '검색'}
            </button>
          </div>
          {error && (
            <div className="text-red-500 text-sm">{error}</div>
          )}
          <FileUpload setMarkers={setMarkers} />
        </div>
      </div>
      <div className="h-full w-full">
        <MapComponent markers={markers} ref={mapRef} />
      </div>
    </div>
  );
}
