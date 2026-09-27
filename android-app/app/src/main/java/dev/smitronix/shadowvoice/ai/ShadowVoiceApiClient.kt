package dev.smitronix.shadowvoice.ai

import com.google.gson.Gson
import dev.smitronix.shadowvoice.model.*
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import java.util.concurrent.TimeUnit

class ShadowVoiceApiClient(var baseUrl: String = "https://call.smitronix.dev") {

    private val gson = Gson()
    private val jsonMediaType = "application/json; charset=utf-8".toMediaType()

    private val client = OkHttpClient.Builder()
        .connectTimeout(15, TimeUnit.SECONDS)
        .readTimeout(30, TimeUnit.SECONDS)
        .writeTimeout(15, TimeUnit.SECONDS)
        .build()

    suspend fun startCall(language: String = "auto"): Result<SimulatorStartResponse> = withContext(Dispatchers.IO) {
        try {
            val json = gson.toJson(SimulatorStartRequest(language = language))
            val body = json.toRequestBody(jsonMediaType)
            val request = Request.Builder()
                .url("$baseUrl/api/simulator/start")
                .post(body)
                .build()

            client.newCall(request).execute().use { response ->
                if (!response.isSuccessful) {
                    return@withContext Result.failure(Exception("HTTP ${response.code}"))
                }
                val respBody = response.body?.string() ?: ""
                val data = gson.fromJson(respBody, SimulatorStartResponse::class.java)
                Result.success(data)
            }
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    suspend fun sendTurn(callId: String, speechText: String): Result<SimulatorTurnResponse> = withContext(Dispatchers.IO) {
        try {
            val json = gson.toJson(SimulatorTurnRequest(callId = callId, speechText = speechText))
            val body = json.toRequestBody(jsonMediaType)
            val request = Request.Builder()
                .url("$baseUrl/api/simulator/turn")
                .post(body)
                .build()

            client.newCall(request).execute().use { response ->
                if (!response.isSuccessful) {
                    return@withContext Result.failure(Exception("HTTP ${response.code}"))
                }
                val respBody = response.body?.string() ?: ""
                val data = gson.fromJson(respBody, SimulatorTurnResponse::class.java)
                Result.success(data)
            }
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    suspend fun endCall(callId: String): Result<Boolean> = withContext(Dispatchers.IO) {
        try {
            val json = "{\"callId\":\"$callId\"}"
            val body = json.toRequestBody(jsonMediaType)
            val request = Request.Builder()
                .url("$baseUrl/api/simulator/end")
                .post(body)
                .build()

            client.newCall(request).execute().use { response ->
                Result.success(response.isSuccessful)
            }
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    suspend fun fetchVoicemails(): Result<List<VoicemailItem>> = withContext(Dispatchers.IO) {
        try {
            val request = Request.Builder()
                .url("$baseUrl/api/voicemails")
                .get()
                .build()

            client.newCall(request).execute().use { response ->
                if (!response.isSuccessful) {
                    return@withContext Result.failure(Exception("HTTP ${response.code}"))
                }
                val respBody = response.body?.string() ?: ""
                val data = gson.fromJson(respBody, VoicemailListResponse::class.java)
                Result.success(data.voicemails)
            }
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    suspend fun checkServerStatus(): Result<SystemStatusResponse> = withContext(Dispatchers.IO) {
        try {
            val request = Request.Builder()
                .url("$baseUrl/api/status")
                .get()
                .build()

            client.newCall(request).execute().use { response ->
                if (!response.isSuccessful) {
                    return@withContext Result.failure(Exception("HTTP ${response.code}"))
                }
                val respBody = response.body?.string() ?: ""
                val data = gson.fromJson(respBody, SystemStatusResponse::class.java)
                Result.success(data)
            }
        } catch (e: Exception) {
            Result.failure(e)
        }
    }
}
