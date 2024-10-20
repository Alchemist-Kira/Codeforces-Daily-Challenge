chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "checkVerdict") {
    const verdictElement = document.querySelector(".verdict-accepted");
    if (verdictElement) {
      chrome.runtime.sendMessage({
        action: "problemSolved",
        url: window.location.href,
      });
    }
  } else if (request.action === "checkSubmission") {
    const submitButton = document.querySelector('input[type="submit"]');
    if (submitButton) {
      submitButton.addEventListener("click", () => {
        chrome.runtime.sendMessage({ action: "submissionMade" });
      });
    }
  }
});

// Add a mutation observer to check for verdict changes
const observer = new MutationObserver((mutations) => {
  mutations.forEach((mutation) => {
    if (mutation.type === "childList") {
      const verdictElement = document.querySelector(".verdict-accepted");
      if (verdictElement) {
        chrome.runtime.sendMessage({
          action: "problemSolved",
          url: window.location.href,
        });
        observer.disconnect();
      }
    }
  });
});

// Start observing the document with the configured parameters
observer.observe(document.body, { childList: true, subtree: true });
