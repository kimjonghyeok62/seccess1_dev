import { NextRequest, NextResponse } from 'next/server';

interface GeocodingResult {
  lat: number;
  lng: number;
  dong?: string;  // 행정동
  apartment?: string;  // 아파트 이름
  buildingNumber?: string;  // 아파트 동 번호 (예: 1502동)
}

// VWorld API 호출 함수
async function callVWorldAPI(address: string): Promise<any> {
  const VWORLD_API_KEY = process.env.NEXT_PUBLIC_VWORLD_API_KEY;
  const domain = process.env.VERCEL_URL || 'localhost:3000';
  
  if (!VWORLD_API_KEY) {
    console.error('VWORLD_API_KEY is not set');
    return null;
  }

  // 주소가 이미 인코딩되어 있는지 확인하고 디코딩
  const isEncoded = address.includes('%');
  const decodedAddress = isEncoded ? decodeURIComponent(address) : address;
  
  // 한 번만 인코딩
  const encodedAddress = encodeURIComponent(decodedAddress);

  const url = `https://api.vworld.kr/req/address?service=address&request=getCoord&version=2.0&crs=epsg:4326&address=${encodedAddress}&refine=true&simple=false&format=json&type=road&key=${VWORLD_API_KEY}&domain=${domain}`;

  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Referer': `https://${domain}`
      }
    });

    if (!response.ok) {
      throw new Error(`API request failed with status ${response.status}`);
    }

    const data = await response.json();
    console.log('V-World API Response:', data);

    if (data.response.status === 'ERROR') {
      console.error('V-World API Error:', data.response.error);
      throw new Error(data.response.error.text || '주소를 찾을 수 없습니다.');
    }

    if (!data.response.result || !data.response.result.point) {
      throw new Error('주소를 찾을 수 없습니다.');
    }

    return data;
  } catch (error) {
    console.error('V-World API Error:', error);
    throw error;
  }
}

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const address = searchParams.get('address');

    if (!address) {
      return NextResponse.json(
        { error: '주소가 필요합니다.' },
        { status: 400 }
      );
    }

    // 주소 정제
    const cleanAddress = (addr: string) => {
      return addr
        .replace(/\s+/g, ' ')
        .trim()
        .replace(/^경기\s/, '경기도 ');
    };

    const cleanedAddress = cleanAddress(address);
    const data = await callVWorldAPI(cleanedAddress);

    return NextResponse.json({
      lat: parseFloat(data.response.result.point.y),
      lng: parseFloat(data.response.result.point.x),
      address: data.response.input.address,
      refined: data.response.refined?.text || null,
      type: data.response.refined?.type || null,
      structure: data.response.refined?.structure || null
    });

  } catch (error: any) {
    console.error('Error processing request:', error);
    return NextResponse.json(
      { 
        error: error.message || '주소를 찾을 수 없습니다.',
        details: error.toString()
      },
      { status: error.message.includes('주소를 찾을 수 없습니다.') ? 404 : 500 }
    );
  }
}
