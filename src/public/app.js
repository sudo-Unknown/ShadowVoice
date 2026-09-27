// EchoMe AI Voicemail & Call Gatekeeper Frontend Application

let currentTab = 'inbox';
let activeCallId = null;
let callTimerInterval = null;
let callSeconds = 0;
let isSpeaking = false;
let isListening = false;
let recognition = null;
let allVoicemails = [];
let currentFilter = 'all';

// Initialize on DOM Ready
document.addEventListener('DOMContentLoaded', () => {
  initNavigation();
  initVoicemailInbox();
  initSimulator();
  initSettings();
  initSystemStatus();
  updateClock();
  setInterval(updateClock, 1000);
});

/* =========================================================================
   NAVIGATION & TABS
   ========================================================================= */

function initNavigation() {
  const navBtns = document.querySelectorAll('.nav-item');
  navBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const tab = btn.getAttribute('data-tab');
      switchTab(tab);
    });
  });

  document.getElementById('btn-open-simulator')?.addEventListener('click', () => {
    switchTab('simulator');
  });

  document.getElementById('btn-refresh')?.addEventListener('click', () => {
    loadVoicemails();
  });
}

function switchTab(tabId) {
  currentTab = tabId;
  document.querySelectorAll('.nav-item').forEach(b => {
    b.classList.toggle('active', b.getAttribute('data-tab') === tabId);
  });
  document.querySelectorAll('.tab-pane').forEach(p => {
    p.classList.toggle('active', p.id === `tab-${tabId}`);
  });

  const heading = document.getElementById('page-heading');
  const subheading = document.getElementById('page-subheading');

  if (tabId === 'inbox') {
    heading.textContent = 'Voicemail Inbox';
    subheading.textContent = 'Messages and calls answered on your behalf';
    loadVoicemails();
  } else if (tabId === 'simulator') {
    heading.textContent = 'Voice Call Simulator';
    subheading.textContent = 'Test interactive voice answering directly with your microphone';
  } else if (tabId === 'settings') {
    heading.textContent = 'Persona & Knowledge Settings';
    subheading.textContent = 'Customize how your AI represents you, your availability, and FAQs';
    loadSettings();
  } else if (tabId === 'telephony') {
    heading.textContent = 'Twilio Phone Setup';
    subheading.textContent = 'Connect a live phone number to answer actual telephone calls';
  }
}

function updateClock() {
  const clock = document.getElementById('sim-clock');
  if (clock) {
    const d = new Date();
    clock.textContent = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }
}

/* =========================================================================
   VOICEMAIL INBOX
   ========================================================================= */

function initVoicemailInbox() {
  loadVoicemails();

  // Filter Buttons
  document.querySelectorAll('.filter-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      currentFilter = btn.getAttribute('data-filter');
      renderVoicemailList();
    });
  });

  // Search input
  const searchInput = document.getElementById('inbox-search');
  searchInput?.addEventListener('input', () => {
    renderVoicemailList();
  });
}

async function loadVoicemails() {
  try {
    const res = await fetch('/api/voicemails');
    const data = await res.json();
    allVoicemails = data.voicemails || [];

    // Update unread badge in sidebar
    const unreadCount = allVoicemails.filter(v => !v.is_read).length;
    const badge = document.getElementById('unread-count');
    if (badge) badge.textContent = unreadCount;

    renderVoicemailList();
  } catch (err) {
    console.error('Failed to load voicemails:', err);
  }
}

