import { test, describe, before, after } from 'node:test';
import assert from 'node:assert';
import http from 'node:http';
import {
  initDb,
  createCall,
  endCall,
  addTranscript,
  getTranscripts,
  saveVoicemail,
  getVoicemails,
  getVoicemailDetails,
  markVoicemailRead,
  deleteVoicemail,
  getAllSettings,
  updateSetting
} from '../src/db.js';
import { buildAgentSystemPrompt, buildExtractorPrompt } from '../src/prompts.js';
import { sanitizeForVoice } from '../src/llm.js';
import app from '../src/server.js';

describe('AI Voicemail & Gatekeeper Test Suite', () => {
  let server;
  const testPort = 3099;

  before((done) => {
    initDb();
    server = app.listen(testPort, done);
  });

  after((done) => {
    if (server) server.close(done);
  });

  test('Database: settings initialization and updating', () => {
    const settings = getAllSettings();
    assert.ok(settings.owner_name, 'Owner name should be defined');
    assert.ok(settings.owner_status, 'Owner status should be defined');

    updateSetting('test_custom_key', 'test_value');
    const updated = getAllSettings();
    assert.strictEqual(updated.test_custom_key, 'test_value');
  });

  test('Database: call lifecycle, transcripts, and voicemail CRUD', () => {
    const callId = `unit-test-${Date.now()}`;

    // 1. Create call
    createCall({
      id: callId,
      caller_number: '+19998887777',
      caller_name: 'Bob Builder',
      channel: 'phone'
    });

    // 2. Add transcripts
    addTranscript({ call_id: callId, speaker: 'agent', text: 'Hi, how can I help you?' });
    addTranscript({ call_id: callId, speaker: 'caller', text: 'I need to report an urgent server issue.' });

    const turns = getTranscripts(callId);
    assert.strictEqual(turns.length, 2);
    assert.strictEqual(turns[0].speaker, 'agent');
    assert.strictEqual(turns[1].speaker, 'caller');

    // 3. Save voicemail
    saveVoicemail({
      call_id: callId,
      caller_name: 'Bob Builder',
      caller_phone: '+19998887777',
      purpose: 'Server issue',
      summary: 'Bob called regarding an urgent server outage.',
      action_items: 'Call Bob back immediately.',
      urgency: 'Urgent'
    });

    // 4. Retrieve voicemail
    const voicemails = getVoicemails();
    const found = voicemails.find(v => v.call_id === callId);
    assert.ok(found, 'Voicemail should exist in list');
    assert.strictEqual(found.urgency, 'Urgent');
    assert.strictEqual(found.caller_name, 'Bob Builder');

    // 5. Mark read
    markVoicemailRead(callId, 1);
    const details = getVoicemailDetails(callId);
    assert.strictEqual(details.is_read, 1);
    assert.strictEqual(details.transcripts.length, 2);

    // 6. Delete
    deleteVoicemail(callId);
    const afterDelete = getVoicemails();
    assert.strictEqual(afterDelete.some(v => v.call_id === callId), false);
  });

  test('Prompts: dynamic system prompt generation', () => {
    updateSetting('owner_name', 'Smit');
    updateSetting('owner_role', 'Systems Engineer');

    const prompt = buildAgentSystemPrompt();
    assert.ok(prompt.includes('Smit'), 'Prompt should include owner name');
    assert.ok(prompt.includes('Systems Engineer'), 'Prompt should include owner role');
    assert.ok(prompt.includes('[CALL_END]'), 'Prompt should explain call end tag');
  });

  test('Voice Sanitization: stripping markdown, emojis, and call tags', () => {
    const raw = "Hello **there**! I'd love to help 😊. Let's talk about #devops. [CALL_END]";
    const clean = sanitizeForVoice(raw);

    assert.strictEqual(clean.includes('**'), false);
    assert.strictEqual(clean.includes('#'), false);
    assert.strictEqual(clean.includes('😊'), false);
    assert.strictEqual(clean.includes('[CALL_END]'), false);
    assert.ok(clean.includes('Hello there'));
  });

  test('HTTP API: GET /api/status returns online state', async () => {
    const res = await fetch(`http://localhost:${testPort}/api/status`);
    assert.strictEqual(res.status, 200);
    const data = await res.json();
    assert.strictEqual(data.status, 'online');
    assert.ok(data.llmProvider);
  });

  test('HTTP API: POST /api/simulator/start returns callId and greeting', async () => {
    const res = await fetch(`http://localhost:${testPort}/api/simulator/start`, {
      method: 'POST'
    });
    assert.strictEqual(res.status, 200);
    const data = await res.json();
    assert.ok(data.callId, 'Should return a callId');
    assert.ok(data.greeting, 'Should return a greeting');

    // Clean up
    deleteVoicemail(data.callId);
  });

  test('Telephony Webhook: POST /api/twilio/voice returns valid TwiML XML', async () => {
    const params = new URLSearchParams();
    params.append('CallSid', 'test-twilio-call-1');
    params.append('From', '+18005550199');
    params.append('To', '+18005550100');

    const res = await fetch(`http://localhost:${testPort}/api/twilio/voice`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params.toString()
    });

    assert.strictEqual(res.status, 200);
    const xml = await res.text();
    assert.ok(xml.includes('<Response>'), 'Should return <Response>');
    assert.ok(xml.includes('<Gather'), 'Should include <Gather>');
    assert.ok(xml.includes('<Say'), 'Should include <Say>');

    // Clean up
    deleteVoicemail('test-twilio-call-1');
  });
});
