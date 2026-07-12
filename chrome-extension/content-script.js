// Работает в контексте страницы flowora (host_permissions в manifest.json
// ограничивают его только этим доменом) и пробрасывает window.postMessage
// от сайта в chrome.runtime.sendMessage расширения — напрямую сайт не может
// вызывать chrome.runtime API расширения (у него нет к нему доступа), а
// content script имеет доступ к обоим мирам одновременно.
window.addEventListener("message", (event) => {
  if (event.source !== window) return;
  if (event.data?.source !== "flowora-app") return;

  if (event.data.type === "FOCUS_SESSION_CHANGED") {
    chrome.runtime.sendMessage({
      type: "FOCUS_SESSION_CHANGED",
      active: event.data.active,
      endsAt: event.data.endsAt,
    });
  }

  if (event.data.type === "AUTH_TOKEN_AVAILABLE") {
    // Если пользователь уже залогинен на сайте и открывает popup расширения
    // впервые, удобнее автоматически подхватить токен, чем просить логиниться
    // повторно отдельно в popup.
    chrome.runtime.sendMessage({
      type: "SET_AUTH_TOKEN",
      accessToken: event.data.accessToken,
    });
  }
});
