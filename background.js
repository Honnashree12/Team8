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

    case "DEFINE_WORD":
      defineWord(message.payload.word, message.payload.context).then(sendResponse);
      return true;

    case "SIMPLIFY_TEXT":
      simplifyText(message.payload.text).then(sendResponse);
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

async function defineWord(word, context = "") {
  if (!word || word.trim().length < 2) {
    return { ok: false, error: "Word too short" };
  }

  const clean = word.toLowerCase().replace(/[^a-z'-]/g, "");

  try {
    const res = await fetch("http://127.0.0.1:8787/define", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        term: clean,
        context: context
      })
    });

    if (!res.ok) {
      throw new Error(`HTTP error! status: ${res.status}`);
    }

    const data = await res.json();
    return { ok: true, result: data.result };
  } catch (err) {
    console.error("[DysAssist] Error fetching definition:", err.message);
    return { ok: false, error: err.message };
  }
}

async function simplifyText(text) {
  if (!text || text.trim().length < 10) {
    return { ok: false, error: "Text too short to simplify" };
  }

  try {
    const res = await fetch("http://127.0.0.1:8787/simplify", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        text: text.trim()
      })
    });

    if (!res.ok) {
      throw new Error(`HTTP error! status: ${res.status}`);
    }

    const data = await res.json();
    return { ok: true, result: data.result };
  } catch (err) {
    console.error("[DysAssist] Error simplifying text:", err.message);
    return { ok: false, error: err.message };
  }
}
