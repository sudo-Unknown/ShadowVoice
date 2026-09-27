package dev.smitronix.shadowvoice.model

data class SimulatorStartRequest(
    val language: String = "auto"
)

data class SimulatorStartResponse(
    val callId: String,
    val greeting: String,
    val language: String? = null
)

data class SimulatorTurnRequest(
    val callId: String,
    val speechText: String
)

data class SimulatorTurnResponse(
    val replyText: String,
    val isCallEnd: Boolean
)

data class VoicemailItem(
    val id: Int,
    val call_id: String,
    val caller_name: String?,
    val caller_phone: String?,
    val purpose: String?,
    val summary: String?,
    val action_items: String?,
    val urgency: String?,
    val is_read: Int,
    val created_at: String?,
    val channel: String?,
    val duration_seconds: Int?
)

data class VoicemailListResponse(
    val voicemails: List<VoicemailItem>
)

data class SystemStatusResponse(
    val status: String,
    val uptime: Long,
    val llmProvider: String,
    val ollamaConnected: Boolean,
    val activeModel: String?,
    val port: Int
)
