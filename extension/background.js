// Recall AI — Background Service Worker
// Captures tab audio and streams it to the Recall AI backend via WebSocket

let capturing = false;
let ws = null;
let mediaRecorder = null;
let utteranceCount = 0;
let captureStartTime = 0;
let offscreenReady = false;

// Handle messages from popup
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.action === "startCapture") {
    startCapture(msg.serverUrl)
      .then(() => sendResponse({ success: true }))
      .catch((err) => sendResponse({ success: false, error: err.message }));
    return true; // async response
  }

  if (msg.action === "stopCapture") {
    stopCapture();
    sendResponse({ success: true });
    return false;
  }

  if (msg.action === "getStatus") {
    sendResponse({
      capturing,
      utterances: utteranceCount,
      startTime: captureStartTime,
    });
    return false;
  }

  // Audio data from offscreen document
  if (msg.type === "audioData" && ws && ws.readyState === WebSocket.OPEN) {
    // Convert base64 to ArrayBuffer and send
    const binary = atob(msg.data);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    ws.send(bytes.buffer);
    return false;
  }

  return false;
});

async function startCapture(serverUrl) {
  if (capturing) throw new Error("Already capturing");

  // Connect to backend WebSocket
  ws = new WebSocket(serverUrl);

  await new Promise((resolve, reject) => {
    ws.onopen = resolve;
    ws.onerror = () => reject(new Error("WebSocket connection failed"));
    setTimeout(() => reject(new Error("WebSocket timeout")), 5000);
  });

  ws.onmessage = (e) => {
    try {
      const data = JSON.parse(e.data);
      if (data.type === "transcript") {
        utteranceCount = data.total_utterances || utteranceCount + 1;
        // Notify popup
        chrome.runtime.sendMessage({
          type: "utteranceUpdate",
          count: utteranceCount,
        }).catch(() => {}); // popup might be closed
      }
    } catch {}
  };

  ws.onclose = () => {
    if (capturing) stopCapture();
  };

  // Capture tab audio
  const streamId = await new Promise((resolve, reject) => {
    chrome.tabCapture.capture(
      { audio: true, video: false },
      (stream) => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
          return;
        }
        if (!stream) {
          reject(new Error("No audio stream returned"));
          return;
        }
        resolve(stream);
      }
    );
  });

  // streamId is actually the MediaStream from tabCapture
  const stream = streamId;

  // Create MediaRecorder to send audio chunks
  mediaRecorder = new MediaRecorder(stream, {
    mimeType: "audio/webm;codecs=opus",
  });

  mediaRecorder.ondataavailable = async (e) => {
    if (e.data.size > 0 && ws && ws.readyState === WebSocket.OPEN) {
      const buffer = await e.data.arrayBuffer();
      ws.send(buffer);
    }
  };

  mediaRecorder.onstop = () => {
    stream.getTracks().forEach((t) => t.stop());
  };

  mediaRecorder.start(250); // Send chunks every 250ms
  capturing = true;
  utteranceCount = 0;
  captureStartTime = Date.now();
}

function stopCapture() {
  capturing = false;

  if (mediaRecorder && mediaRecorder.state !== "inactive") {
    mediaRecorder.stop();
    mediaRecorder = null;
  }

  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify({ action: "stop" }));
    ws.close();
  }
  ws = null;
}
