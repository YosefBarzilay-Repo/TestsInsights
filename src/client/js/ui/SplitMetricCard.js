if (!window.UI) window.UI = {};

window.UI.SplitMetricCard = function({ title, leftId, leftLabel, rightId, rightLabel, leftOnClick = null, rightOnClick = null, leftTooltip = '', rightTooltip = '' }) {
    const leftStyle = leftOnClick ? 'cursor: pointer;' : '';
    const leftAttr = leftOnClick ? `onclick="${leftOnClick}"` : '';
    const leftTitle = leftTooltip ? `title="${leftTooltip}"` : '';

    const rightStyle = rightOnClick ? 'cursor: pointer;' : '';
    const rightAttr = rightOnClick ? `onclick="${rightOnClick}"` : '';
    const rightTitle = rightTooltip ? `title="${rightTooltip}"` : '';

    return `
        <div class="card">
            <div class="card-title">${title}</div>
            <div style="display: flex; justify-content: space-around; align-items: center; padding: 1rem 0;">
                <div style="text-align: center;" ${leftAttr} ${leftTitle}>
                    <div id="${leftId}" class="card-value" style="font-weight: 600; color: var(--text-main); ${leftStyle}">-</div>
                    <div style="font-size: 0.9rem; color: var(--text-secondary); margin-top: 0.25rem;">${leftLabel}</div>
                </div>
                <div style="width: 1px; height: 40px; background-color: var(--border-color);"></div>
                <div style="text-align: center;" ${rightAttr} ${rightTitle}>
                    <div id="${rightId}" class="card-value" style="font-weight: 600; color: var(--text-main); ${rightStyle}">-</div>
                    <div style="font-size: 0.9rem; color: var(--text-secondary); margin-top: 0.25rem;">${rightLabel}</div>
                </div>
            </div>
        </div>
    `;
};
