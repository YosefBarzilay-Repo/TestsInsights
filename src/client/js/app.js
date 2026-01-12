// Aliases for easier refactoring
const DataStore = App.DataStore;
const FilterManager = App.FilterManager;
const Utils = App.Utils;
const UIManager = App.UIManager;
const AnalysisService = App.AnalysisService;

function initEventListeners() {
    const addListener = (id, event, handler) => {
        const el = document.getElementById(id);
        if (el) el.addEventListener(event, handler);
    };

    addListener('flakyCount', 'click', () => { UIManager.setFilter(FilterManager.currentFilter === 'flaky' ? 'all' : 'flaky'); UIManager.switchTab('tests'); });
    addListener('brokenCount', 'click', () => { UIManager.setFilter(FilterManager.currentFilter === 'broken' ? 'all' : 'broken'); UIManager.switchTab('tests'); });
    addListener('newFailureCount', 'click', () => { UIManager.setFilter(FilterManager.currentFilter === 'new-failure' ? 'all' : 'new-failure'); UIManager.switchTab('tests'); });
    addListener('totalExecutionsClickable', 'click', () => { UIManager.setFilter('all'); UIManager.switchTab('tests'); });

    addListener('btnExportCsv', 'click', exportDataToCsv);

    addListener('btnPrev', 'click', () => {
        if (UIManager.currentPage > 1) {
            UIManager.currentPage--;
            UIManager.renderTable();
        }
    });
    addListener('btnNext', 'click', () => {
        UIManager.currentPage++;
        UIManager.renderTable();
    });
    
    // Dynamic status filter delegation
    document.addEventListener('click', (e) => {
        if (e.target && e.target.id && e.target.id.startsWith('filter-status-')) {
            const status = e.target.id.replace('filter-status-', '');
            UIManager.setFilter(FilterManager.currentFilter === `status-${status}` ? 'all' : `status-${status}`);
            UIManager.switchTab('tests');
        }
    });
}

window.addEventListener('DOMContentLoaded', () => {
    UIManager.renderDashboard();
    initEventListeners();
    UIManager.renderTable();
    UIManager.updateInsights();
    UIManager.renderTrendChart('trendChartSmall', []);
    
    const typeSelect = document.getElementById('globalRunType');
    const verSelect = document.getElementById('globalVersion');
    if(typeSelect) typeSelect.innerHTML = '<option value="">Run Type</option>';
    if(verSelect) verSelect.innerHTML = '<option value="">Version</option>';
    
    document.getElementById('dashboard').classList.remove('hidden');

    Promise.all([
        fetch('demo/runs_table.json').then(r => r.json()),
        fetch('demo/valid_tests_list.json').then(r => r.text())
    ])
    .then(([runsData, testsText]) => {
        if (Array.isArray(runsData)) {
            runsData.forEach(r => {
                if (r.run_id) DataStore.runMetadata[r.run_id] = r;
            });
        }
        try {
            processJSON(testsText, false);
        } catch (err) {
            console.error(err);
        }
    })
    .catch(err => {
        console.error("Failed to load data", err);
    });
});

function processJSON(jsonText, renderInitialData = true) {
    const success = DataStore.processJSON(jsonText);
    if (!success) return;

    UIManager.renderDashboard();

    FilterManager.activeRunFilters = [];
    UIManager.isComparisonMode = false;

    // Initialize visible runs
    if (renderInitialData) {
        FilterManager.currentVisibleRunIds = DataStore.runStats.map(r => r.id);
    } else {
        FilterManager.currentVisibleRunIds = [];
    }

    // Populate Global Filter Dropdowns
    const typeSelect = document.getElementById('globalRunType');
    const verSelect = document.getElementById('globalVersion');
    const runIdInput = document.getElementById('globalRunId');
    const runIdList = document.getElementById('globalRunIdOptions');
    const statusSelect = document.getElementById('filterStatus');
    typeSelect.innerHTML = '<option value="">Run Type</option>';
    verSelect.innerHTML = '<option value="">Version</option>';
    if (runIdInput) runIdInput.value = '';
    if (runIdList) runIdList.innerHTML = '';
    if (statusSelect) statusSelect.innerHTML = '<option value="">All</option>';

    Array.from(DataStore.runTypes).sort().forEach(t => {
        const opt = document.createElement('option');
        opt.value = t;
        opt.textContent = t;
        typeSelect.appendChild(opt);
    });
    Array.from(DataStore.versions).sort().forEach(v => {
        const opt = document.createElement('option');
        opt.value = v;
        opt.textContent = v;
        verSelect.appendChild(opt);
    });
    if (runIdList) {
        DataStore.runStats.forEach(r => {
            const opt = document.createElement('option');
            opt.value = r.id;
            runIdList.appendChild(opt);
        });
    }
    if (statusSelect) {
        Array.from(DataStore.statuses).sort().forEach(s => {
            const opt = document.createElement('option');
            opt.value = s;
            opt.textContent = s.charAt(0).toUpperCase() + s.slice(1);
            statusSelect.appendChild(opt);
        });
    }

    const uniqueDates = new Set(DataStore.runStats.map(r => r.date).filter(d => d));
    const sortedDates = Array.from(uniqueDates).sort();

    if (sortedDates.length > 0) {
        const minDate = sortedDates[0];
        const maxDate = sortedDates[sortedDates.length - 1];
        const fromInput = document.getElementById('filterDateFrom');
        const toInput = document.getElementById('filterDateTo');
        if (fromInput) { fromInput.min = minDate; fromInput.max = maxDate; }
        if (toInput) { toInput.min = minDate; toInput.max = maxDate; }
    }

    FilterManager.columnFilters = {};

    if (renderInitialData) {
        UIManager.setFilter('all');
        UIManager.updateInsights();
        UIManager.updateInsights(FilterManager.currentVisibleRunIds);
        UIManager.unlockDashboard();
    } else {
        FilterManager.currentFilter = 'all';
        const totalClickable = document.getElementById('totalExecutionsClickable');
        if (totalClickable) totalClickable.classList.add('filter-active');
        
        UIManager.renderTable();
        UIManager.renderTrendChart('trendChartSmall', []);
    }

    document.getElementById('dashboard').classList.remove('hidden');
}

