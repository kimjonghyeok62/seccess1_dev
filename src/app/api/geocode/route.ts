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
  const VWORLD_API_KEY = process.env.VWORLD_API_KEY;
  console.log('=== Environment Details ===');
  console.log('NODE_ENV:', process.env.NODE_ENV);
  console.log('VERCEL_URL:', process.env.VERCEL_URL);
  console.log('VERCEL_ENV:', process.env.VERCEL_ENV);
  console.log('Using API Key:', VWORLD_API_KEY ? 'Set (length: ' + VWORLD_API_KEY.length + ')' : 'Not Set');
  
  if (!VWORLD_API_KEY) {
    console.error('VWORLD_API_KEY is not set');
    return null;
  }

  const VWORLD_API_DOMAIN = 'https://api.vworld.kr/req/address';
  
  // 주소 디코딩 후 다시 인코딩
  const decodedAddress = decodeURIComponent(address);
  const encodedAddress = encodeURIComponent(decodedAddress);
  console.log('Original address:', address);
  console.log('Decoded address:', decodedAddress);
  console.log('Encoded address:', encodedAddress);

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
    key: VWORLD_API_KEY
  };

  // URL 파라미터를 수동으로 구성
  const queryString = Object.entries(params)
    .map(([key, value]) => `${key}=${value}`)
    .join('&');

  const url = `${VWORLD_API_DOMAIN}?${queryString}`;

  const requestHeaders = {
    'Accept': 'application/json',
    'Content-Type': 'application/x-www-form-urlencoded',
    'User-Agent': 'VWorld-Web-Mapper/1.0'
  };

  try {
    console.log('=== Making API Request ===');
    console.log('URL:', url);
    console.log('Headers:', requestHeaders);
    
    const response = await fetch(url, {
      method: 'GET',
      headers: requestHeaders,
      cache: 'no-store'
    });

    const responseText = await response.text();
    console.log('=== VWorld API Response ===');
    console.log('Status:', response.status);
    console.log('Headers:', Object.fromEntries(response.headers.entries()));
    console.log('Body:', responseText);

    if (!response.ok) {
      throw new Error(`API request failed with status ${response.status}: ${responseText}`);
    }

    let data;
    try {
      data = JSON.parse(responseText);
      console.log('Parsed response data:', JSON.stringify(data, null, 2));
    } catch (error: any) {
      console.error('JSON Parse Error:', error.message);
      throw new Error(`Failed to parse API response: ${error.message}`);
    }

    if (!data.response) {
      console.error('Invalid API response format - missing response object');
      throw new Error('Invalid API response format');
    }

    if (data.response.status === 'ERROR') {
      console.error('API Error Response:', data.response);
      throw new Error(`API Error: ${data.response.error?.message || '알 수 없는 오류'}`);
    }

    if (!data.response.result || !data.response.result.point) {
      console.error('API Response missing coordinates:', data.response);
      throw new Error('좌표 정보를 찾을 수 없습니다');
    }

    return data;
  } catch (error: any) {
    console.error('VWorld API Error:', {
      message: error.message,
      url: url,
      stack: error.stack
    });
    return null;
  }
}

export async function GET(request: NextRequest) {
  console.log('=== Request Details ===');
  console.log('Headers:', Object.fromEntries(request.headers.entries()));
  console.log('URL:', request.url);
  console.log('Environment Variables:', {
    VWORLD_API_KEY: process.env.VWORLD_API_KEY ? 'Set' : 'Not Set',
    NEXT_PUBLIC_VWORLD_API_KEY: process.env.NEXT_PUBLIC_VWORLD_API_KEY ? 'Set' : 'Not Set',
    VERCEL_URL: process.env.VERCEL_URL,
    NODE_ENV: process.env.NODE_ENV
  });

  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization'
  };

  try {
    const address = request.nextUrl.searchParams.get('address');
    if (!address) {
      console.error('No address provided');
      return NextResponse.json(
        { error: '주소가 필요합니다.' },
        { 
          status: 400,
          headers: corsHeaders
        }
      );
    }

    console.log('Processing address:', address);

    // 주소 정제 함수
    const cleanAddress = (addr: string) => {
      try {
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
        
        // 주소 완전성 검사 - 도로명 또는 지번 주소 체크
        const isRoadAddress = /로\s*\d+/.test(mainAddress) || /길\s*\d+/.test(mainAddress);
        const isParcelAddress = /동\s*\d+[-]?\d*/.test(mainAddress);
        const isComplete = isRoadAddress || isParcelAddress;

        return {
          mainAddress,
          buildingInfo,
          isComplete
        };
      } catch (error) {
        console.error('Address cleaning error:', error);
        return {
          mainAddress: addr,
          buildingInfo: undefined,
          isComplete: false
        };
      }
    };

    const { mainAddress, buildingInfo, isComplete } = cleanAddress(address);
    console.log('Cleaned address:', { mainAddress, buildingInfo, isComplete });

    if (!isComplete) {
      return NextResponse.json({ 
        error: '주소가 불완전합니다.',
        address: mainAddress,
        message: '정확한 지번이 없습니다.',
      }, { 
        status: 400,
        headers: corsHeaders
      });
    }

    // 도로명 주소로 먼저 시도
    let data = await callVWorldAPI(mainAddress, 'road', request.headers);
    
    // 도로명 주소 실패시 지번 주소로 시도
    if (!data) {
      console.log('Road address failed, trying parcel address');
      data = await callVWorldAPI(mainAddress, 'parcel', request.headers);
    }
    
    if (!data || !data.response || !data.response.result) {
      console.log('Address not found:', mainAddress);
      return NextResponse.json({ 
        error: '주소를 찾을 수 없습니다.',
        address: mainAddress,
        message: '주소를 좌표로 변환하는데 실패했습니다. 주소 형식을 확인해주세요.'
      }, { 
        status: 404,
        headers: corsHeaders
      });
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
    if (buildingInfo) {
      const match = buildingInfo.match(/(\d+)동\s*(\d+)호/);
      if (match) {
        result.buildingNumber = match[1] + '동';
      }
    }

    console.log('Returning result:', result);
    return NextResponse.json(result, {
      headers: corsHeaders
    });
  } catch (error: any) {
    console.error('Geocoding error:', error);
    return NextResponse.json({ 
      error: '서버 오류가 발생했습니다.',
      message: error.message || '알 수 없는 오류가 발생했습니다.'
    }, { 
      status: 500,
      headers: corsHeaders
    });
  }
} 