package dev.smitronix.shadowvoice.service

import android.telecom.Call
import android.telecom.CallScreeningService
import android.util.Log

class ShadowCallScreeningService : CallScreeningService() {

    override fun onScreenCall(callDetails: Call.Details) {
        val phoneNumber = callDetails.handle?.schemeSpecificPart ?: "Unknown"
        Log.d("ShadowCallScreening", "Incoming call from: $phoneNumber")

        // In standard screening, allow the call to pass through to InCallService
        val response = CallResponse.Builder()
            .setDisallowCall(false)
            .setRejectCall(false)
            .setSkipCallLog(false)
            .setSkipNotification(false)
            .build()

        respondToCall(callDetails, response)
    }
}