function renderVoicemailList() {
  const listContainer = document.getElementById('voicemail-list');
  const searchVal = document.getElementById('inbox-search')?.value.toLowerCase() || '';

  let filtered = allVoicemails.filter(vm => {
    if (currentFilter === 'unread' && vm.is_read) return false;
    if (currentFilter === 'urgent' && vm.urgency !== 'Urgent' && vm.urgency !== 'High') return false;

    if (searchVal) {
      const matchName = (vm.caller_name || '').toLowerCase().includes(searchVal);
      const matchPurpose = (vm.purpose || '').toLowerCase().includes(searchVal);
      const matchSummary = (vm.summary || '').toLowerCase().includes(searchVal);
      const matchPhone = (vm.caller_phone || '').toLowerCase().includes(searchVal);
      return matchName || matchPurpose || matchSummary || matchPhone;
    }
    return true;
  });

  if (currentFilter === 'urgent') {
    const urgencyOrder = { Urgent: 0, High: 1, Medium: 2, Low: 3 };
    filtered.sort((a, b) => (urgencyOrder[a.urgency] || 9) - (urgencyOrder[b.urgency] || 9));
  }

  if (filtered.length === 0) {
    listContainer.innerHTML = `
      <div class="empty-state">
        <svg viewBox="0 0 24 24" width="48" height="48" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M22 12h-6l-2 3h-4l-2-3H2v7a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-7z"/><path d="M5.45 5.11L2 12v0h20v0l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z"/></svg>
        <h3>No matching voicemails</h3>
        <p>No messages match your current filter or search query.</p>
      </div>
    `;
    return;
  }

  listContainer.innerHTML = filtered.map(vm => {
    const dateStr = formatDateTime(vm.created_at);
    return `
      <div class="vm-item ${vm.is_read ? '' : 'unread'}" onclick="openVoicemail('${vm.call_id}')" data-id="${vm.call_id}">
        <div class="vm-header">
          <span class="vm-caller">${escapeHtml(vm.caller_name || 'Unknown')}</span>
          <span class="vm-time">${dateStr}</span>
        </div>
        <div class="vm-purpose">${escapeHtml(vm.purpose || 'Voicemail')}</div>
        <div class="vm-snippet">${escapeHtml(vm.summary || 'No summary')}</div>
        <div class="vm-footer">
          <span class="badge-urgency ${vm.urgency}">${vm.urgency}</span>
          <span class="badge-channel">${vm.channel === 'web_simulator' ? 'Web Voice' : 'Phone'}</span>
          ${vm.duration_seconds ? `<span class="badge-channel">${vm.duration_seconds}s</span>` : ''}
        </div>
      </div>
    `;
  }).join('');
}

async function openVoicemail(callId) {
  // Mark active item in list
  document.querySelectorAll('.vm-item').forEach(el => {
    el.classList.toggle('active', el.getAttribute('data-id') === callId);
  });

  const detailContainer = document.getElementById('voicemail-detail');
  detailContainer.innerHTML = `<div class="detail-placeholder">Loading voicemail details...</div>`;

  try {
    const res = await fetch(`/api/voicemails/${callId}`);
    const data = await res.json();
    const vm = data.voicemail;

    if (!vm) {
      detailContainer.innerHTML = `<div class="detail-placeholder">Voicemail not found</div>`;
      return;
    }

    // Mark as read
    if (!vm.is_read) {
      fetch(`/api/voicemails/${callId}/read`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_read: 1 })
      });
      vm.is_read = 1;
      const listItem = document.querySelector(`.vm-item[data-id="${callId}"]`);
      if (listItem) listItem.classList.remove('unread');
      // Update badge
      const unreadCount = allVoicemails.filter(v => v.call_id !== callId && !v.is_read).length;
      const badge = document.getElementById('unread-count');
      if (badge) badge.textContent = unreadCount;
    }

    const transcriptsHtml = (vm.transcripts || []).map(t => `
      <div class="bubble ${t.speaker}">
        <div class="bubble-sender">${t.speaker === 'agent' ? 'AI Voicemail' : escapeHtml(vm.caller_name || 'Caller')}</div>
        <div>${escapeHtml(t.text)}</div>
      </div>
    `).join('');

    detailContainer.innerHTML = `
      <div class="detail-header">
        <div class="detail-title-row">
          <div>
            <h3 style="font-size: 1.25rem; font-weight: 700;">${escapeHtml(vm.caller_name || 'Unknown')}</h3>
            <span style="font-size: 0.85rem; color: #818cf8;">${escapeHtml(vm.caller_phone || 'No phone number provided')}</span>
          </div>
          <div class="detail-actions">
            <span class="badge-urgency ${vm.urgency}">${vm.urgency}</span>
            <button class="btn btn-sm btn-secondary" onclick="deleteVoicemailItem('${callId}')" title="Delete">
              <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
            </button>
          </div>
        </div>
        <div class="detail-meta">
          <span>📅 ${formatDateTime(vm.created_at)}</span>
          <span>⏱️ ${vm.duration_seconds || 0} seconds</span>
          <span>📶 ${vm.channel === 'web_simulator' ? 'Web Simulator' : 'Twilio Voice Call'}</span>
        </div>
      </div>

      <div class="detail-section-title">Topic / Purpose</div>
      <p style="font-weight: 600; margin-bottom: 1rem; color: #e2e8f0;">${escapeHtml(vm.purpose || 'None')}</p>

      <div class="detail-section-title">Message Summary</div>
      <div class="detail-summary-box">
        ${escapeHtml(vm.summary || 'No summary available.')}
      </div>

      <div class="detail-section-title">Action Items for You</div>
      <div class="detail-actions-box">
        ${escapeHtml(vm.action_items || 'None')}
      </div>

      <div class="detail-section-title" style="margin-top: 0.5rem; margin-bottom: 0.75rem;">Full Call Transcript</div>
      <div class="transcript-dialog">
        ${transcriptsHtml || '<p style="color: var(--text-dim); font-size: 0.85rem;">No conversation turns recorded.</p>'}
      </div>
    `;
  } catch (err) {
    console.error('Failed to load voicemail detail:', err);
  }
}

