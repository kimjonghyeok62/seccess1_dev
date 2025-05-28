import { NextRequest, NextResponse } from 'next/server';

const VWORLD_API_KEY = process.env.NEXT_PUBLIC_VWORLD_API_KEY;
const VWORLD_API_DOMAIN = 'http://api.vworld.kr';

interface VWorldResponse {
  response: {
    service: string;
    status: string;
    input: {
      point: { x: string; y: string };
      address: string;
      type: string;
    };
    result: {
      point: { x: string; y: string };
      address: {
        road: string;
        parcel: string;
        refinement?: string;
      };
    }[];
  };
}

async function searchAddress(address: string): Promise<VWorldResponse> {
  if (!VWORLD_API_KEY) {
    throw new Error('API 키가 설정되지 않았습니다.');
  }

  const cleanAddress = address
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^경기\s/, '경기도 ');

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
    key: VWORLD_API_KEY
  });

  try {
    const response = await fetch(`${VWORLD_API_DOMAIN}/req/address?${params.toString()}`, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'User-Agent': 'VWorld-Web-Mapper/1.0'
      }
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('V-World API Error Response:', errorText);
      throw new Error(`API 요청 실패: ${response.status}`);
    }

    const data = await response.json();
    console.log('V-World API Response:', data);

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

    const data = await searchAddress(address);

    if (data.response.status === 'ERROR') {
      throw new Error(data.response.input?.address ? '주소를 찾을 수 없습니다.' : '잘못된 주소 형식입니다.');
    }

    if (!data.response.result || data.response.result.length === 0) {
      throw new Error('주소를 찾을 수 없습니다.');
    }

    const result = data.response.result[0];
    return NextResponse.json({
      lat: parseFloat(result.point.y),
      lng: parseFloat(result.point.x),
      address: result.address.road || result.address.parcel,
      refinement: result.address.refinement
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

