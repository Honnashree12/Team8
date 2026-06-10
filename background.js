const PROFILE_KEY = "userProfile";

chrome.runtime.onInstalled.addListener(async details => {
  if (details.reason !== "install") return;

  const existing = await chrome.storage.local.get(PROFILE_KEY);
  if (!existing[PROFILE_KEY]) {
    chrome.tabs.create({ url: chrome.runtime.getURL("onboarding.html") });
  }
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  switch (message.type) {
    case "GET_PROFILE":
      chrome.storage.local.get(PROFILE_KEY, result => {
        sendResponse({ profile: result[PROFILE_KEY] ?? null });
      });
      return true;

    case "SAVE_PROFILE":
      chrome.storage.local.set({ [PROFILE_KEY]: message.payload }, () => {
        sendResponse({ ok: true });
      });
      return true;

    case "RESET_PROFILE":
      chrome.storage.local.remove(PROFILE_KEY, () => {
        sendResponse({ ok: true });
      });
      return true;

    case "APPLY_READING_THEME_CSS":
      injectReadingCss(sender.tab?.id, message.css, sendResponse);
      return true;

    default:
      sendResponse({ error: "Unknown message type" });
      return false;
  }
});

async function injectReadingCss(tabId, css, sendResponse) {
  if (!tabId || !css) {
    sendResponse({ ok: false, error: "Missing tab id or css" });
    return;
  }

  try {
    await chrome.scripting.insertCSS({
      target: { tabId, allFrames: true },
      css
    });
    sendResponse({ ok: true });
  } catch (error) {
    sendResponse({ ok: false, error: error?.message ?? String(error) });
  }
}
