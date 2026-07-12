// Эти значения ПУБЛИЧНЫ по дизайну Supabase (anon-ключ безопасен без RLS-
// защиты, как и в веб-клиенте, см. lib/supabase/client.ts) — их можно
// безопасно хранить прямо в исходниках расширения.
const SUPABASE_URL = "https://xxxxxxxxxxxxx.supabase.co";
const SUPABASE_ANON_KEY = "eyJxxxxxxxxxxxxxxxxxxxxxxxxxxxx";
const APP_URL = "https://your-flowora-domain.vercel.app";

const loginView = document.getElementById("login-view");
const loggedInView = document.getElementById("logged-in-view");
const errorEl = document.getElementById("error");

function storageGet(keys) {
  return new Promise((resolve) => chrome.storage.local.get(keys, resolve));
}

async function render() {
  const { accessToken, focusActive } = await storageGet(["accessToken", "focusActive"]);

  if (!accessToken) {
    loginView.style.display = "block";
    loggedInView.style.display = "none";
    return;
  }

  loginView.style.display = "none";
  loggedInView.style.display = "block";

  const dot = document.getElementById("status-dot");
  const text = document.getElementById("status-text");
  if (focusActive) {
    dot.classList.add("active");
    text.textContent = "Фокус-сессия активна — блокировка включена";
  } else {
    dot.classList.remove("active");
    text.textContent = "Фокус-сессия не активна";
  }
}

document.getElementById("login-btn").addEventListener("click", async () => {
  const email = document.getElementById("email").value.trim();
  const password = document.getElementById("password").value;
  errorEl.textContent = "";

  if (!email || !password) {
    errorEl.textContent = "Введите email и пароль";
    return;
  }

  try {
    // Прямой вызов Supabase Auth REST API (без клиентской библиотеки
    // @supabase/supabase-js — она не нужна в service worker-контексте
    // расширения ради экономии размера бандла popup'а).
    const res = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: SUPABASE_ANON_KEY,
      },
      body: JSON.stringify({ email, password }),
    });

    const data = await res.json();

    if (!res.ok) {
      errorEl.textContent = data.error_description ?? "Неверный email или пароль";
      return;
    }

    // Токен передаётся в background.js, который сохраняет его в
    // chrome.storage.local и сразу же синхронизирует списки/статус сессии.
    await chrome.runtime.sendMessage({ type: "SET_AUTH_TOKEN", accessToken: data.access_token });
    render();
  } catch (err) {
    errorEl.textContent = "Ошибка сети. Проверьте подключение.";
  }
});

document.getElementById("logout-btn").addEventListener("click", async () => {
  await chrome.runtime.sendMessage({ type: "LOGOUT" });
  render();
});

document.getElementById("open-lists-link").addEventListener("click", (e) => {
  e.preventDefault();
  chrome.tabs.create({ url: `${APP_URL}/settings/blocker` });
});

render();