async function deleteVoicemailItem(callId) {
  if (!confirm('Are you sure you want to delete this voicemail?')) return;
  try {
    await fetch(`/api/voicemails/${callId}`, { method: 'DELETE' });
    allVoicemails = allVoicemails.filter(v => v.call_id !== callId);
    renderVoicemailList();
    document.getElementById('voicemail-detail').innerHTML = `
      <div class="detail-placeholder">
        <p>Voicemail deleted</p>
      </div>
    `;
  } catch (err) {
    alert('Failed to delete voicemail');
  }
}

/* =========================================================================
   VOICE SIMULATOR (Microphone + Speech Synthesis)
   ========================================================================= */

function initSimulator() {
  const startBtn = document.getElementById('btn-start-call');
  const hangupBtn = document.getElementById('btn-hang-up');
  const micBtn = document.getElementById('btn-toggle-mic');
  const sendTextBtn = document.getElementById('btn-send-sim-text');
  const textInput = document.getElementById('sim-text-input');

  startBtn?.addEventListener('click', startSimulatedCall);
  hangupBtn?.addEventListener('click', endSimulatedCall);

  micBtn?.addEventListener('click', () => {
    if (isListening) {
      stopListening();
    } else {
      startListening();
    }
  });

  sendTextBtn?.addEventListener('click', () => {
    const text = textInput.value.trim();
    if (text) {
      textInput.value = '';
      handleUserTurn(text);
    }
  });

  textInput?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      const text = textInput.value.trim();
      if (text) {
        textInput.value = '';
        handleUserTurn(text);
      }
    }
  });

  // Setup Web Speech API SpeechRecognition if supported
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (SpeechRecognition) {
    recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.lang = 'en-US';

    recognition.onresult = (event) => {
      const speech = event.results[0][0].transcript;
      console.log('Recognized speech:', speech);
      stopListening();
      handleUserTurn(speech);
    };

    recognition.onerror = (event) => {
      console.warn('Speech recognition error:', event.error);
      stopListening();
      setDialogSubtitle('System', 'Could not hear microphone speech. You can type below.');
    };

    recognition.onend = () => {
      stopListening();
    };
  } else {
    console.warn('Web Speech Recognition API not supported in this browser. Falling back to text input.');
  }
}

