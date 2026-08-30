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

    const MAX_TOKEN = env.MAX_BOT_TOKEN;
    const MAX_USER_ID = env.MAX_USER_ID;
    if (!MAX_TOKEN || !MAX_USER_ID) {
      return new Response(JSON.stringify({ error: 'MAX_BOT_TOKEN / MAX_USER_ID not set' }), { status: 500, headers: CORS });
    }

    const AUTH = {
      'Authorization': MAX_TOKEN,
      'Content-Type': 'application/json'
    };
    const sendTo = (userId, text) =>
      fetch('https://platform-api.max.ru/messages?user_id=' + encodeURIComponent(userId), {
        method: 'POST', headers: AUTH, body: JSON.stringify({ text })
      }).then(r => r.text());

    let body;
    try {
      body = await request.json();
    } catch (e) {
      return new Response(JSON.stringify({ error: 'bad json' }), { status: 400, headers: CORS });
    }

    // Webhook от MAX: клиент написал боту -> пересылаем владельцу
    if (body.update_type) {
      const secret = request.headers.get('X-Max-Bot-Api-Secret');
      if (!env.MAX_WEBHOOK_SECRET || secret !== env.MAX_WEBHOOK_SECRET) {
        return new Response('FORBIDDEN', { status: 403, headers: CORS });
      }
      if (body.update_type === 'message_created' && body.message) {
        const msg = body.message;
        const sender = msg.sender || {};
        const text = (msg.body && msg.body.text) || '';
        const senderId = sender.user_id;
        if (senderId && text && String(senderId) !== String(MAX_USER_ID)) {
          const name = [sender.first_name, sender.last_name].filter(Boolean).join(' ') || ('ID ' + senderId);
          const fwd = '✉ Сообщение в MAX от ' + name + '\n\n' + text;
          try { await sendTo(MAX_USER_ID, fwd); } catch (e) {}
        }
      }
      return new Response('OK', { status: 200, headers: CORS });
    }

    // Запрос с сайта (форма): текст -> владельцу
    const text = body.text;
    if (!text) {
      return new Response(JSON.stringify({ error: 'Missing text' }), { status: 400, headers: CORS });
    }
    try {
      const result = await sendTo(MAX_USER_ID, text);
      return new Response(JSON.stringify({ status: 200, max: result }), { status: 200, headers: CORS });
    } catch (e) {
      return new Response(JSON.stringify({ error: String(e) }), { status: 500, headers: CORS });
    }
  }
};