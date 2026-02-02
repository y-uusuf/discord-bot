/**
 * Discord Bot Landing Page - Dynamic Functionality
 * Handles status updates, command loading, and UI interactions
 */

// ═══════════════════════════════════════════════════════════
// Configuration
// ═══════════════════════════════════════════════════════════
const API_BASE = window.location.origin;
const STATUS_REFRESH_INTERVAL = 30000; // 30 seconds

// ═══════════════════════════════════════════════════════════
// DOM Elements
// ═══════════════════════════════════════════════════════════
const elements = {
    botAvatar: document.getElementById('bot-avatar'),
    botName: document.getElementById('bot-name'),
    statusIndicator: document.getElementById('status-indicator'),
    statusBadge: document.getElementById('status-badge'),
    statusText: document.getElementById('status-text'),
    serverCount: document.getElementById('server-count'),
    commandCount: document.getElementById('command-count'),
    uptime: document.getElementById('uptime'),
    prefix: document.getElementById('prefix'),
    commandCategories: document.getElementById('command-categories')
};

// ═══════════════════════════════════════════════════════════
// Category Icons & Colors
// ═══════════════════════════════════════════════════════════
const categoryMeta = {
    moderation: { icon: '🛡️', label: 'moderation.' },
    utility: { icon: '🔧', label: 'utility.' },
    fun: { icon: '🎮', label: 'fun.' },
    music: { icon: '🎵', label: 'music.' },
    other: { icon: '📦', label: 'other.' }
};

// ═══════════════════════════════════════════════════════════
// Status Management
// ═══════════════════════════════════════════════════════════
async function fetchStatus() {
    try {
        const response = await fetch(`${API_BASE}/api/status`);
        if (!response.ok) throw new Error('Failed to fetch status');

        const data = await response.json();
        updateStatusUI(data);
        return data;
    } catch (error) {
        console.error('Status fetch error:', error);
        setOfflineStatus();
        return null;
    }
}

function updateStatusUI(data) {
    // Update status indicator
    elements.statusIndicator.className = `status-dot ${data.online ? 'online' : 'offline'}`;
    elements.statusText.textContent = data.online ? 'Online' : 'Offline';

    // Update stats
    elements.serverCount.textContent = data.serverCount?.toLocaleString() || '--';
    elements.commandCount.textContent = data.commandCount?.toLocaleString() || '--';
    elements.uptime.textContent = formatUptime(data.uptime);
    elements.prefix.textContent = data.prefix || ',';

    // Update bot info
    if (data.botName) {
        elements.botName.textContent = data.botName;
        document.title = `@guard`;
    }
    if (data.botAvatar) {
        elements.botAvatar.src = data.botAvatar;
        // Update favicon
        const favicon = document.getElementById('favicon');
        if (favicon) favicon.href = data.botAvatar;
    }
}

function setOfflineStatus() {
    elements.statusIndicator.className = 'status-dot offline';
    elements.statusText.textContent = 'Offline';
}

function formatUptime(seconds) {
    if (!seconds || seconds < 0) return '--';

    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);

    if (days > 0) return `${days}d ${hours}h`;
    if (hours > 0) return `${hours}h ${minutes}m`;
    return `${minutes}m`;
}

// ═══════════════════════════════════════════════════════════
// Commands Management
// ═══════════════════════════════════════════════════════════
async function fetchCommands() {
    try {
        const response = await fetch(`${API_BASE}/api/commands`);
        if (!response.ok) throw new Error('Failed to fetch commands');

        const data = await response.json();
        renderCommands(data.categories);
        return data;
    } catch (error) {
        console.error('Commands fetch error:', error);
        elements.commandCategories.innerHTML = `
            <div class="category-card">
                <div class="category-header">
                    <div class="category-info">
                        <span class="category-icon">⚠️</span>
                        <div>
                            <span class="category-name">Unable to load commands</span>
                            <span class="category-count">Please try again later</span>
                        </div>
                    </div>
                </div>
            </div>
        `;
        return null;
    }
}

function renderCommands(categories) {
    if (!categories || Object.keys(categories).length === 0) {
        elements.commandCategories.innerHTML = '<p style="color: var(--text-muted);">No commands available.</p>';
        return;
    }

    // Sort categories in preferred order
    const order = ['moderation', 'utility', 'fun', 'music', 'other'];
    const sortedCategories = Object.entries(categories).sort(([a], [b]) => {
        return order.indexOf(a.toLowerCase()) - order.indexOf(b.toLowerCase());
    });

    elements.commandCategories.innerHTML = sortedCategories.map(([category, commands]) => {
        const meta = categoryMeta[category.toLowerCase()] || categoryMeta.other;
        const commandsHTML = commands.map(cmd => renderCommand(cmd)).join('');

        return `
            <div class="category-card" data-category="${category}">
                <div class="category-header" onclick="toggleCategory(this)">
                    <div class="category-info">
                        <span class="category-icon">${meta.icon}</span>
                        <div>
                            <span class="category-name">${meta.label}</span>
                            <span class="category-count">${commands.length} commands.</span>
                        </div>
                    </div>
                    <div class="category-toggle">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M6 9l6 6 6-6"/>
                        </svg>
                    </div>
                </div>
                <div class="category-commands">
                    ${commandsHTML}
                </div>
            </div>
        `;
    }).join('');
}

