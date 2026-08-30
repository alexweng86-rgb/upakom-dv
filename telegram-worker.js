export default {
  async fetch(request, env) {
    const CORS = {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'content-type',
      'Access-Control-Allow-Methods': 'POST, OPTIONS'
    };
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });
    if (request.method !== 'POST') return new Response('Send POST', { status: 405, headers: CORS });

    const MAX_TOKEN = env.MAX_BOT_TOKEN;
    const OWNER = env.MAX_USER_ID;
    const SECRET = env.MAX_WEBHOOK_SECRET;
    if (!MAX_TOKEN || !OWNER) {
      return new Response(JSON.stringify({ error: 'env missing' }), { status: 500, headers: CORS });
    }

    const API = 'https://platform-api.max.ru';
    const AUTH = { 'Authorization': MAX_TOKEN, 'Content-Type': 'application/json' };
    const sendTo = (userId, payload) =>
      fetch(API + '/messages?user_id=' + encodeURIComponent(userId), {
        method: 'POST', headers: AUTH, body: JSON.stringify(payload)
      }).then(function (r) { return r.text(); });

    let body;
    try { body = await request.json(); } catch (e) {
      return new Response(JSON.stringify({ error: 'bad json' }), { status: 400, headers: CORS });
    }

    // От формы на сайте (site -> owner), старый формат
    if (body.text != null && !body.update_type) {
      try {
        const result = await sendTo(OWNER, { text: body.text });
        return new Response(JSON.stringify({ status: 200, max: result }), { status: 200, headers: CORS });
      } catch (e) {
        return new Response(JSON.stringify({ error: String(e) }), { status: 500, headers: CORS });
      }
    }

    // Webhook от MAX
    if (!body.update_type) return new Response('OK', { status: 200, headers: CORS });
    if (SECRET && request.headers.get('X-Max-Bot-Api-Secret') !== SECRET) {
      return new Response('FORBIDDEN', { status: 403, headers: CORS });
    }

    try {
      await handleBotUpdate(body, { API, AUTH, sendTo, OWNER });
    } catch (e) {
      try { await sendTo(OWNER, { text: '[bot error] ' + String(e).slice(0, 300) }); } catch (_) {}
    }
    return new Response('OK', { status: 200, headers: CORS });
  }
};

const SECTIONS = [
  ['Посуда одноразовая', '🍽️ Тарелки, стаканы, приборы для фуд-кортов и доставки, бумажные стаканы.'],
  ['Пакеты и мешки', '🛍️ Майка, с ручками, фасовочные, зиплок, мешки, пакеты с печатью.'],
  ['Пищевая упаковка', '📦 Контейнеры, лотки, подложки, тортницы, плёнка, алюминиевые формы.'],
  ['Подарочная упаковка', '🎁 Пакеты подарочные, ленты, бумага, шары, конверты для цветов.'],
  ['Сервировка стола', '🍽️ Салфетки, скатерти, свечи.'],
  ['Бытовая химия', '🧪 Средства для уборки, порошки, чистящие средства.'],
  ['Расходные материалы', '📋 Чековая лента, этикет-лента, ценники, канцтовары.'],
  ['Товары для дома', '🏠 Хозтовары, туалетная бумага, фольга, инвентарь, плёнка.'],
  ['Для отдыха и пикника', '🏕️ Горелки, газ, сушки, одноразовая посуда для выездов.']
];

const KEYBOARD = {
  type: 'inline_keyboard',
  payload: {
    buttons: [
      [
        { type: 'callback', text: '🛍 Каталог', payload: 'menu:catalog' },
        { type: 'callback', text: '🚚 Доставка', payload: 'menu:delivery' },
        { type: 'callback', text: '💰 Оплата', payload: 'menu:payment' }
      ],
      [
        { type: 'callback', text: '📍 Контакты', payload: 'menu:contacts' },
        { type: 'callback', text: '📦 Оптом', payload: 'menu:wholesale' },
        { type: 'callback', text: '🌐 Сайт', payload: 'menu:site' }
      ],
      [
        { type: 'request_contact', text: '📞 Перезвоните мне' }
      ]
    ]
  }
};

const CATALOG_KB = {
  type: 'inline_keyboard',
  payload: {
    buttons: buildCatalogRows()
  }
};

function buildCatalogRows() {
  const rows = [];
  const row = [];
  SECTIONS.forEach(function (s, i) {
    row.push({ type: 'callback', text: String(i + 1) + '. ' + s[0], payload: 'cat:' + i });
    if (row.length === 3) { rows.push(row.slice()); row.length = 0; }
  });
  if (row.length) rows.push(row);
  rows.push([
    { type: 'request_contact', text: '📞 Подобрать у менеджера' }
  ]);
  return rows;
}

const GREETING =
  '👋 Здравствуйте! Это «ДВ Упаком» — упаковка и одноразовая посуда оптом и в розницу.\n' +
  'Более 2000 товаров, 12 филиалов в Хабаровском крае.\n\n' +
  'Выберите раздел ниже или просто напишите свой вопрос:';

