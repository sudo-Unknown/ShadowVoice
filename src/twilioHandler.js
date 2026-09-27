import twilio from 'twilio';
import { config } from './config.js';
import { createCall, endCall, addTranscript, getAllSettings } from './db.js';
import { generateAgentResponse, extractAndSaveVoicemail } from './llm.js';

const { VoiceResponse } = twilio.twiml;

/**
 * Handle initial incoming call webhook from Twilio: POST /api/twilio/voice
 */
export async function handleVoice(req, res) {
  const callSid = req.body.CallSid || `call-${Date.now()}`;
  const fromNumber = req.body.From || 'Unknown';
  const settings = getAllSettings();
  const ownerName = settings.owner_name || 'Smit';

  console.log(`[Twilio Inbound Call] Sid: ${callSid}, From: ${fromNumber}`);

  // Create call record in DB
  createCall({
    id: callSid,
    caller_number: fromNumber,
    channel: 'phone'
  });

  const greeting = `Hi! You've reached ${ownerName}'s AI assistant. ${ownerName} is currently unavailable. How can I help you, or would you like to leave a message?`;

  // Save greeting in transcript
  addTranscript({ call_id: callSid, speaker: 'agent', text: greeting });

  const twiml = new VoiceResponse();
  const gather = twiml.gather({
    input: 'speech',
    action: '/api/twilio/gather',
    method: 'POST',
    speechTimeout: 'auto',
    speechModel: 'phone_call',
    language: config.twilio.language || 'en-US'
  });

  gather.say({
    voice: config.twilio.voice || 'Polly.Matthew-Neural',
    language: config.twilio.language || 'en-US'
  }, greeting);

  // Fallback if caller says nothing after prompt
  twiml.say({
    voice: config.twilio.voice || 'Polly.Matthew-Neural',
    language: config.twilio.language || 'en-US'
  }, "I didn't hear anything. Please speak what you'd like to tell " + ownerName + ".");

  twiml.gather({
    input: 'speech',
    action: '/api/twilio/gather',
    method: 'POST',
    speechTimeout: 'auto',
    speechModel: 'phone_call',
    language: config.twilio.language || 'en-US'
  });

  twiml.say({
    voice: config.twilio.voice || 'Polly.Matthew-Neural',
    language: config.twilio.language || 'en-US'
  }, "I'm sorry, I still couldn't hear you. Please feel free to call back later. Goodbye.");
  twiml.hangup();

  res.type('text/xml');
  res.send(twiml.toString());
}

/**
 * Handle speech input gathered from caller: POST /api/twilio/gather
 */
export async function handleGather(req, res) {
  const callSid = req.body.CallSid;
  const fromNumber = req.body.From || 'Unknown';
  const speechResult = req.body.SpeechResult;

  console.log(`[Twilio Speech Gathered] CallSid: ${callSid}, Speech: "${speechResult}"`);

  const twiml = new VoiceResponse();

  if (!speechResult || !speechResult.trim()) {
    const gather = twiml.gather({
      input: 'speech',
      action: '/api/twilio/gather',
      method: 'POST',
      speechTimeout: 'auto',
      speechModel: 'phone_call',
      language: config.twilio.language || 'en-US'
    });
    gather.say({
      voice: config.twilio.voice || 'Polly.Matthew-Neural',
      language: config.twilio.language || 'en-US'
    }, "I didn't catch that. Could you please repeat what you said?");

    res.type('text/xml');
    return res.send(twiml.toString());
  }

  try {
    const { cleanSpokenText, isCallEnd } = await generateAgentResponse(callSid, speechResult);

    if (isCallEnd) {
      twiml.say({
        voice: config.twilio.voice || 'Polly.Matthew-Neural',
        language: config.twilio.language || 'en-US'
      }, cleanSpokenText);
      twiml.hangup();

      // Finalize call in background
      setImmediate(async () => {
        try {
          endCall(callSid);
          await extractAndSaveVoicemail(callSid, fromNumber);
        } catch (e) {
          console.error('[Error finalizing call]', e);
        }
      });
    } else {
      const gather = twiml.gather({
        input: 'speech',
        action: '/api/twilio/gather',
        method: 'POST',
        speechTimeout: 'auto',
        speechModel: 'phone_call',
        language: config.twilio.language || 'en-US'
      });
      gather.say({
        voice: config.twilio.voice || 'Polly.Matthew-Neural',
        language: config.twilio.language || 'en-US'
      }, cleanSpokenText);
    }
  } catch (err) {
    console.error('[Twilio LLM Turn Error]', err);
    twiml.say({
      voice: config.twilio.voice || 'Polly.Matthew-Neural',
      language: config.twilio.language || 'en-US'
    }, "Thank you. I have recorded your message and will notify the owner right away. Goodbye.");
    twiml.hangup();

    setImmediate(async () => {
      endCall(callSid);
      await extractAndSaveVoicemail(callSid, fromNumber);
    });
  }

  res.type('text/xml');
  res.send(twiml.toString());
}

/**
 * Handle call completion/hangup callback from Twilio: POST /api/twilio/status
 */
export async function handleStatus(req, res) {
  const callSid = req.body.CallSid;
  const callStatus = req.body.CallStatus;
  const fromNumber = req.body.From || 'Unknown';

  console.log(`[Twilio Call Status] Sid: ${callSid}, Status: ${callStatus}`);

  if (['completed', 'failed', 'busy', 'no-answer'].includes(callStatus)) {
    endCall(callSid);
    setImmediate(async () => {
      try {
        await extractAndSaveVoicemail(callSid, fromNumber);
      } catch (e) {
        console.error('[Error extracting voicemail on status change]', e);
      }
    });
  }

  res.sendStatus(200);
}
