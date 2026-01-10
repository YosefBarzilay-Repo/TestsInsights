if (!window.UI) window.UI = {};

window.UI.MetricCard = function({ title, valueId, valueClass = '', subtextHtml = '', onClick = null, tooltip = '' }) {
    const cursorStyle = onClick ? 'cursor: pointer;' : '';
    const clickAttr = onClick ? `onclick="${onClick}"` : '';
    const titleAttr = tooltip ? `title="${tooltip}"` : '';

    return `
        <div class="card metric-card">
            <div class="card-title">${title}</div>
            <div id="${valueId}" class="card-value ${valueClass}" style="${cursorStyle}" ${clickAttr} ${titleAttr}>-</div>
            <div class="card-subtext">${subtextHtml}</div>
        </div>
    `;
};