const ANSWERS = {
  welcome:
    '👋 Здравствуйте! Чем можем помочь?\n\n' +
    'Можете написать вопрос в свободной форме (например: «сколько стоят перчатки»), ' +
    'или выберите раздел в меню ниже.',

  delivery:
    '🚚 Доставка:\n' +
    '• по Комсомольску-на-Амуре — 1 день, бесплатно от 2500 ₽\n' +
    '• пригород — 1–2 дня, бесплатно от 5000 ₽\n' +
    '• точные сроки согласуются с менеджером\n' +
    '• собственная доставка по Хабаровскому краю\n\n' +
    'Самовывоз: г. Комсомольск-на-Амуре, ул. Гаражная, 2а или в любом из 12 филиалов.',

  payment:
    '💳 Оплата:\n' +
    '• наличными и по безналу\n' +
    '• работаем с НДС и без НДС\n' +
    '• по счёту для юрлиц и ИП\n' +
    '• отсрочка платежа для постоянных клиентов',

  contacts:
    '📍 Контакты:\n' +
    '• Тел: +7 (4217) 54-49-45\n' +
    '• Моб: 8 (963) 828-81-14\n' +
    '• Email: upakom@yandex.ru\n' +
    '• Адрес: г. Комсомольск-на-Амуре, ул. Гаражная, 2а\n' +
    '• Режим: Пн–Пт 9:00–18:00, Сб 9:00–15:00\n' +
    '• 12 филиалов розничной сети в Хабаровском крае',

  wholesale:
    '📦 Оптовым клиентам (юрлица и ИП):\n' +
    '• работаем с НДС и без НДС, все закрывающие документы\n' +
    '• индивидуальные условия и отсрочка платежа\n' +
    '• персональный торговый представитель\n' +
    '• предоставляем образцы продукции\n\n' +
    'Оставьте контакт — менеджер подготовит предложение и прайс.',

  price:
    '💰 Прайс-лист высылаем по запросу — ассортимент большой, цены зависят от объёма.\n' +
    'Нажмите «Перезвоните мне» ниже, и мы отправим актуальный прайс.',

  samples:
    '✅ Да, предоставляем образцы для ознакомления.\n' +
    'Оставьте контакт — менеджер согласует ассортимент и условия передачи.',

  hours:
    '🕘 Режим работы:\n' +
    'Пн–Пт 9:00–18:00\n' +
    'Сб 9:00–15:00\n' +
    'Вс — выходной',

  unknown:
    '🤔 Я пока не научился отвечать на этот вопрос, но обязательно помогу!\n' +
    'Оставьте контакт — менеджер «ДВ Упаком» свяжется с вами и ответит.',
  thanks:
    '🙌 Спасибо! Менеджер свяжется с вами в ближайшее время.\n' +
    'Если не хотите ждать — звоните: +7 (4217) 54-49-45 или 8 (963) 828-81-14.'
};

const RULES = [
  { re: /здравств|привет|прив[её]т|добрый|доброе|добрый день|hi|hello|ку[-\s]*ку/, a: 'welcome' },
  { re: /(?:сколько|цена|цены|стоит|стоят|почем|почём|стоимость|прайс|прейскурант)/, a: 'price' },
  { re: /доставк|привезт|отправк|подвезт/, a: 'delivery' },
  { re: /оплат|нал|безнал|счет|счет|расчет|как платить/, a: 'payment' },
  { re: /ндс|налог/, a: 'payment' },
  { re: /оптом|опт /, a: 'wholesale' },
  { re: /юр\s*лиц|ооо|ип|организац|документ|счет-?фактур/, a: 'wholesale' },
  { re: /образец|образцы|пробник/, a: 'samples' },
  { re: /адрес|скулд|склад|самовывоз|филиал|где вы|находитесь|местополож/, a: 'contacts' },
  { re: /телефон|позвони|перезвон|связат|контакт|номер/, a: 'contacts' },
  { re: /режим|график|часы|работаете|во сколько|до скольких|открыт/, a: 'hours' },
  { re: /каталог|ассортимент|товар|есть ли|что есть|ищу|нужен|нужна|нужно|купить|заказать|подскажи/, a: 'catalog' }
];

