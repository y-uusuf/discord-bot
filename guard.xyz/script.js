const API_URL = "https://discord-bot-o1ro.onrender.com"; // Bot URL

async function fetchData() {
    const statusEl = document.getElementById('status-indicator');

    try {
        // Fetch Stats
        const statsRes = await fetch(`${API_URL}/api/stats`);
        if (!statsRes.ok) throw new Error("API Offline");
        const stats = await statsRes.json();

        document.getElementById('uptime').innerText = stats.uptime;
        document.getElementById('ping').innerText = `${Math.round(stats.ping)} ms`;
        document.getElementById('guilds').innerText = stats.guilds;
        document.getElementById('users').innerText = stats.users.toLocaleString();

        if (stats.avatar) {
            document.getElementById('bot-icon').src = stats.avatar;
        }

        statusEl.innerText = "online";
        statusEl.style.color = "#33ff33"; // Green
        statusEl.style.textShadow = "0 0 10px #33ff33";

    } catch (error) {
        console.error("Stats Error:", error);
        statusEl.innerText = "offline";
        statusEl.style.color = "#ff3333";
        // Fallback or retry logic could go here
    }
}

async function fetchCommands() {
    try {
        const cmdRes = await fetch(`${API_URL}/api/commands`);
        const commands = await cmdRes.json();
        renderCommands(commands);
    } catch (error) {
        console.error("Commands Error:", error);
        document.getElementById('command-list').innerHTML = `<p style="color:red">failed to load commands.</p>`;
    }
}

function renderCommands(commands) {
    const list = document.getElementById('command-list');
    list.innerHTML = "";

    commands.forEach(cmd => {
        const div = document.createElement('div');
        div.className = 'command-item';
        div.innerHTML = `
            <span class="command-name">,${cmd.name}</span>
            <span class="command-desc">${cmd.description}</span>
        `;
        list.appendChild(div);
    });

    // Search functionality
    document.getElementById('search').addEventListener('input', (e) => {
        const term = e.target.value.toLowerCase();
        const items = document.querySelectorAll('.command-item');

        items.forEach(item => {
            const name = item.querySelector('.command-name').innerText.toLowerCase();
            const desc = item.querySelector('.command-desc').innerText.toLowerCase();
            if (name.includes(term) || desc.includes(term)) {
                item.style.display = "block";
            } else {
                item.style.display = "none";
            }
        });
    });
}

// Initial Load
fetchData();
fetchCommands();

// Poll stats every 10 seconds
setInterval(fetchData, 10000);
