# ShadowVoice • AI Voicemail & Call Gatekeeper Agent 🎙️

An intelligent, conversational AI representative that answers phone calls on your behalf like an interactive voicemail. It speaks with callers in natural voice, answers questions about your schedule and work, screens incoming inquiries, records structured voicemails, and flags urgent matters immediately.

---

## 🌟 Key Features

- **Real Telephony Support (Twilio)**:
  - Inbound phone call answering using Twilio Voice webhooks.
  - Multi-turn conversational speech dialogue with built-in neural speech synthesis (`Polly.Matthew-Neural`, `Polly.Joanna-Neural`, etc.).
  - Automatic silence detection and speech transcription.
- **Browser-Native Voice Simulator**:
  - Test and talk with your AI representative directly in Google Chrome or any modern browser using your microphone and speaker.
  - Zero Twilio setup needed for local development or testing!
- **Smart Gatekeeper & Personal Persona**:
  - Introduces itself as your AI assistant and informs callers of your current availability (e.g. *"In deep work until 5:00 PM"*).
  - Answers questions about your background, projects, and contact channels.
  - Politely collects the caller's name, phone number, and message.
- **Structured Voicemail Extraction**:
  - Automatically analyzes the call transcript when the call wraps up.
  - Extracts caller name, phone number, purpose, 1-2 sentence summary, action items, and urgency level (`Urgent`, `High`, `Medium`, `Low`).
- **Owner Dashboard & Voicemail Inbox**:
  - Real-time inbox with urgency pill badges, filtering, and search.
  - Full conversation transcript viewer with speech bubbles.
  - Real-time settings editor to update your availability status and instructions without restarting the server.
- **Multi-LLM Engine**:
  - **Local Ollama** (default, 100% private & offline using `cyber-coder:fast` or `qwen2.5-coder:3b`).
  - **Groq** (optional, ultra-low latency ~500 tokens/sec, perfect for real-time phone calls).
  - **OpenAI** (optional, `gpt-4o-mini`).
- **Instant Alerts**:
  - Optional Discord webhook or Telegram alerts with formatted urgency embeds when a voicemail is left.

---

## 🚀 Quick Start

### 1. Start the Server
```bash
cd /home/ubuntu/ai-voicemail-agent
./start.sh
# OR: npm start
```
The server will start on **`http://localhost:3050`**.

### 2. Open the Web Dashboard
Visit [http://localhost:3050](http://localhost:3050) in your browser:
- **Voicemail Inbox**: View all incoming calls and voicemails.
- **Voice Simulator**: Click "Test Voice Call" and speak into your microphone to test the AI talking back to you.
- **Persona & Knowledge**: Set your name, role, live availability note, and custom screening rules.

---

## 📞 Connecting a Real Phone Number (Twilio)

To answer real telephone calls from any mobile phone:

### Step 1: Expose the Webhook with Cloudflare Tunnel
In a new terminal window, run:
```bash
cd /home/ubuntu/ai-voicemail-agent
npm run tunnel
```
Cloudflare will display a public HTTPS URL, for example:
```
https://random-words-1234.trycloudflare.com
```

### Step 2: Configure Twilio
1. Log in to your [Twilio Console](https://console.twilio.com/).
2. Navigate to **Phone Numbers** > **Manage** > **Active numbers**.
3. Click on your active phone number.
4. Scroll down to the **Voice Configuration** section:
   - Under **"A CALL COMES IN"**:
     - Select: `Webhook`
     - URL: `https://<your-tunnel-subdomain>.trycloudflare.com/api/twilio/voice`
     - HTTP Method: `HTTP POST`
5. Click **Save Configuration**.

### Step 3: Call Your Number!
Dial your Twilio phone number. Your AI assistant will answer the call, converse in real-time, take down the caller's message, and immediately post the parsed voicemail to your EchoMe dashboard!

---

## 🛠️ Configuration (`.env`)

You can edit `/home/ubuntu/ai-voicemail-agent/.env` to customize settings:

| Variable | Default | Description |
|---|---|---|
| `PORT` | `3050` | Port for the web server and webhooks |
| `OWNER_NAME` | `Smit` | Your name |
| `OWNER_ROLE` | `Software Engineer & Builder` | Your professional title |
| `OWNER_STATUS` | `In deep work until 5:00 PM` | Your live availability note |
| `LLM_PROVIDER` | `ollama` | `ollama`, `groq`, or `openai` |
| `OLLAMA_MODEL` | `cyber-coder:fast` | Ollama model tag |
| `GROQ_API_KEY` | *(optional)* | Groq API key for cloud speed |
| `TWILIO_VOICE` | `Polly.Matthew-Neural` | Amazon Polly neural voice in Twilio |
| `DISCORD_WEBHOOK_URL`| *(optional)* | Webhook URL for instant Discord notifications |

---

## 🧪 Running Automated Tests

Run the full unit and integration test suite:
```bash
npm test
```

Verifies:
- SQLite initialization, call logging, transcripts, and voicemail CRUD.
- Twilio TwiML generation and speech gathering.
- Dynamic system prompt and knowledge injection.
- Voice sanitization (stripping emojis, formatting, and control tags).
- REST API and simulator endpoints.

---

## 📂 Project Architecture

```
ai-voicemail-agent/
├── SPEC.md                  # Project specification document
├── package.json             # Dependencies and scripts
├── .env                     # Active configuration
├── start.sh                 # Fast startup script
├── src/
│   ├── server.js            # Express application & HTTP routing
│   ├── config.js            # Environment loader and options
│   ├── db.js                # SQLite data access (node:sqlite)
│   ├── llm.js               # Multi-provider LLM chat & extraction
│   ├── prompts.js           # Gatekeeper system prompts & extraction
│   ├── twilioHandler.js     # Twilio Voice TwiML webhook handlers
│   └── public/              # Web Dashboard & Voice Simulator
│       ├── index.html       # HTML UI
│       ├── app.js           # Client-side state & Web Speech API
│       └── style.css        # Responsive styling & phone simulator
└── tests/
    └── voicemail.test.js    # Automated test suite
```
