const countdownEl = document.getElementById("countdown");
let endsAtMs = null;

function formatRemaining(ms) {
  if (ms <= 0) return "00:00";
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

function tick() {
  if (!endsAtMs) return;
  const remaining = endsAtMs - Date.now();
  countdownEl.textContent = formatRemaining(remaining);

  // Сессия закончилась, пока пользователь смотрел на эту страницу — просто
  // отправляем его назад, а не оставляем висеть на устаревшем таймере 00:00.
  if (remaining <= 0) {
    history.back();
  }
}

chrome.runtime.sendMessage({ type: "GET_BLOCKED_PAGE_INFO" }, (response) => {
  if (response?.endsAt) {
    endsAtMs = new Date(response.endsAt).getTime();
    tick();
    setInterval(tick, 1000);
  } else {
    countdownEl.textContent = "—";
  }
});

document.getElementById("skip-btn").addEventListener("click", () => {
  // Требование ТЗ: "с подтверждением, чтобы не позволять бездумно обходить
  // блокировку одним кликом" — стандартный confirm() браузера достаточен
  // для этой цели и не требует отдельной модалки.
  const confirmed = confirm(
    "Пропустить блокировку на 5 минут? Это временно снимет блокировку со всех сайтов на время фокус-сессии."
  );
  if (!confirmed) return;

  chrome.runtime.sendMessage({ type: "SKIP_BLOCKING_5_MIN" }, () => {
    history.back();
  });
});
