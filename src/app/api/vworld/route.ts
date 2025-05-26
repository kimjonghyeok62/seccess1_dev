import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const address = searchParams.get('address');
    
    if (!address) {
      return NextResponse.json({ error: 'Address is required' }, { status: 400 });
    }

    const VWORLD_API_KEY = process.env.NEXT_PUBLIC_VWORLD_API_KEY;
    
    const params = {
      service: 'address',
      request: 'getCoord',
      version: '2.0',
      crs: 'epsg:4326',
      address: address,
      refine: 'true',
      simple: 'false',
      format: 'json',
      type: 'road',
      key: VWORLD_API_KEY,
      domain: request.headers.get('host') || ''
    };

    const queryString = Object.entries(params)
      .map(([key, value]) => `${key}=${value}`)
      .join('&');

    const response = await fetch(
      `http://api.vworld.kr/req/address?${queryString}`,
      {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/x-www-form-urlencoded',
          'Referer': request.headers.get('origin') || '',
          'Origin': request.headers.get('origin') || ''
        }
      }
    );

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error('VWorld API Error:', error);
    return NextResponse.json(
      { error: 'Failed to process the request' },
      { status: 500 }
    );
  }
} 