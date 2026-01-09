if (!window.UI) window.UI = {};

window.UI.DistributionCard = function({ title, totalId, totalLabel = 'Total', items }) {
    const legendItems = items.map(item => `
        <div id="${item.clickId}" class="legend-item clickable-legend">
            <span class="legend-dot ${item.colorClass}"></span>
            <span>${item.label}: <strong id="${item.percentId}">-</strong>% (<span id="${item.countId}">-</span>)</span>
        </div>
    `).join('');

    const bars = items.map(item => `
        <div id="${item.barId}" class="progress-fill ${item.colorClass}" style="width: 0%"></div>
    `).join('');

    return `
        <div class="card">
            <div class="card-title" style="display: flex; justify-content: space-between; align-items: center;">
                <span>${title}</span>
                <span id="${totalId}Clickable" class="clickable-legend" style="font-size: 0.75rem; color: var(--text-secondary); text-transform: none; font-weight: normal;">
                    ${totalLabel}: <strong id="${totalId}" style="color: var(--text-main);">-</strong>
                </span>
            </div>
            <div class="status-legend">
                ${legendItems}
            </div>
            <div class="progress-track">
                ${bars}
            </div>
        </div>
    `;
};