export default {
  async fetch(request, env) {
    const CORS = {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'content-type',
      'Access-Control-Allow-Methods': 'POST, OPTIONS'
    };
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: CORS });
    }
    if (request.method !== 'POST') {
      return new Response('Send POST', { status: 405, headers: CORS });
    }

    let body;
    try {
      body = await request.json();
    } catch (e) {
      return new Response(JSON.stringify({ error: 'bad json' }), { status: 400, headers: CORS });
    }

    const text = body.text;
    if (!text) {
      return new Response(JSON.stringify({ error: 'Missing text' }), { status: 400, headers: CORS });
    }

    const MAX_TOKEN = env.MAX_BOT_TOKEN;
    const MAX_USER_ID = env.MAX_USER_ID;
    if (!MAX_TOKEN || !MAX_USER_ID) {
      return new Response(JSON.stringify({ error: 'MAX_BOT_TOKEN / MAX_USER_ID not set' }), { status: 500, headers: CORS });
    }

    try {
      const resp = await fetch(
        'https://platform-api.max.ru/messages?user_id=' + encodeURIComponent(MAX_USER_ID),
        {
          method: 'POST',
          headers: {
            'Authorization': MAX_TOKEN,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ text })
        }
      );
      const result = await resp.text();
      return new Response(JSON.stringify({ status: resp.status, max: result }), {
        status: 200,
        headers: CORS
      });
    } catch (e) {
      return new Response(JSON.stringify({ error: String(e) }), { status: 500, headers: CORS });
    }
  }
};