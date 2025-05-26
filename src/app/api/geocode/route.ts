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
  
  // 주소를 올바르게 인코딩
  const encodedAddress = encodeURIComponent(address);
  console.log('Original address:', address);
  console.log('Encoded address:', encodedAddress);

  // 현재 도메인 가져오기
  let currentDomain = '';
  const host = headers?.get('host');
  
  if (process.env.VERCEL_URL) {
    currentDomain = `https://${process.env.VERCEL_URL}`;
  } else if (host) {
    const protocol = host.includes('localhost') ? 'http' : 'https';
    currentDomain = `${protocol}://${host}`;
  } else {
    // 현재 배포된 도메인 사용
    currentDomain = 'https://vworld-web-mapper-cg1brcmcr-kimjonghyeoks-projects-54e2f165.vercel.app';
  }

  console.log('=== Domain Details ===');
  console.log('Current Domain:', currentDomain);

  const params = new URLSearchParams({
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
    domain: currentDomain.replace('https://', '').replace('http://', '')
  });

  const url = `${VWORLD_API_DOMAIN}?${params.toString()}`;

  const requestHeaders = {
    'Accept': 'application/json',
    'Content-Type': 'application/x-www-form-urlencoded',
    'Referer': currentDomain,
    'User-Agent': 'VWorld-Web-Mapper/1.0',
    'Origin': currentDomain
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
      domain: currentDomain,
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