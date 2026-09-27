import { config } from './config.js';
import { buildAgentSystemPrompt, buildExtractorPrompt } from './prompts.js';
import { getTranscripts, addTranscript, saveVoicemail, getAllSettings } from './db.js';

/**
 * Universal Chat Completion client supporting Ollama, Groq, and OpenAI
 */
export async function callLLM(messages, options = {}) {
  const provider = options.provider || config.llm.provider;

  // 1. Groq (Ultra-fast cloud)
  if (provider === 'groq' && config.llm.groqApiKey) {
    try {
      const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${config.llm.groqApiKey}`
        },
        body: JSON.stringify({
          model: config.llm.groqModel || 'llama-3.1-8b-instant',
          messages,
          temperature: options.temperature ?? 0.7,
          max_tokens: options.max_tokens ?? 250
        })
      });
      if (res.ok) {
        const data = await res.json();
        return data.choices[0]?.message?.content || '';
      }
      console.warn('Groq API error, falling back to Ollama:', await res.text());
    } catch (err) {
      console.warn('Groq request failed, falling back to Ollama:', err.message);
    }
  }

  // 2. OpenAI
  if (provider === 'openai' && config.llm.openaiApiKey) {
    try {
      const res = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${config.llm.openaiApiKey}`
        },
        body: JSON.stringify({
          model: config.llm.openaiModel || 'gpt-4o-mini',
          messages,
          temperature: options.temperature ?? 0.7,
          max_tokens: options.max_tokens ?? 250
        })
      });
      if (res.ok) {
        const data = await res.json();
        return data.choices[0]?.message?.content || '';
      }
      console.warn('OpenAI API error, falling back to Ollama:', await res.text());
    } catch (err) {
      console.warn('OpenAI request failed, falling back to Ollama:', err.message);
    }
  }

  // 3. Local Ollama (Default & Offline Fallback)
  const ollamaUrl = config.llm.ollamaUrl || 'http://127.0.0.1:11434';
  const ollamaModel = config.llm.ollamaModel || 'cyber-coder:fast';

  const res = await fetch(`${ollamaUrl}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: ollamaModel,
      messages,
      stream: false,
      options: {
        temperature: options.temperature ?? 0.7,
        num_predict: options.max_tokens ?? 250
      }
    })
  });

  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(`Ollama request failed (${res.status}): ${errorText}`);
  }

  const data = await res.json();
  return data.message?.content || '';
}

/**
 * Clean spoken voice output (removes markdown symbols, emojis, bullets)
 */
export function sanitizeForVoice(text) {
  return text
    .replace(/\[\/?CALL_END\]/gi, '')       // strip end tag first
    .replace(/\[\/?CALLEND\]/gi, '')
    .replace(/[*_#`~]/g, '')               // then strip markdown formatting
    .replace(/[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F700}-\u{1F77F}\u{1F780}-\u{1F7FF}\u{1F800}-\u{1F8FF}\u{1F900}-\u{1F9FF}\u{1FA00}-\u{1FA6F}\u{1FA70}-\u{1FAFF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/gu, '') // emojis
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Handle a conversation turn with the caller
 */
export async function generateAgentResponse(callId, callerSpeech) {
  // Record caller turn in database
  if (callerSpeech && callerSpeech.trim()) {
    addTranscript({ call_id: callId, speaker: 'caller', text: callerSpeech.trim() });
  }

  // Load system prompt and prior conversation history
  const systemPrompt = buildAgentSystemPrompt();
  const pastTurns = getTranscripts(callId);

  // Build message history
  const messages = [
    { role: 'system', content: systemPrompt }
  ];

  for (const turn of pastTurns) {
    messages.push({
      role: turn.speaker === 'agent' ? 'assistant' : 'user',
      content: turn.text
    });
  }

  const rawAnswer = await callLLM(messages, { temperature: 0.7, max_tokens: 150 });
  const isCallEnd = rawAnswer.includes('[CALL_END]');
  const cleanSpokenText = sanitizeForVoice(rawAnswer);

  // Record agent response in transcript
  addTranscript({ call_id: callId, speaker: 'agent', text: cleanSpokenText });

  return {
    rawAnswer,
    cleanSpokenText,
    isCallEnd
  };
}

/**
 * Extract structured voicemail info and save to DB
 */
export async function extractAndSaveVoicemail(callId, fallbackNumber = 'Unknown') {
  const transcripts = getTranscripts(callId);
  if (!transcripts || transcripts.length === 0) {
    return null;
  }

  const callerTranscripts = transcripts.filter(t => t.speaker === 'caller');
  if (callerTranscripts.length === 0) {
    // Caller didn't speak
    saveVoicemail({
      call_id: callId,
      caller_name: 'Unknown',
      caller_phone: fallbackNumber,
      purpose: 'Silent Call / Hangup',
      summary: 'Caller connected but did not leave a spoken message.',
      action_items: 'No action needed.',
      urgency: 'Low'
    });
    return;
  }

  try {
    const prompt = buildExtractorPrompt(transcripts, fallbackNumber);
    const result = await callLLM([
      { role: 'user', content: prompt }
    ], { temperature: 0.2, max_tokens: 300 });

    // Extract JSON block
    const jsonMatch = result.match(/\{[\s\S]*\}/);
    let parsed = null;
    if (jsonMatch) {
      try {
        parsed = JSON.parse(jsonMatch[0]);
      } catch (e) {
        console.warn('Failed to parse extracted JSON:', e.message);
      }
    }

    const rawActions = parsed?.action_items;
    let formattedActions = 'Review call transcript and follow up if necessary.';
    if (Array.isArray(rawActions)) {
      formattedActions = rawActions.map(a => `• ${a}`).join('\n');
    } else if (rawActions && typeof rawActions === 'string') {
      formattedActions = rawActions;
    }

    const voicemailData = {
      call_id: callId,
      caller_name: parsed?.caller_name || 'Unknown',
      caller_phone: parsed?.caller_phone || fallbackNumber,
      purpose: parsed?.purpose || 'Voicemail Message',
      summary: parsed?.summary || callerTranscripts.map(t => t.text).join(' '),
      action_items: formattedActions,
      urgency: ['Urgent', 'High', 'Medium', 'Low'].includes(parsed?.urgency) ? parsed.urgency : 'Medium'
    };

    saveVoicemail(voicemailData);

    // Send instant notification if webhook configured
    await sendNotification(voicemailData);

    return voicemailData;
  } catch (err) {
    console.error('Error during voicemail extraction:', err);
    // Fallback save
    saveVoicemail({
      call_id: callId,
      caller_name: 'Unknown',
      caller_phone: fallbackNumber,
      purpose: 'General Voicemail',
      summary: callerTranscripts.map(t => t.text).join(' '),
      action_items: 'Review call transcript.',
      urgency: 'Medium'
    });
  }
}

/**
 * Send alert to Discord or Webhook
 */
export async function sendNotification(voicemail) {
  if (!config.notifications.discordWebhookUrl) return;

  try {
    const urgencyColor = {
      Urgent: 15158332, // Red
      High: 15105570,   // Orange
      Medium: 3447003,  // Blue
      Low: 9807270      // Grey
    }[voicemail.urgency] || 3447003;

    await fetch(config.notifications.discordWebhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        embeds: [{
          title: `📞 New Voicemail: ${voicemail.caller_name} [${voicemail.urgency}]`,
          description: voicemail.summary,
          color: urgencyColor,
          fields: [
            { name: 'Phone/Contact', value: voicemail.caller_phone || 'Not provided', inline: true },
            { name: 'Topic', value: voicemail.purpose, inline: true },
            { name: 'Action Items', value: voicemail.action_items || 'None' }
          ],
          timestamp: new Date().toISOString()
        }]
      })
    });
  } catch (err) {
    console.warn('Failed to send Discord alert:', err.message);
  }
}
