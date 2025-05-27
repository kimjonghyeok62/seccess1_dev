// /app/api/vworld/route.ts
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const address = searchParams.get("address");

  const VWORLD_API_KEY = process.env.VWORLD_API_KEY;

  if (!VWORLD_API_KEY) {
    console.error("VWORLD_API_KEY is not set");
    return new Response("API key not set", { status: 500 });
  }

  const encodedAddress = encodeURIComponent(address || "");
  const url = `https://api.vworld.kr/req/address?service=address&request=getcoord&format=json&type=road&address=${encodedAddress}&key=${VWORLD_API_KEY}`;

  try {
    const response = await fetch(url);
    const contentType = response.headers.get("content-type");

    if (!contentType?.includes("application/json")) {
      const text = await response.text();  // 오류 응답 확인
      console.error("Unexpected response:", text);
      return new Response("Invalid API response", { status: 500 });
    }

    const data = await response.json();
    return new Response(JSON.stringify(data), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Fetch error:", error);
    return new Response("API call failed", { status: 500 });
  }
}
