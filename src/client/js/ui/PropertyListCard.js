if (!window.UI) window.UI = {};

window.UI.PropertyListCard = function({ title, items }) {
    const listHtml = items.map(item => {
        // If a linkId is provided, render a hidden link next to the value
        const valuePart = item.linkId 
            ? `<a id="${item.linkId}" href="#" class="text-link" style="display:none; margin-right: 6px;">-</a><span id="${item.valueId}">-</span>`
            : `<span id="${item.valueId}">-</span>`;
            
        return `
            <div style="display: flex; justify-content: space-between; margin-bottom: 0.75rem; font-size: 1rem;">
                <span style="color: var(--text-secondary);">${item.label}</span>
                <span style="font-family: var(--font-mono); color: var(--text-main);">${valuePart}</span>
            </div>
        `;
    }).join('');

    return `
        <div class="card">
            <div class="card-title">${title}</div>
            <div style="margin-top: 1rem;">
                ${listHtml}
            </div>
        </div>
    `;
};
