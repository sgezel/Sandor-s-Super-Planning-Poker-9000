document.addEventListener('DOMContentLoaded', () => {
    const createSessionBtn = document.getElementById('createSessionBtn');
    const joinSessionBtn = document.getElementById('joinSessionBtn');
    const createUserNameInput = document.getElementById('createUserNameInput');
    const joinUserNameInput = document.getElementById('joinUserNameInput');
    const sessionIdInput = document.getElementById('sessionIdInput');

    createSessionBtn?.addEventListener('click', async () => {
        const userName = createUserNameInput.value.trim();
        if (!userName) {
            showToast('Vul je naam in', 'warning');
            return;
        }

        const sessionId = generateSessionId();
        const url = `/Session?sessionId=${sessionId}&userName=${encodeURIComponent(userName)}&isFacilitator=true`;
        window.location.href = url;
    });

    joinSessionBtn?.addEventListener('click', async () => {
        const userName = joinUserNameInput.value.trim();
        const sessionId = sessionIdInput.value.trim().toUpperCase();

        if (!userName) {
            showToast('Vul je naam in', 'warning');
            return;
        }

        if (!sessionId) {
            showToast('Vul een sessie-ID in', 'warning');
            return;
        }

        const url = `/Session?sessionId=${sessionId}&userName=${encodeURIComponent(userName)}&isFacilitator=false`;
        window.location.href = url;
    });

    createUserNameInput?.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            createSessionBtn?.click();
        }
    });

    joinUserNameInput?.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            joinSessionBtn?.click();
        }
    });

    sessionIdInput?.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            joinSessionBtn?.click();
        }
    });
});