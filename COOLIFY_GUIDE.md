# Self-Hosting ShadowVoice on Coolify 🚀

This guide provides end-to-end instructions for self-hosting **ShadowVoice (AI Voicemail & Call Gatekeeper)** on your own server or VPS using **Coolify**.

---

## 🌟 Why Coolify?
- **Automatic Free SSL**: Coolify automatically issues and renews Let's Encrypt certificates for your custom domain.
- **Permanent Webhook URL**: No more temporary tunnels (like ngrok or Cloudflare tunnel) — your Twilio webhook connects directly to `https://call.yourdomain.com/api/twilio/voice`.
- **Persistent Storage**: All voicemails, calls, and custom instructions are safely preserved across updates via Docker volumes.
- **Auto Healing**: Automatically restarts the container if it crashes or the server reboots.

---

## 📋 Prerequisites
1. A server with **Coolify v4+** installed.
2. A custom domain or subdomain (e.g. `voicemail.yourdomain.com` or `call.yourdomain.com`) pointing to your Coolify server's public IP address.
3. Your Twilio Account & Phone Number.

---

## 🚀 Deployment Options

### Method 1: Deploy from Git (Recommended)

1. **Push your project to GitHub / GitLab**:
   ```bash
   cd /home/ubuntu/ai-voicemail-agent
   git remote add origin https://github.com/your-username/ai-voicemail-agent.git
   git push -u origin master
   ```

2. **Add Application in Coolify**:
   - In Coolify, navigate to your **Projects** > Click **+ New Resource**.
   - Select **Public Repository** (or **Private Repository** with your GitHub app).
   - Enter your repository URL (e.g., `https://github.com/your-username/ai-voicemail-agent`).
   - Branch: `master` or `main`.

3. **Configure Build Settings**:
   - **Build Pack**: Select **`Dockerfile`**.
   - **Port**: Set to `3050`.

4. **Add Persistent Volume (Critical for SQLite)**:
   - In the application settings, go to the **Storages** tab.
   - Click **+ Add Storage**:
     - **Name**: `voicemail_data`
     - **Destination Path**: `/app/data`
   - Click **Save**.

5. **Set Environment Variables**:
   - In Coolify's **Environment Variables** tab, paste the following:
     ```env
     PORT=3050
     OWNER_NAME=Smit
     OWNER_ROLE=Software Engineer & Builder
     OWNER_STATUS=Currently in deep work. Available after 5:00 PM for urgent matters.
     OWNER_BIO=Specializes in AI systems, full-stack software development, cybersecurity, and cloud automation.
     OWNER_EMAIL=smit@example.com

     # LLM Choice: 'groq', 'openai', or 'ollama'
     LLM_PROVIDER=ollama
     OLLAMA_URL=http://host.docker.internal:11434
     OLLAMA_MODEL=cyber-coder:fast

     # If using Groq (Fastest cloud voice response)
     # GROQ_API_KEY=gsk_...
     # GROQ_MODEL=llama-3.1-8b-instant

     # Twilio Voice
     TWILIO_VOICE=Polly.Matthew-Neural
     TWILIO_LANGUAGE=en-US

     # Optional Discord notification
     # DISCORD_WEBHOOK_URL=https://discord.com/api/webhooks/...
     ```

6. **Assign Domain & Deploy**:
   - Under **General** > **Domains**, enter: `https://call.yourdomain.com`.
   - Click **Deploy**!
   - Coolify will build the Docker container, obtain the SSL certificate, and launch the service.

---

### Method 2: Deploy using Docker Compose

If you prefer deploying directly in Coolify without connecting Git:

1. In Coolify, click **+ New Resource** > **Docker Compose**.
2. Paste the contents of [`docker-compose.yml`](file:///home/ubuntu/ai-voicemail-agent/docker-compose.yml):
3. Set your domain (e.g. `https://call.yourdomain.com`).
4. Click **Deploy**.

---

## 🤖 Configuring Ollama with Coolify

Depending on where Ollama runs, configure `OLLAMA_URL`:

| Scenario | Configuration in Coolify |
|---|---|
| **Ollama is installed directly on your VPS host** | Set `OLLAMA_URL=http://host.docker.internal:11434`. (The included Docker Compose has `extra_hosts` enabled). Ensure Ollama listens on `0.0.0.0` by setting `OLLAMA_HOST=0.0.0.0` in its systemd service. |
| **You want Ollama running inside Coolify** | Deploy using [`docker-compose.with-ollama.yml`](file:///home/ubuntu/ai-voicemail-agent/docker-compose.with-ollama.yml). Both will run in the same stack and communicate over internal Docker network. |
| **Using Groq or OpenAI (No VPS CPU usage)** | Set `LLM_PROVIDER=groq`, `GROQ_API_KEY=gsk_...`. Response time drops to ~300ms, which is ideal for real-time telephone calls! |

---

## 📞 Final Step: Update Twilio Webhook

Now that your app is live at `https://call.yourdomain.com`:

1. Open your [Twilio Console](https://console.twilio.com/) > **Phone Numbers** > **Manage** > **Active numbers**.
2. Click your phone number.
3. Under **Voice Configuration** > **"A CALL COMES IN"**:
   - Webhook URL: `https://call.yourdomain.com/api/twilio/voice`
   - HTTP Method: `HTTP POST`
4. Click **Save Configuration**.

Done! Any call to your Twilio number will now be answered by your self-hosted AI on Coolify.
Voicemails and transcripts will appear live on your Coolify web dashboard at `https://call.yourdomain.com`.
