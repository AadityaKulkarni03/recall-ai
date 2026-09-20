// Recall AI — Side Panel with Capture + Query Engine

// ── DOM Elements ───────────────────────────────────────────────
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
const queryInput = document.getElementById("queryInput");
const queryBtn = document.getElementById("queryBtn");
const llmToggle = document.getElementById("llmToggle");
const queryResults = document.getElementById("queryResults");

// ── State ──────────────────────────────────────────────────────
let ws = null;
let mediaRecorder = null;
let stream = null;
let durationInterval = null;
let startTime = 0;
let utteranceCount = 0;
let useLLM = false;

// ── Helpers ────────────────────────────────────────────────────
function showError(msg) { errorMsg.textContent = msg; errorMsg.style.display = "block"; }
function clearError() { errorMsg.style.display = "none"; }

function getApiBase() {
  // Derive HTTP API URL from WebSocket URL
  const wsUrl = serverUrlInput.value.trim();
  return wsUrl
    .replace("/ws/audio", "")
    .replace("wss://", "https://")
    .replace("ws://", "http://");
}

// ── Tabs ───────────────────────────────────────────────────────
document.querySelectorAll(".tab").forEach(tab => {
  tab.addEventListener("click", () => {
    document.querySelectorAll(".tab").forEach(t => t.classList.remove("active"));
    document.querySelectorAll(".tab-content").forEach(c => c.classList.remove("active"));
    tab.classList.add("active");
    document.getElementById("tab-" + tab.dataset.tab).classList.add("active");
  });
});

// ── LLM Toggle ─────────────────────────────────────────────────
llmToggle.addEventListener("click", () => {
  useLLM = !useLLM;
  llmToggle.classList.toggle("on", useLLM);
});

// ── Load saved URL ─────────────────────────────────────────────
chrome.storage.local.get("serverUrl", (data) => {
  if (data.serverUrl) serverUrlInput.value = data.serverUrl;
});

// ── Capture ────────────────────────────────────────────────────
startBtn.addEventListener("click", async () => {
  clearError();
  const serverUrl = serverUrlInput.value.trim();
  if (!serverUrl) { showError("Enter a backend URL"); return; }
  chrome.storage.local.set({ serverUrl });
  startBtn.disabled = true;
  statusText.textContent = "Connecting...";

  try {
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
      } catch {}
    };

    ws.onclose = () => {
      if (mediaRecorder && mediaRecorder.state !== "inactive") stopCapture();
    };

    statusText.textContent = "Select the meeting tab and enable audio sharing...";
    stream = await navigator.mediaDevices.getDisplayMedia({
      video: true,
      audio: true,
    });

    stream.getVideoTracks().forEach(t => t.stop());
    const audioTracks = stream.getAudioTracks();
    if (audioTracks.length === 0) {
      throw new Error("No audio track. Make sure you checked 'Share tab audio'.");
    }

    const audioStream = new MediaStream(audioTracks);
    mediaRecorder = new MediaRecorder(audioStream, { mimeType: "audio/webm;codecs=opus" });
    mediaRecorder.ondataavailable = async (e) => {
      if (e.data.size > 0 && ws && ws.readyState === WebSocket.OPEN) {
        ws.send(await e.data.arrayBuffer());
      }
    };
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
    if (ws) { try { ws.close(); } catch {} ws = null; }
    if (stream) { stream.getTracks().forEach(t => t.stop()); stream = null; }
  }
});

stopBtn.addEventListener("click", () => stopCapture());

