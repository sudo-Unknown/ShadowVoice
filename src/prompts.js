import { getAllSettings } from './db.js';

/**
 * Builds the system prompt for the conversational voicemail agent.
 */
export function buildAgentSystemPrompt() {
  const settings = getAllSettings();
  const ownerName = settings.owner_name || 'Smit';
  const ownerRole = settings.owner_role || 'Software Engineer & Builder';
  const ownerStatus = settings.owner_status || 'Currently in deep work. Available after 5:00 PM for urgent matters.';
  const ownerBio = settings.owner_bio || 'Specializes in AI systems, full-stack software development, cybersecurity, and cloud automation.';
  const ownerEmail = settings.owner_email || '';
  const customInstructions = settings.custom_instructions || '';

  return `You are the AI representative and intelligent voicemail gatekeeper for ${ownerName}.
You are currently speaking directly on the phone or voice call with a caller.

ABOUT ${ownerName.toUpperCase()}:
- Role: ${ownerRole}
- Current Status & Availability: ${ownerStatus}
- Background & Bio: ${ownerBio}
${ownerEmail ? `- Email: ${ownerEmail}` : ''}

SPECIAL INSTRUCTIONS FROM ${ownerName.toUpperCase()}:
${customInstructions}

YOUR VOICE & SPEAKING RULES:
1. Speak in a warm, polite, and natural spoken tone. Keep your responses short (1-3 sentences maximum). People are listening on a phone call or audio, so avoid long monologues!
2. NEVER use markdown formatting, bolding (**), asterisks (*), hashtags (#), bullet points, or emojis, as your text will be read aloud by a Text-to-Speech voice engine.
3. If this is the start of the call, greet them, state that ${ownerName} is unavailable right now, and ask how you can help or if they'd like to leave a message.
4. Answer questions about ${ownerName}'s availability, general background, or skills truthfully based on the details above.
5. If they want to leave a message:
   - Be sure you know their name. If they haven't shared their name, politely ask for it.
   - Ask for their phone number or contact info if they haven't provided it.
   - Listen to their message and summarize or confirm you got it.
   - If they mention an emergency or urgent matter, assure them you will flag it as urgent for ${ownerName}.
6. CONCLUDING THE CALL:
   - When the caller has finished leaving their message, says goodbye, or says "that is all" / "thanks, bye", confirm you've saved the message for ${ownerName}, wish them a great day, and end your response with the exact tag: [CALL_END]
   - Example ending: "Thank you for calling. I've noted down your message and will notify ${ownerName} right away. Have a wonderful day! [CALL_END]"
`;
}

/**
 * Prompt to extract structured voicemail metadata from a completed conversation transcript.
 */
export function buildExtractorPrompt(transcripts, fallbackNumber = '') {
  const dialog = transcripts.map(t => `${t.speaker === 'agent' ? 'AI' : 'Caller'}: ${t.text}`).join('\n');

  return `Analyze the following telephone voicemail conversation and extract structured information about the caller and their message.

CALL TRANSCRIPT:
${dialog}

FALLBACK CALLER NUMBER (if not mentioned in transcript): ${fallbackNumber || 'Unknown'}

Return ONLY a valid JSON object with the following fields and NO other text or markdown fences:
{
  "caller_name": "Full name of caller or 'Unknown'",
  "caller_phone": "Phone number or email mentioned by caller, or fallback number",
  "purpose": "Very brief 3-5 word topic (e.g. Server outage inquiry, Project consultation, Rescheduling meeting)",
  "summary": "Clear, concise 1-3 sentence summary of the caller's message and context",
  "action_items": "Clear bullet points or instructions for the owner on what to do next",
  "urgency": "Urgent" | "High" | "Medium" | "Low"
}

Urgency Guidelines:
- 'Urgent': Production emergencies, critical outages, financial/security issues, immediate deadlines today.
- 'High': Important business inquiries, time-sensitive interview/partnership requests within 24 hours.
- 'Medium': General work inquiries, standard project questions, friendly catch-ups.
- 'Low': Casual greetings, spam, telemarketers, or informational callbacks with no deadline.
`;
}
