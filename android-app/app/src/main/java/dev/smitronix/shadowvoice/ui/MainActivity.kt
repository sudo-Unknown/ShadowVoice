package dev.smitronix.shadowvoice.ui

import android.app.role.RoleManager
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.os.Build
import android.os.Bundle
import android.widget.*
import androidx.activity.result.contract.ActivityResultContracts
import androidx.appcompat.app.AppCompatActivity
import androidx.core.content.ContextCompat
import androidx.lifecycle.lifecycleScope
import dev.smitronix.shadowvoice.R
import dev.smitronix.shadowvoice.ai.ShadowVoiceApiClient
import kotlinx.coroutines.launch

class MainActivity : AppCompatActivity() {

    private lateinit var apiClient: ShadowVoiceApiClient

    private lateinit var etServerUrl: EditText
    private lateinit var spinnerLanguage: Spinner
    private lateinit var btnSaveConfig: Button
    private lateinit var btnSetDefaultDialer: Button
    private lateinit var tvStatus: TextView
    private lateinit var tvVoicemailCount: TextView

    private val requestRoleLauncher = registerForActivityResult(
        ActivityResultContracts.StartActivityForResult()
    ) { result ->
        if (result.resultCode == RESULT_OK) {
            Toast.makeText(this, "ShadowVoice is now your Default Phone App!", Toast.LENGTH_SHORT).show()
        }
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_main)

        val prefs = getSharedPreferences("shadow_voice_prefs", MODE_PRIVATE)
        val serverUrl = prefs.getString("server_url", "https://call.smitronix.dev") ?: "https://call.smitronix.dev"
        val savedLang = prefs.getString("voice_language", "auto") ?: "auto"

        apiClient = ShadowVoiceApiClient(serverUrl)

        etServerUrl = findViewById(R.id.et_server_url)
        spinnerLanguage = findViewById(R.id.spinner_language)
        btnSaveConfig = findViewById(R.id.btn_save_config)
        btnSetDefaultDialer = findViewById(R.id.btn_set_default_dialer)
        tvStatus = findViewById(R.id.tv_server_status)
        tvVoicemailCount = findViewById(R.id.tv_voicemail_count)

        etServerUrl.setText(serverUrl)

        // Setup Language Spinner
        val languages = listOf(
            "🌐 Multilingual Auto-Detect" to "auto",
            "🇮🇳 मराठी (Marathi Voice)" to "mr-IN",
            "🇮🇳 हिन्दी (Hindi Voice)" to "hi-IN",
            "🇮🇳 Indian English Voice" to "en-IN",
            "🇺🇸 US English Voice" to "en-US"
        )
        val adapter = ArrayAdapter(this, android.R.layout.simple_spinner_item, languages.map { it.first })
        adapter.setDropDownViewResource(android.R.layout.simple_spinner_dropdown_item)
        spinnerLanguage.adapter = adapter

        val selectedIndex = languages.indexOfFirst { it.second == savedLang }.takeIf { it >= 0 } ?: 0
        spinnerLanguage.setSelection(selectedIndex)

        btnSaveConfig.setOnClickListener {
            val newUrl = etServerUrl.text.toString().trim()
            val newLang = languages[spinnerLanguage.selectedItemPosition].second
            prefs.edit().putString("server_url", newUrl).putString("voice_language", newLang).apply()
            apiClient.baseUrl = newUrl
            Toast.makeText(this, "Settings Saved!", Toast.LENGTH_SHORT).show()
            checkServerStatus()
        }

        btnSetDefaultDialer.setOnClickListener {
            requestDefaultPhoneAppRole()
        }

        checkAndRequestPermissions()
        checkServerStatus()
        loadVoicemails()
    }

    private fun requestDefaultPhoneAppRole() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            val roleManager = getSystemService(Context.ROLE_SERVICE) as RoleManager
            if (roleManager.isRoleAvailable(RoleManager.ROLE_DIALER) && !roleManager.isRoleHeld(RoleManager.ROLE_DIALER)) {
                val intent = roleManager.createRequestRoleIntent(RoleManager.ROLE_DIALER)
                requestRoleLauncher.launch(intent)
            } else {
                Toast.makeText(this, "Role already granted or not available", Toast.LENGTH_SHORT).show()
            }
        }
    }

    private fun checkAndRequestPermissions() {
        val permissions = mutableListOf(
            android.Manifest.permission.READ_PHONE_STATE,
            android.Manifest.permission.ANSWER_PHONE_CALLS,
            android.Manifest.permission.RECORD_AUDIO,
            android.Manifest.permission.MODIFY_AUDIO_SETTINGS
        )
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            permissions.add(android.Manifest.permission.POST_NOTIFICATIONS)
        }

        val needed = permissions.filter {
            ContextCompat.checkSelfPermission(this, it) != PackageManager.PERMISSION_GRANTED
        }
        if (needed.isNotEmpty()) {
            requestPermissions(needed.toTypedArray(), 101)
        }
    }

    private fun checkServerStatus() {
        tvStatus.text = "Checking server status..."
        lifecycleScope.launch {
            val res = apiClient.checkServerStatus()
            res.onSuccess { data ->
                tvStatus.text = "🟢 Server Online (${data.llmProvider.uppercase()})"
            }.onFailure {
                tvStatus.text = "🔴 Offline / Cannot connect"
            }
        }
    }

    private fun loadVoicemails() {
        lifecycleScope.launch {
            val res = apiClient.fetchVoicemails()
            res.onSuccess { list ->
                tvVoicemailCount.text = "${list.size} Voicemails"
            }
        }
    }
}
