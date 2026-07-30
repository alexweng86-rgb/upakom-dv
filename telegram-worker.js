export default {
  async fetch(request) {
    if (request.method === 'POST') {
      try {
        const body = await request.json();
        const { token, chat_id, text } = body;
        if (!token || !chat_id || !text) {
          return new Response('Missing params', { status: 400 });
        }
        const resp = await fetch('https://api.telegram.org/bot' + token + '/sendMessage', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ chat_id, text })
        });
        const result = await resp.json();
        return new Response(JSON.stringify(result), {
          headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
        });
      } catch (e) {
        return new Response(JSON.stringify({ error: e.message }), {
          status: 500,
          headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
        });
      }
    }
    return new Response('Send POST', { status: 405 });
  }
};
