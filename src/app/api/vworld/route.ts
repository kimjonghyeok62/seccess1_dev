import { NextRequest } from 'next/server';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const address = searchParams.get('address');

  if (!address) {
    return new Response(
      JSON.stringify({ error: 'Address parameter is missing' }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    );
  }

  const VWORLD_API_KEY = process.env.VWORLD_API_KEY;

  if (!VWORLD_API_KEY) {
    console.error('❗ VWORLD_API_KEY 환경변수가 설정되지 않았습니다.');
    return new Response(
      JSON.stringify({ error: 'API key is not set' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }

  console.log("입력 주소:", address);

  // 주소 타입 우선 road, 실패하면 parcel로 재시도
  const tryFetch = async (type: 'road' | 'parcel') => {
    const encodedAddress = encodeURIComponent(address);
    const url = `https://api.vworld.kr/req/address?service=address&request=getcoord&format=json&type=${type}&address=${encodedAddress}&key=${VWORLD_API_KEY}`;
    console.log(`[API 호출] type=${type}, url=${url}`);

    const response = await fetch(url);
    const contentType = response.headers.get('content-type') || '';
    const text = await response.text();

    if (!response.ok || !contentType.includes('application/json')) {
      console.error(`❗ 응답 오류(${type}):`, text);
      return null;
    }

    const data = JSON.parse(text);
    if (data?.response?.status === 'NOT_FOUND') {
      console.warn(`⚠️ ${type} 타입 주소 검색 실패`);
      return null;
    }

    return data;
  };

  try {
    // 1차: type=road
    let data = await tryFetch('road');

    // 실패 시: type=parcel로 재시도
    if (!data) {
      console.log('🔁 도로명 실패 → 지번주소 재시도');
      data = await tryFetch('parcel');
    }

    if (!data) {
      return new Response(
        JSON.stringify({ error: '주소를 찾을 수 없습니다 (road/parcel 모두 실패)' }),
        { status: 404, headers: { 'Content-Type': 'application/json' } }
      );
    }

    return new Response(JSON.stringify(data), {
      headers: { 'Content-Type': 'application/json' },
    });

  } catch (error: any) {
    console.error('❗ API 처리 중 예외 발생:', error);
    return new Response(
      JSON.stringify({ error: 'Internal Server Error', detail: error.message }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}
