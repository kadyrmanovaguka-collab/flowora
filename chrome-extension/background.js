// =============================================================================
// FLOWORA WEBSITE BLOCKER — background.js (Manifest V3 service worker)
// =============================================================================
// Отвечает за:
//  1. Хранение auth-токена и black/white списков в chrome.storage.local
//  2. Периодический опрос /api/sessions/active (подстраховка) + мгновенное
//     обновление по сообщению от content script на сайте Flowora
//  3. Пересборку declarativeNetRequest-правил при любом изменении состояния
//  4. Обработку "Пропустить блокировку на 5 минут" из blocked.html
// =============================================================================

const API_BASE = "https://your-flowora-domain.vercel.app"; // заменить на реальный домен деплоя
const POLL_ALARM_NAME = "flowora-poll-active-session";
const LISTS_ALARM_NAME = "flowora-poll-lists";

// --- helpers для chrome.storage.local (Promise-обёртка, MV3 не даёт async/await из коробки) ---
function storageGet(keys) {
  return new Promise((resolve) => chrome.storage.local.get(keys, resolve));
}
function storageSet(items) {
  return new Promise((resolve) => chrome.storage.local.set(items, resolve));
}

// -----------------------------------------------------------------------------
// ОПРОС АКТИВНОЙ ФОКУС-СЕССИИ
// -----------------------------------------------------------------------------
async function pollActiveSession() {
  const { accessToken } = await storageGet(["accessToken"]);
  if (!accessToken) return; // расширение ещё не залогинено — блокировать нечего

  try {
    const res = await fetch(`${API_BASE}/api/sessions/active`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!res.ok) return;

    const data = await res.json();
    await storageSet({ focusActive: data.active, focusEndsAt: data.endsAt });
    await rebuildBlockingRules();
  } catch (err) {
    // Сеть недоступна/сайт лежит — намеренно НЕ трогаем текущее состояние
    // блокировки: лучше продолжить блокировать по последним известным данным,
    // чем резко снять блокировку из-за временной сетевой ошибки.
    console.warn("Flowora: не удалось опросить активную сессию", err);
  }
}

// -----------------------------------------------------------------------------
// СИНХРОНИЗАЦИЯ BLACK/WHITE СПИСКОВ
// -----------------------------------------------------------------------------
async function syncLists() {
  const { accessToken } = await storageGet(["accessToken"]);
  if (!accessToken) return;

  try {
    const res = await fetch(`${API_BASE}/api/extension/lists`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!res.ok) return;

    const data = await res.json();
    await storageSet({ blacklist: data.blacklist ?? [], whitelist: data.whitelist ?? [] });
    await rebuildBlockingRules();
  } catch (err) {
    console.warn("Flowora: не удалось синхронизировать списки доменов", err);
  }
}

// -----------------------------------------------------------------------------
// ПЕРЕСБОРКА ПРАВИЛ declarativeNetRequest
// -----------------------------------------------------------------------------
// declarativeNetRequest требует явного набора правил заранее (а не проверки
// "на лету" в JS для каждого запроса, как это было в устаревшем webRequest
// blocking API из Manifest V2) — поэтому при любом изменении состояния мы
// удаляем все старые динамические правила и создаём новые с нуля.
async function rebuildBlockingRules() {
  const { blacklist = [], whitelist = [], focusActive, skipUntil } = await storageGet([
    "blacklist",
    "whitelist",
    "focusActive",
    "skipUntil",
  ]);

  const existingRules = await chrome.declarativeNetRequest.getDynamicRules();
  const removeRuleIds = existingRules.map((rule) => rule.id);

  const isSkipping = skipUntil && Date.now() < skipUntil;
  const shouldBlock = focusActive && !isSkipping;

  if (!shouldBlock) {
    await chrome.declarativeNetRequest.updateDynamicRules({ removeRuleIds, addRules: [] });
    return;
  }

  // Whitelist имеет приоритет над blacklist (требование ТЗ): исключаем из
  // блокируемых доменов всё, что явно указано в whitelist — даже если домен
  // случайно попал в оба списка.
  const whitelistSet = new Set(whitelist);
  const domainsToBlock = blacklist.filter((domain) => !whitelistSet.has(domain));

  const addRules = domainsToBlock.map((domain, index) => ({
    id: index + 1, // id должны быть уникальны и стабильны в рамках одного updateDynamicRules-вызова
    priority: 1,
    action: {
      type: "redirect",
      redirect: { extensionPath: "/blocked.html" },
    },
    condition: {
      // urlFilter с ведущим "||" матчит домен и все его сабдомены (синтаксис
      // Adblock-style, поддерживаемый declarativeNetRequest), "^" отделяет
      // домен от возможного порта/пути — стандартный приём, чтобы избежать
      // случайного совпадения с доменами вроде "notinstagram.com".
      urlFilter: `||${domain}^`,
      resourceTypes: ["main_frame"],
    },
  }));

  await chrome.declarativeNetRequest.updateDynamicRules({ removeRuleIds, addRules });
}

// -----------------------------------------------------------------------------
// АЛАРМЫ (Manifest V3 не позволяет держать setInterval в service worker —
// воркер может быть выгружен браузером в любой момент простоя, поэтому
// периодичность задаётся через chrome.alarms, переживающий выгрузку)
// -----------------------------------------------------------------------------
chrome.runtime.onInstalled.addListener(() => {
  chrome.alarms.create(POLL_ALARM_NAME, { periodInMinutes: 0.33 }); // ~каждые 20 секунд
  chrome.alarms.create(LISTS_ALARM_NAME, { periodInMinutes: 5 });
});

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === POLL_ALARM_NAME) pollActiveSession();
  if (alarm.name === LISTS_ALARM_NAME) syncLists();
});

// -----------------------------------------------------------------------------
// СООБЩЕНИЯ: от popup (логин), от content script (мгновенное обновление
// статуса сессии без ожидания следующего опроса), от blocked.html (запрос
// оставшегося времени, запрос на "пропустить блокировку")
// -----------------------------------------------------------------------------
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  (async () => {
    switch (message.type) {
      case "SET_AUTH_TOKEN": {
        await storageSet({ accessToken: message.accessToken });
        await syncLists();
        await pollActiveSession();
        sendResponse({ ok: true });
        break;
      }

      case "LOGOUT": {
        await storageSet({ accessToken: null, focusActive: false });
        await rebuildBlockingRules();
        sendResponse({ ok: true });
        break;
      }

      // Content script на сайте Flowora шлёт это сразу при старте/остановке
      // фокус-сессии — благодаря этому блокировка включается мгновенно,
      // а не только по 20-секундному опросу.
      case "FOCUS_SESSION_CHANGED": {
        await storageSet({ focusActive: message.active, focusEndsAt: message.endsAt ?? null });
        await rebuildBlockingRules();
        sendResponse({ ok: true });
        break;
      }

      case "GET_BLOCKED_PAGE_INFO": {
        const { focusEndsAt } = await storageGet(["focusEndsAt"]);
        sendResponse({ endsAt: focusEndsAt });
        break;
      }

      // "Пропустить блокировку на 5 минут" — подтверждение уже произошло
      // на стороне blocked.html (см. blocked.js), сюда долетает только
      // финальное решение пользователя.
      case "SKIP_BLOCKING_5_MIN": {
        const skipUntil = Date.now() + 5 * 60 * 1000;
        await storageSet({ skipUntil });
        await rebuildBlockingRules();
        sendResponse({ ok: true });
        break;
      }

      default:
        sendResponse({ ok: false, error: "Неизвестный тип сообщения" });
    }
  })();

  return true; // держим канал открытым для асинхронного sendResponse
});
