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
  
  if (!VWORLD_API_KEY) {
    console.error('VWORLD_API_KEY is not set');
    throw new Error('API 키가 설정되지 않았습니다.');
  }

  // 주소가 이미 인코딩되어 있는지 확인하고 디코딩
  const decodedAddress = decodeURIComponent(address);
  
  // 주소 정제
  const cleanAddress = decodedAddress
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^경기\s/, '경기도 ');

  // URL 인코딩
  const encodedAddress = encodeURIComponent(cleanAddress);

  // API 엔드포인트 URL 구성
  const baseUrl = 'http://api.vworld.kr/req/search';
  const params = new URLSearchParams({
    service: 'search',
    request: 'search',
    version: '2.0',
    crs: 'EPSG:4326',
    size: '1000',
    page: '1',
    query: cleanAddress,
    type: 'address',
    category: 'road',
    format: 'json',
    errorformat: 'json',
    key: VWORLD_API_KEY
  });

  try {
    const response = await fetch(`${baseUrl}?${params.toString()}`, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('API Response Error:', errorText);
      throw new Error(`API 요청 실패: ${response.status}`);
    }

    const data = await response.json();
    console.log('V-World API Response:', data);

    if (data.response.status === 'ERROR') {
      console.error('V-World API Error:', data.response.error);
      throw new Error(data.response.error.text || '주소를 찾을 수 없습니다.');
    }

    if (!data.response.result || !data.response.result.items || data.response.result.items.length === 0) {
      throw new Error('주소를 찾을 수 없습니다.');
    }

    const item = data.response.result.items[0];
    if (!item.point) {
      throw new Error('좌표 정보를 찾을 수 없습니다.');
    }

    return {
      lat: parseFloat(item.point.y),
      lng: parseFloat(item.point.x),
      address: item.address.road || item.address.parcel,
      type: 'road',
      title: item.title,
      category: item.category
    };

  } catch (error) {
    console.error('V-World API Error:', error);
    throw error;
  }
}

export async function GET(request: NextRequest) {
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization'
  };

  try {
    const searchParams = request.nextUrl.searchParams;
    const address = searchParams.get('address');

    if (!address) {
      return NextResponse.json(
        { error: '주소가 필요합니다.' },
        { 
          status: 400,
          headers: corsHeaders
        }
      );
    }

    const result = await callVWorldAPI(address);

    return NextResponse.json(result, {
      headers: corsHeaders
    });

  } catch (error: any) {
    console.error('Error processing request:', error);
    return NextResponse.json(
      { 
        error: error.message || '주소를 찾을 수 없습니다.',
        details: error.toString()
      },
      { 
        status: error.message.includes('주소를 찾을 수 없습니다.') ? 404 : 500,
        headers: corsHeaders
      }
    );
  }
}
