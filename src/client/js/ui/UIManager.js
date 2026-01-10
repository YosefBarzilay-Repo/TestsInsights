window.App = window.App || {};

window.App.UIManager = {
    currentPage: 1,
    itemsPerPage: 20,
    isComparisonMode: false,
    activeSavedFilterSettingsBtn: null,
    tooltipTimeout: null,
    sortState: { column: null, direction: 'asc' },

    switchTab: function(tabName) {
        const btn = document.getElementById(`tab-${tabName}`);
        if (btn.classList.contains('disabled')) return;

        document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
        document.getElementById(`tab-${tabName}`).classList.add('active');

        document.getElementById('content-insights').classList.add('hidden');
        document.getElementById('details').classList.add('hidden');
        document.getElementById('content-deepThink').classList.add('hidden');

        document.getElementById('btnInsightsSettings').classList.add('hidden');
        document.getElementById('btnExportCsv').classList.add('hidden');
        document.getElementById('testsSeparator').classList.add('hidden');
        document.getElementById('btnClearFilters').classList.add('hidden');
        document.getElementById('btnCompareRuns').classList.add('hidden');

        if (tabName === 'insights') {
            document.getElementById('content-insights').classList.remove('hidden');
            document.getElementById('btnInsightsSettings').classList.remove('hidden');
        } else if (tabName === 'tests') {
            document.getElementById('details').classList.remove('hidden');
            document.getElementById('btnCompareRuns').classList.remove('hidden');
            document.getElementById('btnExportCsv').classList.remove('hidden');
            document.getElementById('testsSeparator').classList.remove('hidden');
            setTimeout(() => { this.renderTable(); }, 0);
        } else if (tabName === 'deepThink') {
            document.getElementById('content-deepThink').classList.remove('hidden');
        }
    },

    unlockDashboard: function() {
        document.getElementById('emptyState').classList.add('hidden');
        document.getElementById('tabContentContainer').classList.remove('hidden');
        document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('disabled'));
    },

    dismissCard: function(checkbox) {
        const card = checkbox.closest('.recommendation-card');
        if (checkbox.checked) card.classList.add('dismissed');
        else card.classList.remove('dismissed');
    },

    clearDeepThink: function() {
        const container = document.getElementById('deepThinkResults');
        const intro = document.getElementById('deepThinkIntro');
        if (container) {
            container.innerHTML = '';
            container.style.display = 'none';
        }
        if (intro) intro.style.display = 'block';

        const btn = document.getElementById('btnGenerateAnalysis');
        if (btn) {
            btn.innerHTML = '<span class="material-symbols-outlined">auto_awesome</span> Generate Analysis';
            btn.disabled = false;
        }
        document.getElementById('btnExportDeepThink')?.classList.add('hidden');
    },

    renderDashboard: function() {
        const container = document.getElementById('insightsContent');
        if (!container) return;
        if (!window.UI) window.UI = {};

        let html = '';
        html += window.UI.SplitMetricCard({ 
            title: 'Total Scope', 
            leftId: 'filterBarRunCount', 
            leftLabel: 'Runs', 
            rightId: 'filterBarTestCount', 
            rightLabel: 'Tests',
            leftOnClick: "App.UIManager.setFilter('all'); App.UIManager.switchTab('tests');",
            rightOnClick: "App.UIManager.setFilter('all'); App.UIManager.switchTab('tests');",
            leftTooltip: "Show all runs in the list",
            rightTooltip: "Show all tests in the list"
        });
        html += window.UI.ChartCard({ title: 'Execution Trend', chartId: 'trendChartSmall', extraClasses: 'col-span-2' });
        html += window.UI.PropertyListCard({ title: 'Execution Time', items: [{ label: 'Average', valueId: 'statAvgTime' }, { label: 'Max', valueId: 'statMaxTime', linkId: 'statMaxRunLink' }, { label: 'Min', valueId: 'statMinTime', linkId: 'statMinRunLink' }] });
        html += window.UI.DistributionCard({ title: 'Status Distribution', totalId: 'totalExecutions', items: [
            { label: 'Passed', colorClass: 'bg-green', clickId: 'passedFilterClickable', percentId: 'percentPassed', countId: 'countPassed', barId: 'barPassed' },
            { label: 'Failed', colorClass: 'bg-red', clickId: 'failedFilterClickable', percentId: 'percentFailed', countId: 'countFailed', barId: 'barFailed' },
            { label: 'Skipped', colorClass: 'bg-grey', clickId: 'skippedFilterClickable', percentId: 'percentSkipped', countId: 'countSkipped', barId: 'barSkipped' }
        ] });
        html += window.UI.MetricCard({ title: 'Overall Stability Score', valueId: 'stabilityScore', subtextHtml: 'Based on flaky and broken test rates', tooltip: 'Score calculated from failure and flakiness rates' });
        html += window.UI.MetricCard({ 
            title: 'Critical Issues', 
            valueId: 'criticalIssuesCount', 
            valueClass: 'text-red', 
            subtextHtml: 'Tests consistently failing',
            onClick: "App.UIManager.setFilter('broken'); App.UIManager.switchTab('tests');",
            tooltip: "Show tests that failed in all selected runs"
        });
        html += window.UI.MetricCard({ 
            title: 'Flaky Tests', 
            valueId: 'flakyRate', 
            subtextHtml: '<span id="flakyCount" class="clickable-count">-</span> flaky tests of <span id="totalTests">-</span> total',
            onClick: "App.UIManager.setFilter('flaky'); App.UIManager.switchTab('tests');",
            tooltip: "Show tests with unstable results (flipping status)"
        });
        html += window.UI.MetricCard({ 
            title: 'Continuous Failing', 
            valueId: 'brokenRate', 
            subtextHtml: '<span id="brokenCount" class="clickable-count">-</span> failing tests of <span id="totalTestsBroken">-</span> total',
            onClick: "App.UIManager.setFilter('broken'); App.UIManager.switchTab('tests');",
            tooltip: "Show tests failing consecutively for a long period"
        });
        html += window.UI.MetricCard({ 
            title: 'First Time Failure', 
            valueId: 'newFailureRate', 
            subtextHtml: '<span id="newFailureCount" class="clickable-count">-</span> tests started failing in last <span id="displayNewFailureDays">7</span> days',
            onClick: "App.UIManager.setFilter('new-failure'); App.UIManager.switchTab('tests');",
            tooltip: "Show tests that recently started failing"
        });
        html += window.UI.TableWidgetCard({ title: 'Group Status Deviation', containerId: 'groupDeviationContainer' });

        container.innerHTML = html;
    },

    updateFilterDisplay: function() {
        const FilterManager = App.FilterManager;
        const parts = [];
        
        const createTag = (label, value, onClickJs) => {
            return `<span class="filter-chip" style="display: inline-flex; align-items: center; margin-right: 12px; cursor: default;" onmouseover="this.querySelector('.remove-filter-btn').style.display='inline-block'" onmouseout="this.querySelector('.remove-filter-btn').style.display='none'">
                <span style="margin-right: 4px;"><b>${label}:</b> ${value}</span>
                <span class="remove-filter-btn material-symbols-outlined" style="display: none; font-size: 14px; cursor: pointer; color: var(--text-muted);" onclick="${onClickJs}" title="Remove filter">close</span>
            </span>`;
        };

        if (FilterManager.currentFilter !== 'all') {
            const names = { 'flaky': 'Flaky Tests', 'broken': 'Continuous Failing', 'new-failure': 'New Failures', 'passed-only': 'Passed Tests', 'failing': 'Failed Tests', 'skipped-any': 'Skipped Tests' };
            parts.push(createTag('Status', names[FilterManager.currentFilter] || FilterManager.currentFilter, "App.UIManager.setFilter('all')"));
        }

        if (FilterManager.activeRunFilters.length > 0) {
            let val = '';
            if (FilterManager.activeRunFilters.length <= 5) val = FilterManager.activeRunFilters.join(', ');
            else val = `${FilterManager.activeRunFilters.length} selected`;
            parts.push(createTag('Run', val, "App.UIManager.clearRunSelection()"));
        }

        const typeEl = document.getElementById('globalRunType');
        if (typeEl && typeEl.value) parts.push(createTag('Run Type', typeEl.value, "App.UIManager.clearFilter('globalRunType')"));
        const verEl = document.getElementById('globalVersion');
        if (verEl && verEl.value) parts.push(createTag('Version', verEl.value, "App.UIManager.clearFilter('globalVersion')"));
        const runIdEl = document.getElementById('globalRunId');
        if (runIdEl && runIdEl.value) parts.push(createTag('Run', runIdEl.value, "App.UIManager.clearFilter('globalRunId')"));

        const lastDays = document.getElementById('filterLastDays')?.value;
        const fromDate = document.getElementById('filterDateFrom')?.value;
        const toDate = document.getElementById('filterDateTo')?.value;

        if (lastDays) parts.push(createTag('Date', `Last ${lastDays} Days`, "App.UIManager.clearDateRange()"));
        else if (fromDate && toDate) parts.push(createTag('Date', `${fromDate} - ${toDate}`, "App.UIManager.clearDateRange()"));
        else if (fromDate) parts.push(createTag('Date', `From ${fromDate}`, "App.UIManager.clearDateRange()"));
        else if (toDate) parts.push(createTag('Date', `Until ${toDate}`, "App.UIManager.clearDateRange()"));

        let html = parts.join('');
        if (parts.length === 0) html = 'No filter selected';
        const el = document.getElementById('commonFilterDisplay');
        if (el) el.innerHTML = html;
    },

    setFilter: function(filter) {
        App.FilterManager.currentFilter = filter;
        this.isComparisonMode = false;
        this.updateCompareButtonState();

        const toggleActive = (id, isActive) => {
            const el = document.getElementById(id);
            if (el) el.classList.toggle('filter-active', isActive);
        };

        toggleActive('flakyCount', filter === 'flaky');
        toggleActive('brokenCount', filter === 'broken');
        toggleActive('newFailureCount', filter === 'new-failure');
        toggleActive('passedFilterClickable', filter === 'passed-only');
        toggleActive('failedFilterClickable', filter === 'failing');
        toggleActive('skippedFilterClickable', filter === 'skipped-any');
        toggleActive('totalExecutionsClickable', filter === 'all');

        this.updateFilterDisplay();
        this.currentPage = 1;
        this.updateInsights(App.FilterManager.activeRunFilters.length > 0 ? App.FilterManager.activeRunFilters : App.FilterManager.currentVisibleRunIds);
        this.renderTable();
        this.applyGlobalRunFilters();
    },

    toggleSort: function(columnId) {
        if (this.sortState.column === columnId) {
            this.sortState.direction = this.sortState.direction === 'asc' ? 'desc' : 'asc';
        } else {
            this.sortState.column = columnId;
            this.sortState.direction = 'asc';
        }
        this.renderTable();
    },

    openColumnFilter: function(event, columnId) {
        event.stopPropagation();
        const dropdown = document.getElementById('filterDropdown');
        const currentVal = App.FilterManager.columnFilters[columnId] || '';
        
        dropdown.innerHTML = `
            <div style="padding: 0.75rem; min-width: 200px;">
                <div class="form-group" style="margin-bottom: 0.75rem;">
                    <label class="form-label" style="font-size: 12px;">Filter by ${columnId}</label>
                    <input type="text" id="colFilterInput" class="form-input" value="${currentVal}" placeholder="Contains..." autofocus>
                </div>
                <div style="display: flex; justify-content: flex-end; gap: 0.5rem;">
                    <button class="btn btn-secondary" style="height: 24px; font-size: 12px;" onclick="document.getElementById('filterDropdown').style.display='none'">Close</button>
                    <button class="btn btn-primary" style="height: 24px; font-size: 12px;" onclick="App.UIManager.applyColumnFilter('${columnId}')">Apply</button>
                </div>
            </div>
        `;
        
        const rect = event.currentTarget.getBoundingClientRect();
        dropdown.style.top = (rect.bottom + window.scrollY) + 'px';
        dropdown.style.left = (rect.left - 100) + 'px'; // Adjust to not go off screen
        dropdown.style.display = 'block';
        
        const input = document.getElementById('colFilterInput');
        input.focus();
        input.onkeydown = (e) => { if(e.key === 'Enter') this.applyColumnFilter(columnId); };
    },

    applyColumnFilter: function(columnId) {
        const val = document.getElementById('colFilterInput').value;
        if (val) {
            App.FilterManager.columnFilters[columnId] = val;
        } else {
            delete App.FilterManager.columnFilters[columnId];
        }
        document.getElementById('filterDropdown').style.display = 'none';
        this.currentPage = 1;
        this.renderTable();
    },

    toggleMainFilterMenu: function(e) {
        e.stopPropagation();
        const menu = document.getElementById('mainFilterMenu');
        const dateMenu = document.getElementById('dateFilterMenu');
        if (dateMenu) dateMenu.style.display = 'none';
        menu.style.display = menu.style.display === 'flex' ? 'none' : 'flex';
    },

    toggleSavedFilterSettings: function(e) {
        e.stopPropagation();
        const btn = e.currentTarget;
        const existing = document.getElementById('savedFilterSettingsMenu');
        if (existing) {
            existing.remove();
            if (this.activeSavedFilterSettingsBtn === btn) {
                this.activeSavedFilterSettingsBtn = null;
                return;
            }
        }
        this.activeSavedFilterSettingsBtn = btn;
        const rect = btn.getBoundingClientRect();
        const menu = document.createElement('div');
        menu.id = 'savedFilterSettingsMenu';
        menu.className = 'dropdown-menu';
        menu.style.display = 'block';
        menu.style.position = 'fixed';
        menu.style.top = rect.top + 'px';
        menu.style.left = rect.right + 'px';
        menu.style.minWidth = '150px';
        menu.style.zIndex = '10000';
        ['Make as default', 'Share', 'Delete'].forEach(action => {
            const item = document.createElement('div');
            item.className = 'dropdown-item';
            item.textContent = action;
            item.style.color = 'var(--text-muted)';
            item.style.cursor = 'not-allowed';
            item.onclick = (ev) => ev.stopPropagation();
            menu.appendChild(item);
        });
        document.body.appendChild(menu);
        setTimeout(() => document.addEventListener('click', function closeMenu() {
            if (menu.parentNode) menu.parentNode.removeChild(menu);
            App.UIManager.activeSavedFilterSettingsBtn = null;
            document.removeEventListener('click', closeMenu);
        }), 0);
    },

    getTestDisplayDetails: function(testName) {
        const DataStore = App.DataStore;
        const FilterManager = App.FilterManager;
        const Utils = App.Utils;

        let details = DataStore.testDetails[testName] || [];
        if (FilterManager.activeRunFilters.length > 0) {
            details = details.filter(d => FilterManager.activeRunFilters.includes(d.runId));
        }
        const effectiveRunIds = FilterManager.activeRunFilters.length > 0 ? FilterManager.activeRunFilters : FilterManager.currentVisibleRunIds;
        details = details.filter(d => effectiveRunIds.includes(d.runId));

        if (details.length === 0) return { runId: '-', start: '-', end: '-', duration: 0, group: DataStore.testGroups[testName] || '--', status: '-', runType: '-', version: '-' };

        const latest = details.reduce((prev, current) => {
            const numA = parseFloat(prev.runId);
            const numB = parseFloat(current.runId);
            if (!isNaN(numA) && !isNaN(numB)) return (numA > numB) ? prev : current;
            return (prev.runId > current.runId) ? prev : current;
        });

        let duration = 0;
        if (latest.start !== '-' && latest.end !== '-') {
            const s = Utils.parseTimeSeconds(latest.start);
            const e = Utils.parseTimeSeconds(latest.end);
            duration = e - s;
            if (duration < 0) duration += 86400;
        }

        return {
            runId: latest.runId,
            start: latest.start,
            end: latest.end,
            duration: duration,
            group: DataStore.testGroups[testName] || '--',
            status: latest.status,
            runType: latest.runType || '-',
            version: latest.version || '-'
        };
    },

    renderTable: function() {
        const DataStore = App.DataStore;
        const FilterManager = App.FilterManager;
        const Utils = App.Utils;

        const thead = document.querySelector('#details table thead');
        const tbody = document.getElementById('testTableBody');
        tbody.innerHTML = '';

        const isColFilterActive = Object.keys(FilterManager.columnFilters).length > 0;

        if (!FilterManager.isAnyFilterActive() && !isColFilterActive) {
            tbody.innerHTML = '';
            document.getElementById('pageStart').textContent = 0;
            document.getElementById('pageEnd').textContent = 0;
            document.getElementById('totalItems').textContent = 0;
            document.getElementById('btnPrev').disabled = true;
            document.getElementById('btnNext').disabled = true;
            return;
        }

        const settings = JSON.parse(localStorage.getItem('insightsSettings')) || { newFailureVal: 7 };
        const newFailureDays = parseInt(settings.newFailureVal) || 7;

        const clearBtn = document.getElementById('btnClearFilters');
        const isTestsTab = document.getElementById('tab-tests').classList.contains('active');
        if (clearBtn) {
            if (isTestsTab && isColFilterActive) clearBtn.classList.remove('hidden');
            else clearBtn.classList.add('hidden');
        }

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
                    if (effectiveRunIdsSet.has(d.runId)) statuses.add(d.status);
                });
                if (statuses.size === 0) return false;

                if (FilterManager.currentFilter === 'flaky') return statuses.has('passed') && statuses.has('failed');
                else if (FilterManager.currentFilter === 'failing') return statuses.has('failed');
                else if (FilterManager.currentFilter === 'broken') return !statuses.has('passed') && statuses.has('failed');
                else if (FilterManager.currentFilter === 'passed-only') return statuses.size === 1 && statuses.has('passed');
                else if (FilterManager.currentFilter === 'skipped-any') return statuses.has('skipped');
                else if (FilterManager.currentFilter === 'new-failure') {
                    const details = DataStore.testDetails[name] || [];
                    const failures = details.filter(d => d.status === 'failed');
                    if (failures.length === 0) return false;
                    let earliestFailDate = null;
                    failures.forEach(f => {
                        if (!f.date || f.date === '-') return;
                        const d = new Date(f.date);
                        if (!earliestFailDate || d < earliestFailDate) earliestFailDate = d;
                    });
                    if (!earliestFailDate) return false;
                    const dates = DataStore.runStats.map(r => r.date).filter(d => d).sort();
                    const latestDate = dates.length > 0 ? new Date(dates[dates.length - 1]) : new Date();
                    const windowMs = newFailureDays * 24 * 60 * 60 * 1000;
                    const diff = latestDate - earliestFailDate;
                    return diff >= 0 && diff <= windowMs;
                }
                return true;
            });
        }

        // Apply Column Filters
        if (isColFilterActive) {
            tests = tests.filter(testName => {
                const details = this.getTestDisplayDetails(testName);
                const rowData = {
                    'Test Name': testName,
                    'Group': details.group,
                    'Status': details.status,
                    'Run ID': String(details.runId),
                    'Start Time': details.start,
                    'End Time': details.end,
                    'Duration': Utils.formatDuration(details.duration)
                };

                for (const [col, filterVal] of Object.entries(FilterManager.columnFilters)) {
                    if (!String(rowData[col] || '').toLowerCase().includes(filterVal.toLowerCase())) return false;
                }
                return true;
            });
        }

        // Apply Sorting
        if (this.sortState.column) {
            const col = this.sortState.column;
            const dir = this.sortState.direction === 'asc' ? 1 : -1;
            
            tests.sort((a, b) => {
                const detailsA = this.getTestDisplayDetails(a);
                const detailsB = this.getTestDisplayDetails(b);
                let valA, valB;

                switch(col) {
                    case 'Test Name': valA = a; valB = b; break;
                    case 'Group': valA = detailsA.group; valB = detailsB.group; break;
                    case 'Status': valA = detailsA.status; valB = detailsB.status; break;
                    case 'Run ID': valA = detailsA.runId; valB = detailsB.runId; break;
                    case 'Start Time': valA = detailsA.start; valB = detailsB.start; break;
                    case 'End Time': valA = detailsA.end; valB = detailsB.end; break;
                    case 'Duration': valA = detailsA.duration; valB = detailsB.duration; break;
                    default: return 0;
                }

                if (valA < valB) return -1 * dir;
                if (valA > valB) return 1 * dir;
                return 0;
            });
        }

        const totalItems = tests.length;
        const totalPages = Math.ceil(totalItems / this.itemsPerPage);
        const startIdx = (this.currentPage - 1) * this.itemsPerPage;
        const endIdx = startIdx + this.itemsPerPage;
        const paginatedTests = tests.slice(startIdx, endIdx);

        document.getElementById('pageStart').textContent = totalItems > 0 ? startIdx + 1 : 0;
        document.getElementById('pageEnd').textContent = Math.min(endIdx, totalItems);
        document.getElementById('totalItems').textContent = totalItems;
        document.getElementById('btnPrev').disabled = this.currentPage <= 1;
        document.getElementById('btnNext').disabled = this.currentPage >= totalPages;

        if (this.isComparisonMode && FilterManager.activeRunFilters.length >= 2 && FilterManager.activeRunFilters.length <= 3) {
            const sortedRuns = [...FilterManager.activeRunFilters].sort((a, b) => (parseFloat(a) || 0) - (parseFloat(b) || 0));
            let headerHtml = '<tr><th>Test Name</th><th>Test Group</th>';
            sortedRuns.forEach(runId => { headerHtml += `<th class="text-center">Run ${runId}</th>`; });
            headerHtml += '</tr>';
            thead.innerHTML = headerHtml;

            for (const testName of paginatedTests) {
                const row = document.createElement('tr');
                const nameCell = document.createElement('td');
                const nameLink = document.createElement('span');
                nameLink.textContent = DataStore.testNames[testName] || testName;
                nameLink.className = 'test-name-link';
                nameLink.onclick = () => this.openTestDetails(testName);
                nameCell.appendChild(nameLink);
                row.appendChild(nameCell);
                const groupCell = document.createElement('td');
                groupCell.textContent = DataStore.testGroups[testName] || '--';
                row.appendChild(groupCell);
                sortedRuns.forEach(runId => {
                    const cell = document.createElement('td');
                    cell.className = 'text-center';
                    const runDetail = DataStore.testDetails[testName].find(d => d.runId === runId);
                    if (runDetail) {
                        let pillClass = ['passed', 'failed', 'skipped'].includes(runDetail.status) ? `pill-${runDetail.status}` : 'pill-other';
                        cell.innerHTML = `<span class="status-pill ${pillClass}"></span>${runDetail.status}`;
                    } else {
                        cell.innerHTML = '<span style="color:#ccc">-</span>';
                    }
                    row.appendChild(cell);
                });
                tbody.appendChild(row);
            }
            return;
        }

        // Generate Interactive Headers
        const columns = ['Test Name', 'Group', 'Status', 'Run ID', 'Start Time', 'End Time', 'Duration'];
        let theadHtml = '<tr>';
        columns.forEach(col => {
            const isSorted = this.sortState.column === col;
            const sortIcon = isSorted ? (this.sortState.direction === 'asc' ? 'arrow_upward' : 'arrow_downward') : '';
            const isFiltered = FilterManager.columnFilters[col];
            const filterClass = isFiltered ? 'active' : '';
            const alignClass = col === 'Duration' ? 'text-right' : '';
            
            theadHtml += `<th class="th-interactive ${alignClass}" onclick="App.UIManager.toggleSort('${col}')">
                <div class="th-content">
                    <div class="th-text"><span>${col}</span>${sortIcon ? `<span class="material-symbols-outlined sort-indicator" style="font-size:14px;">${sortIcon}</span>` : ''}</div>
                    <div class="th-actions ${filterClass}">
                        <button class="btn-icon" style="width:20px; height:20px; padding:0;" onclick="App.UIManager.openColumnFilter(event, '${col}')"><span class="material-symbols-outlined" style="font-size:14px; ${isFiltered ? 'color:var(--primary);' : ''}">filter_alt</span></button>
                    </div>
                </div>
            </th>`;
        });
        theadHtml += '</tr>';
        thead.innerHTML = theadHtml;

        for (const testName of paginatedTests) {
            const row = document.createElement('tr');
            const details = this.getTestDisplayDetails(testName);
            let durationStr = '-';
            if (details.duration > 0) {
                durationStr = Utils.formatDuration(details.duration);
            }

            const nameCell = document.createElement('td');
            const nameLink = document.createElement('span');
            nameLink.textContent = DataStore.testNames[testName] || testName;
            nameLink.className = 'test-name-link';
            nameLink.onclick = () => this.openTestDetails(testName);
            nameCell.appendChild(nameLink);
            row.appendChild(nameCell);

            const groupCell = document.createElement('td');
            groupCell.textContent = DataStore.testGroups[testName] || '--';
            row.appendChild(groupCell);

            const statusCell = document.createElement('td');
            let iconName = 'help', iconColor = 'var(--status-info)';
            if (details.status === 'passed') { iconName = 'check_circle'; iconColor = 'var(--status-pass)'; }
            else if (details.status === 'failed') { iconName = 'cancel'; iconColor = 'var(--status-fail)'; }
            else if (details.status === 'skipped') { iconName = 'remove_circle'; iconColor = 'var(--status-skip)'; }
            if (details.status !== '-') {
                statusCell.innerHTML = `<div style="display: flex; align-items: center; gap: 6px;"><span class="material-symbols-outlined" style="font-size: 16px; color: ${iconColor};">${iconName}</span><span style="text-transform: capitalize;">${details.status}</span></div>`;
            } else {
                statusCell.textContent = '-';
                statusCell.style.color = 'var(--text-muted)';
            }
            row.appendChild(statusCell);

            const runIdCell = document.createElement('td');
            runIdCell.textContent = details.runId;
            runIdCell.style.cssText = 'color: var(--text-muted); font-size: 0.8rem; white-space: nowrap;';
            row.appendChild(runIdCell);

            const startCell = document.createElement('td');
            startCell.textContent = details.start;
            startCell.style.cssText = 'color: var(--text-muted); font-size: 0.8rem; white-space: nowrap;';
            row.appendChild(startCell);

            const endCell = document.createElement('td');
            endCell.textContent = details.end;
            endCell.style.cssText = 'color: var(--text-muted); font-size: 0.8rem; white-space: nowrap;';
            row.appendChild(endCell);

            const durCell = document.createElement('td');
            durCell.textContent = durationStr;
            durCell.className = 'text-right';
            durCell.style.fontFamily = 'var(--font-mono)';
            row.appendChild(durCell);

            tbody.appendChild(row);
        }
    },

    openTestDetails: function(testName) {
        const DataStore = App.DataStore;
        const FilterManager = App.FilterManager;
        const Utils = App.Utils;

        let details = DataStore.testDetails[testName] || [];
        if (details.length === 0) return;

        const effectiveRunIds = FilterManager.activeRunFilters.length > 0 ? FilterManager.activeRunFilters : FilterManager.currentVisibleRunIds;
        const effectiveRunIdsSet = new Set(effectiveRunIds);
        details = details.filter(d => effectiveRunIdsSet.has(d.runId));

        if (FilterManager.advancedFilters.runId) details = details.filter(d => String(d.runId).includes(FilterManager.advancedFilters.runId));
        if (FilterManager.advancedFilters.status) details = details.filter(d => d.status.toLowerCase() === FilterManager.advancedFilters.status.toLowerCase());
        if (FilterManager.advancedFilters.startTimeMin) {
            const min = Utils.parseTimeSeconds(FilterManager.advancedFilters.startTimeMin + ':00');
            details = details.filter(d => d.start !== '-' && Utils.parseTimeSeconds(d.start) >= min);
        }
        if (FilterManager.advancedFilters.startTimeMax) {
            const max = Utils.parseTimeSeconds(FilterManager.advancedFilters.startTimeMax + ':59');
            details = details.filter(d => d.start !== '-' && Utils.parseTimeSeconds(d.start) <= max);
        }
        if (FilterManager.advancedFilters.durationMin) {
            const min = parseFloat(FilterManager.advancedFilters.durationMin);
            details = details.filter(d => {
                if (d.start === '-' || d.end === '-') return false;
                let dur = Utils.parseTimeSeconds(d.end) - Utils.parseTimeSeconds(d.start);
                if (dur < 0) dur += 86400;
                return dur >= min;
            });
        }
        if (FilterManager.advancedFilters.durationMax) {
            const max = parseFloat(FilterManager.advancedFilters.durationMax);
            details = details.filter(d => {
                if (d.start === '-' || d.end === '-') return false;
                let dur = Utils.parseTimeSeconds(d.end) - Utils.parseTimeSeconds(d.start);
                if (dur < 0) dur += 86400;
                return dur <= max;
            });
        }

        const displayName = DataStore.testNames[testName] || testName;
        const group = DataStore.testGroups[testName] || '--';
        document.getElementById('modalTitle').textContent = `History: ${displayName} (Group: ${group})`;
        const tbody = document.getElementById('modalTableBody');
        tbody.innerHTML = '';

        details.sort((a, b) => (parseFloat(a.runId) || 0) - (parseFloat(b.runId) || 0));

        details.forEach(d => {
            const row = document.createElement('tr');
            let durationStr = '-';
            if (d.start && d.end && d.start !== '-' && d.end !== '-') {
                const s = Utils.parseTimeSeconds(d.start);
                const e = Utils.parseTimeSeconds(d.end);
                let dur = e - s;
                if (dur < 0) dur += 86400;
                durationStr = Utils.formatDuration(dur);
            }
            let pillClass = ['passed', 'failed', 'skipped'].includes(d.status) ? `pill-${d.status}` : 'pill-other';
            row.innerHTML = `<td>${d.runId}</td><td>${d.date}</td><td>${d.start} - ${d.end}</td><td style="font-family: var(--font-mono);">${durationStr}</td><td><span class="status-pill ${pillClass}"></span>${d.status}</td>`;
            tbody.appendChild(row);
        });

        document.getElementById('detailModal').classList.remove('hidden');
        this.renderChart(details);
    },

    filterByGroupStatus: function(group, status) {
        this.switchTab('tests');
        this.clearAdvancedFilters();
        document.getElementById('filterTestGroup').value = (group === 'Unassigned') ? '--' : group;
        document.getElementById('filterStatus').value = status;
        this.applyAdvancedFilters();
    },

    updateInsights: function(runIds = null) {
        this.clearDeepThink();
        const DataStore = App.DataStore;
        const FilterManager = App.FilterManager;
        const Utils = App.Utils;

        if (!FilterManager.isAnyFilterActive()) runIds = [];

        let totalRuns, totalTests, totalPassed = 0, totalFailed = 0, totalSkipped = 0, flakyCount = 0, brokenCount = 0, newFailureCount = 0, criticalCount = 0;
        const settings = JSON.parse(localStorage.getItem('insightsSettings')) || { continuousFailVal: 7, continuousFailUnit: 'weeks', newFailureVal: 7, flakyThreshold: 1 };
        const newFailureDays = parseInt(settings.newFailureVal) || 7;
        const flakyThreshold = parseInt(settings.flakyThreshold) || 1;
        const contFailVal = parseInt(settings.continuousFailVal) || 7;
        const contFailUnit = settings.continuousFailUnit || 'weeks';
        const allDates = DataStore.runStats.map(r => r.date).filter(d => d).sort();
        const latestDate = allDates.length > 0 ? new Date(allDates[allDates.length - 1]) : new Date();
        const newFailureWindowMs = newFailureDays * 24 * 60 * 60 * 1000;

        const calculateStats = (testName, details) => {
            let flips = 0, lastStatus = null;
            details.forEach(d => { if (d.status !== 'skipped') { if (lastStatus && d.status !== lastStatus) flips++; lastStatus = d.status; } });
            if (flips >= flakyThreshold) flakyCount++;

            if (details.length > 0 && details[details.length - 1].status === 'failed') {
                let streakStartDate = null, streakCount = 0;
                for (let i = details.length - 1; i >= 0; i--) {
                    if (details[i].status === 'failed') { streakCount++; streakStartDate = details[i].date; } else if (details[i].status === 'passed') break;
                }
                let isBroken = false;
                if (contFailUnit === 'runs') { if (streakCount >= contFailVal) isBroken = true; }
                else {
                    const lastDate = new Date(details[details.length - 1].date);
                    const startDate = new Date(streakStartDate);
                    const diffDays = Math.ceil(Math.abs(lastDate - startDate) / (1000 * 60 * 60 * 24));
                    if (diffDays >= (contFailUnit === 'weeks' ? contFailVal * 7 : contFailVal)) isBroken = true;
                }
                if (isBroken) brokenCount++;
            }

            const allDetails = DataStore.testDetails[testName] || [];
            const failures = allDetails.filter(d => d.status === 'failed');
            if (failures.length > 0) {
                let earliestFailDate = null;
                failures.forEach(f => { if (f.date && f.date !== '-') { const d = new Date(f.date); if (!earliestFailDate || d < earliestFailDate) earliestFailDate = d; } });
                const diff = earliestFailDate ? (latestDate - earliestFailDate) : -1;
                if (diff >= 0 && diff <= newFailureWindowMs) newFailureCount++;
            }
            if (!details.some(d => d.status === 'passed') && details.some(d => d.status === 'failed')) criticalCount++;
        };

        if (runIds !== null && runIds.length > 0) {
            const selectedRunData = DataStore.runStats.filter(r => runIds.includes(r.id));
            const testsInRuns = new Set();
            selectedRunData.forEach(runData => {
                totalPassed += runData.passed; totalFailed += runData.failed; totalSkipped += runData.skipped;
                (DataStore.runToTestsMap[runData.id] || new Set()).forEach(t => testsInRuns.add(t));
            });
            totalRuns = selectedRunData.length; totalTests = testsInRuns.size;
            testsInRuns.forEach(testName => {
                const details = (DataStore.testDetails[testName] || []).filter(d => runIds.includes(d.runId)).sort((a, b) => (a.runId > b.runId ? 1 : -1));
                calculateStats(testName, details);
            });
        } else if (runIds === null || runIds.length === 0) {
            if (runIds !== null) { totalRuns = 0; totalTests = 0; }
            else {
                totalRuns = DataStore.runStats.length; totalTests = Object.keys(DataStore.testHistory).length;
                DataStore.runStats.forEach(run => { totalPassed += run.passed; totalFailed += run.failed; totalSkipped += run.skipped; });
                for (const testName in DataStore.testResults) {
                    const details = (DataStore.testDetails[testName] || []).slice().sort((a, b) => (a.runId > b.runId ? 1 : -1));
                    calculateStats(testName, details);
                }
            }
        }

        const totalExecutions = totalPassed + totalFailed + totalSkipped;
        const setText = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
        const setWidth = (id, val) => { const el = document.getElementById(id); if (el) el.style.width = val; };

        setText('filterBarRunCount', totalRuns); setText('filterBarTestCount', totalTests);
        setText('countPassed', totalPassed); setText('countFailed', totalFailed); setText('countSkipped', totalSkipped); setText('totalExecutions', totalExecutions);
        const pPass = totalExecutions ? (totalPassed / totalExecutions) * 100 : 0;
        const pFail = totalExecutions ? (totalFailed / totalExecutions) * 100 : 0;
        const pSkip = totalExecutions ? (totalSkipped / totalExecutions) * 100 : 0;
        setWidth('barPassed', pPass + '%'); setWidth('barFailed', pFail + '%'); setWidth('barSkipped', pSkip + '%');
        setText('percentPassed', pPass.toFixed(1)); setText('percentFailed', pFail.toFixed(1)); setText('percentSkipped', pSkip.toFixed(1));

        const setRate = (id, count) => {
            const rate = totalTests ? (count / totalTests) * 100 : 0;
            const el = document.getElementById(id);
            if (el) {
                el.textContent = rate.toFixed(1) + '%';
                el.className = 'card-value ' + (rate > 5 ? 'text-red' : (rate > 0 ? 'text-warning' : 'text-green'));
            }
        };
        setRate('flakyRate', flakyCount); setRate('brokenRate', brokenCount); setRate('newFailureRate', newFailureCount);
        setText('flakyCount', flakyCount); setText('brokenCount', brokenCount); setText('newFailureCount', newFailureCount);
        setText('totalTests', totalTests); setText('totalTestsBroken', totalTests);
        setText('criticalIssuesCount', criticalCount);

        const stabilityScore = totalTests ? Math.max(0, 100 - ((flakyCount + criticalCount) / totalTests * 100)).toFixed(1) : 0;
        const scoreEl = document.getElementById('stabilityScore');
        if (scoreEl) {
            scoreEl.textContent = stabilityScore + '/100';
            scoreEl.className = 'card-value ' + (stabilityScore > 80 ? 'text-green' : (stabilityScore > 50 ? 'text-warning' : 'text-red'));
        }

        // Time Stats
        const timeStatsRuns = (runIds !== null) ? DataStore.runStats.filter(r => runIds.includes(r.id)) : DataStore.runStats;
        const durations = timeStatsRuns.map(r => r.durationSeconds).filter(d => typeof d === 'number');
        if (durations.length > 0) {
            const avg = durations.reduce((a, b) => a + b, 0) / durations.length;
            const min = Math.min(...durations);
            const max = Math.max(...durations);
            setText('statAvgTime', Utils.formatDuration(avg));
            setText('statMaxTime', Utils.formatDuration(max));
            setText('statMinTime', Utils.formatDuration(min));
            const maxRun = timeStatsRuns.find(r => r.durationSeconds === max);
            const minRun = timeStatsRuns.find(r => r.durationSeconds === min);
            const link = (id, runId) => {
                const el = document.getElementById(id);
                if (el && runId) { el.textContent = `Run ${runId}`; el.style.display = 'inline'; el.onclick = (e) => this.toggleRunFilter(runId, e); }
                else if (el) el.style.display = 'none';
            };
            link('statMaxRunLink', maxRun?.id); link('statMinRunLink', minRun?.id);
        }

        // Group Deviation
        const groupStats = {};
        const targetRunIds = (runIds !== null) ? new Set(runIds) : null;
        for (const [testName, details] of Object.entries(DataStore.testDetails)) {
            const group = (DataStore.testGroups[testName] && DataStore.testGroups[testName] !== '--') ? DataStore.testGroups[testName] : 'Unassigned';
            if (!groupStats[group]) groupStats[group] = { passed: 0, failed: 0, skipped: 0, total: 0 };
            details.forEach(d => {
                if (targetRunIds && !targetRunIds.has(d.runId)) return;
                if (d.status === 'passed') groupStats[group].passed++;
                else if (d.status === 'failed') groupStats[group].failed++;
                else if (d.status === 'skipped') groupStats[group].skipped++;
                groupStats[group].total++;
            });
        }
        const groupContainer = document.getElementById('groupDeviationContainer');
        if (groupContainer) {
            groupContainer.innerHTML = '';
            const sortedGroups = Object.entries(groupStats).sort((a, b) => (b[1].failed - a[1].failed) || (b[1].total - a[1].total));
            if (sortedGroups.length === 0) groupContainer.innerHTML = '<div style="color:var(--text-muted); font-size:0.9rem;">No data available</div>';
            else {
                const table = document.createElement('table');
                table.style.width = '100%'; table.style.borderCollapse = 'collapse'; table.style.fontSize = '0.85rem';
                table.innerHTML = `<thead><tr style="text-align: left; border-bottom: 1px solid var(--border-color);"><th style="padding: 0.75rem 1rem;">Group</th><th style="padding: 0.75rem 1rem; text-align: right;">P / F / S</th><th style="padding: 0.75rem 1rem; width: 40%;">Distribution</th></tr></thead>`;
                const tbody = document.createElement('tbody');
                sortedGroups.forEach(([groupName, stats]) => {
                    if (stats.total === 0) return;
                    const safeGroupName = groupName.replace(/'/g, "\\'");
                    const tr = document.createElement('tr');
                    tr.style.borderBottom = '1px solid var(--border-color)';
                    tr.innerHTML = `<td style="padding: 0.75rem 1rem;">${groupName}</td><td style="padding: 0.75rem 1rem; text-align: right;"><span class="text-green" style="cursor: pointer; text-decoration: underline;" onclick="App.UIManager.filterByGroupStatus('${safeGroupName}', 'passed')">${stats.passed}</span> / <span class="text-red" style="cursor: pointer; text-decoration: underline;" onclick="App.UIManager.filterByGroupStatus('${safeGroupName}', 'failed')">${stats.failed}</span> / <span style="color: var(--text-muted); cursor: pointer; text-decoration: underline;" onclick="App.UIManager.filterByGroupStatus('${safeGroupName}', 'skipped')">${stats.skipped}</span></td><td style="padding: 0.75rem 1rem;"><div class="progress-track" style="height: 6px; width: 100%; margin: 0;"><div class="progress-fill bg-green" style="width: ${(stats.passed/stats.total)*100}%"></div><div class="progress-fill bg-red" style="width: ${(stats.failed/stats.total)*100}%"></div><div class="progress-fill bg-grey" style="width: ${(stats.skipped/stats.total)*100}%"></div></div></td>`;
                    tbody.appendChild(tr);
                });
                table.appendChild(tbody);
                groupContainer.appendChild(table);
            }
        }
    },

    toggleRunFilter: function(runId, event) {
        const isMultiSelect = event.ctrlKey || event.metaKey || event.shiftKey;
        App.FilterManager.toggleRunFilter(runId, isMultiSelect);
        ['flakyCount', 'brokenCount', 'newFailureCount', 'passedFilterClickable', 'failedFilterClickable', 'skippedFilterClickable', 'totalExecutionsClickable'].forEach(id => {
            const el = document.getElementById(id);
            if (el) el.classList.remove('filter-active');
        });
        this.updateFilterDisplay();
        this.updateInsights(App.FilterManager.activeRunFilters);
        this.updateInsights(App.FilterManager.activeRunFilters.length > 0 ? App.FilterManager.activeRunFilters : App.FilterManager.currentVisibleRunIds);
        this.renderTable();
        this.applyGlobalRunFilters();
    },

    toggleDateDropdown: function(e) {
        e.stopPropagation();
        const menu = document.getElementById('dateFilterMenu');
        menu.style.display = menu.style.display === 'block' ? 'none' : 'block';
    },

    handleDateRangeChange: function() {
        document.getElementById('filterLastDays').value = '';
        this.updateDateFilterText();
        this.applyGlobalRunFilters();
    },

    clearDateRange: function(e) {
        if (e) e.stopPropagation();
        document.getElementById('filterDateFrom').value = '';
        document.getElementById('filterDateTo').value = '';
        document.getElementById('filterLastDays').value = '';
        this.updateDateFilterText();
        this.applyGlobalRunFilters();
    },

    clearFilter: function(id) {
        const el = document.getElementById(id);
        if (el) { el.value = ''; this.applyGlobalRunFilters(); }
    },

    updateDateFilterText: function() {
        const btnText = document.getElementById('dateFilterText');
        const lastDays = document.getElementById('filterLastDays').value;
        const fromDate = document.getElementById('filterDateFrom').value;
        const toDate = document.getElementById('filterDateTo').value;
        if (lastDays) btnText.textContent = `Last ${lastDays} Days`;
        else if (fromDate && toDate) btnText.textContent = `${fromDate} - ${toDate}`;
        else if (fromDate) btnText.textContent = `From ${fromDate}`;
        else if (toDate) btnText.textContent = `Until ${toDate}`;
        else btnText.textContent = 'Date';
        const clearBtn = document.getElementById('clearDateBtn');
        if (clearBtn) { if (lastDays || fromDate || toDate) clearBtn.classList.remove('hidden'); else clearBtn.classList.add('hidden'); }
    },

    handleLastDaysInput: function() {
        if (document.getElementById('filterLastDays').value) {
            document.getElementById('filterDateFrom').value = '';
            document.getElementById('filterDateTo').value = '';
        }
        this.updateDateFilterText();
        this.applyGlobalRunFilters();
    },

    applyGlobalRunFilters: function() {
        const DataStore = App.DataStore;
        const FilterManager = App.FilterManager;
        const type = document.getElementById('globalRunType').value;
        const ver = document.getElementById('globalVersion').value;
        const runId = document.getElementById('globalRunId')?.value;
        const fromDate = document.getElementById('filterDateFrom').value;
        const toDate = document.getElementById('filterDateTo').value;
        const lastDays = parseInt(document.getElementById('filterLastDays').value);
        let cutoffDateStr = null;

        if (!isNaN(lastDays) && lastDays > 0) {
            const allDates = DataStore.runStats.map(r => r.date).filter(d => d).sort();
            if (allDates.length > 0) {
                const targetDate = new Date(allDates[allDates.length - 1]);
                targetDate.setDate(targetDate.getDate() - (lastDays - 1));
                cutoffDateStr = targetDate.toISOString().split('T')[0];
            }
        }

        const visibleRuns = DataStore.runStats.filter(r => {
            let dateMatch = true;
            if (cutoffDateStr) dateMatch = r.date >= cutoffDateStr;
            else { if (fromDate && r.date < fromDate) dateMatch = false; if (toDate && r.date > toDate) dateMatch = false; }
            return (!type || r.runType === type) && (!ver || r.version === ver) && (!runId || String(r.id).includes(runId)) && dateMatch;
        });

        const setVis = (id, v) => { const el = document.getElementById(id); if (el) el.classList.toggle('hidden', !v); };
        setVis('clearRunIdBtn', !!runId); setVis('clearRunTypeBtn', !!type); setVis('clearVersionBtn', !!ver);

        FilterManager.currentVisibleRunIds = visibleRuns.map(r => r.id);
        FilterManager.activeRunFilters = FilterManager.activeRunFilters.filter(id => FilterManager.currentVisibleRunIds.includes(id));

        this.unlockDashboard();
        this.renderTrendChart('trendChartSmall', visibleRuns);
        this.renderTrendChart('trendChartLarge', visibleRuns);
        this.updateFilterDisplay();
        this.updateInsights(FilterManager.activeRunFilters.length > 0 ? FilterManager.activeRunFilters : FilterManager.currentVisibleRunIds);
        this.renderTable();
    },

    renderTrendChart: function(containerId, data) {
        const container = document.getElementById(containerId);
        if (!container) return;
        if (!App.FilterManager.isAnyFilterActive()) data = [];
        container.innerHTML = '';
        if (!data || data.length === 0) { container.innerHTML = '<div style="width:100%; height:100%; display:flex; align-items:center; justify-content:center; color:var(--text-muted);">No run data available</div>'; return; }

        let maxDuration = 0;
        data.forEach(r => { if ((r.totalTestDuration || 0) > maxDuration) maxDuration = r.totalTestDuration; });

        const barsContainer = document.createElement('div');
        barsContainer.style.cssText = 'position: absolute; top: 0; left: 0; width: 100%; height: 100%; display: flex; align-items: flex-end; gap: 1px;';
        data.forEach(run => {
            const bar = document.createElement('div');
            bar.className = 'chart-bar' + (App.FilterManager.activeRunFilters.includes(run.id) ? ' active' : '');
            
            let h = maxDuration > 0 ? ((run.totalTestDuration || 0) / maxDuration) * 100 : 100;
            if (h < 2) h = 2; // Minimum height for visibility
            bar.style.height = `${h}%`;

            const pPass = run.total ? (run.passed / run.total) * 100 : 0;
            const pFail = run.total ? (run.failed / run.total) * 100 : 0;
            const pSkip = run.total ? (run.skipped / run.total) * 100 : 0;
            bar.innerHTML = `<div class="chart-bar-segment bg-green" style="height: ${pPass}%"></div><div class="chart-bar-segment bg-red" style="height: ${pFail}%"></div>${pSkip > 0 ? `<div class="chart-bar-segment bg-grey" style="height: ${pSkip}%"></div>` : ''}`;
            bar.onclick = (event) => this.toggleRunFilter(run.id, event);
            
            if (containerId === 'trendChartSmall') {
                bar.onmouseenter = (e) => {
                    const content = this.generateTooltipContent(run);
                    this.showTooltip(e, content, bar);
                };
                bar.onmouseleave = () => {
                    this.hideTooltip();
                };
            }

            if (containerId === 'trendChartLarge') {
                bar.onmouseenter = () => {
                    const detailsEl = document.getElementById('trendModalDetails');
                    if (detailsEl) {
                        const duration = App.Utils.formatDuration(run.durationSeconds);
                        detailsEl.innerHTML = `
                            <div style="display: grid; grid-template-columns: auto 1fr auto 1fr; gap: 0.5rem 2rem; font-size: 0.9rem; width: 100%;">
                                <div style="display: contents;">
                                    <span style="color: var(--text-muted);">Run ID:</span> <span style="font-family: var(--font-mono); color: var(--text-main);">${run.id}</span>
                                    <span style="color: var(--text-muted);">Date:</span> <span style="color: var(--text-main);">${run.date}</span>
                                </div>
                                <div style="display: contents;">
                                    <span style="color: var(--text-muted);">Time:</span> <span style="color: var(--text-main);">${run.startTime || '-'}</span>
                                    <span style="color: var(--text-muted);">Duration:</span> <span style="font-family: var(--font-mono); color: var(--text-main);">${duration}</span>
                                </div>
                                <div style="grid-column: 1 / -1; height: 1px; background: var(--border-color); margin: 0.5rem 0;"></div>
                                <div style="display: contents;">
                                    <span style="color: var(--text-muted);">Total:</span> <span style="font-weight: 600; color: var(--text-main);">${run.total}</span>
                                    <span style="color: var(--text-muted);">Passed:</span> <span style="color: var(--status-pass); font-weight: 600;">${run.passed}</span>
                                </div>
                                <div style="display: contents;">
                                    <span style="color: var(--text-muted);">Failed:</span> <span style="color: var(--status-fail); font-weight: 600;">${run.failed}</span>
                                    <span style="color: var(--text-muted);">Skipped:</span> <span style="color: var(--status-skip); font-weight: 600;">${run.skipped}</span>
                                </div>
                            </div>
                        `;
                    }
                };
            }

            barsContainer.appendChild(bar);
        });
        container.appendChild(barsContainer);
    },

    generateTooltipContent: function(run) {
        const duration = App.Utils.formatDuration(run.durationSeconds);
        const totalExec = App.Utils.formatDuration(run.totalTestDuration || 0);
        return `
            <div style="display: flex; flex-direction: column; gap: 0.5rem;">
                <div style="font-weight: 600; border-bottom: 1px solid var(--border-color); padding-bottom: 0.25rem; margin-bottom: 0.25rem; color: var(--text-main);">
                    Run ${run.id}
                </div>
                <div style="display: grid; grid-template-columns: auto 1fr; gap: 0.25rem 1rem; font-size: 0.8rem;">
                    <span style="color: var(--text-muted);">Date:</span> <span style="color: var(--text-secondary);">${run.date}</span>
                    <span style="color: var(--text-muted);">Time:</span> <span style="color: var(--text-secondary);">${run.startTime || '-'}</span>
                    <span style="color: var(--text-muted);">Duration:</span> <span style="font-family: var(--font-mono); color: var(--text-secondary);">${duration}</span>
                    <span style="color: var(--text-muted);">Total Exec:</span> <span style="font-family: var(--font-mono); color: var(--text-secondary);">${totalExec}</span>
                    <span style="color: var(--text-muted);">Total:</span> <span style="color: var(--text-main); font-weight: 600;">${run.total}</span>
                    <span style="color: var(--status-pass);">Passed:</span> <span style="color: var(--status-pass); font-weight: 600;">${run.passed}</span>
                    <span style="color: var(--status-fail);">Failed:</span> <span style="color: var(--status-fail); font-weight: 600;">${run.failed}</span>
                    <span style="color: var(--status-skip);">Skipped:</span> <span style="color: var(--status-skip); font-weight: 600;">${run.skipped}</span>
                </div>
            </div>
        `;
    },

    showTooltip: function(event, content, targetElement) {
        if (this.tooltipTimeout) clearTimeout(this.tooltipTimeout);
        const tooltip = document.getElementById('customTooltip');
        if (!tooltip) return;
        
        tooltip.innerHTML = content;
        tooltip.classList.remove('hidden');
        
        const tooltipRect = tooltip.getBoundingClientRect();
        
        let left = event.clientX + 12;
        let top = event.clientY + 12;
        
        if (left + tooltipRect.width > window.innerWidth) left = event.clientX - tooltipRect.width - 12;
        if (top + tooltipRect.height > window.innerHeight) top = event.clientY - tooltipRect.height - 12;
        if (top < 0) top = 10;
        if (left < 0) left = 10;

        tooltip.style.top = `${top}px`;
        tooltip.style.left = `${left}px`;
    },

    hideTooltip: function() {
        this.tooltipTimeout = setTimeout(() => {
            document.getElementById('customTooltip').classList.add('hidden');
        }, 300);
    },

    cancelTooltipHide: function() {
        if (this.tooltipTimeout) clearTimeout(this.tooltipTimeout);
    },

    openTrendModal: function() {
        this.renderTrendChart('trendChartLarge', App.DataStore.runStats);
        const detailsEl = document.getElementById('trendModalDetails');
        if (detailsEl) detailsEl.innerHTML = '<span style="color: var(--text-muted);">Hover over a bar to view details</span>';
        document.getElementById('trendModal').classList.remove('hidden');
    },
    closeTrendModal: function() { document.getElementById('trendModal').classList.add('hidden'); },
    
    handleCompareRunsClick: function() {
        if (this.isComparisonMode) {
            this.clearRunSelection();
        } else {
            this.openRunComparisonModal();
        }
    },

    updateCompareButtonState: function() {
        const btn = document.getElementById('btnCompareRuns');
        if (btn) {
            btn.classList.toggle('active', this.isComparisonMode);
        }
    },

    openRunComparisonModal: function() {
        const tbody = document.getElementById('runsListTableBody');
        if (!tbody) return;
        tbody.innerHTML = '';
        const runIdsToShow = App.FilterManager.activeRunFilters.length > 0 ? App.FilterManager.activeRunFilters : App.FilterManager.currentVisibleRunIds;
        const runsData = App.DataStore.runStats.filter(r => runIdsToShow.includes(r.id)).sort((a, b) => (parseFloat(b.id) || 0) - (parseFloat(a.id) || 0));

        runsData.forEach(run => {
            const tr = document.createElement('tr');
            tr.innerHTML = `<td style="padding: 8px; border-bottom: 1px solid var(--border-color); text-align: center;"><input type="checkbox" class="run-compare-checkbox" value="${run.id}" onchange="App.UIManager.handleRunSelectionChange()"></td><td style="padding: 8px; border-bottom: 1px solid var(--border-color);">${run.id}</td><td style="padding: 8px; border-bottom: 1px solid var(--border-color);">${run.date || '-'}</td><td style="padding: 8px; border-bottom: 1px solid var(--border-color); font-size: 0.85rem;">${run.startTime || '-'}</td><td style="padding: 8px; border-bottom: 1px solid var(--border-color); text-align: right; font-family: var(--font-mono);">${App.Utils.formatDuration(run.durationSeconds)}</td><td style="padding: 8px; border-bottom: 1px solid var(--border-color); text-align: right;">${run.total}</td><td style="padding: 8px; border-bottom: 1px solid var(--border-color); text-align: right; color: var(--status-pass);">${run.passed}</td><td style="padding: 8px; border-bottom: 1px solid var(--border-color); text-align: right; color: var(--status-fail);">${run.failed}</td><td style="padding: 8px; border-bottom: 1px solid var(--border-color); text-align: right; color: var(--status-skip);">${run.skipped}</td>`;
            tbody.appendChild(tr);
        });
        this.handleRunSelectionChange();
        document.getElementById('runComparisonModal').classList.remove('hidden');
    },
    closeRunComparisonModal: function() { document.getElementById('runComparisonModal').classList.add('hidden'); },

    handleRunSelectionChange: function() {
        const checkboxes = document.querySelectorAll('.run-compare-checkbox:checked');
        const compareBtn = document.getElementById('modalCompareBtn');
        compareBtn.textContent = `Compare (${checkboxes.length})`;
        compareBtn.disabled = !(checkboxes.length >= 2 && checkboxes.length <= 3);
    },

    triggerRunComparison: function() {
        const checkboxes = document.querySelectorAll('.run-compare-checkbox:checked');
        App.FilterManager.activeRunFilters = Array.from(checkboxes).map(cb => cb.value);
        this.isComparisonMode = true;
        this.updateCompareButtonState();
        this.currentPage = 1;
        this.renderTable();
        this.closeRunComparisonModal();
        this.updateFilterDisplay();
    },

    openAdvancedFilter: function() {
        const FM = App.FilterManager.advancedFilters;
        document.getElementById('filterTestName').value = FM.testName;
        document.getElementById('filterTestGroup').value = FM.testGroup;
        document.getElementById('filterRunId').value = FM.runId;
        document.getElementById('filterStatus').value = FM.status;
        document.getElementById('filterStartTimeMin').value = FM.startTimeMin;
        document.getElementById('filterStartTimeMax').value = FM.startTimeMax;
        document.getElementById('filterDurationMin').value = FM.durationMin;
        document.getElementById('filterDurationMax').value = FM.durationMax;
        document.getElementById('advancedFilterModal').classList.remove('hidden');
    },
    closeAdvancedFilter: function() { document.getElementById('advancedFilterModal').classList.add('hidden'); },

    applyAdvancedFilters: function() {
        const FM = App.FilterManager.advancedFilters;
        FM.testName = document.getElementById('filterTestName').value;
        FM.testGroup = document.getElementById('filterTestGroup').value;
        FM.runId = document.getElementById('filterRunId').value;
        FM.status = document.getElementById('filterStatus').value;
        FM.startTimeMin = document.getElementById('filterStartTimeMin').value;
        FM.startTimeMax = document.getElementById('filterStartTimeMax').value;
        FM.durationMin = document.getElementById('filterDurationMin').value;
        FM.durationMax = document.getElementById('filterDurationMax').value;
        this.currentPage = 1;
        this.renderTable();
        this.closeAdvancedFilter();
    },

    clearAdvancedFilters: function() {
        App.FilterManager.columnFilters = {};
        this.applyAdvancedFilters();
    },

    clearRunSelection: function() {
        App.FilterManager.clearAll();
        this.isComparisonMode = false;
        this.updateCompareButtonState();
        this.updateFilterDisplay();
        ['flakyCount', 'brokenCount', 'newFailureCount', 'passedFilterClickable', 'failedFilterClickable', 'skippedFilterClickable', 'totalExecutionsClickable'].forEach(id => document.getElementById(id).classList.remove('filter-active'));
        this.applyGlobalRunFilters();
        this.updateInsights(App.FilterManager.currentVisibleRunIds);
        this.renderTable();
    },

    clearAllFilters: function() {
        this.clearAdvancedFilters(); // Resets inputs and calls applyAdvancedFilters
        App.FilterManager.clearAll();
        this.setFilter('all');
    },

    renderChart: function(details) {
        const container = document.getElementById('chartContainer');
        container.innerHTML = '';
        if (details.length < 2) { container.innerHTML = '<div style="padding:1rem; text-align:center; color:#666;">Not enough data for trend chart</div>'; return; }
        const width = container.clientWidth, height = 150, padding = 20;
        const yPass = height * 0.3, yFail = height * 0.7, ySkip = height * 0.5;
        const points = details.map((d, index) => {
            const x = padding + (index / (details.length - 1)) * (width - (padding * 2));
            let y = ySkip; if (d.status === 'passed') y = yPass; if (d.status === 'failed') y = yFail;
            return `${x},${y}`;
        }).join(' ');
        container.innerHTML = `<svg width="100%" height="100%"><polyline points="${points}" fill="none" stroke="var(--primary)" stroke-width="2"/></svg>`;
    },

    closeModal: function() { document.getElementById('detailModal').classList.add('hidden'); }
};