import type { UserProfile } from "../types";

const KEY = "userProfile";

chrome.runtime.onInstalled.addListener(async (details) => {
  if (details.reason === "install") {
    const result = await chrome.storage.local.get(KEY);
    if (!result[KEY]) {
      chrome.tabs.create({ url: chrome.runtime.getURL("onboarding.html") });
    }
  }
});

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  switch (message.type) {
    case "GET_PROFILE":
      chrome.storage.local.get(KEY, (r) => sendResponse({ profile: r[KEY] ?? null }));
      return true;
    case "SAVE_PROFILE":
      chrome.storage.local.set({ [KEY]: message.payload as UserProfile }, () => sendResponse({ ok: true }));
      return true;
    case "RESET_PROFILE":
      chrome.storage.local.remove(KEY, () => sendResponse({ ok: true }));
      return true;
  }
});

export {};
