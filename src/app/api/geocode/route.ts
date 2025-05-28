import { NextRequest, NextResponse } from 'next/server';

const VWORLD_API_KEY = process.env.NEXT_PUBLIC_VWORLD_API_KEY;
const VWORLD_API_DOMAIN = process.env.VERCEL_URL || 'localhost:3000';

async function searchAddress(address: string): Promise<any> {
  if (!VWORLD_API_KEY) {
    throw new Error('API 키가 설정되지 않았습니다.');
  }

  // 주소 정제
  const cleanAddress = address
    .split(',')[0]
    .replace(/\s+/g, ' ')
    .replace(/^경기\s/, '경기도 ')
    .replace(/\s*\d+호\s*$/, '')
    .replace(/\s*(아파트|APT|상가|빌딩|오피스텔)\s*$/, '')
    .trim();

  console.log('정제된 주소:', cleanAddress);

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
    domain: VWORLD_API_DOMAIN
  });

  try {
    const apiUrl = `https://api.vworld.kr/req/address?${params.toString()}`;
    console.log('API 요청 URL:', apiUrl);

    const response = await fetch(apiUrl, {
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
    console.log('Raw API Response:', responseText);

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
      address: cleanAddress,
      type: 'road',
      original: address
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

