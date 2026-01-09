if (!window.UI) window.UI = {};

window.UI.PropertyListCard = function({ title, items }) {
    const rows = items.map(item => `
        <div style="display: flex; justify-content: space-between; align-items: center;">
            <span style="color: var(--text-secondary); font-size: 0.9rem;">${item.label}</span>
            <div style="display: flex; align-items: center; gap: 0.5rem;">
                ${item.linkId ? `<span id="${item.linkId}" class="clickable-count" style="font-size: 0.85rem; display: none;"></span>` : ''}
                <span id="${item.valueId}" style="font-weight: 600; color: var(--text-main); font-size: 1.1rem;">-</span>
            </div>
        </div>
    `).join('');

    return `
        <div class="card">
            <div class="card-title">${title}</div>
            <div style="display: flex; flex-direction: column; gap: 0.5rem;">
                ${rows}
            </div>
        </div>
    `;
};