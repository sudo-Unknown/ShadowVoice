# ShadowVoice • Native Android Call Screener & Voicemail App 📱

The native Android companion app for **ShadowVoice**. It intercepts incoming telephone calls directly on your Android smartphone, allows you to screen calls using your self-hosted AI representative, streams live transcripts to your screen, and records voicemails with zero Twilio fees!

---

## 🌟 Key Features

1. **Native Telecom Integration (`InCallService`)**:
   - Replaces the default phone screen when a call arrives.
   - Adds a prominent **"🤖 Screen with ShadowVoice AI"** button.
2. **Multilingual Voice Support**:
   - **मराठी (Marathi)**: Native Marathi speech recognition & Text-to-Speech (`mr-IN`).
   - **हिन्दी (Hindi)**: Native Hindi speech recognition & Text-to-Speech (`hi-IN`).
   - **English**: Indian English (`en-IN`) & US English (`en-US`).
   - **Auto-Detect**: Automatically detects language and responds in the caller's language.
3. **Live Streaming Call Transcript**:
   - Watch the caller's spoken words and the AI's spoken answers stream live on your screen in real time.
4. **"Take Over Call" Button**:
   - If an important caller is on the line, tap **Take Over Call** anytime to mute the AI and speak to them personally.
5. **Zero Twilio Fees**:
   - Runs directly on your phone's cellular SIM card and carrier network.

---

## 🚀 How to Build & Install

### Step 1: Open in Android Studio
1. Clone this repository to your laptop/workstation:
   ```bash
   git clone https://github.com/sudo-Unknown/ShadowVoice.git
   ```
2. In Android Studio, select **Open** > choose the **`android-app`** folder.
3. Allow Gradle to sync dependencies.

### Step 2: Build & Install on Your Phone
1. Connect your Android smartphone via USB (enable **USB Debugging** in Developer Options).
2. Click the green **Run (▶)** button in Android Studio, or build an APK via:
   ```bash
   ./gradlew assembleDebug
   ```
   The APK will be generated at: `app/build/outputs/apk/debug/app-debug.apk`.
3. Transfer and install the APK onto your phone.

### Step 3: Enable Permissions on Your Phone
1. Open the **ShadowVoice** app on your phone.
2. Grant the requested permissions:
   - **Phone State & Answer Calls**: Allows answering incoming calls.
   - **Microphone**: Allows the AI to listen to caller speech.
   - **Notifications**: Alerts you when a voicemail is logged.
3. Tap **"Set as Default Phone App"** in the app to enable the incoming call screener overlay.

### Step 4: Configure Your Server
1. In the app settings:
   - **Server Endpoint**: `https://call.smitronix.dev`
   - **AI Voice & Language**: Select `🌐 Multilingual Auto-Detect`, `🇮🇳 मराठी`, or `🇮🇳 हिन्दी`.
2. Tap **Save Settings**.

---

## 📞 How Call Screening Works in Action

1. Someone dials your actual personal SIM number.
2. Your phone rings with the ShadowVoice screen.
3. Tap **"Screen with ShadowVoice AI"**:
   - The app answers the call on speakerphone.
   - The AI greets the caller in your selected language (e.g. Marathi: *"नमस्कार! मी Asmit यांचा एआय प्रतिनिधी बोलत आहे..."*).
   - The caller speaks their message.
   - The live transcript updates on your phone in real time.
   - When the caller finishes, the AI confirms saving the message, hangs up, and logs the structured voicemail to your dashboard at `https://call.smitronix.dev`.
