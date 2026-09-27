import http from 'http';
import os from 'os';
import fs from 'fs';
import { callLLM } from './llm.js';
import { getVoicemails } from './db.js';

const DOCKER_SOCKET = '/var/run/docker.sock';

/**
 * Perform an HTTP request over the local Docker Unix socket
 */
function dockerSocketRequest(method, path) {
  return new Promise((resolve, reject) => {
    if (!fs.existsSync(DOCKER_SOCKET)) {
      return resolve({ status: 503, error: 'Docker socket not available', body: [] });
    }

    const req = http.request({
      socketPath: DOCKER_SOCKET,
      path,
      method,
      timeout: 10000
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, body: data ? JSON.parse(data) : {} });
        } catch (e) {
          resolve({ status: res.statusCode, body: data });
        }
      });
    });

    req.on('timeout', () => {
      req.destroy();
      resolve({ status: 504, error: 'Docker socket request timed out', body: [] });
    });

    req.on('error', (err) => {
      resolve({ status: 500, error: err.message, body: [] });
    });

    req.end();
  });
}

/**
 * Fetch host system resource metrics (CPU, RAM, Disk, Uptime)
 */
export function getSystemMetrics() {
  const totalMem = os.totalmem();
  const freeMem = os.freemem();
  const usedMem = totalMem - freeMem;
  
  let diskTotal = 0;
  let diskFree = 0;
  try {
    const statfs = fs.statfsSync('/');
    diskTotal = statfs.bsize * statfs.blocks;
    diskFree = statfs.bsize * statfs.bfree;
  } catch (e) {
    // Fallback if statfsSync not supported
  }
  const diskUsed = diskTotal - diskFree;
  const loadAvg = os.loadavg();
  const cpus = os.cpus();

  return {
    host: {
      hostname: os.hostname(),
      platform: os.platform(),
      arch: os.arch(),
      uptimeSeconds: Math.floor(os.uptime()),
      loadAvg: [
        parseFloat(loadAvg[0].toFixed(2)),
        parseFloat(loadAvg[1].toFixed(2)),
        parseFloat(loadAvg[2].toFixed(2))
      ]
    },
    cpu: {
      cores: cpus.length,
      model: cpus[0]?.model || 'ARM/x86 Processor',
      loadPercent: Math.min(100, parseFloat(((loadAvg[0] / (cpus.length || 1)) * 100).toFixed(1)))
    },
    memory: {
      totalBytes: totalMem,
      usedBytes: usedMem,
      freeBytes: freeMem,
      totalGB: parseFloat((totalMem / (1024 ** 3)).toFixed(2)),
      usedGB: parseFloat((usedMem / (1024 ** 3)).toFixed(2)),
      freeGB: parseFloat((freeMem / (1024 ** 3)).toFixed(2)),
      usagePercent: parseFloat(((usedMem / totalMem) * 100).toFixed(1))
    },
    disk: {
      totalGB: parseFloat((diskTotal / (1024 ** 3)).toFixed(2)),
      usedGB: parseFloat((diskUsed / (1024 ** 3)).toFixed(2)),
      freeGB: parseFloat((diskFree / (1024 ** 3)).toFixed(2)),
      usagePercent: diskTotal > 0 ? parseFloat(((diskUsed / diskTotal) * 100).toFixed(1)) : 0
    }
  };
}

/**
 * List all Docker containers and their live states
 */
