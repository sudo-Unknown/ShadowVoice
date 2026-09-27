package dev.smitronix.shadowvoice.ui

import android.Manifest
import android.app.role.RoleManager
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.graphics.Color
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.os.PowerManager
import android.provider.Settings
import android.telecom.TelecomManager
import android.view.Gravity
import android.view.View
import android.widget.*
import androidx.activity.result.ActivityResultLauncher
import androidx.activity.result.contract.ActivityResultContracts
import androidx.appcompat.app.AppCompatActivity
import androidx.core.app.NotificationManagerCompat
import androidx.core.content.ContextCompat
import androidx.lifecycle.lifecycleScope
import dev.smitronix.shadowvoice.R
import dev.smitronix.shadowvoice.ai.ShadowVoiceApiClient
import dev.smitronix.shadowvoice.model.DockerContainerItem
import dev.smitronix.shadowvoice.model.VoicemailItem
import dev.smitronix.shadowvoice.speech.SpeechManager
import kotlinx.coroutines.launch

class MainActivity : AppCompatActivity() {

    private lateinit var apiClient: ShadowVoiceApiClient
    private var speechManager: SpeechManager? = null

    // Top Bar
    private lateinit var tvTopStatus: TextView
    private lateinit var btnRefreshAll: Button

    // Tab Buttons
    private lateinit var tabCalls: Button
    private lateinit var tabSystem: Button
    private lateinit var tabCopilot: Button
    private lateinit var tabSettings: Button

    // Tab Views
    private lateinit var viewCallsInbox: View
    private lateinit var viewSystemMonitor: View
    private lateinit var viewCopilot: View
    private lateinit var viewSettings: View

    // Permissions & Setup Views
    private lateinit var btnGrantAllPermissions: Button
    private lateinit var tvStatusDialer: TextView
    private lateinit var btnSetDefaultDialer: Button
    private lateinit var tvStatusNotif: TextView
    private lateinit var btnReqNotif: Button
    private lateinit var tvStatusAudio: TextView
    private lateinit var btnReqAudio: Button
    private lateinit var tvStatusPhone: TextView
    private lateinit var btnReqPhone: Button
    private lateinit var tvStatusBattery: TextView
    private lateinit var btnReqBattery: Button

    // Voicemails Views
    private lateinit var tvVoicemailStats: TextView
    private lateinit var containerVoicemails: LinearLayout
    private lateinit var tvEmptyVoicemails: TextView

    // System Monitor Views
    private lateinit var tvCpuVal: TextView
    private lateinit var tvCpuDetails: TextView
    private lateinit var tvRamVal: TextView
    private lateinit var tvRamDetails: TextView
    private lateinit var tvDiskVal: TextView
    private lateinit var tvDiskDetails: TextView
    private lateinit var tvUptimeVal: TextView
    private lateinit var tvUptimeDetails: TextView
    private lateinit var tvContainersStats: TextView
    private lateinit var containerDockerList: LinearLayout
    private lateinit var btnLaunchCoolify: Button
    private lateinit var btnLaunchShadowVoice: Button

    // Copilot Views
    private lateinit var scrollCopilot: ScrollView
    private lateinit var containerCopilotChat: LinearLayout
    private lateinit var etCopilotInput: EditText
    private lateinit var btnCopilotMic: ImageButton
    private lateinit var btnCopilotSend: Button
    private lateinit var chipQueryHealth: Button
    private lateinit var chipQueryVoicemails: Button
    private lateinit var chipQueryMarathi: Button

    // Settings Views
    private lateinit var etServerUrl: EditText
    private lateinit var spinnerLanguage: Spinner
    private lateinit var btnSaveConfig: Button

    private val copilotHistory = mutableListOf<Map<String, String>>()
    private val languages = listOf("auto", "mr-IN", "hi-IN", "en-IN", "en-US")
    private val languageLabels = listOf(
        "🌐 Multilingual Auto-Detect",
        "🇮🇳 मराठी (Marathi)",
        "🇮🇳 हिन्दी (Hindi)",
        "🇮🇳 English (India)",
        "🇺🇸 English (US)"
    )

