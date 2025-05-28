'use client';

import React, { forwardRef, useEffect, useRef, useState } from 'react';
import Script from 'next/script';
import 'leaflet/dist/leaflet.css';

declare global {
  interface Window {
    vw: any;
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
    if (typeof window === 'undefined' || !window.vw) return;

    const initMap = () => {
      const domain = typeof window !== 'undefined' ? window.location.hostname : '';
      
      const options = {
        container: mapContainerId,
        mapMode: "2d-map",
        basemapType: window.vw.ol3.BasemapType.GRAPHIC,
        controlDensity: window.vw.ol3.DensityType.EMPTY,
        interactionDensity: window.vw.ol3.DensityType.BASIC,
        controlsAutoArrange: true,
        homePosition: window.vw.ol3.CameraPosition,
        initPosition: window.vw.ol3.CameraPosition,
      };

      const mapController = new window.vw.MapController(options);
      mapRef.current = mapController;

      // 마커 추가
      markers.forEach((marker) => {
        const markerSize = calculateMarkerSize(marker.count);
        addMarker(mapController, marker, markerSize);
      });

      // 모든 마커가 보이도록 지도 영역 조정
      if (markers.length > 0) {
        const bounds = calculateBounds(markers);
        mapController.zoomToExtent(bounds);
      }
    };

    initMap();

    return () => {
      if (mapRef.current) {
        // 지도 정리 작업
        mapRef.current = null;
      }
    };
  }, [markers]);

  const calculateMarkerSize = (count: number) => {
    const k = 0.1111;
    const maxRadius = 50;
    return Math.min(Math.sqrt(count / k), maxRadius);
  };

  const calculateBounds = (markers: Marker[]) => {
    let minLat = markers[0].lat;
    let maxLat = markers[0].lat;
    let minLng = markers[0].lng;
    let maxLng = markers[0].lng;

    markers.forEach(marker => {
      minLat = Math.min(minLat, marker.lat);
      maxLat = Math.max(maxLat, marker.lat);
      minLng = Math.min(minLng, marker.lng);
      maxLng = Math.max(maxLng, marker.lng);
    });

    return [minLng, minLat, maxLng, maxLat];
  };

  const addMarker = (mapController: any, marker: Marker, size: number) => {
    const markerOptions = {
      map: mapController,
      position: [marker.lng, marker.lat],
      icon: {
        size: [size * 2, size * 2],
        anchor: [size, size],
        html: `
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
      },
      title: marker.address,
      offset: [-(size), -(size)]
    };

    const markerInstance = new window.vw.ol3.Marker(markerOptions);
    
    // 팝업 설정
    const popupContent = `
      <div class="p-2 max-w-xs">
        <p class="font-bold mb-1">${marker.address}</p>
        <p class="text-sm text-gray-600">${marker.count}건</p>
        ${marker.addresses.length > 0 ? `
          <div class="mt-2 text-xs text-gray-500 max-h-32 overflow-y-auto">
            ${marker.addresses.map(addr => `<p>${addr}</p>`).join('')}
          </div>
        ` : ''}
      </div>
    `;

    markerInstance.on('click', () => {
      const popup = new window.vw.ol3.Popup();
      popup.setContent(popupContent);
      popup.setPosition(markerOptions.position);
      mapController.addPopup(popup);
    });
  };

  return (
    <>
      <Script 
        src={`https://map.vworld.kr/js/vworldMapInit.js.do?version=2.0&apiKey=${VWORLD_KEY}&domain=${typeof window !== 'undefined' ? window.location.hostname : ''}`}
        strategy="beforeInteractive"
      />
      <div className="relative h-full w-full">
        <div 
          id={mapContainerId} 
          style={{ height: '100%', width: '100%', minHeight: '600px' }}
          ref={ref}
        />
        <div className="absolute top-4 right-4 bg-white p-2 rounded shadow-lg z-[1000]">
          <select 
            value={mapType}
            onChange={(e) => {
              setMapType(e.target.value as 'base' | 'satellite' | 'hybrid');
              if (mapRef.current) {
                const type = e.target.value === 'satellite' ? 
                  window.vw.ol3.BasemapType.SATELLITE : 
                  e.target.value === 'hybrid' ? 
                    window.vw.ol3.BasemapType.HYBRID : 
                    window.vw.ol3.BasemapType.GRAPHIC;
                mapRef.current.setBasemapType(type);
              }
            }}
            className="px-2 py-1 border rounded"
          >
            <option value="base">기본지도</option>
            <option value="satellite">위성지도</option>
            <option value="hybrid">하이브리드</option>
          </select>
        </div>
      </div>
    </>
  );
});

MapComponent.displayName = 'MapComponent';

export default MapComponent; 