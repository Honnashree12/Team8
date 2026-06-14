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
const e="userProfile";chrome.runtime.onInstalled.addListener(async r=>{r.reason==="install"&&((await chrome.storage.local.get(e))[e]||chrome.tabs.create({url:chrome.runtime.getURL("onboarding.html")}))});chrome.runtime.onMessage.addListener((r,o,t)=>{switch(r.type){case"GET_PROFILE":return chrome.storage.local.get(e,a=>{t({profile:a[e]??null})}),!0;case"SAVE_PROFILE":{const a=r.payload;return chrome.storage.local.set({[e]:a},()=>{t({ok:!0})}),!0}case"RESET_PROFILE":return chrome.storage.local.remove(e,()=>{t({ok:!0})}),!0;default:t({error:"Unknown message type"})}});chrome.tabs.onUpdated.addListener((r,o)=>{o.status});