async function startSimulatedCall() {
  document.getElementById('sim-idle-view').classList.add('hidden');
  document.getElementById('sim-active-view').classList.remove('hidden');

  callSeconds = 0;
  clearInterval(callTimerInterval);
  callTimerInterval = setInterval(() => {
    callSeconds++;
    const mins = String(Math.floor(callSeconds / 60)).padStart(2, '0');
    const secs = String(callSeconds % 60).padStart(2, '0');
    const timerEl = document.getElementById('sim-call-timer');
    if (timerEl) timerEl.textContent = `${mins}:${secs}`;
  }, 1000);

  const feed = document.getElementById('sim-transcript-feed');
  feed.innerHTML = '';

  setDialogSubtitle('System', 'Connecting call...');
  setWaveState('idle');

  try {
    const selectedLang = document.getElementById('sim-lang-select')?.value || 'auto';
    const res = await fetch('/api/simulator/start', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ language: selectedLang })
    });
    const data = await res.json();
    activeCallId = data.callId;

    // AI Greeting
    setDialogSubtitle('AI Representative', data.greeting);
    addTurnToFeed('agent', data.greeting);
    await speakAloud(data.greeting, data.language || selectedLang);

    // Prompt user to speak
    startListening();
  } catch (err) {
    console.error('Error starting simulator:', err);
    setDialogSubtitle('System', 'Failed to connect voice agent.');
  }
}

async function handleUserTurn(userSpeech) {
  if (!activeCallId) return;

  addTurnToFeed('caller', userSpeech);
  setDialogSubtitle('You (Caller)', userSpeech);
  setWaveState('processing');

  try {
    const res = await fetch('/api/simulator/turn', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        callId: activeCallId,
        speechText: userSpeech
      })
    });

    const data = await res.json();
    const reply = data.replyText;
    const isCallEnd = data.isCallEnd;

    setDialogSubtitle('AI Representative', reply);
    addTurnToFeed('agent', reply);
    await speakAloud(reply);

    if (isCallEnd) {
      setDialogSubtitle('System', 'Call concluded. Voicemail has been saved!');
      setTimeout(() => {
        endSimulatedCall();
      }, 2000);
    } else {
      // Continue conversation: listen for next caller turn
      startListening();
    }
  } catch (err) {
    console.error('Turn error:', err);
    setDialogSubtitle('System', 'Error generating response.');
    setWaveState('idle');
  }
}

async function endSimulatedCall() {
  stopListening();
  window.speechSynthesis?.cancel();
  clearInterval(callTimerInterval);

  if (activeCallId) {
    try {
      await fetch('/api/simulator/end', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ callId: activeCallId })
      });
    } catch (e) {
      console.warn('End call notification failed', e);
    }
  }

  activeCallId = null;
  setWaveState('idle');

  document.getElementById('sim-active-view').classList.add('hidden');
  document.getElementById('sim-idle-view').classList.remove('hidden');

  // Refresh inbox in case voicemail was saved
  loadVoicemails();
}

function startListening() {
  if (!recognition) return;
  try {
    isListening = true;
    const micBtn = document.getElementById('btn-toggle-mic');
    micBtn?.classList.add('active');

    const selectedLang = document.getElementById('sim-lang-select')?.value || 'auto';
    if (selectedLang === 'mr-IN') {
      recognition.lang = 'mr-IN';
      setDialogSubtitle('You', 'ऐकत आहे... (मायक्रोफोनमध्ये बोला)');
    } else if (selectedLang === 'hi-IN') {
      recognition.lang = 'hi-IN';
      setDialogSubtitle('You', 'सुन रहा हूँ... (माइक्रोफ़ोन में बोलिए)');
    } else if (selectedLang === 'en-IN') {
      recognition.lang = 'en-IN';
      setDialogSubtitle('You', 'Listening... (speak into microphone)');
    } else if (selectedLang === 'en-US') {
      recognition.lang = 'en-US';
      setDialogSubtitle('You', 'Listening... (speak into microphone)');
    } else {
      // Auto: set hi-IN which parses English, Hindi, and code-mixed speech gracefully in Chrome Web Speech
      recognition.lang = 'hi-IN';
      setDialogSubtitle('You', 'Listening... (Speak in English, हिन्दी, or मराठी)');
    }

    setWaveState('listening');
    recognition.start();
  } catch (e) {
    // Might already be started
  }
}

function stopListening() {
  isListening = false;
  const micBtn = document.getElementById('btn-toggle-mic');
  micBtn?.classList.remove('active');
  try {
    recognition?.stop();
  } catch (e) {}
  if (!isSpeaking) setWaveState('idle');
}