function stopCapture() {
  if (mediaRecorder && mediaRecorder.state !== "inactive") mediaRecorder.stop();
  if (stream) { stream.getTracks().forEach(t => t.stop()); stream = null; }
  if (ws && ws.readyState === WebSocket.OPEN) {
    try { ws.send(JSON.stringify({ action: "stop" })); ws.close(); } catch {}
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

// ── Query Engine ───────────────────────────────────────────────

function cleanAnswer(text) {
  return text
    .replace(/^Answer:\s*/i, "")
    .replace(/\nConfidence:\s*(high|medium|low)\s*$/i, "")
    .replace(/\n?Sources?:[\s\S]*$/i, "")
    .replace(/\s*\([\w\s]+@\s*[\d?]+s?\)/g, "")
    .replace(/\s*\([\w\s]+,\s*[\d?]+s?\)/g, "")
    .replace(/\s*\[\d+\]/g, "")
    .trim();
}

function formatTime(s) {
  if (!s || s <= 0) return "0:00";
  return `${Math.floor(s / 60)}:${Math.floor(s % 60).toString().padStart(2, "0")}`;
}

queryBtn.addEventListener("click", () => runQuery());
queryInput.addEventListener("keydown", (e) => { if (e.key === "Enter") runQuery(); });

async function runQuery() {
  const question = queryInput.value.trim();
  if (!question) return;
  const apiBase = getApiBase();

  queryBtn.disabled = true;
  queryResults.innerHTML = '<div class="empty-state">Searching...</div>';

  if (!useLLM) {
    // Non-streaming query
    try {
      const res = await fetch(`${apiBase}/api/query`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question, use_llm: false, top_k: 5 }),
      });
      const data = await res.json();
      renderResults(data, null);
    } catch (err) {
      queryResults.innerHTML = `<div class="empty-state" style="color:#f87171;">Query failed: ${err.message}</div>`;
    }
    queryBtn.disabled = false;
    return;
  }

  // Streaming query with LLM
  try {
    const res = await fetch(`${apiBase}/api/query/stream`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ question, use_llm: true, top_k: 5 }),
    });

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    let retrievalData = null;
    let answerText = "";
    let answerEl = null;

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      const lines = buffer.split("\n");
      buffer = lines.pop() || "";

      for (const line of lines) {
        if (!line.startsWith("data: ")) continue;
        const evt = JSON.parse(line.slice(6));

        if (evt.type === "retrieval") {
          retrievalData = evt;
          renderResults({ retrieval_ms: evt.retrieval_ms, passages: evt.passages }, "");
          answerEl = queryResults.querySelector(".ai-answer-text");
        }
        if (evt.type === "token" && answerEl) {
          answerText += evt.token;
          answerEl.innerHTML = cleanAnswer(answerText) + '<span class="streaming-cursor"></span>';
          queryResults.scrollTop = queryResults.scrollHeight;
        }
        if (evt.type === "done" && answerEl) {
          answerEl.innerHTML = cleanAnswer(answerText);
        }
      }
    }
  } catch (err) {
    queryResults.innerHTML = `<div class="empty-state" style="color:#f87171;">Query failed: ${err.message}</div>`;
  }
  queryBtn.disabled = false;
}

function renderResults(data, answer) {
  let html = "";

  // Latency
  if (data.retrieval_ms !== undefined) {
    html += `<span class="latency-pill retrieval">⚡ ${data.retrieval_ms.toFixed(1)}ms</span>`;
  }

  // AI answer placeholder
  if (answer !== null) {
    html += `<div class="ai-answer"><div class="ai-label">AI Summary</div><div class="ai-answer-text">${answer || '<span class="streaming-cursor"></span>'}</div></div>`;
  }

  // Passages
  if (data.passages && data.passages.length > 0) {
    html += data.passages.map(p => `
      <div class="passage">
        <div class="meta">
          <span class="score">${(p.score * 100).toFixed(0)}%</span>
          <span class="speaker-ts">${p.speaker} · ${formatTime(p.timestamp)}</span>
        </div>
        <div>${p.text}</div>
      </div>
    `).join("");
  } else if (answer === null) {
    html += '<div class="empty-state">No matching passages found</div>';
  }

  // Non-streaming answer
  if (data.answer && answer === null) {
    html = `<div class="ai-answer"><div class="ai-label">AI Summary</div><div>${cleanAnswer(data.answer)}</div></div>` + html;
  }

  queryResults.innerHTML = html;
}
