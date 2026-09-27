import dotenv from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load .env from project root
dotenv.config({ path: path.join(__dirname, '..', '.env') });

export const config = {
  port: parseInt(process.env.PORT || '3000', 10),
  owner: {
    name: process.env.OWNER_NAME || 'Smit',
    role: process.env.OWNER_ROLE || 'Software Engineer & Builder',
    status: process.env.OWNER_STATUS || 'Currently busy/in focus work. Available after 5:00 PM for urgent matters.',
    bio: process.env.OWNER_BIO || 'Specializes in AI systems, full-stack software development, and cloud systems.',
    email: process.env.OWNER_EMAIL || 'smit@example.com'
  },
  llm: {
    provider: process.env.LLM_PROVIDER || 'ollama', // 'ollama' | 'groq' | 'openai'
    ollamaUrl: process.env.OLLAMA_URL || 'http://127.0.0.1:11434',
    ollamaModel: process.env.OLLAMA_MODEL || 'cyber-coder:fast',
    groqApiKey: process.env.GROQ_API_KEY || '',
    groqModel: process.env.GROQ_MODEL || 'llama-3.1-8b-instant',
    openaiApiKey: process.env.OPENAI_API_KEY || '',
    openaiModel: process.env.OPENAI_MODEL || 'gpt-4o-mini'
  },
  twilio: {
    accountSid: process.env.TWILIO_ACCOUNT_SID || '',
    authToken: process.env.TWILIO_AUTH_TOKEN || '',
    phoneNumber: process.env.TWILIO_PHONE_NUMBER || '',
    voice: process.env.TWILIO_VOICE || 'Polly.Matthew-Neural',
    language: process.env.TWILIO_LANGUAGE || 'en-US'
  },
  notifications: {
    discordWebhookUrl: process.env.DISCORD_WEBHOOK_URL || '',
    telegramBotToken: process.env.TELEGRAM_BOT_TOKEN || '',
    telegramChatId: process.env.TELEGRAM_CHAT_ID || ''
  },
  dbPath: path.join(__dirname, '..', 'data', 'voicemail.sqlite')
};
