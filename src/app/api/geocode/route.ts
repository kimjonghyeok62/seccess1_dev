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

  const url = `http://api.vworld.kr/req/address?service=address&request=getCoord&version=2.0&crs=epsg:4326&address=${encodedAddress}&refine=true&simple=false&format=json&type=road&key=${VWORLD_API_KEY}`;

  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'User-Agent': 'VWorld-Web-Mapper/1.0'
      },
      cache: 'no-store'
    });

    if (!response.ok) {
      throw new Error(`API 요청 실패: ${response.status}`);
    }

    const data = await response.json();
    console.log('V-World API Response:', data);

    if (data.response.status === 'ERROR') {
      console.error('V-World API Error:', data.response.error);
      throw new Error(data.response.error.text || '주소를 찾을 수 없습니다.');
    }

    if (!data.response.result || data.response.result.length === 0) {
      throw new Error('주소를 찾을 수 없습니다.');
    }

    const result = data.response.result[0];
    if (!result.point) {
      throw new Error('좌표 정보를 찾을 수 없습니다.');
    }

    return {
      lat: parseFloat(result.point.y),
      lng: parseFloat(result.point.x),
      address: cleanAddress,
      type: result.type,
      zipcode: result.zipcode,
      structure: result.structure
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

    const result = await callVWorldAPI(address);

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
