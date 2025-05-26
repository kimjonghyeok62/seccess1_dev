'use client';

import React, { forwardRef } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap, CircleMarker, Tooltip } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import { useEffect, useState, useMemo } from 'react';

// Leaflet 기본 아이콘 문제 해결
const icon = L.icon({
  iconUrl: '/marker-icon.png',
  iconRetinaUrl: '/marker-icon-2x.png',
  shadowUrl: '/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41]
});

export interface MapComponentProps {
  markers: Array<{
    lat: number;
    lng: number;
    address: string;
    count: number;
    addresses: string[];
    buildingCounts?: string;
    isApartment: boolean;
  }>;
}

// 마커들의 중심점과 경계를 계산하는 컴포넌트
const MapController = ({ markers }: MapComponentProps) => {
  const map = useMap();

  useEffect(() => {
    if (markers.length > 0) {
      // 모든 마커의 위치로 경계 상자 생성
      const bounds = L.latLngBounds(markers.map(marker => [marker.lat, marker.lng]));
      
      // 경계 상자에 맞게 지도 뷰 조정 (패딩 적용)
      map.fitBounds(bounds, {
        padding: [50, 50], // 상하좌우 50픽셀 패딩
        maxZoom: 17 // 최대 줌 레벨 제한
      });
    } else {
      // 마커가 없을 경우 경기도 중심으로 이동
      map.setView([37.2911, 127.0089], 11); // 경기도 용인시 중심, 줌 레벨 11
    }
  }, [markers, map]);

  return null;
};

const MapComponent = forwardRef<L.Map, MapComponentProps>(({ markers }, ref) => {
  const [mapType, setMapType] = useState<'base' | 'satellite' | 'hybrid'>('base');

  // 마커 크기 계산
  const markerSizes = useMemo(() => {
    const baseRadius = 3; // 기본 반지름 (count가 1일 때) - 6에서 3으로 변경
    const maxRadius = 30; // 최대 반지름 - 15에서 30으로 변경
    
    // 최대 count 찾기
    const maxCount = Math.max(...markers.map(m => m.count));
    
    // 각 마커의 반지름 계산
    return markers.map(marker => {
      // 면적이 count에 비례하도록 반지름 계산
      // 면적 ∝ π * r² ∝ count
      // 따라서 r ∝ √count
      const radius = Math.min(
        baseRadius * Math.sqrt(marker.count),
        maxRadius
      );
      return radius;
    });
  }, [markers]);

  useEffect(() => {
    // Leaflet CSS가 SSR과 충돌하는 것을 방지
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
    document.head.appendChild(link);

    return () => {
      document.head.removeChild(link);
    };
  }, []);

  const VWORLD_KEY = process.env.NEXT_PUBLIC_VWORLD_API_KEY;

const getMapUrl = (type: string) => {
    const key = VWORLD_KEY;
    switch (type) {
      case 'satellite':
        return `http://api.vworld.kr/req/wmts/1.0.0/${key}/Satellite/{z}/{y}/{x}.jpeg`;
      case 'hybrid':
        return `http://api.vworld.kr/req/wmts/1.0.0/${key}/Hybrid/{z}/{y}/{x}.png`;
      default:
        return `http://api.vworld.kr/req/wmts/1.0.0/${key}/Base/{z}/{y}/{x}.png`;
    }
  };

  return (
    <div className="relative h-full w-full">
      <MapContainer
        center={[37.2911, 127.0089]}
        zoom={11}
        style={{ height: '100%', width: '100%' }}
        maxZoom={19}
        minZoom={7}
        ref={ref}
      >
        <MapController markers={markers} />
        <TileLayer
          attribution='&copy; <a href="http://www.vworld.kr">VWorld</a>'
          url={getMapUrl(mapType)}
        />
        {markers.map((marker, index) => (
          <div key={`marker-group-${index}`}>
            <CircleMarker
              key={index}
              center={[marker.lat, marker.lng]}
              radius={markerSizes[index]}
              fillColor="#2563eb"
              fillOpacity={0.8}
              color="#1d4ed8"
              weight={2}
              eventHandlers={{
                mouseover: (e) => {
                  e.target.setStyle({ fillColor: '#3b82f6', color: '#2563eb', fillOpacity: 0.9 });
                  e.target.setRadius(markerSizes[index] * 1.2);
                },
                mouseout: (e) => {
                  e.target.setStyle({ fillColor: '#2563eb', color: '#1d4ed8', fillOpacity: 0.8 });
                  e.target.setRadius(markerSizes[index]);
                },
                click: (e) => {
                  e.target.setStyle({ fillColor: '#1d4ed8', color: '#1e40af', fillOpacity: 1 });
                }
              }}
            >
              <Popup>
                <div className="text-sm" style={{ minWidth: '390px' }}>
                  <div className="max-h-40 overflow-y-auto">
                    <p className="font-bold mb-1">{marker.count}건</p>
                    {marker.addresses.map((address, i) => (
                      <p key={i} className="text-gray-600" style={{ margin: 0 }}>
                        {address}
                      </p>
                    ))}
                  </div>
                </div>
              </Popup>
            </CircleMarker>
            {marker.count >= 10 && (
              <Marker
                position={[marker.lat, marker.lng]}
                icon={L.divIcon({
                  className: 'custom-div-icon',
                  html: `<div style="color: white; font-weight: bold; text-align: center; width: 30px; height: 30px; display: flex; align-items: center; justify-content: center; margin-left: -15px; margin-top: -15px;">${marker.count}</div>`,
                  iconSize: [30, 30],
                  iconAnchor: [0, 0]
                })}
              >
                <Popup>
                  <div className="text-sm" style={{ minWidth: '390px' }}>
                    <div className="max-h-40 overflow-y-auto">
                      <p className="font-bold mb-1">{marker.count}건</p>
                      {marker.addresses.map((address, i) => (
                        <p key={i} className="text-gray-600" style={{ margin: 0 }}>
                          {address}
                        </p>
                      ))}
                    </div>
                  </div>
                </Popup>
              </Marker>
            )}
          </div>
        ))}
      </MapContainer>
      <div className="absolute top-4 right-4 bg-white p-2 rounded shadow-lg z-[1000]">
        <select 
          value={mapType}
          onChange={(e) => setMapType(e.target.value as 'base' | 'satellite' | 'hybrid')}
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