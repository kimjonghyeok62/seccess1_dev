'use client';

import React, { forwardRef, useEffect, useRef, useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap, CircleMarker } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';

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

// 마커들의 중심점과 경계를 계산하는 컴포넌트
const MapController = ({ markers }: { markers: Marker[] }) => {
  const map = useMap();

  useEffect(() => {
    if (markers.length > 0) {
      const bounds = L.latLngBounds(markers.map(marker => [marker.lat, marker.lng]));
      map.fitBounds(bounds, {
        padding: [50, 50],
        maxZoom: 17
      });
    }
  }, [markers, map]);

  return null;
};

// 마커 컴포넌트
const MarkerComponent = ({ marker, size }: { marker: Marker; size: number }) => {
  return (
    <>
      <CircleMarker
        center={[marker.lat, marker.lng]}
        radius={size}
        fillColor="#1d4ed8"
        fillOpacity={0.6}
        color="#1e40af"
        weight={1}
      >
        <Popup>
          <div className="p-2 max-w-xs">
            <p className="font-bold mb-1">{marker.address}</p>
            <p className="text-sm text-gray-600">{marker.count}건</p>
            {marker.addresses.length > 0 && (
              <div className="mt-2 text-xs text-gray-500 max-h-32 overflow-y-auto">
                {marker.addresses.map((addr, i) => (
                  <p key={i}>{addr}</p>
                ))}
              </div>
            )}
          </div>
        </Popup>
      </CircleMarker>
      {marker.count >= 10 && (
        <Marker
          position={[marker.lat, marker.lng]}
          icon={L.divIcon({
            className: 'custom-div-icon',
            html: `<div style="
              background-color: transparent;
              color: white;
              font-weight: bold;
              text-align: center;
              width: ${size * 2}px;
              height: ${size * 2}px;
              display: flex;
              align-items: center;
              justify-content: center;
              text-shadow: 1px 1px 2px rgba(0,0,0,0.5);
              margin-left: -${size}px;
              margin-top: -${size}px;
              font-size: ${Math.max(12, Math.min(16, size * 0.5))}px;
            ">${marker.count}</div>`,
            iconSize: [size * 2, size * 2],
            iconAnchor: [0, 0]
          })}
        >
          <Popup>
            <div className="p-2 max-w-xs">
              <p className="font-bold mb-1">{marker.address}</p>
              <p className="text-sm text-gray-600">{marker.count}건</p>
              {marker.addresses.length > 0 && (
                <div className="mt-2 text-xs text-gray-500 max-h-32 overflow-y-auto">
                  {marker.addresses.map((addr, i) => (
                    <p key={i}>{addr}</p>
                  ))}
                </div>
              )}
            </div>
          </Popup>
        </Marker>
      )}
    </>
  );
};

const MapComponent = forwardRef<L.Map, MapComponentProps>(({ markers }, ref) => {
  const [mapType, setMapType] = useState<'base' | 'satellite' | 'hybrid'>('base');
  const VWORLD_KEY = process.env.NEXT_PUBLIC_VWORLD_API_KEY;

  const getMapUrl = (type: string) => {
    const key = VWORLD_KEY;
    const domain = typeof window !== 'undefined' ? window.location.hostname : '';
    switch (type) {
      case 'satellite':
        return `https://api.vworld.kr/req/wmts/1.0.0/${key}/Satellite/{z}/{y}/{x}.jpeg?domain=${domain}`;
      case 'hybrid':
        return `https://api.vworld.kr/req/wmts/1.0.0/${key}/Hybrid/{z}/{y}/{x}.png?domain=${domain}`;
      default:
        return `https://api.vworld.kr/req/wmts/1.0.0/${key}/Base/{z}/{y}/{x}.png?domain=${domain}`;
    }
  };

  // 마커 크기 계산
  const markerSizes = markers.map(marker => {
    const k = 0.1111;
    const maxRadius = 50;
    return Math.min(Math.sqrt(marker.count / k), maxRadius);
  });

  return (
    <div className="relative h-full w-full">
      <MapContainer
        center={[37.2911, 127.0089]}
        zoom={11}
        style={{ height: '100%', width: '100%', minHeight: '600px' }}
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
          <MarkerComponent
            key={`marker-${index}`}
            marker={marker}
            size={markerSizes[index]}
          />
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