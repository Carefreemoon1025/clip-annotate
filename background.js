// background.js - 后台服务：右键菜单、快捷键、存储、AI 总结

// 安装时创建右键菜单
chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: "clip-annotate-capture",
    title: "抄录选中文字",
    contexts: ["selection"]
  });
});

// Storage helpers
function getClippings() {
  return new Promise((resolve) => {
    chrome.storage.local.get({ clippings: [] }, (result) => {
      resolve(result.clippings);
    });
  });
}

function saveClippings(clippings) {
  return new Promise((resolve) => {
    chrome.storage.local.set({ clippings }, resolve);
  });
}

// 点击右键菜单
chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === "clip-annotate-capture") {
    saveClipping(info.selectionText, tab.url, tab.title);
  }
});

// 快捷键
chrome.commands.onCommand.addListener((command) => {
  if (command === "capture-selection") {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (!tabs[0]) return;
      chrome.tabs.sendMessage(tabs[0].id, { action: "getSelection" }, (response) => {
        if (chrome.runtime.lastError) return;
        if (response && response.text) {
          saveClipping(response.text, response.url, response.title);
        }
      });
    });
  }
});

// 保存抄录
async function saveClipping(text, url, pageTitle) {
  if (!text || !text.trim()) return;

  const clipping = {
    id: Date.now().toString(36) + Math.random().toString(36).slice(2, 8),
    rawText: text,
    summary: text.length <= 100 ? text : "",
    url: url || "",
    pageTitle: pageTitle || "",
    timestamp: Date.now(),
    annotation: ""
  };

  const clippings = await getClippings();
  clippings.unshift(clipping);
  await saveClippings(clippings);

  chrome.runtime.sendMessage({ action: "clippingSaved", clippingId: clipping.id }).catch(() => {});

  // 长文本异步调用 AI 总结
  if (text.length > 100) {
    generateSummary(clipping.id, text);
  }
}

// AI 总结
async function generateSummary(clippingId, text) {
  try {
    const result = await chrome.storage.local.get(["apiKey", "apiEndpoint", "apiModel"]);
    const apiKey = result.apiKey || "";
    const apiEndpoint = (result.apiEndpoint || "https://api.deepseek.com").replace(/\/+$/, "");
    const apiModel = result.apiModel || "deepseek-v4-flash";

    if (!apiKey) return;

    const prompt = `一句话总结（≤20字）：${text.slice(0, 2000)}`;

    const response = await fetch(`${apiEndpoint}/v1/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: apiModel,
        messages: [{ role: "user", content: prompt }],
        max_tokens: 60,
        temperature: 0.3
      })
    });

    if (!response.ok) throw new Error(`API error: ${response.status}`);

    const data = await response.json();
    const summary = data.choices?.[0]?.message?.content?.trim() || "";

    if (summary) {
      const clippings = await getClippings();
      const idx = clippings.findIndex(c => c.id === clippingId);
      if (idx !== -1) {
        clippings[idx].summary = summary;
        await saveClippings(clippings);
        chrome.runtime.sendMessage({ action: "summaryReady", clippingId }).catch(() => {});
      }
    }
  } catch (err) {
    console.error("AI summary error:", err);
    const clippings = await getClippings();
    const idx = clippings.findIndex(c => c.id === clippingId);
    if (idx !== -1) {
      clippings[idx].summary = "[AI 总结生成失败]";
      await saveClippings(clippings);
    }
  }
}

// 更新批注
async function updateAnnotation(clippingId, annotation) {
  const clippings = await getClippings();
  const idx = clippings.findIndex(c => c.id === clippingId);
  if (idx !== -1) {
    clippings[idx].annotation = annotation;
    await saveClippings(clippings);
  }
}

// 删除抄录
async function deleteClipping(clippingId) {
  const clippings = await getClippings();
  const filtered = clippings.filter(c => c.id !== clippingId);
  await saveClippings(filtered);
}

// 重试 AI 总结
async function retrySummary(clippingId) {
  const clippings = await getClippings();
  const clipping = clippings.find(c => c.id === clippingId);
  if (clipping && clipping.rawText.length > 100) {
    generateSummary(clippingId, clipping.rawText);
  }
}

// 消息路由：sidepanel -> background
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  switch (request.action) {
    case "updateAnnotation":
      (async () => {
        await updateAnnotation(request.clippingId, request.annotation);
        sendResponse({ ok: true });
      })();
      return true;
    case "deleteClipping":
      (async () => {
        await deleteClipping(request.clippingId);
        sendResponse({ ok: true });
      })();
      return true;
    case "retrySummary":
      (async () => {
        await retrySummary(request.clippingId);
        sendResponse({ ok: true });
      })();
      return true;
    case "getClippings":
      (async () => {
        const clippings = await getClippings();
        sendResponse({ clippings });
      })();
      return true;
    case "getConfig":
      chrome.storage.local.get(["apiKey", "apiEndpoint", "apiModel"], (result) => {
        sendResponse({
          apiKey: result.apiKey || "",
          apiEndpoint: result.apiEndpoint || "https://api.deepseek.com",
          apiModel: result.apiModel || "deepseek-v4-flash"
        });
      });
      return true;
    case "saveConfig":
      chrome.storage.local.set({
        apiKey: request.apiKey,
        apiEndpoint: request.apiEndpoint || "https://api.deepseek.com",
        apiModel: request.apiModel || "deepseek-v4-flash"
      }, () => {
        sendResponse({ ok: true });
      });
      return true;
    case "exportData":
      (async () => {
        const clippings = await getClippings();
        sendResponse({ clippings });
      })();
      return true;
  }
});
