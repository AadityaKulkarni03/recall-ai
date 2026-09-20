// Recall AI — Chrome Extension Popup
// Communicates with background.js via chrome.runtime messages

const startBtn = document.getElementById("startBtn");
const stopBtn = document.getElementById("stopBtn");
const statusDot = document.getElementById("statusDot");
const statusText = document.getElementById("statusText");
const statsDiv = document.getElementById("stats");
const utterancesEl = document.getElementById("utterances");
const durationEl = document.getElementById("duration");
const serverUrlInput = document.getElementById("serverUrl");

let durationInterval = null;
let startTime = 0;

// Load saved server URL
chrome.storage.local.get("serverUrl", (data) => {
  if (data.serverUrl) serverUrlInput.value = data.serverUrl;
});

// Check current capture state
chrome.runtime.sendMessage({ action: "getStatus" }, (resp) => {
  if (resp && resp.capturing) {
    showCapturing(resp.utterances || 0);
    startTime = resp.startTime || Date.now();
    startDurationTimer();
  }
});

startBtn.addEventListener("click", () => {
  const serverUrl = serverUrlInput.value.trim();
  if (!serverUrl) {
    statusText.textContent = "Enter a backend WebSocket URL";
    return;
  }
  // Save URL
  chrome.storage.local.set({ serverUrl });

  startBtn.disabled = true;
  statusText.textContent = "Starting capture...";

  chrome.runtime.sendMessage(
    { action: "startCapture", serverUrl },
    (resp) => {
      if (resp && resp.success) {
        showCapturing(0);
        startTime = Date.now();
        startDurationTimer();
      } else {
        startBtn.disabled = false;
        statusText.textContent = `Error: ${resp?.error || "Failed to start capture"}`;
        statusDot.className = "dot off";
      }
    }
  );
});

stopBtn.addEventListener("click", () => {
  chrome.runtime.sendMessage({ action: "stopCapture" }, () => {
    showStopped();
  });
});

// Listen for utterance count updates from background
chrome.runtime.onMessage.addListener((msg) => {
  if (msg.type === "utteranceUpdate") {
    utterancesEl.textContent = msg.count;
  }
});

function showCapturing(utterances) {
  startBtn.style.display = "none";
  stopBtn.style.display = "block";
  serverUrlInput.disabled = true;
  statsDiv.style.display = "flex";
  statusDot.className = "dot recording";
  statusText.textContent = "Capturing tab audio...";
  utterancesEl.textContent = utterances;
}

function showStopped() {
  startBtn.style.display = "block";
  startBtn.disabled = false;
  stopBtn.style.display = "none";
  serverUrlInput.disabled = false;
  statusDot.className = "dot";
  statusText.textContent = "Capture stopped";
  if (durationInterval) clearInterval(durationInterval);
}

function startDurationTimer() {
  if (durationInterval) clearInterval(durationInterval);
  durationInterval = setInterval(() => {
    const elapsed = Math.floor((Date.now() - startTime) / 1000);
    const m = Math.floor(elapsed / 60);
    const s = elapsed % 60;
    durationEl.textContent = `${m}:${s.toString().padStart(2, "0")}`;
  }, 1000);
}
