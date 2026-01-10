if (!window.UI) window.UI = {};

window.UI.ChartCard = function({ title, chartId, extraClasses = '' }) {
    return `
        <div class="card ${extraClasses}" style="min-height: 200px; display: flex; flex-direction: column;">
            <div class="card-title">${title}</div>
            <div class="trend-chart-container" style="flex: 1; height: auto;">
                <div id="${chartId}" style="width: 100%; height: 100%; display: flex; align-items: flex-end;"></div>
            </div>
        </div>
    `;
};