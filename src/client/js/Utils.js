window.App = window.App || {};
window.App.Utils = {
    parseTimeSeconds: function(timeStr) {
        if (!timeStr || timeStr === '-') return 0;
        const parts = timeStr.split(':');
        if (parts.length < 2) return 0;
        return (+parts[0]) * 3600 + (+parts[1]) * 60 + (+parts[2] || 0);
    },
    formatDuration: function(seconds) {
        if (seconds < 60) return seconds.toFixed(1) + 's';
        const m = Math.floor(seconds / 60);
        const sRem = (seconds % 60).toFixed(0);
        return `${m}m ${sRem}s`;
    }
};