function speakAloud(text, forcedLang = null) {
  return new Promise((resolve) => {
    if (!('speechSynthesis' in window)) {
      resolve();
      return;
    }

    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 0.98;
    utterance.pitch = 1.0;

    const voices = window.speechSynthesis.getVoices();
    const selectedLang = forcedLang || document.getElementById('sim-lang-select')?.value || 'auto';
    const hasDevanagari = /[\u0900-\u097F]/.test(text);

    let chosenVoice = null;
    let targetLang = 'en-US';

    if (hasDevanagari || selectedLang === 'mr-IN' || selectedLang === 'hi-IN') {
      const isMarathi = selectedLang === 'mr-IN' || /आहे|नाही|नमस्कार|स्मित|कळवीन|सांगा|होय|दिवस|काही|तुमचा|माझा|बोलायचं|केल्याबद्दल/i.test(text);

      if (isMarathi) {
        targetLang = 'mr-IN';
        // 1. Try dedicated Marathi voice
        chosenVoice = voices.find(v => v.lang.startsWith('mr') || v.name.toLowerCase().includes('marathi'));
        // 2. If browser lacks Marathi voice pack, fallback to Hindi voice which accurately pronounces Devanagari phonetics
        if (!chosenVoice) {
          chosenVoice = voices.find(v => v.lang.startsWith('hi') || v.name.toLowerCase().includes('hindi') || v.name.includes('Lekha') || v.name.includes('Kajal') || v.name.includes('Aditi'));
        }
      } else {
        targetLang = 'hi-IN';
        // Dedicated Hindi voice
        chosenVoice = voices.find(v => v.lang.startsWith('hi') || v.name.toLowerCase().includes('hindi') || v.name.includes('Lekha') || v.name.includes('Kajal') || v.name.includes('Aditi'));
      }
    } else if (selectedLang === 'en-IN') {
      targetLang = 'en-IN';
      chosenVoice = voices.find(v => v.lang === 'en-IN' || v.name.includes('India') || v.name.includes('Ravi') || v.name.includes('Heera'));
    }

    // Default to natural English if no Indian/Devanagari voice selected
    if (!chosenVoice) {
      chosenVoice = voices.find(v => v.lang.startsWith('en') && (v.name.includes('Natural') || v.name.includes('Google') || v.name.includes('Samantha')));
    }

    if (chosenVoice) {
      utterance.voice = chosenVoice;
      utterance.lang = chosenVoice.lang || targetLang;
    } else {
      utterance.lang = targetLang;
    }

    setWaveState('speaking');
    isSpeaking = true;

    utterance.onend = () => {
      isSpeaking = false;
      setWaveState('idle');
      resolve();
    };

    utterance.onerror = () => {
      isSpeaking = false;
      setWaveState('idle');
      resolve();
    };

    window.speechSynthesis.speak(utterance);
  });
}

function setWaveState(state) {
  const wave = document.getElementById('sim-wave');
  if (!wave) return;
  wave.className = 'audio-wave-container';
  if (state === 'speaking' || state === 'listening') {
    wave.classList.add('speaking');
  }
}

function setDialogSubtitle(speaker, text) {
  const sEl = document.getElementById('sim-speaker-name');
  const tEl = document.getElementById('sim-dialog-text');
  if (sEl) sEl.textContent = speaker;
  if (tEl) tEl.textContent = text;
}

function addTurnToFeed(speaker, text) {
  const feed = document.getElementById('sim-transcript-feed');
  if (!feed) return;

  const empty = feed.querySelector('.empty-feed');
  if (empty) empty.remove();

  const bubble = document.createElement('div');
  bubble.className = `bubble ${speaker}`;
  bubble.innerHTML = `
    <div class="bubble-sender">${speaker === 'agent' ? 'AI Voicemail' : 'Caller'}</div>
    <div>${escapeHtml(text)}</div>
  `;
  feed.appendChild(bubble);
  feed.scrollTop = feed.scrollHeight;
}

/* =========================================================================
   SETTINGS & KNOWLEDGE BASE
   ========================================================================= */

