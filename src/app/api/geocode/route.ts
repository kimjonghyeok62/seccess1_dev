import { NextRequest, NextResponse } from 'next/server';

const VWORLD_API_KEY = process.env.NEXT_PUBLIC_VWORLD_API_KEY;

function cleanAddress(rawAddress: string): string {
  // 콤마로 구분된 경우 첫 부분만 사용
  const withoutComma = rawAddress.split(',')[0];
  
  return withoutComma
    .replace(/\s+/g, ' ') // 연속된 공백을 하나로
    .replace(/^경기\s/, '경기도 ') // '경기'를 '경기도'로
    .replace(/\s*\d+호\s*$/, '') // '101호' 같은 끝부분 제거
    .replace(/\s*[A-Za-z]+\s*$/, '') // 영문 제거
    .replace(/\s*(아파트|APT|상가|빌딩|오피스텔)\s*$/, '') // 건물 유형 제거
    .trim();
}

async function searchAddress(address: string): Promise<any> {
  if (!VWORLD_API_KEY) {
    throw new Error('API 키가 설정되지 않았습니다.');
  }

  // 주소 정제
  const cleanedAddress = cleanAddress(address);
  console.log('정제된 주소:', cleanedAddress); // 디버깅용 로그

  // API 요청 URL 구성
  const params = new URLSearchParams({
    service: 'address',
    request: 'getcoord',
    version: '2.0',
    crs: 'EPSG:4326',
    address: cleanedAddress,
    refine: 'true',
    simple: 'false',
    format: 'json',
    type: 'road',
    key: VWORLD_API_KEY,
    domain: process.env.VERCEL_URL || 'localhost:3000'
  });

  try {
    const proxyUrl = `/api/address?${params.toString()}`;
    console.log('요청 URL:', proxyUrl); // 디버깅용 로그

    const response = await fetch(proxyUrl, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'User-Agent': 'VWorld Web Mapper'
      },
      next: { revalidate: 0 }
    });

    const responseText = await response.text();
    console.log('Raw API Response:', responseText); // 디버깅용 로그

    if (!response.ok) {
      throw new Error(`API 요청 실패 (${response.status}): ${responseText}`);
    }

    let data;
    try {
      data = JSON.parse(responseText);
    } catch (e) {
      throw new Error(`잘못된 JSON 응답: ${responseText}`);
    }

    if (!data.response) {
      throw new Error('유효하지 않은 API 응답 형식');
    }

    if (data.response.status === 'ERROR') {
      throw new Error(data.response.error?.text || '주소를 찾을 수 없습니다.');
    }

    if (!data.response.result || data.response.result.length === 0) {
      throw new Error('주소를 찾을 수 없습니다.');
    }

    const result = data.response.result[0];
    return {
      lat: parseFloat(result.point.y),
      lng: parseFloat(result.point.x),
      address: cleanedAddress,
      type: 'road',
      original: address // 원본 주소도 함께 반환
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
      { 
        status: error.message.includes('주소를 찾을 수 없습니다.') ? 404 : 500,
        headers: {
          'Content-Type': 'application/json',
        }
      }
    );
  }
}

