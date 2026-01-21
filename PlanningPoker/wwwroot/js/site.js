function generateSessionId() {
    return Math.random().toString(36).substring(2, 8).toUpperCase();
}

function copyToClipboard(text) {
    navigator.clipboard.writeText(text).then(() => {
        showToast('Gekopieerd naar klembord!', 'success');
    }).catch(err => {
        showToast('Kon niet kopiëren', 'error');
    });
}

function showToast(message, type = 'info') {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');

    const colorMap = {
        'success': '#10B981',
        'error': '#EF4444',
        'warning': '#F59E0B',
        'info': '#4F46E5'
    };

    toast.style.background = colorMap[type] || colorMap['info'];
    toast.className = 'toast px-6 py-3 rounded-xl shadow-2xl text-white font-medium';
    toast.textContent = message;

    container.appendChild(toast);

    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateY(-20px)';
        toast.style.transition = 'all 0.3s ease';
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

function getInitials(name) {
    return name.split(' ').map(n => n[0]).join('').toUpperCase().substring(0, 2);
}

function getRandomColor() {
    const colors = [
        'linear-gradient(135deg, #6366F1 0%, #8B5CF6 100%)',
        'linear-gradient(135deg, #EC4899 0%, #F43F5E 100%)',
        'linear-gradient(135deg, #14B8A6 0%, #0EA5E9 100%)',
        'linear-gradient(135deg, #84CC16 0%, #22C55E 100%)',
        'linear-gradient(135deg, #F59E0B 0%, #EF4444 100%)',
        'linear-gradient(135deg, #06B6D4 0%, #3B82F6 100%)',
        'linear-gradient(135deg, #F97316 0%, #EAB308 100%)',
        'linear-gradient(135deg, #8B5CF6 0%, #D946EF 100%)',
        'linear-gradient(135deg, #0EA5E9 0%, #6366F1 100%)',
        'linear-gradient(135deg, #F43F5E 0%, #EC4899 100%)',
        'linear-gradient(135deg, #10B981 0%, #14B8A6 100%)',
        'linear-gradient(135deg, #6366F1 0%, #4F46E5 100%)'
    ];
    return colors[Math.floor(Math.random() * colors.length)];
}
