package dev.smitronix.shadowvoice.service

import android.content.Context
import android.content.Intent
import android.media.AudioManager
import android.telecom.Call
import android.telecom.InCallService
import android.util.Log
import dev.smitronix.shadowvoice.ui.CallScreenActivity

class ShadowInCallService : InCallService() {

    companion object {
        var currentCall: Call? = null
        var isScreeningActive: Boolean = false

        fun answerCall() {
            currentCall?.answer(0)
        }

        fun disconnectCall() {
            currentCall?.disconnect()
            currentCall = null
            isScreeningActive = false
        }

        fun setSpeakerphone(context: Context, enabled: Boolean) {
            val audioManager = context.getSystemService(Context.AUDIO_SERVICE) as AudioManager
            audioManager.isSpeakerphoneOn = enabled
        }
    }

    private val callCallback = object : Call.Callback() {
        override fun onStateChanged(call: Call, state: Int) {
            when (state) {
                Call.STATE_DISCONNECTED -> {
                    Log.d("ShadowInCallService", "Call disconnected")
                    currentCall = null
                    isScreeningActive = false
                }
                Call.STATE_ACTIVE -> {
                    Log.d("ShadowInCallService", "Call active")
                }
            }
        }
    }

    override fun onCallAdded(call: Call) {
        super.onCallAdded(call)
        currentCall = call
        call.registerCallback(callCallback)

        val phoneNumber = call.details.handle?.schemeSpecificPart ?: "Unknown Caller"
        Log.d("ShadowInCallService", "New call received from: $phoneNumber")

        // Launch CallScreenActivity
        val intent = Intent(this, CallScreenActivity::class.java).apply {
            flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_SINGLE_TOP
            putExtra("CALLER_NUMBER", phoneNumber)
        }
        startActivity(intent)
    }

    override fun onCallRemoved(call: Call) {
        super.onCallRemoved(call)
        call.unregisterCallback(callCallback)
        if (currentCall == call) {
            currentCall = null
            isScreeningActive = false
        }
    }
}
