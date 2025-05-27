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
  
  if (!VWORLD_API_KEY) {
    console.error('VWORLD_API_KEY is not set');
    return null;
  }

  const VWORLD_API_DOMAIN = 'https://api.vworld.kr/req/address';
  
  // 주소가 이미 인코딩되어 있는지 확인하고 디코딩
  const isEncoded = address.includes('%');
  const decodedAddress = isEncoded ? decodeURIComponent(address) : address;
  
  // 한 번만 인코딩
  const encodedAddress = encodeURIComponent(decodedAddress);

  const params = {
    service: 'address',
    request: 'getCoord',
    version: '2.0',
    crs: 'epsg:4326',
    address: encodedAddress,
    refine: 'true',
    simple: 'false',
    format: 'json',
    type: type,
    key: VWORLD_API_KEY,
    domain: headers?.get('host') || 'localhost:3000'
  };

  // URL 파라미터를 수동으로 구성
  const queryString = Object.entries(params)
    .map(([key, value]) => `${key}=${value}`)
    .join('&');

  const url = `${VWORLD_API_DOMAIN}?${queryString}`;

  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/x-www-form-urlencoded',
        'User-Agent': 'VWorld-Web-Mapper/1.0',
        'Referer': headers?.get('origin') || 'http://localhost:3000',
        'Origin': headers?.get('origin') || 'http://localhost:3000'
      },
      cache: 'no-store'
    });

    if (!response.ok) {
      throw new Error(`API request failed with status ${response.status}`);
    }

    const data = await response.json();

    if (!data.response) {
      throw new Error('Invalid API response format');
    }

    if (data.response.status === 'ERROR') {
      throw new Error(`API Error: ${data.response.error?.message || '알 수 없는 오류'}`);
    }

    if (!data.response.result || !data.response.result.point) {
      throw new Error('좌표 정보를 찾을 수 없습니다');
    }

    return data;
  } catch (error: any) {
    console.error('VWorld API Error:', error);
    return null;
  }
}

export async function GET(request: NextRequest) {
  try {
    const address = request.nextUrl.searchParams.get('address');
    if (!address) {
      return NextResponse.json(
        { error: '주소가 필요합니다.' },
        { status: 400 }
      );
    }

    // 주소 정제 함수
    const cleanAddress = (addr: string) => {
      // URL 디코딩
      const decodedAddr = decodeURIComponent(addr);
      
      // 아파트 동/호수 정보 추출
      const parts = decodedAddr.split(',').map(part => part.trim());
      let mainAddress = parts[0];
      let buildingInfo = parts[1];

      // 불필요한 공백 제거
      mainAddress = mainAddress.replace(/\s+/g, ' ').trim();
      
      // "경기" -> "경기도" 변환
      mainAddress = mainAddress.replace(/^경기\s/, '경기도 ');
      
      // 주소 완전성 검사
      const hasProvince = /(경기도|서울시|강원도|충청도|전라도|경상도|제주도)/.test(mainAddress);
      const hasCity = /(시|군|구)/.test(mainAddress);
      const hasDistrict = /(동|읍|면)/.test(mainAddress);
      
      // 도로명 주소 체크
      const isRoadAddress = /(로|길)\s*\d+/.test(mainAddress);
      
      // 지번 주소 체크 (동 다음에 숫자가 오는 경우)
      const isParcelAddress = /동\s+\d+[-]?\d*/.test(mainAddress);
      
      // 상세주소 정보 추출 (아파트 동, 호수 등)
      const buildingMatch = buildingInfo?.match(/(\d+)동\s*(\d+)호/);
      const buildingNumber = buildingMatch ? buildingMatch[1] : undefined;
      const unitNumber = buildingMatch ? buildingMatch[2] : undefined;

      const isComplete = hasProvince && hasCity && (isRoadAddress || isParcelAddress);

      return {
        mainAddress,
        buildingInfo,
        buildingNumber,
        unitNumber,
        isComplete,
        isRoadAddress,
        isParcelAddress
      };
    };

    const { mainAddress, buildingInfo, buildingNumber, isComplete, isRoadAddress } = cleanAddress(address);

    if (!isComplete) {
      return NextResponse.json({ 
        error: '주소가 불완전합니다.',
        address: mainAddress,
        message: '정확한 주소 형식이 아닙니다. 도로명 주소 또는 지번 주소를 입력해주세요.',
      }, { status: 400 });
    }

    // 도로명 주소로 먼저 시도
    let data = await callVWorldAPI(mainAddress, isRoadAddress ? 'road' : 'parcel', request.headers);
    
    // 도로명 주소로 실패하면 지번 주소로 시도
    if (!data && isRoadAddress) {
      data = await callVWorldAPI(mainAddress, 'parcel', request.headers);
    }

    if (!data || !data.response || data.response.status === 'NOT_FOUND') {
      return NextResponse.json({ 
        error: '주소를 찾을 수 없습니다.',
        address: mainAddress,
      }, { status: 404 });
    }

    const result: GeocodingResult = {
      lat: parseFloat(data.response.result.point.y),
      lng: parseFloat(data.response.result.point.x),
    };

    // 행정동 정보가 있으면 추가
    if (data.response.result.structure?.level4A) {
      result.dong = data.response.result.structure.level4A;
    }

    // 아파트 동/호수 정보가 있으면 추가
    if (buildingNumber) {
      result.buildingNumber = buildingNumber + '동';
    }

    return NextResponse.json(result);
  } catch (error: any) {
    console.error('Geocoding error:', error);
    return NextResponse.json({ 
      error: '서버 오류가 발생했습니다.',
      message: error.message || '알 수 없는 오류가 발생했습니다.'
    }, { status: 500 });
  }
}
