function extractProblemLinkFromUrl(url) {
  const match = url.match(
    /\/(?:problemset\/problem|contest\/\d+\/problem|gym\/\d+\/problem)\/(\d+\/[A-Z]\d*)/
  );
  return match ? `/problemset/problem/${match[1]}` : null;
}

let chosenRating = 800;
let chosenTags = [];
let isRedirecting = false;
let solvedProblems = [];

chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.sync.get(
    [
      "rating",
      "tags",
      "killSwitchEndDate",
      "solvedProblems",
      "lastSubmissionDate",
    ],
    (result) => {
      if (result.rating) chosenRating = result.rating;
      if (result.tags) chosenTags = result.tags;
      if (result.solvedProblems) solvedProblems = result.solvedProblems;
      if (!result.killSwitchEndDate) {
        chrome.storage.sync.set({
          killSwitchEndDate: new Date(0).toISOString(),
        });
      }
      if (!result.lastSubmissionDate) {
        chrome.storage.sync.set({
          lastSubmissionDate: new Date(0).toISOString(),
        });
      }
    }
  );
});

chrome.tabs.onCreated.addListener((tab) => {
  checkAndRedirect(tab.id);
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === "complete" && !isRedirecting) {
    checkAndRedirect(tabId);
  }
});

function checkAndRedirect(tabId) {
  chrome.tabs.get(tabId, (tab) => {
    const url = tab.url;
    if (isCodeforcesProblemPage(url) || isCodeforcesSubmissionPage(url)) {
      return;
    }

    chrome.storage.sync.get(
      ["lastSubmissionDate", "killSwitchEndDate"],
      (result) => {
        const today = new Date().toDateString();
        const lastSubmission = new Date(result.lastSubmissionDate);
        const killSwitchEnd = new Date(result.killSwitchEndDate);
        if (
          lastSubmission.toDateString() !== today &&
          killSwitchEnd <= new Date()
        ) {
          getRandomProblem(tabId);
        }
      }
    );
  });
}

function isCodeforcesProblemPage(url) {
  return (
    url.includes("codeforces.com/problemset/problem") ||
    url.includes("codeforces.com/contest") ||
    url.includes("codeforces.com/gym")
  );
}

function isCodeforcesSubmissionPage(url) {
  return (
    url.includes("codeforces.com/problemset/submit") ||
    url.includes("codeforces.com/problemset/status") ||
    url.includes("codeforces.com/contest") ||
    url.includes("codeforces.com/gym")
  );
}

function getRandomProblem(tabId) {
  isRedirecting = true;
  const tagQuery = chosenTags.length > 0 ? chosenTags.join(";") : "";
  const url = `https://codeforces.com/problemset?tags=${chosenRating}-${chosenRating},${tagQuery}`;

  fetch(url)
    .then((response) => response.text())
    .then((html) => {
      const problemLinks = extractProblemLinks(html);
      const unsolvedProblems = problemLinks.filter(
        (link) => !solvedProblems.includes(link)
      );

      if (unsolvedProblems.length > 0) {
        const randomProblem =
          unsolvedProblems[Math.floor(Math.random() * unsolvedProblems.length)];
        const problemUrl = "https://codeforces.com" + randomProblem;
        chrome.tabs.update(tabId, { url: problemUrl }, () => {
          setTimeout(() => {
            isRedirecting = false;
          }, 5000);
        });
      } else {
        console.error("No unsolved problems found");
        chrome.tabs.update(
          tabId,
          { url: "https://codeforces.com/problemset" },
          () => {
            isRedirecting = false;
          }
        );
      }
    })
    .catch((error) => {
      console.error("Error fetching problems:", error);
      chrome.tabs.update(
        tabId,
        { url: "https://codeforces.com/problemset" },
        () => {
          isRedirecting = false;
        }
      );
    });
}

function extractProblemLinks(html) {
  const regex = /<a href="(\/problemset\/problem\/\d+\/[A-Z]\d*)"[^>]*>/g;
  const matches = [...html.matchAll(regex)];
  return matches.map((match) => match[1]);
}

chrome.webNavigation.onCompleted.addListener((details) => {
  if (details.url.includes("codeforces.com/problemset/submit")) {
    chrome.tabs.sendMessage(details.tabId, { action: "checkSubmission" });
  }
});

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "setSettings") {
    chosenRating = request.rating;
    chosenTags = request.tags;
    chrome.storage.sync.set({ rating: chosenRating, tags: chosenTags });
  } else if (request.action === "getNewProblem") {
    chrome.tabs.create({}, (tab) => {
      getRandomProblem(tab.id);
    });
  } else if (request.action === "submissionMade") {
    const today = new Date();
    chrome.storage.sync.set({ lastSubmissionDate: today.toISOString() }, () => {
      console.log("Submission made. Extension will turn off for a day.");
    });
  } else if (request.action === "toggleKillSwitch") {
    chrome.storage.sync.get(
      ["lastSubmissionDate", "killSwitchEndDate"],
      (result) => {
        const lastSubmission = new Date(result.lastSubmissionDate);
        const currentKillSwitchEnd = new Date(result.killSwitchEndDate);
        const now = new Date();

        // Use the later of lastSubmission + 1 day or now as the base time
        const baseTime = new Date(
          Math.max(
            lastSubmission.getTime() + 24 * 60 * 60 * 1000,
            now.getTime()
          )
        );

        // If current kill switch is in the future, use it as the base time
        const startTime =
          currentKillSwitchEnd > baseTime ? currentKillSwitchEnd : baseTime;

        const newEndDate = new Date(
          startTime.getTime() + request.duration * 24 * 60 * 60 * 1000
        );

        chrome.storage.sync.set(
          { killSwitchEndDate: newEndDate.toISOString() },
          () => {
            console.log(
              `Kill switch activated until ${newEndDate.toLocaleString()}`
            );
          }
        );
      }
    );
  }
});
