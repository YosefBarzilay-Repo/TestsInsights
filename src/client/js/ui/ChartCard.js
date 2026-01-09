if (!window.UI) window.UI = {};

window.UI.ChartCard = function({ title, chartId, extraClasses = '' }) {
    return `
        <div class="card ${extraClasses}" style="min-height: 200px; display: flex; flex-direction: column;">
            <div class="card-title">${title}</div>
            <div class="trend-chart-container" style="flex: 1; height: auto;">
                <div id="${chartId}" style="width: 100%; height: 100%; display: flex; align-items: flex-end;"></div>
                <div class="trend-chart-controls">
                    <button id="compareRunsBtn" class="btn-icon" onclick="toggleComparisonMode(); switchTab('tests')" title="Select 2-3 runs to compare" disabled>
                        <span class="material-symbols-outlined">compare_arrows</span>
                    </button>
                    <button id="clearRunFilterBtn" class="btn-icon" onclick="clearRunSelection()" title="Clear Selection" disabled>
                        <span class="material-symbols-outlined">close</span>
                    </button>
                    <button class="btn-icon" onclick="openTrendModal()" title="Enlarge" disabled>
                        <span class="material-symbols-outlined">open_in_full</span>
                    </button>
                </div>
            </div>
        </div>
    `;
};