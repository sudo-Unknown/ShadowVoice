package dev.smitronix.shadowvoice.receiver

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.telephony.TelephonyManager
import android.util.Log
import androidx.core.content.ContextCompat
import dev.smitronix.shadowvoice.service.AutoVoicemailService

class CallStateReceiver : BroadcastReceiver() {

    override fun onReceive(context: Context, intent: Intent) {
        if (intent.action != TelephonyManager.ACTION_PHONE_STATE_CHANGED) return

        val stateStr = intent.getStringExtra(TelephonyManager.EXTRA_STATE) ?: return
        val incomingNumber = intent.getStringExtra(TelephonyManager.EXTRA_INCOMING_NUMBER) ?: "Unknown Caller"

        Log.d("CallStateReceiver", "Phone state changed: $stateStr, number: $incomingNumber")

        val prefs = context.getSharedPreferences("shadow_voice_prefs", Context.MODE_PRIVATE)
        val isAutoVoicemailEnabled = prefs.getBoolean("auto_voicemail_enabled", true)

        if (!isAutoVoicemailEnabled) {
            Log.d("CallStateReceiver", "Live Voicemail is disabled in settings.")
            return
        }

        when (stateStr) {
            TelephonyManager.EXTRA_STATE_RINGING -> {
                Log.d("CallStateReceiver", "Incoming call ringing. Starting AutoVoicemailService...")
                val serviceIntent = Intent(context, AutoVoicemailService::class.java).apply {
                    action = AutoVoicemailService.ACTION_INCOMING_RING
                    putExtra(AutoVoicemailService.EXTRA_CALLER_NUMBER, incomingNumber)
                }
                try {
                    ContextCompat.startForegroundService(context, serviceIntent)
                } catch (e: Exception) {
                    Log.e("CallStateReceiver", "Failed to start AutoVoicemailService: ${e.message}")
                }
            }
            TelephonyManager.EXTRA_STATE_OFFHOOK,
            TelephonyManager.EXTRA_STATE_IDLE -> {
                Log.d("CallStateReceiver", "Call state transitioned to $stateStr. Dismissing auto-answer timer.")
                val cancelIntent = Intent(context, AutoVoicemailService::class.java).apply {
                    action = AutoVoicemailService.ACTION_CANCEL_OR_DISMISS
                }
                try {
                    context.startService(cancelIntent)
                } catch (e: Exception) {
                    // Ignored if service is already stopped
                }
            }
        }
    }
}