    // Activity Result Launchers
    private lateinit var permissionLauncher: ActivityResultLauncher<Array<String>>
    private lateinit var roleLauncher: ActivityResultLauncher<Intent>
    private lateinit var batteryLauncher: ActivityResultLauncher<Intent>

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_main)

        initLaunchers()
        initViews()
        setupListeners()
        loadPreferences()

        initSpeech()
        switchTab("calls")
        updatePermissionIndicators()
        refreshAllData()
    }

    override fun onResume() {
        super.onResume()
        updatePermissionIndicators()
    }

    private fun initLaunchers() {
        permissionLauncher = registerForActivityResult(
            ActivityResultContracts.RequestMultiplePermissions()
        ) { _ ->
            updatePermissionIndicators()
            Toast.makeText(this, "Permissions updated!", Toast.LENGTH_SHORT).show()
        }

        roleLauncher = registerForActivityResult(
            ActivityResultContracts.StartActivityForResult()
        ) { _ ->
            updatePermissionIndicators()
            val isDefault = isDefaultDialer()
            val msg = if (isDefault) "ShadowVoice is now your Default Phone Screener!" else "Default phone app was not set."
            Toast.makeText(this, msg, Toast.LENGTH_LONG).show()
        }

        batteryLauncher = registerForActivityResult(
            ActivityResultContracts.StartActivityForResult()
        ) { _ ->
            updatePermissionIndicators()
        }
    }

    private fun initViews() {
        tvTopStatus = findViewById(R.id.tv_top_status)
        btnRefreshAll = findViewById(R.id.btn_refresh_all)

        tabCalls = findViewById(R.id.tab_calls)
        tabSystem = findViewById(R.id.tab_system)
        tabCopilot = findViewById(R.id.tab_copilot)
        tabSettings = findViewById(R.id.tab_settings)

        viewCallsInbox = findViewById(R.id.view_calls_inbox)
        viewSystemMonitor = findViewById(R.id.view_system_monitor)
        viewCopilot = findViewById(R.id.view_copilot)
        viewSettings = findViewById(R.id.view_settings)

        // Permission Views
        btnGrantAllPermissions = findViewById(R.id.btn_grant_all_permissions)
        tvStatusDialer = findViewById(R.id.tv_status_dialer)
        btnSetDefaultDialer = findViewById(R.id.btn_set_default_dialer)
        tvStatusNotif = findViewById(R.id.tv_status_notif)
        btnReqNotif = findViewById(R.id.btn_req_notif)
        tvStatusAudio = findViewById(R.id.tv_status_audio)
        btnReqAudio = findViewById(R.id.btn_req_audio)
        tvStatusPhone = findViewById(R.id.tv_status_phone)
        btnReqPhone = findViewById(R.id.btn_req_phone)
        tvStatusBattery = findViewById(R.id.tv_status_battery)
        btnReqBattery = findViewById(R.id.btn_req_battery)

        tvVoicemailStats = findViewById(R.id.tv_voicemail_stats)
        containerVoicemails = findViewById(R.id.container_voicemails)
        tvEmptyVoicemails = findViewById(R.id.tv_empty_voicemails)

        tvCpuVal = findViewById(R.id.tv_cpu_val)
        tvCpuDetails = findViewById(R.id.tv_cpu_details)
        tvRamVal = findViewById(R.id.tv_ram_val)
        tvRamDetails = findViewById(R.id.tv_ram_details)
        tvDiskVal = findViewById(R.id.tv_disk_val)
        tvDiskDetails = findViewById(R.id.tv_disk_details)
        tvUptimeVal = findViewById(R.id.tv_uptime_val)
        tvUptimeDetails = findViewById(R.id.tv_uptime_details)
        tvContainersStats = findViewById(R.id.tv_containers_stats)
        containerDockerList = findViewById(R.id.container_docker_list)
        btnLaunchCoolify = findViewById(R.id.btn_launch_coolify)
        btnLaunchShadowVoice = findViewById(R.id.btn_launch_shadowvoice)

        scrollCopilot = findViewById(R.id.scroll_copilot)
        containerCopilotChat = findViewById(R.id.container_copilot_chat)
        etCopilotInput = findViewById(R.id.et_copilot_input)
        btnCopilotMic = findViewById(R.id.btn_copilot_mic)
        btnCopilotSend = findViewById(R.id.btn_copilot_send)
        chipQueryHealth = findViewById(R.id.chip_query_health)
        chipQueryVoicemails = findViewById(R.id.chip_query_voicemails)
        chipQueryMarathi = findViewById(R.id.chip_query_marathi)

        etServerUrl = findViewById(R.id.et_server_url)
        spinnerLanguage = findViewById(R.id.spinner_language)
        btnSaveConfig = findViewById(R.id.btn_save_config)

        val adapter = ArrayAdapter(this, android.R.layout.simple_spinner_dropdown_item, languageLabels)
        spinnerLanguage.adapter = adapter
    }

    private fun setupListeners() {
        tabCalls.setOnClickListener { switchTab("calls") }
        tabSystem.setOnClickListener { switchTab("system") }
        tabCopilot.setOnClickListener { switchTab("copilot") }
        tabSettings.setOnClickListener { switchTab("settings") }

        btnRefreshAll.setOnClickListener { refreshAllData() }

        // Permission Handlers
        btnGrantAllPermissions.setOnClickListener {
            requestAllEssentialPermissions()
        }

        btnSetDefaultDialer.setOnClickListener {
            requestDefaultDialerRole()
        }

        btnReqNotif.setOnClickListener {
            requestNotificationPermission()
        }

        btnReqAudio.setOnClickListener {
            permissionLauncher.launch(arrayOf(Manifest.permission.RECORD_AUDIO))
        }

        btnReqPhone.setOnClickListener {
            val permissions = mutableListOf(
                Manifest.permission.READ_PHONE_STATE,
                Manifest.permission.ANSWER_PHONE_CALLS,
                Manifest.permission.READ_CALL_LOG,
                Manifest.permission.READ_CONTACTS
            )
            permissionLauncher.launch(permissions.toTypedArray())
        }

        btnReqBattery.setOnClickListener {
            requestBatteryOptimizationExemption()
        }

        btnLaunchCoolify.setOnClickListener {
            val browserIntent = Intent(Intent.ACTION_VIEW, Uri.parse("https://coolify.smitronix.dev"))
            startActivity(browserIntent)
        }

        btnLaunchShadowVoice.setOnClickListener {
            val browserIntent = Intent(Intent.ACTION_VIEW, Uri.parse("https://call.smitronix.dev"))
            startActivity(browserIntent)
        }

        btnCopilotSend.setOnClickListener {
            val text = etCopilotInput.text.toString().trim()
            if (text.isNotEmpty()) {
                sendCopilotMessage(text)
                etCopilotInput.setText("")
            }
        }

        btnCopilotMic.setOnClickListener {
            speechManager?.startListening()
            Toast.makeText(this, "Listening (Marathi / Hindi / English)...", Toast.LENGTH_SHORT).show()
        }

        chipQueryHealth.setOnClickListener { sendCopilotMessage("How is my server health right now?") }
        chipQueryVoicemails.setOnClickListener { sendCopilotMessage("Who called me today and what are the voicemails?") }
        chipQueryMarathi.setOnClickListener { sendCopilotMessage("सध्या सर्व्हर आणि कंटेनर्सचे काय स्टेटस आहे?") }

        btnSaveConfig.setOnClickListener { savePreferences() }
    }

    private fun updatePermissionIndicators() {
        // 1. Default Dialer
        val hasDialer = isDefaultDialer()
        tvStatusDialer.text = if (hasDialer) "🟢 Active: Default Screener" else "⚪ Not Set (Tap 'Set Default')"
        tvStatusDialer.setTextColor(if (hasDialer) Color.parseColor("#10B981") else Color.parseColor("#FBBF24"))
        btnSetDefaultDialer.text = if (hasDialer) "Active" else "Set Default"
        btnSetDefaultDialer.isEnabled = !hasDialer

        // 2. Notifications
        val hasNotif = NotificationManagerCompat.from(this).areNotificationsEnabled()
        tvStatusNotif.text = if (hasNotif) "🟢 Active: Alerts Enabled" else "⚪ Disabled (Tap 'Enable')"
        tvStatusNotif.setTextColor(if (hasNotif) Color.parseColor("#10B981") else Color.parseColor("#FBBF24"))
        btnReqNotif.text = if (hasNotif) "Enabled" else "Enable"
        btnReqNotif.isEnabled = !hasNotif

        // 3. Audio / Mic
        val hasAudio = ContextCompat.checkSelfPermission(this, Manifest.permission.RECORD_AUDIO) == PackageManager.PERMISSION_GRANTED
        tvStatusAudio.text = if (hasAudio) "🟢 Active: Microphone Ready" else "⚪ Required for AI speech"
        tvStatusAudio.setTextColor(if (hasAudio) Color.parseColor("#10B981") else Color.parseColor("#FBBF24"))
        btnReqAudio.text = if (hasAudio) "Granted" else "Grant"
        btnReqAudio.isEnabled = !hasAudio

        // 4. Phone State & Contacts
        val hasPhone = ContextCompat.checkSelfPermission(this, Manifest.permission.READ_PHONE_STATE) == PackageManager.PERMISSION_GRANTED &&
                       ContextCompat.checkSelfPermission(this, Manifest.permission.ANSWER_PHONE_CALLS) == PackageManager.PERMISSION_GRANTED
        tvStatusPhone.text = if (hasPhone) "🟢 Active: SIM Calls Connected" else "⚪ Required to answer calls"
        tvStatusPhone.setTextColor(if (hasPhone) Color.parseColor("#10B981") else Color.parseColor("#FBBF24"))
        btnReqPhone.text = if (hasPhone) "Granted" else "Grant"
        btnReqPhone.isEnabled = !hasPhone

        // 5. Battery Optimization
        val pm = getSystemService(Context.POWER_SERVICE) as? PowerManager
        val isIgnoringBattery = pm?.isIgnoringBatteryOptimizations(packageName) ?: false
        tvStatusBattery.text = if (isIgnoringBattery) "🟢 Active: Unrestricted" else "⚪ Standard (Recommend whitelist)"
        tvStatusBattery.setTextColor(if (isIgnoringBattery) Color.parseColor("#10B981") else Color.parseColor("#FBBF24"))
        btnReqBattery.text = if (isIgnoringBattery) "Whitelisted" else "Whitelist"
        btnReqBattery.isEnabled = !isIgnoringBattery

        // Master button state
        val allGranted = hasDialer && hasNotif && hasAudio && hasPhone && isIgnoringBattery
        if (allGranted) {
            btnGrantAllPermissions.text = "✅ All System Permissions Configured!"
            btnGrantAllPermissions.setBackgroundColor(Color.parseColor("#334155"))
            btnGrantAllPermissions.isEnabled = false
        } else {
            btnGrantAllPermissions.text = "⚡ 1-Tap: Grant All Essential Permissions"
            btnGrantAllPermissions.setBackgroundColor(Color.parseColor("#10B981"))
            btnGrantAllPermissions.isEnabled = true
        }
    }

    private fun isDefaultDialer(): Boolean {
        val telecomManager = getSystemService(Context.TELECOM_SERVICE) as? TelecomManager
        return telecomManager?.defaultDialerPackage == packageName
    }

    private fun requestAllEssentialPermissions() {
        val permissions = mutableListOf<String>()

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            if (ContextCompat.checkSelfPermission(this, Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) {
                permissions.add(Manifest.permission.POST_NOTIFICATIONS)
            }
        }
        if (ContextCompat.checkSelfPermission(this, Manifest.permission.RECORD_AUDIO) != PackageManager.PERMISSION_GRANTED) {
            permissions.add(Manifest.permission.RECORD_AUDIO)
        }
        if (ContextCompat.checkSelfPermission(this, Manifest.permission.READ_PHONE_STATE) != PackageManager.PERMISSION_GRANTED) {
            permissions.add(Manifest.permission.READ_PHONE_STATE)
        }
        if (ContextCompat.checkSelfPermission(this, Manifest.permission.ANSWER_PHONE_CALLS) != PackageManager.PERMISSION_GRANTED) {
            permissions.add(Manifest.permission.ANSWER_PHONE_CALLS)
        }
        if (ContextCompat.checkSelfPermission(this, Manifest.permission.READ_CALL_LOG) != PackageManager.PERMISSION_GRANTED) {
            permissions.add(Manifest.permission.READ_CALL_LOG)
        }
        if (ContextCompat.checkSelfPermission(this, Manifest.permission.READ_CONTACTS) != PackageManager.PERMISSION_GRANTED) {
            permissions.add(Manifest.permission.READ_CONTACTS)
        }

        if (permissions.isNotEmpty()) {
            permissionLauncher.launch(permissions.toTypedArray())
        }

        // Trigger default dialer role request if not already granted
        if (!isDefaultDialer()) {
            requestDefaultDialerRole()
        }

        // Prompt battery optimization if needed
        requestBatteryOptimizationExemption()
    }

    private fun requestNotificationPermission() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            permissionLauncher.launch(arrayOf(Manifest.permission.POST_NOTIFICATIONS))
        } else {
            // Open system notification settings for this app
            val intent = Intent(Settings.ACTION_APP_NOTIFICATION_SETTINGS).apply {
                putExtra(Settings.EXTRA_APP_PACKAGE, packageName)
            }
            startActivity(intent)
        }
    }

    private fun requestDefaultDialerRole() {
        // Method 1: Android Q+ RoleManager
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            val roleManager = getSystemService(RoleManager::class.java)
            if (roleManager != null && roleManager.isRoleAvailable(RoleManager.ROLE_DIALER)) {
                try {
                    val intent = roleManager.createRequestRoleIntent(RoleManager.ROLE_DIALER)
                    roleLauncher.launch(intent)
                    return
                } catch (e: Exception) {
                    // Fallback to call screening or direct dialer intent
                }
            }

            // Fallback to ROLE_CALL_SCREENING
            if (roleManager != null && roleManager.isRoleAvailable(RoleManager.ROLE_CALL_SCREENING)) {
                try {
                    val intent = roleManager.createRequestRoleIntent(RoleManager.ROLE_CALL_SCREENING)
                    roleLauncher.launch(intent)
                    return
                } catch (e: Exception) {}
            }
        }

        // Method 2: Standard TelecomManager change dialer intent
        try {
            val intent = Intent(TelecomManager.ACTION_CHANGE_DEFAULT_DIALER).apply {
                putExtra(TelecomManager.EXTRA_CHANGE_DEFAULT_DIALER_PACKAGE_NAME, packageName)
            }
            roleLauncher.launch(intent)
        } catch (e: Exception) {
            // Method 3: Direct application details settings
            Toast.makeText(this, "Opening App Settings: Please set ShadowVoice as Default Phone App", Toast.LENGTH_LONG).show()
            val intent = Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS).apply {
                data = Uri.fromParts("package", packageName, null)
            }
            startActivity(intent)
        }
    }

    private fun requestBatteryOptimizationExemption() {
        val pm = getSystemService(Context.POWER_SERVICE) as? PowerManager
        if (pm != null && !pm.isIgnoringBatteryOptimizations(packageName)) {
            try {
                val intent = Intent(Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS).apply {
                    data = Uri.parse("package:$packageName")
                }
                batteryLauncher.launch(intent)
            } catch (e: Exception) {
                try {
                    val intent = Intent(Settings.ACTION_IGNORE_BATTERY_OPTIMIZATION_SETTINGS)
                    startActivity(intent)
                } catch (e2: Exception) {}
            }
        }
    }

    private fun initSpeech() {
        speechManager = SpeechManager(
            context = this,
            onSpeechRecognized = { text ->
                runOnUiThread {
                    etCopilotInput.setText(text)
                    sendCopilotMessage(text)
                }
            },
            onError = { err ->
                runOnUiThread {
                    Toast.makeText(this, "Speech error: $err", Toast.LENGTH_SHORT).show()
                }
            }
        )
    }

    private fun switchTab(tab: String) {
        val activeColor = Color.parseColor("#6366F1")
        val inactiveColor = Color.parseColor("#1E293B")
        val activeText = Color.parseColor("#FFFFFF")
        val inactiveText = Color.parseColor("#94A3B8")

        tabCalls.backgroundTintList = android.content.res.ColorStateList.valueOf(if (tab == "calls") activeColor else inactiveColor)
        tabCalls.setTextColor(if (tab == "calls") activeText else inactiveText)

        tabSystem.backgroundTintList = android.content.res.ColorStateList.valueOf(if (tab == "system") activeColor else inactiveColor)
        tabSystem.setTextColor(if (tab == "system") activeText else inactiveText)

        tabCopilot.backgroundTintList = android.content.res.ColorStateList.valueOf(if (tab == "copilot") activeColor else inactiveColor)
        tabCopilot.setTextColor(if (tab == "copilot") activeText else inactiveText)

        tabSettings.backgroundTintList = android.content.res.ColorStateList.valueOf(if (tab == "settings") activeColor else inactiveColor)
        tabSettings.setTextColor(if (tab == "settings") activeText else inactiveText)

        viewCallsInbox.visibility = if (tab == "calls") View.VISIBLE else View.GONE
        viewSystemMonitor.visibility = if (tab == "system") View.VISIBLE else View.GONE
        viewCopilot.visibility = if (tab == "copilot") View.VISIBLE else View.GONE
        viewSettings.visibility = if (tab == "settings") View.VISIBLE else View.GONE

        updatePermissionIndicators()
    }

    private fun refreshAllData() {
        tvTopStatus.text = "🔄 Refreshing telemetry & voicemails..."
        updatePermissionIndicators()
        lifecycleScope.launch {
            loadVoicemails()
            loadSystemTelemetry()
            loadDockerContainers()
        }
    }

    private suspend fun loadVoicemails() {
        val result = apiClient.fetchVoicemails()
        result.onSuccess { voicemails ->
            tvVoicemailStats.text = "${voicemails.size} Messages"
            containerVoicemails.removeAllViews()

            if (voicemails.isEmpty()) {
                containerVoicemails.addView(tvEmptyVoicemails)
            } else {
                for (vm in voicemails) {
                    val card = createVoicemailCard(vm)
                    containerVoicemails.addView(card)
                }
            }
        }.onFailure {
            tvVoicemailStats.text = "Offline"
        }
    }

    private fun createVoicemailCard(vm: VoicemailItem): View {
        val card = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setBackgroundColor(Color.parseColor("#1E293B"))
            setPadding(32, 28, 32, 28)
            val params = LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT,
                LinearLayout.LayoutParams.WRAP_CONTENT
            ).apply { setMargins(0, 0, 0, 24) }
            layoutParams = params
        }

        // Header Row: Caller + Urgency
        val headerRow = LinearLayout(this).apply {
            orientation = LinearLayout.HORIZONTAL
            gravity = Gravity.CENTER_VERTICAL
        }

        val tvCaller = TextView(this).apply {
            text = "${vm.caller_name ?: "Unknown Caller"} (${vm.caller_phone ?: "N/A"})"
            setTextColor(Color.WHITE)
            textSize = 15f
            setTypeface(null, android.graphics.Typeface.BOLD)
            layoutParams = LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1f)
        }

        val urgencyBadge = TextView(this).apply {
            text = vm.urgency?.uppercase() ?: "NORMAL"
            val bg = when (vm.urgency?.lowercase()) {
                "high", "critical" -> Color.parseColor("#EF4444")
                "medium" -> Color.parseColor("#F59E0B")
                else -> Color.parseColor("#10B981")
            }
            setBackgroundColor(bg)
            setTextColor(Color.WHITE)
            textSize = 10f
            setPadding(16, 6, 16, 6)
        }

        headerRow.addView(tvCaller)
        headerRow.addView(urgencyBadge)
        card.addView(headerRow)

        // Purpose / Summary
        if (!vm.purpose.isNullOrBlank()) {
            val tvPurpose = TextView(this).apply {
                text = "📌 ${vm.purpose}"
                setTextColor(Color.parseColor("#93C5FD"))
                textSize = 13f
                setPadding(0, 10, 0, 4)
            }
            card.addView(tvPurpose)
        }

        if (!vm.summary.isNullOrBlank()) {
            val tvSummary = TextView(this).apply {
                text = vm.summary
                setTextColor(Color.parseColor("#CBD5E1"))
                textSize = 13f
                setPadding(0, 4, 0, 8)
            }
            card.addView(tvSummary)
        }

        // Action items
        if (!vm.action_items.isNullOrBlank()) {
            val tvActions = TextView(this).apply {
                text = "⚡ Action: ${vm.action_items}"
                setTextColor(Color.parseColor("#FBBF24"))
                textSize = 12f
                setPadding(0, 4, 0, 8)
            }
            card.addView(tvActions)
        }

        return card
    }

    private suspend fun loadSystemTelemetry() {
        val result = apiClient.fetchSystemMetrics()
        result.onSuccess { m ->
            tvTopStatus.text = "🟢 Connected • ${m.host.hostname} (${(m.host.uptimeSeconds / 3600)}h uptime)"
            tvCpuVal.text = "${m.cpu.loadPercent}%"
            tvCpuDetails.text = "${m.cpu.cores} Cores (${m.cpu.model ?: "ARM"})"

            tvRamVal.text = "${m.memory.usagePercent}%"
            tvRamDetails.text = "${m.memory.usedGB} GB / ${m.memory.totalGB} GB"

            tvDiskVal.text = "${m.disk.usagePercent}%"
            tvDiskDetails.text = "${m.disk.usedGB} GB / ${m.disk.totalGB} GB"

            tvUptimeVal.text = "${(m.host.uptimeSeconds / 3600)} hrs"
            tvUptimeDetails.text = "${m.host.platform} ${m.host.arch}"
        }.onFailure {
            tvTopStatus.text = "🔴 VPS Connection Error"
        }
    }

    private suspend fun loadDockerContainers() {
        val result = apiClient.fetchContainers()
        result.onSuccess { d ->
            tvContainersStats.text = "${d.running} / ${d.total} Running"
            containerDockerList.removeAllViews()

            for (c in d.containers) {
                val card = createContainerCard(c)
                containerDockerList.addView(card)
            }
        }.onFailure {
            tvContainersStats.text = "Docker API Offline"
        }
    }

    private fun createContainerCard(c: DockerContainerItem): View {
        val card = LinearLayout(this).apply {
            orientation = LinearLayout.HORIZONTAL
            gravity = Gravity.CENTER_VERTICAL
            setBackgroundColor(Color.parseColor("#1E293B"))
            setPadding(28, 20, 28, 20)
            val params = LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT,
                LinearLayout.LayoutParams.WRAP_CONTENT
            ).apply { setMargins(0, 0, 0, 16) }
            layoutParams = params
        }

        val textLayout = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            layoutParams = LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1f)
        }

        val tvName = TextView(this).apply {
            text = c.name
            setTextColor(Color.WHITE)
            textSize = 14f
            setTypeface(null, android.graphics.Typeface.BOLD)
        }

        val tvStatus = TextView(this).apply {
            text = "${if (c.state == "running") "🟢" else "🔴"} ${c.status}"
            setTextColor(if (c.state == "running") Color.parseColor("#86EFAC") else Color.parseColor("#FCA5A5"))
            textSize = 11f
            setPadding(0, 2, 0, 0)
        }

        textLayout.addView(tvName)
        textLayout.addView(tvStatus)
        card.addView(textLayout)

        val btnRestart = Button(this).apply {
            text = "🔄 Restart"
            setTextColor(Color.WHITE)
            textSize = 11f
            backgroundTintList = android.content.res.ColorStateList.valueOf(Color.parseColor("#334155"))
            setOnClickListener {
                restartContainer(c.name)
            }
        }

        card.addView(btnRestart)
        return card
    }

    private fun restartContainer(name: String) {
        Toast.makeText(this, "Restarting container $name...", Toast.LENGTH_SHORT).show()
        lifecycleScope.launch {
            val res = apiClient.controlContainer(name, "restart")
            res.onSuccess {
                Toast.makeText(this@MainActivity, "$name restarted successfully!", Toast.LENGTH_SHORT).show()
                loadDockerContainers()
            }.onFailure { err ->
                Toast.makeText(this@MainActivity, "Failed: ${err.message}", Toast.LENGTH_LONG).show()
            }
        }
    }

    private fun sendCopilotMessage(userMessage: String) {
        appendCopilotBubble("You", userMessage, Color.parseColor("#3B82F6"))

        lifecycleScope.launch {
            val result = apiClient.sendAssistantMessage(userMessage, copilotHistory)
            result.onSuccess { data ->
                appendCopilotBubble("ShadowVoice AI", data.reply, Color.parseColor("#1E293B"))

                // Speak response in user's language (Marathi / Hindi / English)
                speechManager?.speak(data.reply) {}

                copilotHistory.add(mapOf("role" to "user", "content" to userMessage))
                copilotHistory.add(mapOf("role" to "assistant", "content" to data.reply))

                if (data.executedAction != null && data.executedAction.success) {
                    Toast.makeText(this@MainActivity, "Action executed: Container ${data.executedAction.container} restarted!", Toast.LENGTH_LONG).show()
                    loadDockerContainers()
                }
            }.onFailure { e ->
                appendCopilotBubble("System", "Error: ${e.message}", Color.parseColor("#EF4444"))
            }
        }
    }

    private fun appendCopilotBubble(sender: String, message: String, bgColor: Int) {
        val bubble = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setBackgroundColor(bgColor)
            setPadding(28, 20, 28, 20)
            val params = LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT,
                LinearLayout.LayoutParams.WRAP_CONTENT
            ).apply { setMargins(0, 0, 0, 16) }
            layoutParams = params
        }

        val tvSender = TextView(this).apply {
            text = sender
            setTextColor(Color.parseColor("#94A3B8"))
            textSize = 11f
            setTypeface(null, android.graphics.Typeface.BOLD)
        }

        val tvContent = TextView(this).apply {
            text = message
            setTextColor(Color.WHITE)
            textSize = 14f
            setPadding(0, 4, 0, 0)
        }

        bubble.addView(tvSender)
        bubble.addView(tvContent)
        containerCopilotChat.addView(bubble)

        scrollCopilot.post {
            scrollCopilot.fullScroll(View.FOCUS_DOWN)
        }
    }

    private fun loadPreferences() {
        val prefs = getSharedPreferences("shadow_voice_prefs", MODE_PRIVATE)
        val serverUrl = prefs.getString("server_url", "https://call.smitronix.dev") ?: "https://call.smitronix.dev"
        val lang = prefs.getString("voice_language", "auto") ?: "auto"

        etServerUrl.setText(serverUrl)
        val idx = languages.indexOf(lang)
        if (idx >= 0) spinnerLanguage.setSelection(idx)

        apiClient = ShadowVoiceApiClient(serverUrl)
        speechManager?.currentLanguageCode = lang
    }

    private fun savePreferences() {
        val serverUrl = etServerUrl.text.toString().trim()
        val langIdx = spinnerLanguage.selectedItemPosition
        val langCode = if (langIdx in languages.indices) languages[langIdx] else "auto"

        getSharedPreferences("shadow_voice_prefs", MODE_PRIVATE).edit()
            .putString("server_url", serverUrl)
            .putString("voice_language", langCode)
            .apply()

        apiClient.baseUrl = serverUrl
        speechManager?.currentLanguageCode = langCode

        Toast.makeText(this, "Settings saved! Testing connection...", Toast.LENGTH_SHORT).show()
        refreshAllData()
    }

    override fun onDestroy() {
        super.onDestroy()
        speechManager?.destroy()
    }
}
