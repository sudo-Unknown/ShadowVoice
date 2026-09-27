package dev.smitronix.shadowvoice.ui

import android.os.Bundle
import android.util.Log
import android.view.View
import android.widget.Button
import android.widget.TextView
import androidx.appcompat.app.AppCompatActivity
import androidx.lifecycle.lifecycleScope
import dev.smitronix.shadowvoice.R
import dev.smitronix.shadowvoice.ai.ShadowVoiceApiClient
import dev.smitronix.shadowvoice.service.ShadowInCallService
import dev.smitronix.shadowvoice.speech.SpeechManager
import kotlinx.coroutines.launch

class CallScreenActivity : AppCompatActivity() {

    private lateinit var apiClient: ShadowVoiceApiClient
    private lateinit var speechManager: SpeechManager

    private var activeCallId: String? = null
    private var callerNumber: String = "Unknown"
    private var selectedLanguage: String = "auto"

    private lateinit var tvCallerInfo: TextView
    private lateinit var tvStatus: TextView
    private lateinit var tvTranscript: TextView
    private lateinit var btnScreenAi: Button
    private lateinit var btnAnswerPersonal: Button
    private lateinit var btnDecline: Button
    private lateinit var btnTakeOver: Button

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_call_screen)

        callerNumber = intent.getStringExtra("CALLER_NUMBER") ?: "Unknown Caller"
        val prefs = getSharedPreferences("shadow_voice_prefs", MODE_PRIVATE)
        val serverUrl = prefs.getString("server_url", "https://call.smitronix.dev") ?: "https://call.smitronix.dev"
        selectedLanguage = prefs.getString("voice_language", "auto") ?: "auto"

        apiClient = ShadowVoiceApiClient(serverUrl)

        tvCallerInfo = findViewById(R.id.tv_caller_info)
        tvStatus = findViewById(R.id.tv_call_status)
        tvTranscript = findViewById(R.id.tv_transcript)
        btnScreenAi = findViewById(R.id.btn_screen_ai)
        btnAnswerPersonal = findViewById(R.id.btn_answer_personal)
        btnDecline = findViewById(R.id.btn_decline)
        btnTakeOver = findViewById(R.id.btn_take_over)

        tvCallerInfo.text = callerNumber
        tvStatus.text = "Incoming Call..."

        speechManager = SpeechManager(
            context = this,
            onSpeechRecognized = { text ->
                handleCallerSpeech(text)
            },
            onError = { err ->
                Log.w("CallScreen", "Speech error: $err")
            }
        ).apply {
            currentLanguageCode = selectedLanguage
        }

        btnScreenAi.setOnClickListener {
            startAiScreening()
        }

        btnAnswerPersonal.setOnClickListener {
            speechManager.destroy()
            ShadowInCallService.answerCall()
            finish()
        }

        btnDecline.setOnClickListener {
            speechManager.destroy()
            ShadowInCallService.disconnectCall()
            finish()
        }

        btnTakeOver.setOnClickListener {
            speechManager.stopListening()
            tvStatus.text = "Call Taken Over"
            btnTakeOver.visibility = View.GONE
            appendTranscript("System", "You took over the call.")
        }
    }

    private fun startAiScreening() {
        ShadowInCallService.isScreeningActive = true
        ShadowInCallService.answerCall()
        ShadowInCallService.setSpeakerphone(this, true)

        btnScreenAi.visibility = View.GONE
        btnAnswerPersonal.visibility = View.GONE
        btnTakeOver.visibility = View.VISIBLE
        tvStatus.text = "🤖 Screening with AI ($selectedLanguage)..."

        lifecycleScope.launch {
            val result = apiClient.startCall(selectedLanguage)
            result.onSuccess { data ->
                activeCallId = data.callId
                appendTranscript("AI Representative", data.greeting)
                speechManager.speak(data.greeting) {
                    // Start listening for caller's turn
                    speechManager.startListening()
                    tvStatus.text = "Listening to caller..."
                }
            }.onFailure { e ->
                tvStatus.text = "Connection error: ${e.message}"
            }
        }
    }

    private fun handleCallerSpeech(callerSpeech: String) {
        val callId = activeCallId ?: return
        appendTranscript("Caller", callerSpeech)
        tvStatus.text = "AI thinking..."

        lifecycleScope.launch {
            val result = apiClient.sendTurn(callId, callerSpeech)
            result.onSuccess { turn ->
                appendTranscript("AI Representative", turn.replyText)
                speechManager.speak(turn.replyText) {
                    if (turn.isCallEnd) {
                        tvStatus.text = "Call finished. Voicemail saved!"
                        ShadowInCallService.disconnectCall()
                        finish()
                    } else {
                        tvStatus.text = "Listening to caller..."
                        speechManager.startListening()
                    }
                }
            }.onFailure { e ->
                tvStatus.text = "Failed to generate reply: ${e.message}"
            }
        }
    }

    private fun appendTranscript(speaker: String, text: String) {
        runOnUiThread {
            val existing = tvTranscript.text.toString()
            val newEntry = "$speaker: $text\n\n"
            tvTranscript.text = existing + newEntry
        }
    }

    override fun onDestroy() {
        super.onDestroy()
        speechManager.destroy()
    }
}
