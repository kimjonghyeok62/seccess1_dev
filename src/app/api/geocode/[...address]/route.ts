import { NextRequest, NextResponse } from 'next/server';

interface GeocodingResult {
  lat: number;
  lng: number;
  dong?: string;  // 행정동
  apartment?: string;  // 아파트 이름
  buildingNumber?: string;  // 아파트 동 번호 (예: 1502동)
}

// VWorld API 호출 함수
async function callVWorldAPI(address: string, type: 'road' | 'parcel' = 'road'): Promise<any> {
  const VWORLD_API_KEY = process.env.VWORLD_API_KEY;
  if (!VWORLD_API_KEY) {
    console.error('VWORLD_API_KEY is not set');
    return null;
  }

  const VWORLD_API_DOMAIN = 'https://api.vworld.kr/req/address';

  const params = new URLSearchParams({
    service: 'address',
    request: 'getCoord',
    version: '2.0',
    crs: 'epsg:4326',
    address: address,
    refine: 'true',
    simple: 'false',
    format: 'json',
    type: type,
    key: VWORLD_API_KEY,
  });

  const url = `${VWORLD_API_DOMAIN}?${params}`;
  console.log('Calling VWorld API:', url);

  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
      },
      cache: 'no-store'
    });

    const data = await response.json();
    console.log('VWorld API Response:', JSON.stringify(data, null, 2));

    if (data.response.status === 'OK' && data.response.result) {
      return data;
    } else if (data.response.status === 'ERROR') {
      console.error('VWorld API Error:', data.response.error);
      return null;
    }
    
    return null;
  } catch (error) {
    console.error('VWorld API call failed:', error);
    return null;
  }
}

export async function GET(request: NextRequest) {
  console.log('Received request:', request.url);
  
  try {
    const address = request.nextUrl.searchParams.get('address');
    if (!address) {
      console.error('No address provided');
      return NextResponse.json(
        { error: '주소가 필요합니다.' },
        { status: 400 }
      );
    }

    console.log('Processing address:', address);

    // 주소 정제 함수
    const cleanAddress = (addr: string) => {
      // 아파트 동/호수 정보 추출
      const parts = addr.split(',').map(part => part.trim());
      let mainAddress = parts[0];
      let buildingInfo = parts[1];

      // 불필요한 공백 제거
      mainAddress = mainAddress.replace(/\s+/g, ' ').trim();
      // "경기" -> "경기도" 변환
      mainAddress = mainAddress.replace(/^경기\s/, '경기도 ');
      
      return {
        mainAddress,
        buildingInfo
      };
    };

    const { mainAddress, buildingInfo } = cleanAddress(address);
    console.log('Cleaned address:', { mainAddress, buildingInfo });

    // 도로명 주소로 먼저 시도
    let data = await callVWorldAPI(mainAddress, 'road');
    
    // 도로명 주소 실패시 지번 주소로 시도
    if (!data) {
      console.log('Road address failed, trying parcel address');
      data = await callVWorldAPI(mainAddress, 'parcel');
    }
    
    if (!data) {
      console.log('Address not found:', mainAddress);
      return NextResponse.json({ 
        error: '주소를 찾을 수 없습니다.',
        address: mainAddress
      }, { status: 404 });
    }

    const result: GeocodingResult = {
      lat: parseFloat(data.response.result.point.y),
      lng: parseFloat(data.response.result.point.x),
    };

    // 행정동 정보가 있으면 추가
    if (data.response.result.structure?.level4) {
      result.dong = data.response.result.structure.level4;
    }

    // 아파트 동/호수 정보가 있으면 추가
    if (buildingInfo) {
      const match = buildingInfo.match(/(\d+)동\s*(\d+)호/);
      if (match) {
        result.buildingNumber = match[1] + '동';
      }
    }

    console.log('Returning result:', result);
    return NextResponse.json(result);
  } catch (error) {
    console.error('Geocoding error:', error);
    return NextResponse.json({ 
      error: '주소 변환 중 오류가 발생했습니다.',
      details: error instanceof Error ? error.message : '알 수 없는 오류'
    }, { status: 500 });
  }
} 