function renderCommand(cmd) {
    const aliasesHTML = cmd.aliases && cmd.aliases.length > 0
        ? `<span class="command-aliases">aliases: ${cmd.aliases.join(', ')}</span>`
        : '';

    const usageHTML = cmd.usage
        ? `<div class="command-usage">${escapeHtml(cmd.usage)}</div>`
        : '';

    return `
        <div class="command-item">
            <div class="command-header">
                <span class="command-name">${escapeHtml(cmd.name)}</span>
                ${aliasesHTML}
            </div>
            <p class="command-description">${escapeHtml(cmd.description)}</p>
            ${usageHTML}
        </div>
    `;
}

// ═══════════════════════════════════════════════════════════
// UI Interactions
// ═══════════════════════════════════════════════════════════
function toggleCategory(headerElement) {
    const card = headerElement.closest('.category-card');
    card.classList.toggle('expanded');
}

// Expose to global scope for onclick handler
window.toggleCategory = toggleCategory;

// ═══════════════════════════════════════════════════════════
// Utilities
// ═══════════════════════════════════════════════════════════
function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// ═══════════════════════════════════════════════════════════
// Initialization
// ═══════════════════════════════════════════════════════════
async function init() {
    // Fetch initial data
    await Promise.all([
        fetchStatus(),
        fetchCommands()
    ]);

    // Set up periodic status updates
    setInterval(fetchStatus, STATUS_REFRESH_INTERVAL);
}

// Start when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}

// ═══════════════════════════════════════════════════════════
// Snow Particle System - Performance Optimized
// ═══════════════════════════════════════════════════════════
(function () {
    const canvas = document.createElement('canvas');
    canvas.id = 'snow-canvas';
    canvas.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;pointer-events:none;z-index:9999;';
    document.body.appendChild(canvas);

    const ctx = canvas.getContext('2d');
    let width, height;
    let mouseX = 0, mouseY = 0;
    let lastMouseX = window.innerWidth / 2;
    let lastMouseY = window.innerHeight / 2;
    let windX = 0, windY = 0;
    const particles = [];
    const PARTICLE_COUNT = 150;
    const MIN_SIZE = 10;
    const MAX_SIZE = 20;

    // Load snowflake image (white)
    const snowflakeImg = new Image();
    snowflakeImg.src = 'https://img.icons8.com/ios-filled/50/ffffff/snowflake.png';

    function resize() {
        width = canvas.width = window.innerWidth;
        height = canvas.height = window.innerHeight;
    }

    function createParticle() {
        return {
            x: Math.random() * width,
            y: Math.random() * height - height,
            size: Math.random() * (MAX_SIZE - MIN_SIZE) + MIN_SIZE,
            speed: Math.random() * 3 + 2,
            opacity: Math.random() * 0.3 + 0.2,
            drift: Math.random() * 1 - 0.5,
            rotation: Math.random() * Math.PI * 2,
            rotationSpeed: (Math.random() - 0.5) * 0.05
        };
    }

    function initParticles() {
        particles.length = 0;
        for (let i = 0; i < PARTICLE_COUNT; i++) {
            const p = createParticle();
            p.y = Math.random() * height; // Initial spread
            particles.push(p);
        }
    }

    function animate() {
        ctx.clearRect(0, 0, width, height);

        // Gradually reduce wind momentum
        windX *= 0.98;
        windY *= 0.98;

        particles.forEach(p => {
            // Basic movement + wind influence
            p.y += p.speed;
            p.x += (p.drift + windX);
            p.rotation += p.rotationSpeed;

            // Reset if off-screen (recycle particles)
            if (p.y > height + p.size) {
                p.y = -p.size;
                p.x = Math.random() * width;
            }
            if (p.x > width) p.x = 0;
            if (p.x < 0) p.x = width;

            // Draw logic
            ctx.save();
            ctx.translate(p.x, p.y);
            ctx.rotate(p.rotation);
            ctx.globalAlpha = p.opacity;

            if (snowflakeImg.complete) {
                ctx.drawImage(snowflakeImg, -p.size / 2, -p.size / 2, p.size, p.size);
            } else {
                // Fallback if image not loaded yet
                ctx.fillStyle = '#ffffff';
                ctx.beginPath();
                ctx.arc(0, 0, p.size / 2, 0, Math.PI * 2);
                ctx.fill();
            }

            ctx.restore();
        });

        requestAnimationFrame(animate);
    }

    // Event listeners
    window.addEventListener('resize', resize, { passive: true });

    // Wind physics: track mouse speed/direction
    document.addEventListener('mousemove', (e) => {
        mouseX = e.clientX;
        mouseY = e.clientY;

        // Calculate wind based on cursor movement delta
        windX = (mouseX - lastMouseX) * 0.04;
        windY = (mouseY - lastMouseY) * 0.02;
        lastMouseX = mouseX;
        lastMouseY = mouseY;
    }, { passive: true });

    // Initialize
    resize();
    initParticles();
    animate();
})();
