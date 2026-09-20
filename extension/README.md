# Recall AI — Chrome Extension

Capture audio from any browser tab (Google Meet, Zoom web, etc.) and stream it to your Recall AI backend for real-time transcription and search.

## Install

1. Open `chrome://extensions/` in Chrome
2. Enable **Developer mode** (top right toggle)
3. Click **Load unpacked**
4. Select the `extension/` folder from this repo

## Usage

1. Join a Google Meet (or any tab with audio)
2. Click the Recall AI extension icon in the toolbar
3. Verify the backend URL (default: `ws://localhost:8000/ws/audio`)
4. Click **Start Capture**
5. The extension captures tab audio and streams it to your backend
6. Open `http://localhost:3000` to see real-time transcripts and query the meeting

## How It Works

- Uses Chrome's `tabCapture` API to capture audio from the active tab
- Encodes audio as `webm/opus` chunks via MediaRecorder (250ms intervals)
- Streams chunks to the Recall AI backend via WebSocket
- Backend forwards to Deepgram for real-time STT, then indexes into Moss

## Limitations

- Only captures remote participants' audio (what plays through the tab)
- Does not capture your own microphone — use the app's Live Audio tab for that
- Must be on the tab you want to capture when you click Start
- Tab capture stops if you close or navigate away from the tab
