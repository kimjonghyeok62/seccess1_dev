export async function GET() {
  return new Response(
    JSON.stringify({
      error: "이 API는 더 이상 사용되지 않습니다. '/api/vworld'를 사용하세요.",
    }),
    {
      status: 410, // 410 Gone
      headers: { 'Content-Type': 'application/json' }
    }
  );
}
