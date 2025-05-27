import { NextRequest } from 'next/server';

// 주소 정제 함수
const cleanAddress = (address: string) => {
  // 번지수 패턴 정규화
  const numberPattern = /(\d+)(-\d+)?$/;
  const match = address.match(numberPattern);
  
  // 도로명이 숫자로만 끝나는 경우 검증
  if (!match && /\d+로$/.test(address)) {
    throw new Error('도로명 주소가 불완전합니다. 건물번호를 포함해주세요.');
  }
  
  if (!match) return address;

  // 기본 주소와 번지수 분리
  const baseAddress = address.slice(0, match.index).trim();
  const number = match[0];

  return `${baseAddress} ${number}`;
};

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const address = searchParams.get('address');

  if (!address) {
    return new Response(
      JSON.stringify({ error: 'Address parameter is missing' }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    );
  }

  const VWORLD_API_KEY = process.env.NEXT_PUBLIC_VWORLD_API_KEY;
  if (!VWORLD_API_KEY) {
    console.error('❗ NEXT_PUBLIC_VWORLD_API_KEY 환경변수가 설정되지 않았습니다.');
    return new Response(
      JSON.stringify({ error: 'API key is not set' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }

  const tryFetch = async (type: 'road' | 'parcel') => {
    const cleanedAddress = cleanAddress(address);
    const encodedAddress = encodeURIComponent(cleanedAddress);
    const url = `http://api.vworld.kr/req/address?service=address&request=getcoord&type=${type}&address=${encodedAddress}&key=${VWORLD_API_KEY}&format=json`;

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);

      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
          'Referer': 'http://localhost:3000'
        },
        signal: controller.signal,
        cache: 'force-cache'  // 캐싱 추가
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        console.error(`❗ API 오류(${type})`);
        return null;
      }

      const data = await response.json();

      if (data?.response?.status === 'ERROR') {
        console.error(`❗ API 에러(${type}):`, data.response.error);
        return null;
      }

      const point = data?.response?.result?.point;
      if (!point) return null;

      return {
        lat: parseFloat(point.y),
        lng: parseFloat(point.x),
        address: data.response.refined?.text || address
      };
    } catch (error: unknown) {
      if (error instanceof Error && error.name === 'AbortError') {
        console.error(`❗ API 요청 타임아웃(${type})`);
      }
      return null;
    }
  };

  try {
    // 도로명 주소로 시도
    let result = await tryFetch('road');
    
    // 실패하면 지번 주소로 시도
    if (!result) {
      console.log('🔄 도로명 주소 실패, 지번 주소로 재시도');
      result = await tryFetch('parcel');
    }

    if (!result) {
      return new Response(
        JSON.stringify({ 
          error: '주소를 찾을 수 없습니다.',
          message: '입력한 주소를 다시 확인해주세요.'
        }),
        { status: 404, headers: { 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify(result),
      { headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    console.error('❗ 처리 중 오류 발생:', error);
    return new Response(
      JSON.stringify({ 
        error: 'Internal Server Error', 
        message: error.message 
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}
