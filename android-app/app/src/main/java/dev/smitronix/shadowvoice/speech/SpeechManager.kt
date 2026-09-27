package dev.smitronix.shadowvoice.speech

import android.content.Context
import android.content.Intent
import android.os.Bundle
import android.speech.RecognitionListener
import android.speech.RecognizerIntent
import android.speech.SpeechRecognizer
import android.speech.tts.TextToSpeech
import android.speech.tts.UtteranceProgressListener
import android.util.Log
import java.util.Locale

class SpeechManager(
    private val context: Context,
    private val onSpeechRecognized: (String) -> Unit,
    private val onError: (String) -> Unit
) : TextToSpeech.OnInitListener {

    private val tag = "ShadowSpeechManager"

    private var tts: TextToSpeech? = null
    private var isTtsReady = false
    private var speechRecognizer: SpeechRecognizer? = null

    var currentLanguageCode: String = "auto"

    private val localeMarathi = Locale("mr", "IN")
    private val localeHindi = Locale("hi", "IN")
    private val localeIndianEnglish = Locale("en", "IN")
    private val localeUsEnglish = Locale("en", "US")

    init {
        tts = TextToSpeech(context, this)
        initSpeechRecognizer()
    }

    override fun onInit(status: Int) {
        if (status == TextToSpeech.SUCCESS) {
            isTtsReady = true
            Log.d(tag, "TextToSpeech initialized successfully.")
            applyLanguageToTts(currentLanguageCode)
        } else {
            Log.e(tag, "TextToSpeech initialization failed with status $status")
        }
    }

    private fun initSpeechRecognizer() {
        if (SpeechRecognizer.isRecognitionAvailable(context)) {
            speechRecognizer = SpeechRecognizer.createSpeechRecognizer(context).apply {
                setRecognitionListener(object : RecognitionListener {
                    override fun onReadyForSpeech(params: Bundle?) {}
                    override fun onBeginningOfSpeech() {}
                    override fun onRmsChanged(rmsdB: Float) {}
                    override fun onBufferReceived(buffer: ByteArray?) {}
                    override fun onEndOfSpeech() {}
                    override fun onError(error: Int) {
                        Log.w(tag, "Speech recognition error: $error")
                        // If no speech input detected, retry listening after brief delay
                        if (error == SpeechRecognizer.ERROR_NO_MATCH || error == SpeechRecognizer.ERROR_SPEECH_TIMEOUT) {
                            startListening()
                        } else {
                            onError("Speech recognition error: $error")
                        }
                    }

                    override fun onResults(results: Bundle?) {
                        val matches = results?.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION)
                        val text = matches?.firstOrNull() ?: ""
                        if (text.isNotBlank()) {
                            onSpeechRecognized(text)
                        }
                    }

                    override fun onPartialResults(partialResults: Bundle?) {}
                    override fun onEvent(eventType: Int, params: Bundle?) {}
                })
            }
        }
    }

    fun startListening() {
        val intent = Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH).apply {
            putExtra(RecognizerIntent.EXTRA_LANGUAGE_MODEL, RecognizerIntent.LANGUAGE_MODEL_FREE_FORM)
            putExtra(RecognizerIntent.EXTRA_PARTIAL_RESULTS, false)
            putExtra(RecognizerIntent.EXTRA_MAX_RESULTS, 1)

            val targetLang = when (currentLanguageCode) {
                "mr-IN" -> "mr-IN"
                "hi-IN" -> "hi-IN"
                "en-IN" -> "en-IN"
                else -> "hi-IN" // hi-IN parses English, Hindi, and code-mixed speech gracefully
            }
            putExtra(RecognizerIntent.EXTRA_LANGUAGE, targetLang)
            putExtra(RecognizerIntent.EXTRA_LANGUAGE_PREFERENCE, targetLang)
        }
        speechRecognizer?.startListening(intent)
    }

    fun stopListening() {
        try {
            speechRecognizer?.stopListening()
        } catch (e: Exception) {
            Log.w(tag, "Error stopping recognizer: ${e.message}")
        }
    }

    fun speak(text: String, onDone: () -> Unit) {
        if (!isTtsReady || tts == null) {
            onDone()
            return
        }

        // Auto-detect Marathi / Hindi from Devanagari script
        val hasDevanagari = text.any { it in '\u0900'..'\u097F' }
        if (hasDevanagari || currentLanguageCode == "mr-IN" || currentLanguageCode == "hi-IN") {
            val isMarathi = currentLanguageCode == "mr-IN" ||
                text.contains("आहे") || text.contains("नमस्कार") || text.contains("नाही") ||
                text.contains("स्मित") || text.contains("कळवीन") || text.contains("सांगा")

            val targetLocale = if (isMarathi) localeMarathi else localeHindi
            val res = tts?.setLanguage(targetLocale)
            if (res == TextToSpeech.LANG_MISSING_DATA || res == TextToSpeech.LANG_NOT_SUPPORTED) {
                // Fallback to Hindi if Marathi voice pack is missing on device
                tts?.language = localeHindi
            }
        } else if (currentLanguageCode == "en-IN") {
            tts?.language = localeIndianEnglish
        } else {
            tts?.language = localeUsEnglish
        }

        tts?.setOnUtteranceProgressListener(object : UtteranceProgressListener() {
            override fun onStart(utteranceId: String?) {}
            override fun onDone(utteranceId: String?) {
                onDone()
            }
            override fun onError(utteranceId: String?) {
                onDone()
            }
        })

        val utteranceId = "utterance_${System.currentTimeMillis()}"
        tts?.speak(text, TextToSpeech.QUEUE_FLUSH, null, utteranceId)
    }

    private fun applyLanguageToTts(langCode: String) {
        val targetLocale = when (langCode) {
            "mr-IN" -> localeMarathi
            "hi-IN" -> localeHindi
            "en-IN" -> localeIndianEnglish
            else -> localeUsEnglish
        }
        tts?.language = targetLocale
    }

    fun destroy() {
        try {
            speechRecognizer?.destroy()
            tts?.stop()
            tts?.shutdown()
        } catch (e: Exception) {
            Log.w(tag, "Error tearing down speech components: ${e.message}")
        }
    }
}
