# Spec: AI Voicemail & Personal Call Gatekeeper Agent

## Objective
Build an AI-powered conversational voicemail agent that acts on the user's behalf for incoming phone calls and interactive voice interactions. The agent:
1. Greets callers warmly and announces that it is the user's AI representative.
2. Answers questions about the user's schedule, current availability status, projects, and FAQs.
3. Screens callers politely, determines their intent, and records a structured voicemail message (name, contact number, purpose, urgency, and details).
4. Provides a telephony endpoint for Twilio phone numbers (using TwiML speech gathering and neural text-to-speech).
5. Provides a Browser-Native Voice Simulator for real-time testing (using Web Speech API for voice in/out) without needing to dial a phone number.
6. Provides a Web Dashboard / Inbox to review calls, filter by urgency, view transcripts, and customize the owner's knowledge base and availability in real time.

## Tech Stack
- **Runtime**: Node.js v24+
- **Backend**: Express.js
- **Database**: Built-in `node:sqlite` (zero external C++ bindings, ultra-fast and reliable)
- **Telephony**: Twilio Voice TwiML (`<Gather input="speech">`, `<Say>`, `<Hangup>`)
- **LLM Engine**: Multi-provider conversational driver supporting:
  - Local Ollama (e.g. `cyber-coder:fast` / `qwen2.5-coder:3b` running on port 11434)
  - Cloud LLMs (Groq, OpenAI, Gemini) via standard completion interface
- **Frontend**: Single Page Dashboard & Voice Call Simulator with modern responsive UI and Web Speech API.
- **Tunneling**: One-click Cloudflare Tunnel integration (`cloudflared`) to expose Twilio webhooks to the public internet securely.

## Commands
```bash
# Install dependencies
npm install

# Start the Voicemail Server & Web Dashboard (default port: 3000)
npm start

# Run in development mode with auto-reload
npm run dev

# Expose webhook to Twilio via Cloudflare Tunnel
npm run tunnel

# Run automated tests
npm test
```

## Project Structure
```
ai-voicemail-agent/
├── SPEC.md                  # This specification document
├── package.json             # Node dependencies and scripts
├── .env.example             # Environment configuration template
├── src/
│   ├── server.js            # Main Express server and route setup
│   ├── config.js            # Configuration settings and env loading
│   ├── db.js                # SQLite schema and data access methods (node:sqlite)
│   ├── llm.js               # Multi-provider LLM conversational engine (Ollama/Groq/OpenAI)
│   ├── prompts.js           # Gatekeeper system prompts and message extraction logic
│   ├── twilioHandler.js     # Twilio Voice webhook, TwiML generation, and call session manager
│   └── public/              # Web Dashboard & Voice Simulator
│       ├── index.html       # Single-page UI (Dashboard + Inbox + Live Voice Simulator + Settings)
│       ├── app.js           # Client-side state, Web Speech API voice loop, API calls
│       └── style.css        # Sleek modern styling
└── tests/
    └── voicemail.test.js    # Unit & integration tests for conversation flow & DB
```

## Boundaries
- **Always do**:
  - Keep call latency minimal (<1.5s per turn) to avoid caller abandonment.
  - Gracefully handle speech recognition timeouts or unclear speech.
  - Automatically persist call logs, transcripts, and extracted structured messages in SQLite.
  - Fall back gracefully to local Ollama if no cloud API keys are provided.
- **Never do**:
  - Expose private credentials or owner API keys to callers or client-side scripts.
  - Lock up the server thread during audio processing or LLM calls.
  - Lose voicemail transcripts on unexpected disconnects.

## Success Criteria
1. Server starts cleanly and initializes SQLite database with tables for `calls`, `messages`, and `settings`.
2. Telephony webhook `/api/twilio/voice` responds with valid TwiML greeting and speech gather.
3. Telephony webhook `/api/twilio/gather` processes caller speech, queries LLM, responds with conversational audio, and extracts structured voicemail upon wrap-up.
4. Browser Voice Simulator accurately captures microphone input via Web Speech API, sends to conversational backend, and speaks responses aloud.
5. Inbox dashboard accurately shows caller list, audio transcript, urgency indicator, and summary.
6. Settings page allows updating owner name, availability status, and bio without restarting the server.
7. Automated tests verify conversation turn handling, message extraction, and DB persistence.
