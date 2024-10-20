const officialTags = [
  "2-sat",
  "binary search",
  "bitmasks",
  "brute force",
  "chinese remainder theorem",
  "combinatorics",
  "constructive algorithms",
  "data structures",
  "dfs and similar",
  "divide and conquer",
  "dp",
  "dsu",
  "expression parsing",
  "fft",
  "flows",
  "games",
  "geometry",
  "graph matchings",
  "graphs",
  "greedy",
  "hashing",
  "implementation",
  "interactive",
  "math",
  "matrices",
  "meet-in-the-middle",
  "number theory",
  "probabilities",
  "schedules",
  "shortest paths",
  "sortings",
  "string suffix structures",
  "strings",
  "ternary search",
  "trees",
  "two pointers",
];

document.addEventListener("DOMContentLoaded", () => {
  const ratingSelect = document.getElementById("rating");
  const tagInput = document.getElementById("tagInput");
  const tagList = document.getElementById("tagList");
  const saveButton = document.getElementById("save");
  const newProblemButton = document.getElementById("newProblem");
  const killSwitchButton = document.getElementById("killSwitch");
  const killSwitchDuration = document.getElementById("killSwitchDuration");
  const statusDiv = document.getElementById("status");
  const darkModeToggle = document.getElementById("darkModeToggle");

  let countdownInterval;
  let tags = [];

  function updateStatus() {
    chrome.storage.sync.get(
      ["lastSubmissionDate", "killSwitchEndDate"],
      (result) => {
        const now = new Date();
        const lastSubmission = new Date(result.lastSubmissionDate);
        const killSwitchEnd = new Date(result.killSwitchEndDate);
        const nextProblemTime = new Date(
          lastSubmission.getTime() + 24 * 60 * 60 * 1000
        );

        if (nextProblemTime > now) {
          updateCountdown(nextProblemTime);
        } else if (killSwitchEnd > now) {
          updateCountdown(killSwitchEnd);
        } else {
          clearInterval(countdownInterval);
          statusDiv.textContent = "Ready for a new problem!";
          statusDiv.className = "unsolved";
        }
      }
    );
  }

  function updateCountdown(endDate) {
    clearInterval(countdownInterval);

    function updateTimer() {
      const now = new Date().getTime();
      const distance = endDate - now;

      if (distance < 0) {
        clearInterval(countdownInterval);
        updateStatus();
        return;
      }

      const days = Math.floor(distance / (1000 * 60 * 60 * 24));
      const hours = Math.floor(
        (distance % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60)
      );
      const minutes = Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((distance % (1000 * 60)) / 1000);

      let countdownText = "Next problem in: ";
      if (days > 0) countdownText += `${days}d `;
      countdownText += `${hours}h ${minutes}m ${seconds}s`;

      statusDiv.textContent = countdownText;
      statusDiv.className = "unsolved";
    }

    updateTimer();
    countdownInterval = setInterval(updateTimer, 1000);
  }

  function renderTags() {
    tagList.innerHTML = tags
      .map(
        (tag) =>
          `<span class="tag">${tag}<button class="remove-tag" data-tag="${tag}" aria-label="Remove ${tag} tag">&times;</button></span>`
      )
      .join("");

    document.querySelectorAll(".remove-tag").forEach((button) => {
      button.addEventListener("click", function () {
        removeTag(this.getAttribute("data-tag"));
      });
    });
  }

  function addTag(tag) {
    tag = tag.toLowerCase();
    if (tag && !tags.includes(tag) && officialTags.includes(tag)) {
      tags.push(tag);
      renderTags();
    } else if (!officialTags.includes(tag)) {
      alert("Invalid tag. Please enter a valid Codeforces tag.");
    }
  }

  function removeTag(tag) {
    tags = tags.filter((t) => t !== tag);
    renderTags();
  }

  chrome.storage.sync.get(["rating", "tags", "darkMode"], (result) => {
    if (result.rating) {
      ratingSelect.value = result.rating;
    }
    if (result.tags) {
      tags = result.tags;
      renderTags();
    }
    if (result.darkMode) {
      document.body.classList.add("dark-mode");
      darkModeToggle.checked = true;
    }
  });

  updateStatus();

  tagInput.addEventListener("keydown", (event) => {
    if (event.key === "Enter" || event.key === ",") {
      event.preventDefault();
      const inputTags = event.target.value.split(",").map((t) => t.trim());
      inputTags.forEach((tag) => {
        if (tag) addTag(tag);
      });
      event.target.value = "";
    }
  });

  tagInput.addEventListener("blur", () => {
    const inputTags = tagInput.value.split(",").map((t) => t.trim());
    inputTags.forEach((tag) => {
      if (tag) addTag(tag);
    });
    tagInput.value = "";
  });

  saveButton.addEventListener("click", () => {
    const selectedRating = ratingSelect.value;
    chrome.runtime.sendMessage({
      action: "setSettings",
      rating: parseInt(selectedRating),
      tags: tags,
    });
    statusDiv.textContent = `Settings saved. Rating: ${selectedRating}, Tags: ${tags.join(
      ", "
    )}`;
    setTimeout(updateStatus, 1500);
  });

  newProblemButton.addEventListener("click", () => {
    chrome.runtime.sendMessage({ action: "getNewProblem" });
    window.close();
  });

  killSwitchButton.addEventListener("click", () => {
    const duration = parseInt(killSwitchDuration.value);
    const endDate = new Date();
    endDate.setDate(endDate.getDate() + duration);

    chrome.runtime.sendMessage({
      action: "toggleKillSwitch",
      duration: duration,
      endDate: endDate.toISOString(),
    });

    updateCountdown(endDate);
  });

  function showTagSuggestions() {
    const input = tagInput.value.toLowerCase();
    const lastTag = input.split(",").pop().trim();
    const suggestions = officialTags.filter((tag) => tag.includes(lastTag));
    const datalist = document.getElementById("tagSuggestions");
    datalist.innerHTML = suggestions
      .map(
        (tag) =>
          `<option value="${
            input.split(",").slice(0, -1).join(",") +
            (input.includes(",") ? ", " : "") +
            tag
          }">`
      )
      .join("");
  }

  tagInput.addEventListener("input", showTagSuggestions);

  darkModeToggle.addEventListener("change", () => {
    if (darkModeToggle.checked) {
      document.body.classList.add("dark-mode");
      chrome.storage.sync.set({ darkMode: true });
    } else {
      document.body.classList.remove("dark-mode");
      chrome.storage.sync.set({ darkMode: false });
    }
  });

  // Add this new event listener to update status when popup opens
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "submissionMade") {
      updateStatus();
    }
  });
});