// Close dropdown when clicking outside
document.addEventListener('click', function (e) {
    const dropdown = document.getElementById('filterDropdown');
    if (dropdown.style.display === 'block' && !e.target.closest('.th-interactive')) {
        dropdown.style.display = 'none';
    }

    const dateMenu = document.getElementById('dateFilterMenu');
    const dateBtn = document.getElementById('dateFilterBtn');
    if (dateMenu && dateMenu.style.display === 'block' && !dateMenu.contains(e.target) && !dateBtn.contains(e.target)) {
        dateMenu.style.display = 'none';
    }

    const mainMenu = document.getElementById('mainFilterMenu');
    const mainBtn = document.getElementById('mainFilterBtn');
    if (mainMenu && mainMenu.style.display === 'flex' && !mainMenu.contains(e.target) && !mainBtn.contains(e.target)) {
        mainMenu.style.display = 'none';
    }

    const profileMenu = document.getElementById('profileMenu');
    const profileBtn = document.getElementById('btnProfile');
    if (profileMenu && profileMenu.style.display === 'block' && !profileMenu.contains(e.target) && !profileBtn.contains(e.target)) {
        profileMenu.style.display = 'none';
    }

    const insightsMenu = document.getElementById('insightsSettingsMenu');
    const insightsBtn = document.getElementById('btnInsightsSettings');
    if (insightsMenu && insightsMenu.style.display === 'block' && !insightsMenu.contains(e.target) && !insightsBtn.contains(e.target)) {
        insightsMenu.style.display = 'none';
    }

    const testsMenu = document.getElementById('testsSettingsMenu');
    const testsBtn = document.getElementById('btnTestsSettings');
    if (testsMenu && testsMenu.style.display === 'block' && !testsMenu.contains(e.target) && !testsBtn.contains(e.target)) {
        testsMenu.style.display = 'none';
    }
});

// Close modal on outside click
document.getElementById('detailModal').addEventListener('click', function (e) {
    if (e.target === this) UIManager.closeModal();
});
document.getElementById('runComparisonModal').addEventListener('click', function (e) {
    if (e.target === this) UIManager.closeRunComparisonModal();
});
document.getElementById('advancedFilterModal').addEventListener('click', function (e) {
    if (e.target === this) UIManager.closeAdvancedFilter();
});

