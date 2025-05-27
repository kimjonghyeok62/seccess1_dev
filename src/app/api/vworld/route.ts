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

  // ✅ 공백 제거 후 '동' 또는 '번지' 포함 여부로 주소 타입 판단
  const normalized = address.replace(/\s+/g, '');
  const addressType = /동|번지/.test(normalized) ? 'parcel' : 'road';

  const tryFetch = async (type: 'road' | 'parcel') => {
    const encodedAddress = encodeURIComponent(address);
    const url = `https://api.vworld.kr/req/address?service=address&request=getcoord&format=json&type=${type}&address=${encodedAddress}&key=${VWORLD_API_KEY}`;

    const response = await fetch(url);
    const contentType = response.headers.get('content-type') || '';
    const text = await response.text();

    if (!response.ok || !contentType.includes('application/json')) {
      console.error(`❗ 응답 오류 (${type}):`, text);
      return null;
    }

    const data = JSON.parse(text);
    if (data?.response?.status === 'NOT_FOUND') return null;

    const point = data?.response?.result?.point;
    if (!point) return null;

    return {
      lat: parseFloat(point.y),
      lng: parseFloat(point.x)
    };
  };

  try {
    // ✅ 먼저 type=road 시도 → 실패 시 parcel로 fallback
    let result = await tryFetch(addressType === 'parcel' ? 'parcel' : 'road');
    if (!result) {
      result = await tryFetch(addressType === 'parcel' ? 'road' : 'parcel');
    }

    if (!result) {
      return new Response(
        JSON.stringify({ error: '주소를 찾을 수 없습니다.' }),
        { status: 404, headers: { 'Content-Type': 'application/json' } }
      );
    }

    return new Response(JSON.stringify(result), {
      headers: { 'Content-Type': 'application/json' },
    });

  } catch (error: any) {
    console.error('❗ 처리 중 예외 발생:', error);
    return new Response(
      JSON.stringify({ error: 'Internal Server Error', detail: error.message }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}
