'use client';

import React, { forwardRef, useEffect, useRef, useState } from 'react';
import Script from 'next/script';
import 'leaflet/dist/leaflet.css';

declare global {
  interface Window {
    vw: any;
    maps: any;
  }
}

export interface Marker {
  lat: number;
  lng: number;
  address: string;
  count: number;
  addresses: string[];
  isApartment?: boolean;
}

export interface MapComponentProps {
  markers: Marker[];
}

const MapComponent = forwardRef<any, MapComponentProps>(({ markers }, ref) => {
  const mapRef = useRef<any>(null);
  const [mapType, setMapType] = useState<'base' | 'satellite' | 'hybrid'>('base');
  const VWORLD_KEY = process.env.NEXT_PUBLIC_VWORLD_API_KEY;
  const mapContainerId = 'vmap';

  useEffect(() => {
    // VWorld 스크립트 로드
    const loadVWorldScript = () => {
      return new Promise<void>((resolve, reject) => {
        const script = document.createElement('script');
        script.src = `https://map.vworld.kr/js/vworldMapInit.js.do?version=2.0&apiKey=${VWORLD_KEY}`;
        script.async = true;
        script.onload = () => resolve();
        script.onerror = () => reject(new Error('VWorld 스크립트 로드 실패'));
        document.head.appendChild(script);
      });
    };

    const initializeMap = async () => {
      try {
        await loadVWorldScript();

        const vw = window.vw;
        if (!vw) {
          console.error('VWorld API가 로드되지 않았습니다.');
          return;
        }

        // 지도 옵션 설정
        const options = {
          container: mapContainerId,
          mapMode: "2d-map",
          basemapType: vw.BasemapType.GRAPHIC,
          controlDensity: vw.DensityType.EMPTY,
          interactionDensity: vw.DensityType.BASIC,
          controlsAutoArrange: true,
          homePosition: vw.CameraPosition,
          initPosition: vw.CameraPosition
        };

        // 지도 생성
        const map = new vw.Map(options);
        mapRef.current = map;

        // 초기 위치 설정 (대한민국 중심)
        map.setCenter(new vw.CoordZ(127.5, 36.5, 7));

        // 마커 추가
        if (markers && markers.length > 0) {
          markers.forEach((marker) => {
            const size = calculateMarkerSize(marker.count);
            addMarker(map, marker, size);
          });

          // 모든 마커가 보이도록 지도 영역 조정
          const bounds = calculateBounds(markers);
          if (bounds) {
            map.setBounds(bounds);
          }
        }

      } catch (error) {
        console.error('지도 초기화 중 오류 발생:', error);
      }
    };

    initializeMap();

    return () => {
      if (mapRef.current) {
        mapRef.current.destroy();
        mapRef.current = null;
      }
    };
  }, [VWORLD_KEY]);

  // 마커가 변경될 때마다 업데이트
  useEffect(() => {
    if (!mapRef.current || !markers) return;

    const map = mapRef.current;

    // 기존 마커 제거
    map.clearMarkers();

    // 새 마커 추가
    markers.forEach((marker) => {
      const size = calculateMarkerSize(marker.count);
      addMarker(map, marker, size);
    });

    // 지도 영역 조정
    const bounds = calculateBounds(markers);
    if (bounds) {
      map.setBounds(bounds);
    }
  }, [markers]);

  const calculateMarkerSize = (count: number) => {
    const k = 0.1111;
    const maxRadius = 50;
    return Math.min(Math.sqrt(count / k), maxRadius);
  };

  const calculateBounds = (markers: Marker[]) => {
    if (!markers || markers.length === 0) return null;

    const lngs = markers.map(m => m.lng);
    const lats = markers.map(m => m.lat);

    return {
      sw: [Math.min(...lngs), Math.min(...lats)],
      ne: [Math.max(...lngs), Math.max(...lats)]
    };
  };

  const addMarker = (map: any, marker: Marker, size: number) => {
    try {
      const markerOptions = {
        map: map,
        position: [marker.lng, marker.lat],
        title: marker.address,
        content: `
          <div style="
            width: ${size * 2}px;
            height: ${size * 2}px;
            background-color: rgba(29, 78, 216, 0.6);
            border: 1px solid #1e40af;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            color: white;
            font-weight: bold;
            text-shadow: 1px 1px 2px rgba(0,0,0,0.5);
            font-size: ${Math.max(12, Math.min(16, size * 0.5))}px;
          ">
            ${marker.count}
          </div>
        `
      };

      const markerInstance = new window.vw.Marker(markerOptions);

      // 클릭 이벤트에 팝업 추가
      markerInstance.on('click', () => {
        const infoWindow = new window.vw.InfoWindow({
          map: map,
          position: [marker.lng, marker.lat],
          content: `
            <div class="p-2 max-w-xs">
              <p class="font-bold mb-1">${marker.address}</p>
              <p class="text-sm text-gray-600">${marker.count}건</p>
              ${marker.addresses.length > 0 ? `
                <div class="mt-2 text-xs text-gray-500 max-h-32 overflow-y-auto">
                  ${marker.addresses.map(addr => `<p>${addr}</p>`).join('')}
                </div>
              ` : ''}
            </div>
          `
        });
      });

    } catch (error) {
      console.error('마커 추가 중 오류 발생:', error);
    }
  };

  const handleMapTypeChange = (type: 'base' | 'satellite' | 'hybrid') => {
    if (!mapRef.current) return;

    setMapType(type);
    const map = mapRef.current;
    
    try {
      switch (type) {
        case 'satellite':
          map.setBasemapType(window.vw.BasemapType.SATELLITE);
          break;
        case 'hybrid':
          map.setBasemapType(window.vw.BasemapType.HYBRID);
          break;
        default:
          map.setBasemapType(window.vw.BasemapType.GRAPHIC);
      }
    } catch (error) {
      console.error('지도 타입 변경 중 오류 발생:', error);
    }
  };

  return (
    <div className="relative h-full w-full">
      <div 
        id={mapContainerId} 
        style={{ height: '100%', width: '100%', minHeight: '600px' }}
        ref={ref}
      />
      <div className="absolute top-4 right-4 bg-white p-2 rounded shadow-lg z-[1000]">
        <select 
          value={mapType}
          onChange={(e) => handleMapTypeChange(e.target.value as 'base' | 'satellite' | 'hybrid')}
          className="px-2 py-1 border rounded"
        >
          <option value="base">기본지도</option>
          <option value="satellite">위성지도</option>
          <option value="hybrid">하이브리드</option>
        </select>
      </div>
    </div>
  );
});

MapComponent.displayName = 'MapComponent';

export default MapComponent; 