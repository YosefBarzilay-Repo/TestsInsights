if (!window.UI) window.UI = {};

window.UI.MetricCard = function({ title, valueId, valueClass = '', subtextHtml, extraClasses = '' }) {
    return `
        <div class="card ${extraClasses}">
            <div class="card-title">${title}</div>
            <div class="card-value ${valueClass}" id="${valueId}">-</div>
            <div class="card-subtext">
                ${subtextHtml}
            </div>
        </div>
    `;
};