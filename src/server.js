import express from 'express';
import cors from 'cors';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { config } from './config.js';
import {
  initDb,
  createCall,
  endCall,
  addTranscript,
  getVoicemails,
  getVoicemailDetails,
  markVoicemailRead,
  deleteVoicemail,
  getAllSettings,
  updateSettings
} from './db.js';
import { generateAgentResponse, extractAndSaveVoicemail } from './llm.js';
import { handleVoice, handleGather, handleStatus } from './twilioHandler.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

// Middlewares
app.use(cors());
// Twilio sends application/x-www-form-urlencoded
app.use(express.urlencoded({ extended: true }));
// Web frontend sends application/json
app.use(express.json());

// Serve static frontend assets
app.use(express.static(path.join(__dirname, 'public')));

/* =========================================================================
   TWILIO TELEPHONY ROUTES (Voice Webhooks)
   ========================================================================= */

app.post('/api/twilio/voice', handleVoice);
app.post('/api/twilio/gather', handleGather);
app.post('/api/twilio/status', handleStatus);

/* =========================================================================
   WEB VOICE SIMULATOR ROUTES (Browser-Native Voice Agent)
   ========================================================================= */

/**
 * Start a new simulated voice call
 */
app.post('/api/simulator/start', (req, res) => {
  const callId = `web-${Date.now()}`;
  const settings = getAllSettings();
  const ownerName = settings.owner_name || 'Smit';

  createCall({
    id: callId,
    caller_number: 'Web Browser Caller',
    caller_name: 'Web Visitor',
    channel: 'web_simulator'
  });

  const greeting = `Hi! You've reached ${ownerName}'s AI representative. ${ownerName} is currently unavailable. How can I help you, or would you like to leave a message?`;
  addTranscript({ call_id: callId, speaker: 'agent', text: greeting });

  res.json({
    callId,
    greeting
  });
});

/**
 * Handle a conversation turn in the browser simulator
 */
app.post('/api/simulator/turn', async (req, res) => {
  const { callId, speechText } = req.body;

  if (!callId || !speechText) {
    return res.status(400).json({ error: 'Missing callId or speechText' });
  }

  try {
    const { cleanSpokenText, isCallEnd } = await generateAgentResponse(callId, speechText);

    if (isCallEnd) {
      endCall(callId);
      // Asynchronously extract and summarize voicemail
      setImmediate(async () => {
        try {
          await extractAndSaveVoicemail(callId, 'Web Visitor');
        } catch (e) {
          console.error('[Simulator Extraction Error]', e);
        }
      });
    }

    res.json({
      replyText: cleanSpokenText,
      isCallEnd
    });
  } catch (err) {
    console.error('[Simulator Turn Error]', err);
    res.status(500).json({ error: 'Failed to process voice turn: ' + err.message });
  }
});

/**
 * End a simulated call manually (e.g. user clicks Hang Up)
 */
app.post('/api/simulator/end', async (req, res) => {
  const { callId } = req.body;
  if (!callId) {
    return res.status(400).json({ error: 'Missing callId' });
  }

  endCall(callId);
  try {
    const vm = await extractAndSaveVoicemail(callId, 'Web Visitor');
    res.json({ success: true, voicemail: vm });
  } catch (err) {
    console.error('[Simulator Manual End Error]', err);
    res.status(500).json({ error: 'Failed to extract voicemail' });
  }
});

/* =========================================================================
   VOICEMAIL INBOX & MANAGEMENT API
   ========================================================================= */

// Get all voicemails
app.get('/api/voicemails', (req, res) => {
  const unreadOnly = req.query.unread === 'true';
  const voicemails = getVoicemails({ unreadOnly });
  res.json({ voicemails });
});

// Get single voicemail with transcript dialog
app.get('/api/voicemails/:callId', (req, res) => {
  const details = getVoicemailDetails(req.params.callId);
  if (!details) {
    return res.status(404).json({ error: 'Voicemail not found' });
  }
  res.json({ voicemail: details });
});

// Mark voicemail as read/unread
app.patch('/api/voicemails/:callId/read', (req, res) => {
  const isRead = req.body.is_read !== undefined ? req.body.is_read : 1;
  markVoicemailRead(req.params.callId, isRead);
  res.json({ success: true });
});

// Delete voicemail
app.delete('/api/voicemails/:callId', (req, res) => {
  deleteVoicemail(req.params.callId);
  res.json({ success: true });
});

/* =========================================================================
   SETTINGS & STATUS API
   ========================================================================= */

// Get current persona and settings
app.get('/api/settings', (req, res) => {
  const settings = getAllSettings();
  res.json({ settings });
});

// Update settings
app.post('/api/settings', (req, res) => {
  const updates = req.body;
  if (!updates || typeof updates !== 'object') {
    return res.status(400).json({ error: 'Invalid settings body' });
  }
  updateSettings(updates);
  res.json({ success: true, settings: getAllSettings() });
});

// System Status
app.get('/api/status', async (req, res) => {
  let ollamaOk = false;
  try {
    const check = await fetch(`${config.llm.ollamaUrl}/api/tags`);
    ollamaOk = check.ok;
  } catch (e) {
    ollamaOk = false;
  }

  res.json({
    status: 'online',
    uptime: Math.floor(process.uptime()),
    llmProvider: config.llm.provider,
    ollamaConnected: ollamaOk,
    twilioConfigured: Boolean(config.twilio.accountSid && config.twilio.authToken),
    activeModel: config.llm.provider === 'ollama' ? config.llm.ollamaModel : (config.llm.groqModel || config.llm.openaiModel),
    port: config.port
  });
});

// Fallback to index.html for client-side routing
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Start listening
export function startServer(port = config.port) {
  initDb();
  return app.listen(port, () => {
    console.log(`\n=================================================`);
    console.log(`🎙️  AI Voicemail & Call Gatekeeper is RUNNING!`);
    console.log(`=================================================`);
    console.log(`  Local Web Dashboard: http://localhost:${port}`);
    console.log(`  Twilio Webhook:      http://localhost:${port}/api/twilio/voice`);
    console.log(`  LLM Engine:          ${config.llm.provider.toUpperCase()}`);
    console.log(`=================================================\n`);
  });
}

// Auto-run if executed directly
if (process.argv[1] && process.argv[1].endsWith('server.js')) {
  startServer();
}

export default app;
