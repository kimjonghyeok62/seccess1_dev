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

  // ✅ 주소 유형 자동 판단: "동"이 포함되면 지번으로 간주
  const addressType = /[가-힣]+\s*동|\d+번지/.test(address) ? 'parcel' : 'road';

  const encodedAddress = encodeURIComponent(address);
  const url = `https://api.vworld.kr/req/address?service=address&request=getcoord&format=json&type=${addressType}&address=${encodedAddress}&key=${VWORLD_API_KEY}`;

  try {
    const response = await fetch(url);
    const contentType = response.headers.get('content-type') || '';

    if (!response.ok) {
      const text = await response.text();
      console.error('❗ API 호출 실패:', text);
      return new Response(
        JSON.stringify({ error: 'Failed to fetch from VWorld API' }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }

    if (!contentType.includes('application/json')) {
      const text = await response.text();
      console.error('❗ JSON 이외 응답:', text);
      return new Response(
        JSON.stringify({ error: 'Unexpected response format from VWorld API' }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const data = await response.json();
    return new Response(JSON.stringify(data), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error: any) {
    console.error('❗ VWorld API 처리 중 예외:', error);
    return new Response(
      JSON.stringify({ error: 'Internal Server Error', detail: error.message }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}
