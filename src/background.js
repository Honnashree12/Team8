chrome.runtime.onInstalled.addListener(() => {
  console.log('[ReadingAssistant] background worker installed');
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (!message || message.type !== 'applyTypography') {
    return false;
  }

  const tabId = sender.tab?.id;
  if (typeof tabId !== 'number') {
    console.warn('[ReadingAssistant] No tabId available for styling request');
    sendResponse({ success: false, error: 'missing-tab-id' });
    return false;
  }

  chrome.scripting.insertCSS(
    {
      target: { tabId },
      css: message.cssCode,
    }, () => {
      const error = chrome.runtime.lastError;
      if (error) {
        console.warn('[ReadingAssistant] insertCSS failed:', error.message);
        sendResponse({ success: false, error: error.message });
        return;
      }

      sendResponse({ success: true });
    }
  );

  return true;
});
