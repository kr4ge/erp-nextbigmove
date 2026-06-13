const RESPONSE_HEADERS = {
  'content-type': 'application/json; charset=utf-8',
  'cache-control': 'public, max-age=86400',
} as const;

export function GET() {
  return new Response('{}', {
    status: 200,
    headers: RESPONSE_HEADERS,
  });
}
