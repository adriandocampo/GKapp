const BRIDGE_URL = 'https://gkapp-sofascore-bridge.onrender.com';

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const path = url.pathname + url.search;

    if (request.method === 'OPTIONS') {
      return new Response(null, {
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, OPTIONS',
          'Access-Control-Allow-Headers': '*',
          'Access-Control-Max-Age': '86400',
        },
      });
    }

    if (path === '/health' || path === '/health/') {
      const bridgeUrl = env.SOFASCORE_BRIDGE_URL || BRIDGE_URL;
      try {
        const h = await fetch(`${bridgeUrl}/health`, { signal: AbortSignal.timeout(25000) });
        const body = await h.json();
        return new Response(JSON.stringify(body), {
          status: h.status,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
          },
        });
      } catch {
        return new Response(JSON.stringify({ ok: false, ready: false, error: 'bridge unreachable' }), {
          status: 503,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
          },
        });
      }
    }

    if (path.startsWith('/img/')) {
      const imgPath = path.replace('/img/', '/api/v1/');
      const target = `https://img.sofascore.com${imgPath}`;
      const imgResponse = await fetch(target, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'Accept': 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8',
          'Referer': 'https://www.sofascore.com/',
        },
      });

      const responseHeaders = new Headers(imgResponse.headers);
      responseHeaders.set('Access-Control-Allow-Origin', '*');
      responseHeaders.set('Access-Control-Allow-Methods', 'GET, OPTIONS');
      responseHeaders.set('Access-Control-Allow-Headers', '*');

      return new Response(imgResponse.body, {
        status: imgResponse.status,
        statusText: imgResponse.statusText,
        headers: responseHeaders,
      });
    }

    if (path.startsWith('/api/v1/')) {
      const bridgeUrl = env.SOFASCORE_BRIDGE_URL || BRIDGE_URL;
      const target = `${bridgeUrl}${path}`;
      const bridgeResponse = await fetch(target, {
        headers: { 'Accept': 'application/json' },
      });

      const responseHeaders = new Headers(bridgeResponse.headers);
      responseHeaders.set('Access-Control-Allow-Origin', '*');
      responseHeaders.set('Access-Control-Allow-Methods', 'GET, OPTIONS');
      responseHeaders.set('Access-Control-Allow-Headers', '*');
      responseHeaders.set('Access-Control-Expose-Headers', 'Content-Type');

      return new Response(bridgeResponse.body, {
        status: bridgeResponse.status,
        statusText: bridgeResponse.statusText,
        headers: responseHeaders,
      });
    }

    return new Response('Not found', { status: 404 });
  },
};
