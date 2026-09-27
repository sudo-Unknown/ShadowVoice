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

data class HostMetrics(
    val hostname: String?,
    val platform: String?,
    val arch: String?,
    val uptimeSeconds: Long,
    val loadAvg: List<Double>?
)

data class CpuMetrics(
    val cores: Int,
    val model: String?,
    val loadPercent: Double
)

data class MemoryMetrics(
    val totalGB: Double,
    val usedGB: Double,
    val freeGB: Double,
    val usagePercent: Double
)

data class DiskMetrics(
    val totalGB: Double,
    val usedGB: Double,
    val freeGB: Double,
    val usagePercent: Double
)

data class SystemMetricsResponse(
    val host: HostMetrics,
    val cpu: CpuMetrics,
    val memory: MemoryMetrics,
    val disk: DiskMetrics
)

data class ContainerPort(
    val ip: String?,
    val privatePort: Int,
    val publicPort: Int?,
    val type: String?
)

data class DockerContainerItem(
    val id: String,
    val fullId: String?,
    val name: String,
    val image: String?,
    val state: String, // running, exited, etc.
    val status: String,
    val created: Long?,
    val ports: List<ContainerPort>?
)

data class DockerContainersResponse(
    val available: Boolean,
    val total: Int,
    val running: Int,
    val stopped: Int,
    val containers: List<DockerContainerItem>
)

data class AssistantRequest(
    val message: String,
    val history: List<Map<String, String>> = emptyList()
)

data class AssistantAction(
    val type: String?,
    val container: String?,
    val success: Boolean,
    val error: String?
)

data class AssistantResponse(
    val reply: String,
    val executedAction: AssistantAction?,
    val metrics: Map<String, Any>?
)
