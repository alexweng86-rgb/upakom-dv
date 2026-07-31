export default {
  async fetch(request, env) {
    const CORS = { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' };
    if (request.method !== 'POST') {
      return new Response('Send POST', { status: 405, headers: CORS });
    }
    let body;
    try {
      body = await request.json();
    } catch (e) {
      return new Response(JSON.stringify({ error: 'bad json' }), { status: 400, headers: CORS });
    }

    if (body.text) {
      const token = env.GH_DISPATCH_TOKEN;
      if (!token) {
        return new Response(JSON.stringify({ error: 'GH_DISPATCH_TOKEN not set' }), { status: 500, headers: CORS });
      }
      const resp = await fetch('https://api.github.com/repos/alexweng86-rgb/upakom-dv/dispatches', {
        method: 'POST',
        headers: {
          'Authorization': 'Bearer ' + token,
          'Accept': 'application/vnd.github+json',
          'Content-Type': 'application/json',
          'X-GitHub-Api-Version': '2022-11-28'
        },
        body: JSON.stringify({ event_type: 'max-notify', client_payload: { text: body.text } })
      });
      return new Response(JSON.stringify({ status: resp.status }), { status: resp.status, headers: CORS });
    }

    const { token, chat_id, text } = body;
    if (token && chat_id && text) {
      const resp = await fetch('https://api.telegram.org/bot' + token + '/sendMessage', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id, text })
      });
      const result = await resp.json();
      return new Response(JSON.stringify(result), { headers: CORS });
    }

    return new Response(JSON.stringify({ error: 'Missing params' }), { status: 400, headers: CORS });
  }
};
