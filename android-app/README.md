# ShadowVoice Hub • Unified Android Super-App 📱⚡

The unified Android Super-App companion for **ShadowVoice**. It bridges your smartphone's cellular telephone network with your self-hosted VPS, Docker infrastructure, and AI representative — all in a single native APK with zero carrier fees!

---

## 🌟 4-in-1 Super-App Features

### 1. 📞 Cellular Call Screener & Voicemail Inbox
- **Telecom `InCallService` Integration**: Replaces the default phone screen when a call arrives on your phone.
- **"🤖 Screen with AI" Button**: Answers the call on speakerphone, speaks the greeting, listens to the caller, and streams live transcripts to your screen.
- **"🎙️ Take Over Call"**: Instantly silence the AI and take over the call whenever you want to speak directly to the caller.
- **Multilingual Support**: Supports **मराठी (Marathi)**, **हिन्दी (Hindi)**, and **English** with auto-detection.
- **In-App Voicemail Inbox**: View all recorded voicemails with caller names, phone numbers, urgency tags (🔴 High, 🟡 Medium, 🟢 Low), summaries, and action items.

### 2. 🖥️ VPS & Docker Infrastructure Monitor
- **Live System Telemetry**: Real-time cards displaying:
  - ⚡ **CPU Load**: % load, cores, and processor model.
  - 🧠 **Memory (RAM)**: % utilized and exact `GB Used / GB Total`.
  - 💾 **Disk Storage**: % used and free capacity.
  - ⏱️ **Host Uptime & OS Platform**: Live hours and platform metrics.
- **Docker Container Management**:
  - Full list of all 38+ Docker containers (`coolify`, `ai-voicemail-agent`, `n8n`, `pihole`, `wireguard`, `stremio`, etc.).
  - Live status indicators (🟢 running, 🔴 exited).
  - One-tap **🔄 Restart** button per container directly from your phone!
- **Quick Service Launchers**: Direct one-tap buttons to open your web tools:
  - 🌐 **Coolify Control Panel** (`https://coolify.smitronix.dev`)
  - 🎙️ **ShadowVoice Web Dashboard** (`https://call.smitronix.dev`)

### 3. 🤖 AI System Copilot (Voice & Text)
- Tap the microphone button and talk to your server in **मराठी**, **हिन्दी**, or **English**:
  - *"How is my server health right now?"*
  - *"Who called me today and what are the voicemails?"*
  - *"सध्या सर्व्हर आणि कंटेनर्सचे काय स्टेटस आहे?"* (What's the status of the server and containers?)
  - *"Restart container n8n"*
- The copilot inspects live server telemetry, checks SQLite voicemails, queries Docker, and speaks back in your chosen language!
- Automated action execution: When you ask it to restart a container, it triggers the restart directly via the Docker API.

### 4. ⚙️ Centralized Settings
- Configure your VPS endpoint URL (preconfigured to `https://call.smitronix.dev`).
- Switch voice language preferences (`🌐 Multilingual Auto-Detect`, `🇮🇳 मराठी`, `🇮🇳 हिन्दी`, `🇮🇳 English (India)`, `🇺🇸 English (US)`).

---

## 🚀 How to Build & Install

### Step 1: Open in Android Studio
1. Clone this repository to your computer:
   ```bash
   git clone https://github.com/sudo-Unknown/ShadowVoice.git
   ```
2. In Android Studio, click **File > Open** and select the **`android-app`** directory.
3. Wait a few moments for Gradle to sync dependencies.

### Step 2: Build & Run on Your Phone
1. Connect your Android device via USB with **USB Debugging** enabled.
2. Click the green **Run (▶)** button in Android Studio, or build an APK via terminal:
   ```bash
   ./gradlew assembleDebug
   ```
   The APK will be generated at: `app/build/outputs/apk/debug/app-debug.apk`.
3. Install the APK on your device.

### Step 3: Grant Permissions on Your Phone
1. Open **ShadowVoice Hub** on your phone.
2. Grant requested permissions:
   - **Phone State & Answer Calls**: Allows answering incoming calls.
   - **Microphone**: Allows the AI to listen to caller speech & your voice commands.
   - **Notifications**: Alerts you when a voicemail is logged.
3. Tap **"Set as Default Phone Screener"** to enable call interception.

---

## 📡 Backend Architecture

```
[ Android Smartphone ]
       │
       ├── Calls: Native InCallService + SpeechRecognizer / TTS
       ├── UI: Call Screener, Voicemail Inbox, VPS Telemetry, Docker Manager
       │
       ▼ HTTPS (Let's Encrypt SSL)
[ call.smitronix.dev (Docker Port 3050) ]
       │
       ├── /api/simulator/turn  ──> Groq Cloud (qwen/qwen3.8-27b) [130ms turnaround]
       ├── /api/voicemails      ──> SQLite Database (/app/data/voicemail.sqlite)
       ├── /api/system/metrics  ──> Host CPU, RAM, Disk, Uptime
       ├── /api/system/containers ──> Docker Unix Socket (/var/run/docker.sock)
       └── /api/system/assistant ──> AI System Copilot
```