export async function getDockerContainers() {
  const res = await dockerSocketRequest('GET', '/containers/json?all=1');
  if (res.error) {
    return {
      available: false,
      error: res.error,
      containers: []
    };
  }

  const rawContainers = Array.isArray(res.body) ? res.body : [];
  const containers = rawContainers.map(c => {
    const rawName = (c.Names && c.Names[0]) || '';
    const cleanName = rawName.replace(/^\//, '');
    return {
      id: c.Id.slice(0, 12),
      fullId: c.Id,
      name: cleanName,
      image: c.Image,
      state: c.State, // 'running', 'exited', 'restarting', 'paused'
      status: c.Status, // e.g. "Up 2 hours (healthy)"
      created: c.Created,
      ports: (c.Ports || []).map(p => ({
        ip: p.IP,
        privatePort: p.PrivatePort,
        publicPort: p.PublicPort,
        type: p.Type
      }))
    };
  });

  const runningCount = containers.filter(c => c.state === 'running').length;

  return {
    available: true,
    total: containers.length,
    running: runningCount,
    stopped: containers.length - runningCount,
    containers
  };
}

/**
 * Control a Docker container (restart, start, stop)
 */
export async function controlContainer(idOrName, action) {
  if (!['restart', 'start', 'stop'].includes(action)) {
    throw new Error(`Unsupported container action: ${action}`);
  }

  const urlPath = `/containers/${encodeURIComponent(idOrName)}/${action}${action === 'restart' || action === 'stop' ? '?t=10' : ''}`;
  const res = await dockerSocketRequest('POST', urlPath);

  if (res.status >= 200 && res.status < 300) {
    return { success: true, message: `Container ${idOrName} ${action}ed successfully.` };
  } else if (res.status === 304) {
    return { success: true, message: `Container ${idOrName} was already in target state.` };
  } else if (res.status === 404) {
    throw new Error(`Container ${idOrName} not found.`);
  } else {
    throw new Error(res.body?.message || res.error || `Failed to ${action} container (HTTP ${res.status})`);
  }
}

/**
 * Retrieve tail logs for a container
 */
export async function getContainerLogs(idOrName, tail = 100) {
  const urlPath = `/containers/${encodeURIComponent(idOrName)}/logs?stdout=1&stderr=1&tail=${tail}`;
  const res = await dockerSocketRequest('GET', urlPath);

  if (res.status >= 200 && res.status < 300) {
    // Docker multiplexed log stream has 8-byte headers per frame; clean up non-printable ASCII
    let raw = typeof res.body === 'string' ? res.body : JSON.stringify(res.body);
    const cleaned = raw.replace(/[\x00-\x09\x0B-\x1F\x7F-\x9F]/g, '');
    return { success: true, logs: cleaned };
  } else {
    throw new Error(`Failed to fetch logs for ${idOrName}: HTTP ${res.status}`);
  }
}

/**
 * AI System Assistant / Copilot
 * Allows user to talk or type in Marathi, Hindi, or English to control their phone, voicemails, and server.
 */
export async function systemAssistantTurn(userMessage, conversationHistory = []) {
  const metrics = getSystemMetrics();
  const dockerInfo = await getDockerContainers();
  const recentVoicemails = getVoicemails({ limit: 5 });

  const systemPrompt = `You are "ShadowVoice AI", Smit's unified Phone & System Super-App Assistant.
You can monitor server health, check Docker containers, inspect recent voicemails, and manage VPS services.

CURRENT LIVE SERVER TELEMETRY:
- Host: ${metrics.host.hostname} (${metrics.host.platform} ${metrics.host.arch}), Uptime: ${(metrics.host.uptimeSeconds / 3600).toFixed(1)} hrs
- CPU Usage: ${metrics.cpu.loadPercent}% (${metrics.cpu.cores} cores, ${metrics.cpu.model})
- RAM Usage: ${metrics.memory.usedGB} GB / ${metrics.memory.totalGB} GB (${metrics.memory.usagePercent}%)
- Disk Usage: ${metrics.disk.usedGB} GB / ${metrics.disk.totalGB} GB (${metrics.disk.usagePercent}%)
- Containers Total: ${dockerInfo.total} (${dockerInfo.running} Running, ${dockerInfo.stopped} Stopped)
- Running Containers: ${dockerInfo.containers.filter(c => c.state === 'running').slice(0, 15).map(c => c.name).join(', ')}

RECENT PHONE VOICEMAILS (${recentVoicemails.length} total):
${recentVoicemails.map(v => `- Caller: ${v.caller_name || 'Unknown'} (${v.caller_phone || 'N/A'}), Purpose: ${v.purpose || 'N/A'}, Urgency: ${v.urgency || 'Low'}, Time: ${v.created_at}`).join('\n')}

OPERATING GUIDELINES:
1. Respond naturally, politely, and concisely in the SAME LANGUAGE as the user (English, मराठी, or हिन्दी).
2. If the user asks about system health, CPU, RAM, disk, or running containers, synthesize the real numbers clearly.
3. If the user asks about phone calls or voicemails, tell them caller names, urgency, and action items.
4. If the user explicitly asks to restart a specific container (e.g. "Restart container n8n" or "कूलिफाय रीस्टार्ट करा"), include a special action tag at the very end of your response:
   [ACTION:RESTART_CONTAINER:<container_name>]
5. Keep answers voice-friendly, clear, and direct (max 2-4 sentences unless detailed report requested).`;

  const messages = [
    { role: 'system', content: systemPrompt },
    ...conversationHistory.slice(-6),
    { role: 'user', content: userMessage }
  ];

  const rawReply = await callLLM(messages, { temperature: 0.3, max_tokens: 400 });

  // Check if an action tag is present
  let cleanReply = rawReply;
  let executedAction = null;
  const actionMatch = rawReply.match(/\[ACTION:RESTART_CONTAINER:([a-zA-Z0-9_\-]+)\]/);
  if (actionMatch) {
    const targetContainer = actionMatch[1];
    cleanReply = rawReply.replace(actionMatch[0], '').trim();
    try {
      await controlContainer(targetContainer, 'restart');
      executedAction = { type: 'restart', container: targetContainer, success: true };
    } catch (e) {
      executedAction = { type: 'restart', container: targetContainer, success: false, error: e.message };
    }
  }

  return {
    reply: cleanReply,
    executedAction,
    metrics: {
      cpu: metrics.cpu.loadPercent,
      ram: metrics.memory.usagePercent,
      disk: metrics.disk.usagePercent,
      runningContainers: dockerInfo.running
    }
  };
}