async function handleBotUpdate(upd, ctx) {
  const t = upd.update_type;

  if (t === 'bot_started' || (t === 'message_created' && (upd.message.body.text || '').replace(/^[\/\s]+/, '').toLowerCase().slice(0, 5) === 'start')) {
    const userId = t === 'bot_started' ? (upd.user && upd.user.user_id) : (upd.message.sender && upd.message.sender.user_id);
    if (userId) {
      await ctx.sendTo(userId, { text: GREETING, attachments: [KEYBOARD] });
    }
    return;
  }

  if (t === 'message_callback') {
    const cb = upd.callback || {};
    const userId = cb.user && cb.user.user_id;
    const payload = cb.payload || '';
    if (!userId) return;
    await handleMenuPayload(payload, userId, ctx);
    return;
  }

  if (t !== 'message_created') return;

  const msg = upd.message || {};
  const sender = msg.sender || {};
  const text = (msg.body && msg.body.text || '').trim();
  const senderId = sender.user_id;
  if (!senderId) return;
  const isOwner = String(senderId) === String(ctx.OWNER);

  // Клиент поделился контактом
  const atts = (msg.body && msg.body.attachments) || [];
  const contact = atts.filter(function (a) { return a.type === 'contact'; })[0];
  if (contact) {
    const p = contact.payload || {};
    const vcf = p.vcf_info || '';
    const phone = (vcf.match(/TEL[^:]*:(.+)/i) || [])[1] || '';
    const name = (vcf.match(/(?:FN|N)[^:]*:(.+)/i) || [])[1] || '';
    const from = [sender.first_name, sender.last_name].filter(Boolean).join(' ').trim();
    const info = '📇 Контакт из MAX от ' + (from || name || ('ID ' + senderId));
    const phoneLine = phone ? '\n📞 Телефон: ' + phone : '';
    const nameLine = name && name.trim() ? '\n👤 Имя: ' + name.trim() : '';
    const verified = p.hash ? '\n✅ Номер подтверждён аккаунтом MAX' : '\n⚠️ Номер без подтверждения (прислан вручную)';
    if (!isOwner) {
      await ctx.sendTo(ctx.OWNER, { text: info + phoneLine + nameLine + verified + '\n—\nПрофиль: https://max.ru/' + senderId });
    }
    await ctx.sendTo(senderId, { text: ANSWERS.thanks });
    return;
  }

  if (!text) return;

  const lower = text.toLowerCase();
  for (const r of RULES) {
    if (r.re.test(lower)) {
      if (r.a === 'catalog') {
        const cats = SECTIONS.map(function (s, i) { return (i + 1) + '. ' + s[0]; }).join('\n');
        await ctx.sendTo(senderId, { text: '🛍 Разделы каталога:\n' + cats + '\n\nВыберите интересующий раздел — расскажу подробнее. Полный каталог на сайте dv-upakom.ru.', attachments: [CATALOG_KB] });
      } else {
        await ctx.sendTo(senderId, { text: ANSWERS[r.a], attachments: [KEYBOARD] });
      }
      return;
    }
  }

  // Нераспознан: клиенту - запрос контакта, владельцу - вопрос
  const from = [sender.first_name, sender.last_name].filter(Boolean).join(' ').trim() || ('ID ' + senderId);
  await ctx.sendTo(senderId, { text: ANSWERS.unknown, attachments: [KEYBOARD] });
  if (!isOwner) {
    await ctx.sendTo(ctx.OWNER, {
      text: '✉ Вопрос в MAX от ' + from + ' (id ' + senderId + '):\n\n' + text
    });
  }
}

async function handleMenuPayload(payload, userId, ctx) {
  if (payload === 'menu:catalog') {
    const cats = SECTIONS.map(function (s, i) { return (i + 1) + '. ' + s[0]; }).join('\n');
    await ctx.sendTo(userId, { text: '🛍 Разделы каталога:\n' + cats + '\n\nВыберите интересующий раздел — расскажу подробнее. Полный каталог на сайте dv-upakom.ru.', attachments: [CATALOG_KB] });
    return;
  }
  if (payload === 'menu:delivery') { await ctx.sendTo(userId, { text: ANSWERS.delivery, attachments: [KEYBOARD] }); return; }
  if (payload === 'menu:payment') { await ctx.sendTo(userId, { text: ANSWERS.payment, attachments: [KEYBOARD] }); return; }
  if (payload === 'menu:contacts') { await ctx.sendTo(userId, { text: ANSWERS.contacts, attachments: [KEYBOARD] }); return; }
  if (payload === 'menu:wholesale') {
    await ctx.sendTo(userId, { text: ANSWERS.wholesale, attachments: [SINGLE_CONTACT_KB] });
    return;
  }
  if (payload === 'menu:site') { await ctx.sendTo(userId, { text: '🌐 Наш сайт: https://dv-upakom.ru', attachments: [KEYBOARD] }); return; }
  if (payload.indexOf('cat:') === 0) {
    const i = parseInt(payload.slice(4), 10);
    if (i >= 0 && i < SECTIONS.length) {
      const s = SECTIONS[i];
      await ctx.sendTo(userId, { text: '🛍 ' + s[0] + '\n' + s[1] + '\n\nПолный ассортимент и цены смотрите на сайте dv-upakom.ru или оставьте контакт — пришлём прайс.', attachments: [SINGLE_CONTACT_KB] });
    }
    return;
  }
}

const SINGLE_CONTACT_KB = {
  type: 'inline_keyboard',
  payload: {
    buttons: [
      [{ type: 'request_contact', text: '📞 Перезвоните мне' }]
    ]
  }
};