function exportDataToCsv() {
    // 1. Gather Insights
    const insights = [
        ['Insight', 'Value'],
        ['Total Runs', document.getElementById('totalRuns').textContent],
        ['Total Unique Tests', document.getElementById('totalTestsDisplay').textContent],
        ['Total Executions', document.getElementById('totalExecutions').textContent],
        [],
        ['Status', 'Count'],
        ['Passed', document.getElementById('countPassed').textContent],
        ['Failed', document.getElementById('countFailed').textContent],
        ['Skipped', document.getElementById('countSkipped').textContent],
        [],
        ['Metric', 'Count', 'Rate'],
        ['Flaky Tests', document.getElementById('flakyCount').textContent, document.getElementById('flakyRate').textContent],
        ['Continuous Failing', document.getElementById('brokenCount').textContent, document.getElementById('brokenRate').textContent],
        [],
        []
    ];


    // 2. Gather Table Data (re-implementing filtering logic from renderTable)
    const tableHeader = ['Test Name', 'Test Group', 'Run ID', 'Start Time', 'End Time', 'Duration', 'Passed', 'Failed', 'Skipped'];
    const tableRows = [];


    let tests = Object.keys(DataStore.testHistory);

    const effectiveRunIds = FilterManager.activeRunFilters.length > 0 ? FilterManager.activeRunFilters : FilterManager.currentVisibleRunIds;
    const effectiveRunIdsSet = new Set(effectiveRunIds);

    const testsInEffectiveRuns = new Set();
    effectiveRunIds.forEach(runId => {
        const runTests = DataStore.runToTestsMap[runId] || new Set();
        runTests.forEach(testName => testsInEffectiveRuns.add(testName));
    });
    tests = tests.filter(name => testsInEffectiveRuns.has(name));
    
    if (FilterManager.currentFilter !== 'all') {
        tests = tests.filter(name => {
            const statuses = new Set();
            const details = DataStore.testDetails[name] || [];
            details.forEach(d => {
                if (effectiveRunIdsSet.has(d.runId)) {
                    statuses.add(d.status);
                }
            });

            if (FilterManager.currentFilter === 'flaky') {
                return statuses.has('passed') && statuses.has('failed');
            } else if (FilterManager.currentFilter === 'failing') {
                return statuses.has('failed');
            } else if (FilterManager.currentFilter === 'broken') {
                return !statuses.has('passed') && statuses.has('failed');
            } else if (FilterManager.currentFilter === 'passed-only') {
                return statuses.size === 1 && statuses.has('passed');
            } else if (FilterManager.currentFilter === 'skipped-any') {
                return statuses.has('skipped');
            }
            return true;
        });
    }

    tests.forEach(testName => {
        const history = DataStore.testHistory[testName];
        const totalRuns = history.length;
        const passedCount = history.filter(s => s === 'passed').length;
        const failedCount = history.filter(s => s === 'failed').length;
        const skippedCount = totalRuns - passedCount - failedCount;
        const groupName = DataStore.testGroups[testName] || '--';

        // Calculate Time & Duration (Latest Run)
        let startTime = '-';
        let endTime = '-';
        let durationStr = '-';
        let runId = '-';

        let details = DataStore.testDetails[testName] || [];
        details = details.filter(d => effectiveRunIdsSet.has(d.runId));

        if (details.length > 0) {
            const latest = details.reduce((prev, current) => {
                const numA = parseFloat(prev.runId);
                const numB = parseFloat(current.runId);
                if (!isNaN(numA) && !isNaN(numB)) return (numA > numB) ? prev : current;
                return (prev.runId > current.runId) ? prev : current;
            });
            runId = latest.runId || '-';
            startTime = latest.start || '-';
            endTime = latest.end || '-';
            if (startTime !== '-' && endTime !== '-') {
                const s = Utils.parseTimeSeconds(startTime);
                const e = Utils.parseTimeSeconds(endTime);
                let d = e - s;
                if (d < 0) d += 86400;
                durationStr = d.toFixed(1) + 's';
            }
        }

        const displayName = DataStore.testNames[testName] || testName;
        tableRows.push([displayName, groupName, runId, startTime, endTime, durationStr, passedCount, failedCount, skippedCount]);
    });


    // 3. Construct CSV String
    const escapeCsvCell = (cell) => `"${String(cell).replace(/"/g, '""')}"`;
    let csvContent = insights.map(rowArray => rowArray.map(escapeCsvCell).join(',')).join('\r\n');
    csvContent += '\r\n' + tableHeader.map(escapeCsvCell).join(',') + '\r\n';
    csvContent += tableRows.map(rowArray => rowArray.map(escapeCsvCell).join(',')).join('\r\n');


    // 4. Trigger Download
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", "tests_insights_export.csv");
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

// Setup Autocomplete Listeners
(function setupAutocomplete() {
    const inputs = [
        { id: 'filterTestName', listId: 'testNameOptions', getData: () => Array.from(new Set(Object.values(DataStore.testNames))).sort() },
        { id: 'filterTestGroup', listId: 'testGroupOptions', getData: () => Array.from(new Set(Object.values(DataStore.testGroups))).filter(g => g && g !== '--').sort() },
        { id: 'filterRunId', listId: 'runIdOptions', getData: () => DataStore.runStats.map(r => r.id).sort() }
    ];

    inputs.forEach(config => {
        const input = document.getElementById(config.id);
        const list = document.getElementById(config.listId);

        input.addEventListener('input', function () {
            const val = this.value.toLowerCase();
            list.innerHTML = '';

            if (val.length < 2) return;

            const data = config.getData();
            const matches = data.filter(item => String(item).toLowerCase().includes(val));

            matches.slice(0, 50).forEach(item => {
                const opt = document.createElement('option');
                opt.value = item;
                list.appendChild(opt);
            });
        });
    });
})();