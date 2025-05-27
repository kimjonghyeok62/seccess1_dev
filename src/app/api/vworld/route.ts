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

    const response = await fetch(url);
    const contentType = response.headers.get('content-type') || '';
    const text = await response.text();

    if (!response.ok || !contentType.includes('application/json')) {
      console.error(`❗ 응답 오류(${type}):`, text);
      return null;
        { status: 404, headers: { 'Content-Type': 'application/json' } }
      );
    }

      headers: { 'Content-Type': 'application/json' },
    });

  } catch (error: any) {
    return new Response(
      JSON.stringify({ error: 'Internal Server Error', detail: error.message }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}
