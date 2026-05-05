// content.js - 获取页面选中的文本和元数据
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "getSelection") {
    const selection = window.getSelection();
    const text = selection ? selection.toString().trim() : "";
    sendResponse({
      text: text,
      url: window.location.href,
      title: document.title
    });
  }
});
