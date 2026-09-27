package dev.smitronix.shadowvoice.service

import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.content.pm.ServiceInfo
import android.media.AudioManager
import android.os.Build
import android.os.IBinder
import android.telecom.TelecomManager
import android.telephony.TelephonyManager
import android.util.Log
import androidx.core.app.NotificationCompat
import androidx.core.content.ContextCompat
import dev.smitronix.shadowvoice.R
import dev.smitronix.shadowvoice.ui.CallScreenActivity
import kotlinx.coroutines.*

class AutoVoicemailService : Service() {

    companion object {
        const val TAG = "AutoVoicemailService"
        const val CHANNEL_ID = "shadowvoice_auto_voicemail_channel"
        const val NOTIFICATION_ID = 20261

        const val ACTION_INCOMING_RING = "dev.smitronix.shadowvoice.ACTION_INCOMING_RING"
        const val ACTION_ANSWER_NOW = "dev.smitronix.shadowvoice.ACTION_ANSWER_NOW"
        const val ACTION_CANCEL_OR_DISMISS = "dev.smitronix.shadowvoice.ACTION_CANCEL_OR_DISMISS"

        const val EXTRA_CALLER_NUMBER = "EXTRA_CALLER_NUMBER"
    }

    private val serviceScope = CoroutineScope(Dispatchers.Main + Job())
    private var countdownJob: Job? = null
    private var activeCallerNumber: String = "Unknown Caller"

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onCreate() {
        super.onCreate()
        createNotificationChannel()
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        val action = intent?.action ?: return START_NOT_STICKY

        when (action) {
            ACTION_INCOMING_RING -> {
                activeCallerNumber = intent.getStringExtra(EXTRA_CALLER_NUMBER) ?: "Unknown Caller"
                startRingCountdown()
            }
            ACTION_ANSWER_NOW -> {
                answerCallWithAi()
            }
            ACTION_CANCEL_OR_DISMISS -> {
                stopCountdownAndSelf()
            }
        }

        return START_NOT_STICKY
    }

    private fun startRingCountdown() {
        val prefs = getSharedPreferences("shadow_voice_prefs", Context.MODE_PRIVATE)
        val delaySeconds = prefs.getInt("auto_answer_delay_seconds", 18)

        // Show initial ongoing foreground notification
        val notification = buildCountdownNotification(delaySeconds)
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                startForeground(NOTIFICATION_ID, notification, ServiceInfo.FOREGROUND_SERVICE_TYPE_PHONE_CALL)
            } else {
                startForeground(NOTIFICATION_ID, notification)
            }
        } catch (e: Exception) {
            Log.e(TAG, "Error starting foreground service: ${e.message}")
            startForeground(NOTIFICATION_ID, notification)
        }

        countdownJob?.cancel()
        countdownJob = serviceScope.launch {
            for (remaining in delaySeconds downTo 1) {
                updateNotification(remaining)
                delay(1000L)

                // Double check telephony state: if phone stopped ringing, stop
                val telephony = getSystemService(Context.TELEPHONY_SERVICE) as? TelephonyManager
                val state = telephony?.callState
                if (state != null && state != TelephonyManager.CALL_STATE_RINGING) {
                    Log.d(TAG, "Call is no longer ringing (state: $state). Cancelling countdown.")
                    stopCountdownAndSelf()
                    return@launch
                }
            }

            // Time expired: auto-answer with AI!
            Log.d(TAG, "Timeout reached! Auto-answering call with AI Voicemail...")
            answerCallWithAi()
        }
    }

    private fun answerCallWithAi() {
        countdownJob?.cancel()

        try {
            val telecomManager = getSystemService(Context.TELECOM_SERVICE) as? TelecomManager
            if (ContextCompat.checkSelfPermission(this, android.Manifest.permission.ANSWER_PHONE_CALLS) == PackageManager.PERMISSION_GRANTED) {
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                    telecomManager?.acceptRingingCall()
                    Log.d(TAG, "acceptRingingCall() invoked successfully")
                }
            } else {
                Log.w(TAG, "Missing ANSWER_PHONE_CALLS permission")
            }

            // Route audio to speakerphone
            val audioManager = getSystemService(Context.AUDIO_SERVICE) as? AudioManager
            audioManager?.mode = AudioManager.MODE_IN_COMMUNICATION
            audioManager?.isSpeakerphoneOn = true

            // Launch CallScreenActivity in auto-screen mode
            val screenIntent = Intent(this, CallScreenActivity::class.java).apply {
                flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_SINGLE_TOP or Intent.FLAG_ACTIVITY_CLEAR_TOP
                putExtra("CALLER_NUMBER", activeCallerNumber)
                putExtra("AUTO_SCREEN", true)
            }
            startActivity(screenIntent)

        } catch (e: Exception) {
            Log.e(TAG, "Failed to answer call with AI: ${e.message}", e)
        } finally {
            stopCountdownAndSelf()
        }
    }

    private fun stopCountdownAndSelf() {
        countdownJob?.cancel()
        stopForeground(STOP_FOREGROUND_REMOVE)
        stopSelf()
    }

    private fun buildCountdownNotification(secondsLeft: Int) =
        NotificationCompat.Builder(this, CHANNEL_ID)
            .setSmallIcon(R.drawable.ic_launcher)
            .setContentTitle("📞 Call from $activeCallerNumber")
            .setContentText("Ringing... AI Voicemail answers in ${secondsLeft}s")
            .setPriority(NotificationCompat.PRIORITY_HIGH)
            .setCategory(NotificationCompat.CATEGORY_CALL)
            .setOngoing(true)
            .addAction(
                R.drawable.ic_launcher,
                "🤖 Answer with AI Now",
                getAnswerNowPendingIntent()
            )
            .addAction(
                R.drawable.ic_launcher,
                "❌ Ignore",
                getDismissPendingIntent()
            )
            .build()

    private fun updateNotification(secondsLeft: Int) {
        val notificationManager = getSystemService(Context.NOTIFICATION_SERVICE) as? NotificationManager
        notificationManager?.notify(NOTIFICATION_ID, buildCountdownNotification(secondsLeft))
    }

    private fun getAnswerNowPendingIntent(): PendingIntent {
        val intent = Intent(this, AutoVoicemailService::class.java).apply {
            action = ACTION_ANSWER_NOW
        }
        return PendingIntent.getService(this, 1, intent, PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)
    }

    private fun getDismissPendingIntent(): PendingIntent {
        val intent = Intent(this, AutoVoicemailService::class.java).apply {
            action = ACTION_CANCEL_OR_DISMISS
        }
        return PendingIntent.getService(this, 2, intent, PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)
    }

    private fun createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channel = NotificationChannel(
                CHANNEL_ID,
                "ShadowVoice Live Voicemail",
                NotificationManager.IMPORTANCE_HIGH
            ).apply {
                description = "Shows live status and countdown when incoming phone calls ring"
            }
            val manager = getSystemService(NotificationManager::class.java)
            manager?.createNotificationChannel(channel)
        }
    }

    override fun onDestroy() {
        super.onDestroy()
        serviceScope.cancel()
    }
}
