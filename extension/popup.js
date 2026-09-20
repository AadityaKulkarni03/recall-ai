// Recall AI — Side Panel
// Captures tab/system audio via Screen Sharing for meeting transcription.

const startBtn = document.getElementById("startBtn");
const stopBtn = document.getElementById("stopBtn");
const statusDot = document.getElementById("statusDot");
const statusText = document.getElementById("statusText");
const statsDiv = document.getElementById("stats");
const utterancesEl = document.getElementById("utterances");
const durationEl = document.getElementById("duration");
const serverUrlInput = document.getElementById("serverUrl");
const errorMsg = document.getElementById("errorMsg");
const transcriptDiv = document.getElementById("transcriptList");

let ws = null;
let mediaRecorder = null;
let stream = null;
let durationInterval = null;
let startTime = 0;
let utteranceCount = 0;

function showError(msg) {
  errorMsg.textContent = msg;
  errorMsg.style.display = "block";
}
function clearError() {
  errorMsg.style.display = "none";
}

chrome.storage.local.get("serverUrl", (data) => {
  if (data.serverUrl) serverUrlInput.value = data.serverUrl;
});

startBtn.addEventListener("click", async () => {
  clearError();
  const serverUrl = serverUrlInput.value.trim();
  if (!serverUrl) { showError("Enter a backend URL"); return; }
  chrome.storage.local.set({ serverUrl });
  startBtn.disabled = true;
  statusText.textContent = "Connecting...";

  try {
    // 1. Connect WebSocket to backend
    ws = new WebSocket(serverUrl);
    await new Promise((resolve, reject) => {
      ws.onopen = () => resolve();
      ws.onerror = () => reject(new Error("WebSocket failed. Is the backend running?"));
      setTimeout(() => reject(new Error("Connection timeout")), 5000);
    });

    ws.onmessage = (e) => {
      try {
        const data = JSON.parse(e.data);
        if (data.type === "transcript") {
          utteranceCount = data.total_utterances || utteranceCount + 1;
          utterancesEl.textContent = utteranceCount;
          addTranscriptLine(data.speaker, data.text);
        } else if (data.type === "error") {
          showError("STT: " + data.message);
        }
      } catch { }
    };

    ws.onclose = () => {
      if (mediaRecorder && mediaRecorder.state !== "inactive") stopCapture();
    };

    // 2. Capture tab audio via screen sharing
    // Chrome will show a picker — user selects the Meet tab and checks "Share tab audio"
    statusText.textContent = "Select the meeting tab and enable audio sharing...";
    stream = await navigator.mediaDevices.getDisplayMedia({
      video: true,  // required by API, we'll discard it
      audio: true,  // this captures the tab's audio
    });

    // Stop the video track — we only need audio
    stream.getVideoTracks().forEach(t => t.stop());

    const audioTracks = stream.getAudioTracks();
    if (audioTracks.length === 0) {
      throw new Error("No audio track. Make sure you checked 'Share tab audio' in the picker.");
    }

    // Create audio-only stream for recording
    const audioStream = new MediaStream(audioTracks);

    // 3. Record and stream to backend
    mediaRecorder = new MediaRecorder(audioStream, { mimeType: "audio/webm;codecs=opus" });
    mediaRecorder.ondataavailable = async (e) => {
      if (e.data.size > 0 && ws && ws.readyState === WebSocket.OPEN) {
        ws.send(await e.data.arrayBuffer());
      }
    };

    // If user stops sharing from Chrome's built-in control
    audioTracks[0].onended = () => stopCapture();

    mediaRecorder.start(250);
    startTime = Date.now();
    utteranceCount = 0;
    showCapturing();
    startDurationTimer();

  } catch (err) {
    showError(err.message);
    startBtn.disabled = false;
    statusText.textContent = "Ready";
    statusDot.className = "dot off";
    if (ws) { try { ws.close(); } catch { } ws = null; }
    if (stream) { stream.getTracks().forEach(t => t.stop()); stream = null; }
  }
});

stopBtn.addEventListener("click", () => stopCapture());

function stopCapture() {
  if (mediaRecorder && mediaRecorder.state !== "inactive") mediaRecorder.stop();
  if (stream) { stream.getTracks().forEach(t => t.stop()); stream = null; }
  if (ws && ws.readyState === WebSocket.OPEN) {
    try { ws.send(JSON.stringify({ action: "stop" })); ws.close(); } catch { }
  }
  ws = null;
  mediaRecorder = null;
  showStopped();
}

function addTranscriptLine(speaker, text) {
  const empty = transcriptDiv.querySelector(".empty-state");
  if (empty) empty.remove();
  const el = document.createElement("div");
  el.className = "transcript-line";
  el.innerHTML = `<span class="speaker">${speaker}</span>${text}`;
  transcriptDiv.appendChild(el);
  transcriptDiv.scrollTop = transcriptDiv.scrollHeight;
}

function showCapturing() {
  startBtn.style.display = "none";
  stopBtn.style.display = "block";
  serverUrlInput.disabled = true;
  statsDiv.style.display = "flex";
  statusDot.className = "dot recording";
  statusText.textContent = "Capturing meeting audio...";
  transcriptDiv.style.display = "block";
}

function showStopped() {
  startBtn.style.display = "block";
  startBtn.disabled = false;
  stopBtn.style.display = "none";
  serverUrlInput.disabled = false;
  statusDot.className = "dot";
  statusText.textContent = "Capture stopped";
  if (durationInterval) { clearInterval(durationInterval); durationInterval = null; }
}

function startDurationTimer() {
  if (durationInterval) clearInterval(durationInterval);
  durationInterval = setInterval(() => {
    const elapsed = Math.floor((Date.now() - startTime) / 1000);
    durationEl.textContent = `${Math.floor(elapsed / 60)}:${(elapsed % 60).toString().padStart(2, "0")}`;
  }, 1000);
}
