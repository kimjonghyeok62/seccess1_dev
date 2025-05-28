import { NextRequest, NextResponse } from 'next/server';

const VWORLD_API_KEY = process.env.NEXT_PUBLIC_VWORLD_API_KEY;
const VWORLD_API_DOMAIN = process.env.VERCEL_URL || 'localhost:3000';

// 환경 정보 로깅
console.log('=== 환경 설정 정보 ===');
console.log('VWORLD_API_KEY:', VWORLD_API_KEY ? '설정됨' : '미설정');
console.log('VWORLD_API_DOMAIN:', VWORLD_API_DOMAIN);
console.log('NODE_ENV:', process.env.NODE_ENV);
console.log('VERCEL_ENV:', process.env.VERCEL_ENV);
console.log('=====================');

async function searchAddress(address: string): Promise<any> {
  console.log('\n=== 주소 검색 시작 ===');
  console.log('입력된 원본 주소:', address);

  if (!VWORLD_API_KEY) {
    console.error('API 키 오류: API 키가 설정되지 않음');
    throw new Error('API 키가 설정되지 않았습니다.');
  }

  // 주소 정제 과정 로깅
  console.log('\n--- 주소 정제 과정 ---');
  const cleanAddress = address
    .split(',')[0]
    .replace(/\s+/g, ' ')
    .replace(/^경기\s/, '경기도 ')
    .replace(/\s*\d+호\s*$/, '')
    .replace(/\s*(아파트|APT|상가|빌딩|오피스텔)\s*$/, '')
    .trim();

  console.log('정제된 주소:', cleanAddress);

  try {
    // API 직접 호출
    const apiUrl = new URL('https://api.vworld.kr/req/address');
    apiUrl.searchParams.append('service', 'address');
    apiUrl.searchParams.append('request', 'getcoord');
    apiUrl.searchParams.append('version', '2.0');
    apiUrl.searchParams.append('crs', 'EPSG:4326');
    apiUrl.searchParams.append('address', cleanAddress);
    apiUrl.searchParams.append('refine', 'true');
    apiUrl.searchParams.append('simple', 'false');
    apiUrl.searchParams.append('format', 'json');
    apiUrl.searchParams.append('type', 'road');
    apiUrl.searchParams.append('key', VWORLD_API_KEY);
    apiUrl.searchParams.append('domain', VWORLD_API_DOMAIN);

    console.log('API 요청 URL:', apiUrl.toString());

    const response = await fetch(apiUrl.toString(), {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'User-Agent': 'VWorld Web Mapper',
        'Cache-Control': 'no-cache',
        'Referer': `https://${VWORLD_API_DOMAIN}`
      }
    });

    const responseText = await response.text();
    console.log('원본 응답 데이터:', responseText);

    if (!response.ok) {
      console.error('API 오류 응답:', responseText);
      throw new Error(`API 요청 실패 (${response.status}): ${responseText}`);
    }

    let data;
    try {
      data = JSON.parse(responseText);
      console.log('파싱된 응답 데이터:', JSON.stringify(data, null, 2));
    } catch (e) {
      console.error('JSON 파싱 오류:', e);
      throw new Error(`잘못된 JSON 응답: ${responseText}`);
    }

    if (!data.response) {
      console.error('유효하지 않은 응답 형식:', data);
      throw new Error('유효하지 않은 API 응답 형식');
    }

    if (data.response.status === 'ERROR') {
      console.error('API 에러 응답:', data.response.error);
      throw new Error(data.response.error?.text || '주소를 찾을 수 없습니다.');
    }

    if (!data.response.result || data.response.result.length === 0) {
      console.error('검색 결과 없음:', data.response);
      throw new Error('주소를 찾을 수 없습니다.');
    }

    const result = data.response.result[0];
    const response_data = {
      lat: parseFloat(result.point.y),
      lng: parseFloat(result.point.x),
      address: cleanAddress,
      type: 'road',
      original: address,
      point: result.point,
      structure: result.structure
    };

    console.log('최종 응답 데이터:', response_data);
    return response_data;

  } catch (error: any) {
    console.error('\n=== 오류 발생 ===');
    console.error('오류 타입:', error.constructor.name);
    console.error('오류 메시지:', error.message);
    console.error('스택 트레이스:', error.stack);
    throw error;
  }
}

export async function GET(request: NextRequest) {
  console.log('\n=== API 라우트 호출 ===');
  console.log('요청 URL:', request.url);
  console.log('요청 헤더:', Object.fromEntries(request.headers.entries()));

  try {
    const searchParams = request.nextUrl.searchParams;
    const address = searchParams.get('address');

    if (!address) {
      console.error('주소 파라미터 누락');
      return NextResponse.json(
        { error: '주소가 필요합니다.' },
        { status: 400 }
      );
    }

    const result = await searchAddress(address);
    return NextResponse.json(result);

  } catch (error: any) {
    console.error('요청 처리 오류:', error);
    return NextResponse.json(
      { 
        error: error.message || '주소를 찾을 수 없습니다.',
        details: error.toString(),
        stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
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

