import { NextRequest, NextResponse } from 'next/server';

const VWORLD_API_KEY = process.env.NEXT_PUBLIC_VWORLD_API_KEY;

async function searchAddress(address: string): Promise<any> {
  if (!VWORLD_API_KEY) {
    throw new Error('API 키가 설정되지 않았습니다.');
  }

  // 주소 정제
  const cleanAddress = address
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^경기\s/, '경기도 ');

  // API 요청 URL 구성
  const params = new URLSearchParams({
    service: 'address',
    request: 'getcoord',
    version: '2.0',
    crs: 'EPSG:4326',
    address: cleanAddress,
    refine: 'true',
    simple: 'false',
    format: 'json',
    type: 'road',
    key: VWORLD_API_KEY,
    domain: process.env.VERCEL_URL || 'localhost:3000'
  });

  try {
    // 직접 프록시 URL 사용
    const proxyUrl = `/api/vworld/req/address?${params.toString()}`;
    console.log('Requesting URL:', proxyUrl);

    const response = await fetch(proxyUrl, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('V-World API Error Response:', errorText);
      throw new Error(`API 요청 실패: ${response.status}`);
    }

    const data = await response.json();
    console.log('V-World API Response:', data);

    if (data.response.status === 'ERROR') {
      throw new Error(data.response.error.text || '주소를 찾을 수 없습니다.');
    }

    if (!data.response.result || data.response.result.length === 0) {
      throw new Error('주소를 찾을 수 없습니다.');
    }

    const result = data.response.result[0];
    return {
      lat: parseFloat(result.point.y),
      lng: parseFloat(result.point.x),
      address: cleanAddress,
      type: 'road'
    };

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

    const result = await searchAddress(address);
    return NextResponse.json(result);

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