function initSettings() {
  loadSettings();

  document.getElementById('btn-save-settings')?.addEventListener('click', saveSettings);

  // Quick Status Chips
  document.querySelectorAll('.status-chip').forEach(chip => {
    chip.addEventListener('click', () => {
      const statusText = chip.getAttribute('data-status');
      const textarea = document.getElementById('set-owner-status');
      if (textarea) textarea.value = statusText;
    });
  });
}

async function loadSettings() {
  try {
    const res = await fetch('/api/settings');
    const data = await res.json();
    const s = data.settings || {};

    if (document.getElementById('set-owner-name')) document.getElementById('set-owner-name').value = s.owner_name || '';
    if (document.getElementById('set-owner-role')) document.getElementById('set-owner-role').value = s.owner_role || '';
    if (document.getElementById('set-owner-email')) document.getElementById('set-owner-email').value = s.owner_email || '';
    if (document.getElementById('set-owner-status')) document.getElementById('set-owner-status').value = s.owner_status || '';
    if (document.getElementById('set-owner-bio')) document.getElementById('set-owner-bio').value = s.owner_bio || '';
    if (document.getElementById('set-custom-instructions')) document.getElementById('set-custom-instructions').value = s.custom_instructions || '';
    if (document.getElementById('set-default-lang') && s.default_language) document.getElementById('set-default-lang').value = s.default_language;
    if (document.getElementById('sim-lang-select') && s.default_language) document.getElementById('sim-lang-select').value = s.default_language;

    // Update active caller title in simulator
    const simOwnerTitle = document.getElementById('sim-owner-title');
    if (simOwnerTitle && s.owner_name) {
      simOwnerTitle.textContent = `${s.owner_name}'s AI Assistant`;
    }
  } catch (err) {
    console.error('Failed to load settings:', err);
  }
}

async function saveSettings() {
  const updates = {
    owner_name: document.getElementById('set-owner-name')?.value.trim(),
    owner_role: document.getElementById('set-owner-role')?.value.trim(),
    owner_email: document.getElementById('set-owner-email')?.value.trim(),
    owner_status: document.getElementById('set-owner-status')?.value.trim(),
    owner_bio: document.getElementById('set-owner-bio')?.value.trim(),
    custom_instructions: document.getElementById('set-custom-instructions')?.value.trim(),
    default_language: document.getElementById('set-default-lang')?.value || 'auto'
  };

  const statusMsg = document.getElementById('save-status-msg');
  if (statusMsg) statusMsg.textContent = 'Saving...';

  try {
    const res = await fetch('/api/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates)
    });
    if (res.ok) {
      if (statusMsg) statusMsg.textContent = '✓ Saved successfully!';
      setTimeout(() => { if (statusMsg) statusMsg.textContent = ''; }, 3000);
      loadSettings();
    } else {
      if (statusMsg) statusMsg.textContent = '✗ Error saving settings';
    }
  } catch (err) {
    if (statusMsg) statusMsg.textContent = '✗ Error saving settings';
  }
}

/* =========================================================================
   SYSTEM STATUS
   ========================================================================= */

async function initSystemStatus() {
  try {
    const res = await fetch('/api/status');
    const data = await res.json();

    const dot = document.querySelector('.status-dot');
    const statusText = document.getElementById('sys-status-text');
    const modelMeta = document.getElementById('sys-model-meta');

    if (data.status === 'online') {
      if (dot) dot.className = 'status-dot online';
      if (statusText) statusText.textContent = data.ollamaConnected ? 'AI Engine Ready' : 'Server Online';
      if (modelMeta) modelMeta.textContent = `${data.llmProvider.toUpperCase()}: ${data.activeModel || 'fast'}`;
    }
  } catch (err) {
    console.warn('Status poll failed:', err);
  }
}

/* =========================================================================
   HELPERS
   ========================================================================= */

function formatDateTime(isoString) {
  if (!isoString) return '';
  const date = new Date(isoString);
  const now = new Date();
  const isToday = date.toDateString() === now.toDateString();

  if (isToday) {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }
  return date.toLocaleDateString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
