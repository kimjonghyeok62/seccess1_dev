import { NextRequest, NextResponse } from 'next/server';

interface GeocodingResult {
  lat: number;
  lng: number;
  dong?: string;  // 행정동
  apartment?: string;  // 아파트 이름
  buildingNumber?: string;  // 아파트 동 번호 (예: 1502동)
}

// VWorld API 호출 함수
async function callVWorldAPI(address: string, type: 'road' | 'parcel' = 'road', headers?: Headers): Promise<any> {
  const VWORLD_API_KEY = "21E28EA8-73D0-340C-9EA2-B0CDCA0809B5";
  console.log('=== Environment Details ===');
  console.log('NODE_ENV:', process.env.NODE_ENV);
  console.log('VERCEL_URL:', process.env.VERCEL_URL);
  console.log('VERCEL_ENV:', process.env.VERCEL_ENV);
  console.log('Using API Key:', VWORLD_API_KEY ? 'Set (length: ' + VWORLD_API_KEY.length + ')' : 'Not Set');
  
  if (!VWORLD_API_KEY) {
    console.error('VWORLD_API_KEY is not set');
    return null;
  }

  // ... existing code ...
}

export async function GET() {
  return new Response(
    JSON.stringify({
      error: "이 API는 더 이상 사용되지 않습니다. '/api/vworld'를 사용하세요.",
    }),
    {
      status: 410, // 410 Gone
      headers: { 'Content-Type': 'application/json' }
    }
  );
}
