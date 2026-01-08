let globalTestHistory = {};
let globalTestResults = {};
let globalTestGroups = {};
let globalTestNames = {};
let runToTestsMap = {};
let globalRunTypes = new Set();
let globalVersions = new Set();
let globalRunStats = [];
let globalTestDetails = {}; // Stores full row data per test
let currentFilter = 'all'; // 'all', 'flaky', 'failing'
let lastDeepAnalysisData = null;
let columnFilters = {};
let activeRunFilter = null;
let activeRunFilters = []; // Use an array for multi-select
let isComparisonMode = false;
let currentVisibleRunIds = [];
let currentPage = 1;
let advancedFilters = {
    testName: '',
    testGroup: '',
    runId: '',
    status: '',
    startTimeMin: '',
    startTimeMax: '',
    durationMin: '',
    durationMax: ''
};
const itemsPerPage = 20;

function switchTab(tabName) {
    // Remove active class from all tabs
    document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
    document.getElementById(`tab-${tabName}`).classList.add('active');

    // Hide all content
    document.getElementById('content-insights').classList.add('hidden');
    document.getElementById('details').classList.add('hidden');
    document.getElementById('content-deepThink').classList.add('hidden');

    // Show selected content
    if (tabName === 'insights') {
        document.getElementById('content-insights').classList.remove('hidden');
    } else if (tabName === 'tests') {
        document.getElementById('details').classList.remove('hidden');
        // Force re-render after a brief delay to ensure layout is calculated
        setTimeout(() => {
            renderTable();
        }, 0);
    } else if (tabName === 'deepThink') {
        document.getElementById('content-deepThink').classList.remove('hidden');
    }
}

function parseTimeSeconds(timeStr) {
    if (!timeStr || timeStr === '-') return 0;
    const parts = timeStr.split(':');
    if (parts.length < 2) return 0;
    return (+parts[0]) * 3600 + (+parts[1]) * 60 + (+parts[2] || 0);
}

function dismissCard(checkbox) {
    const card = checkbox.closest('.recommendation-card');
    if (checkbox.checked) {
        card.classList.add('dismissed');
    } else {
        card.classList.remove('dismissed');
    }
}

function generateDeepAnalysis() {
    const container = document.getElementById('deepThinkResults');
    const intro = document.getElementById('deepThinkIntro');
    const btn = document.getElementById('btnGenerateAnalysis');
    const exportBtn = document.getElementById('btnExportDeepThink');

    btn.innerHTML = '<span class="material-symbols-outlined spin">sync</span> Analyzing...';
    btn.disabled = true;

    setTimeout(() => {
        const totalTests = Object.keys(globalTestHistory).length;
        const flakyTests = Object.keys(globalTestResults).filter(t => globalTestResults[t].has('passed') && globalTestResults[t].has('failed'));
        const brokenTests = Object.keys(globalTestResults).filter(t => !globalTestResults[t].has('passed') && globalTestResults[t].has('failed'));

        // Analyze Slow Tests (> 10 mins avg)
        const slowTests = [];
        for (const [testName, details] of Object.entries(globalTestDetails)) {
            let totalDuration = 0;
            let count = 0;
            details.forEach(d => {
                if (d.start && d.end && d.start !== '-' && d.end !== '-') {
                    let start = parseTimeSeconds(d.start);
                    let end = parseTimeSeconds(d.end);
                    let duration = end - start;
                    if (duration < 0) duration += 24 * 3600;
                    totalDuration += duration;
                    count++;
                }
            });
            if (count > 0) {
                const avgMinutes = (totalDuration / count) / 60;
                if (avgMinutes > 10) {
                    slowTests.push({ name: globalTestNames[testName] || testName, duration: avgMinutes.toFixed(1) });
                }
            }
        }

        // Analyze Slow Runs (> 1.5x avg)
        const slowRuns = [];
        let totalRunDuration = 0;
        let runCount = 0;
        const runDurations = [];
        globalRunStats.forEach(run => {
            if (run.startTime && run.endTime) {
                let start = parseTimeSeconds(run.startTime);
                let end = parseTimeSeconds(run.endTime);
                let duration = end - start;
                if (duration < 0) duration += 24 * 3600;
                runDurations.push({ id: run.id, duration: duration });
                totalRunDuration += duration;
                runCount++;
            }
        });
        if (runCount > 0) {
            const avgRunDuration = totalRunDuration / runCount;
            const threshold = Math.max(avgRunDuration * 1.5, 120); // At least 2 mins
            runDurations.forEach(r => {
                if (r.duration > threshold) {
                    slowRuns.push({
                        id: r.id,
                        duration: (r.duration / 60).toFixed(1),
                        avg: (avgRunDuration / 60).toFixed(1)
                    });
                }
            });
        }

        // Analyze Tests Without Group
        const testsWithoutGroup = Object.keys(globalTestGroups).filter(t => !globalTestGroups[t] || globalTestGroups[t] === '--');

        // Stability Score
        const stabilityScore = Math.max(0, 100 - ((flakyTests.length + brokenTests.length) / totalTests * 100)).toFixed(1);

        lastDeepAnalysisData = {
            stabilityScore,
            brokenTests,
            flakyTests,
            slowTests,
            slowRuns,
            testsWithoutGroup
        };

        let html = '';

        let scoreColor = stabilityScore > 80 ? 'text-green' : (stabilityScore > 50 ? 'text-warning' : 'text-red');

        html += `
                    <div class="insights-grid" style="margin-bottom: 2rem;">
                        <div class="card" style="border: 1px solid #e5e7eb; box-shadow: none;">
                            <div class="card-title">Overall Stability Score</div>
                            <div class="card-value ${scoreColor}">${stabilityScore}/100</div>
                            <div class="card-subtext">Based on flaky and broken test rates</div>
                        </div>
                        <div class="card" style="border: 1px solid #e5e7eb; box-shadow: none;">
                            <div class="card-title">Critical Issues</div>
                            <div class="card-value text-red">${brokenTests.length}</div>
                            <div class="card-subtext">Tests consistently failing</div>
                        </div>
                    </div>
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem;">
                        <h4 style="margin: 0;">AI Recommendations</h4>
                        <button class="btn btn-secondary" onclick="exportDeepThinkToCsv()" style="padding: 0.25rem 0.75rem; font-size: 0.8rem;">
                            <span class="material-symbols-outlined" style="font-size: 1.1rem;">download</span>
                            Export
                        </button>
                    </div>
                `;

        if (brokenTests.length > 0) {
            html += `
                        <div class="recommendation-card" style="border-left: 4px solid #ef4444;">
                            <div class="recommendation-header" style="justify-content: space-between;">
                                <div style="display: flex; align-items: center; gap: 1rem;">
                                    <div class="recommendation-icon-box rec-icon-red"><span class="material-symbols-outlined">error</span></div>
                                    <div class="recommendation-title">Fix Broken Tests First</div>
                                </div>
                                <label style="display: flex; align-items: center; gap: 0.5rem; cursor: pointer;" title="Mark as resolved">
                                    <span style="font-size: 0.75rem; color: #9ca3af;">Done</span>
                                    <input type="checkbox" onchange="dismissCard(this)" style="width: 1.1rem; height: 1.1rem; cursor: pointer; accent-color: #10b981;">
                                </label>
                            </div>
                            <div style="color: #4b5563; font-size: 0.95rem; line-height: 1.5;">
                                ${brokenTests.length} tests are consistently failing. These provide no value and block the pipeline.
                            </div>
                            <div class="recommendation-action">
                                <span class="material-symbols-outlined" style="color: var(--primary);">lightbulb</span>
                                <span style="font-size: 0.9rem; font-weight: 500; color: #374151;"><strong>Recommendation:</strong> Quarantine or fix these tests immediately.</span>
                            </div>
                        </div>`;
        }
        if (flakyTests.length > 0) {
            const flakyList = flakyTests.map(t => globalTestNames[t] || t).join(', ');
            html += `
                        <div class="recommendation-card" style="border-left: 4px solid #f59e0b;">
                            <div class="recommendation-header" style="justify-content: space-between;">
                                <div style="display: flex; align-items: center; gap: 1rem;">
                                    <div class="recommendation-icon-box rec-icon-yellow"><span class="material-symbols-outlined">warning</span></div>
                                    <div class="recommendation-title">Address Flakiness</div>
                                </div>
                                <label style="display: flex; align-items: center; gap: 0.5rem; cursor: pointer;" title="Mark as resolved">
                                    <span style="font-size: 0.75rem; color: #9ca3af;">Done</span>
                                    <input type="checkbox" onchange="dismissCard(this)" style="width: 1.1rem; height: 1.1rem; cursor: pointer; accent-color: #10b981;">
                                </label>
                            </div>
                            <div style="color: #4b5563; font-size: 0.95rem; line-height: 1.5;">
                                ${flakyTests.length} tests are exhibiting flaky behavior:
                                <div style="margin-top:0.5rem; font-size: 0.85rem; background: #fff; padding: 0.5rem; border-radius: 0.25rem; border: 1px solid #e5e7eb; max-height: 100px; overflow-y: auto;">
                                    ${flakyList}
                                </div>
                            </div>
                            <div class="recommendation-action">
                                <span class="material-symbols-outlined" style="color: var(--primary);">lightbulb</span>
                                <span style="font-size: 0.9rem; font-weight: 500; color: #374151;"><strong>Recommendation:</strong> Review test isolation and environment stability.</span>
                            </div>
                        </div>`;
        }
        if (slowTests.length > 0) {
            const slowList = slowTests.map(t => `${t.name} (${t.duration}m)`).join(', ');
            html += `
                        <div class="recommendation-card" style="border-left: 4px solid #f59e0b;">
                            <div class="recommendation-header" style="justify-content: space-between;">
                                <div style="display: flex; align-items: center; gap: 1rem;">
                                    <div class="recommendation-icon-box rec-icon-yellow"><span class="material-symbols-outlined">timer</span></div>
                                    <div class="recommendation-title">Optimize Slow Tests</div>
                                </div>
                                <label style="display: flex; align-items: center; gap: 0.5rem; cursor: pointer;" title="Mark as resolved">
                                    <span style="font-size: 0.75rem; color: #9ca3af;">Done</span>
                                    <input type="checkbox" onchange="dismissCard(this)" style="width: 1.1rem; height: 1.1rem; cursor: pointer; accent-color: #10b981;">
                                </label>
                            </div>
                            <div style="color: #4b5563; font-size: 0.95rem; line-height: 1.5;">
                                ${slowTests.length} tests have an average execution time > 10 minutes:
                                <div style="margin-top:0.5rem; font-size: 0.85rem; background: #fff; padding: 0.5rem; border-radius: 0.25rem; border: 1px solid #e5e7eb; max-height: 100px; overflow-y: auto;">
                                    ${slowList}
                                </div>
                            </div>
                            <div class="recommendation-action">
                                <span class="material-symbols-outlined" style="color: var(--primary);">lightbulb</span>
                                <span style="font-size: 0.9rem; font-weight: 500; color: #374151;"><strong>Recommendation:</strong> Investigate these tests for performance optimization.</span>
                            </div>
                        </div>`;
        }
        if (slowRuns.length > 0) {
            const slowRunList = slowRuns.map(r => `Run ${r.id} (${r.duration}m)`).join(', ');
            html += `
                        <div class="recommendation-card" style="border-left: 4px solid #f59e0b;">
                            <div class="recommendation-header" style="justify-content: space-between;">
                                <div style="display: flex; align-items: center; gap: 1rem;">
                                    <div class="recommendation-icon-box rec-icon-yellow"><span class="material-symbols-outlined">history_toggle_off</span></div>
                                    <div class="recommendation-title">Long Pipeline Runs Detected</div>
                                </div>
                                <label style="display: flex; align-items: center; gap: 0.5rem; cursor: pointer;" title="Mark as resolved">
                                    <span style="font-size: 0.75rem; color: #9ca3af;">Done</span>
                                    <input type="checkbox" onchange="dismissCard(this)" style="width: 1.1rem; height: 1.1rem; cursor: pointer; accent-color: #10b981;">
                                </label>
                            </div>
                            <div style="color: #4b5563; font-size: 0.95rem; line-height: 1.5;">
                                Some runs took significantly longer than the average (${slowRuns[0].avg}m):
                                <div style="margin-top:0.5rem; font-size: 0.85rem; background: #fff; padding: 0.5rem; border-radius: 0.25rem; border: 1px solid #e5e7eb; max-height: 100px; overflow-y: auto;">
                                    ${slowRunList}
                                </div>
                            </div>
                            <div class="recommendation-action">
                                <span class="material-symbols-outlined" style="color: var(--primary);">lightbulb</span>
                                <span style="font-size: 0.9rem; font-weight: 500; color: #374151;"><strong>Recommendation:</strong> Check infrastructure load or test retries in these runs.</span>
                            </div>
                        </div>`;
        }
        if (testsWithoutGroup.length > 0) {
            html += `
                        <div class="recommendation-card" style="border-left: 4px solid #f59e0b;">
                            <div class="recommendation-header" style="justify-content: space-between;">
                                <div style="display: flex; align-items: center; gap: 1rem;">
                                    <div class="recommendation-icon-box rec-icon-yellow"><span class="material-symbols-outlined">group_off</span></div>
                                    <div class="recommendation-title">Missing Test Ownership</div>
                                </div>
                                <label style="display: flex; align-items: center; gap: 0.5rem; cursor: pointer;" title="Mark as resolved">
                                    <span style="font-size: 0.75rem; color: #9ca3af;">Done</span>
                                    <input type="checkbox" onchange="dismissCard(this)" style="width: 1.1rem; height: 1.1rem; cursor: pointer; accent-color: #10b981;">
                                </label>
                            </div>
                            <div style="color: #4b5563; font-size: 0.95rem; line-height: 1.5;">
                                ${testsWithoutGroup.length} tests are not assigned to any group. Tests without a group may lack ownership, making maintenance and targeted execution difficult.
                            </div>
                            <div class="recommendation-action">
                                <span class="material-symbols-outlined" style="color: var(--primary);">lightbulb</span>
                                <span style="font-size: 0.9rem; font-weight: 500; color: #374151;"><strong>Recommendation:</strong> Assign a 'test_group_name' to ensure accountability and better organization.</span>
                            </div>
                        </div>`;
        }
        if (brokenTests.length === 0 && flakyTests.length === 0 && slowTests.length === 0 && slowRuns.length === 0 && testsWithoutGroup.length === 0) {
            html += `
                        <div class="recommendation-card" style="border-left: 4px solid #10b981;">
                            <div class="recommendation-header" style="justify-content: space-between;">
                                <div style="display: flex; align-items: center; gap: 1rem;">
                                    <div class="recommendation-icon-box rec-icon-green"><span class="material-symbols-outlined">check_circle</span></div>
                                    <div class="recommendation-title">Great Stability!</div>
                                </div>
                                <label style="display: flex; align-items: center; gap: 0.5rem; cursor: pointer;" title="Dismiss">
                                    <span style="font-size: 0.75rem; color: #9ca3af;">Done</span>
                                    <input type="checkbox" onchange="dismissCard(this)" style="width: 1.1rem; height: 1.1rem; cursor: pointer; accent-color: #10b981;">
                                </label>
                            </div>
                            <div style="color: #4b5563; font-size: 0.95rem; line-height: 1.5;">
                                Your test suite appears very stable and performant.
                            </div>
                            <div class="recommendation-action">
                                <span class="material-symbols-outlined" style="color: var(--primary);">lightbulb</span>
                                <span style="font-size: 0.9rem; font-weight: 500; color: #374151;"><strong>Recommendation:</strong> Keep up the good work!</span>
                            </div>
                        </div>`;
        }

        container.innerHTML = html;
        container.style.display = 'block';
        if (intro) intro.style.display = 'none';
        btn.innerHTML = '<span class="material-symbols-outlined">refresh</span> Regenerate Analysis';
        btn.disabled = false;
        if (exportBtn) exportBtn.classList.remove('hidden');
    }, 800);
}

window.addEventListener('DOMContentLoaded', () => {
    fetch('demo/valid_tests_list.json')
        .then(response => {
            if (!response.ok) throw new Error("Failed to load data");
            return response.text();
        })
        .then(text => {
            try {
                processJSON(text);
            } catch (err) {
                console.error(err);
                alert('Error processing JSON data');
            }
        })
        .catch(err => {
            console.error(err);
            alert('Could not fetch data file: ' + err.message);
        });
});

document.getElementById('searchInput').addEventListener('input', function (e) {
    currentPage = 1;
    renderTable();
});

document.getElementById('flakyCount').addEventListener('click', function () {
    setFilter(currentFilter === 'flaky' ? 'all' : 'flaky');
});

document.getElementById('brokenCount').addEventListener('click', function () {
    setFilter(currentFilter === 'broken' ? 'all' : 'broken');
});
document.getElementById('newFailureCount').addEventListener('click', function () {
    setFilter(currentFilter === 'new-failure' ? 'all' : 'new-failure');
});

document.getElementById('passedFilterClickable').addEventListener('click', () => {
    setFilter(currentFilter === 'passed-only' ? 'all' : 'passed-only');
});
document.getElementById('failedFilterClickable').addEventListener('click', () => {
    setFilter(currentFilter === 'failing' ? 'all' : 'failing');
});
document.getElementById('skippedFilterClickable').addEventListener('click', () => {
    setFilter(currentFilter === 'skipped-any' ? 'all' : 'skipped-any');
});
document.getElementById('totalExecutionsClickable').addEventListener('click', () => {
    setFilter('all');
});

document.getElementById('btnExportCsv').addEventListener('click', exportDataToCsv);

document.getElementById('btnPrev').addEventListener('click', () => {
    if (currentPage > 1) {
        currentPage--;
        renderTable();
    }
});
document.getElementById('btnNext').addEventListener('click', () => {
    currentPage++;
    renderTable();
});

function setFilter(filter) {
    currentFilter = filter;
    isComparisonMode = false;

    // Update flaky count link style
    document.getElementById('flakyCount').classList.toggle('filter-active', filter === 'flaky');
    // Update broken count link style
    document.getElementById('brokenCount').classList.toggle('filter-active', filter === 'broken');
    document.getElementById('newFailureCount').classList.toggle('filter-active', filter === 'new-failure');

    // NEW: update status distribution legend styles
    document.getElementById('passedFilterClickable').classList.toggle('filter-active', filter === 'passed-only');
    document.getElementById('failedFilterClickable').classList.toggle('filter-active', filter === 'failing');
    document.getElementById('skippedFilterClickable').classList.toggle('filter-active', filter === 'skipped-any');
    document.getElementById('totalExecutionsClickable').classList.toggle('filter-active', filter === 'all');

    currentPage = 1;
    updateInsights(activeRunFilters);

    document.getElementById('compareRunsBtn').disabled = !(activeRunFilters.length >= 2 && activeRunFilters.length <= 3);
    document.getElementById('clearRunFilterBtn').disabled = activeRunFilters.length === 0;
    renderTable();
    renderTrendChart('trendChartSmall', globalRunStats);
    renderTrendChart('trendChartLarge', globalRunStats);
}

function processJSON(jsonText) {
    if (!jsonText || !jsonText.trim()) {
        alert('The uploaded JSON file is empty.');
        return;
    }

    // Handle BOM
    if (jsonText.charCodeAt(0) === 0xFEFF) {
        jsonText = jsonText.slice(1);
    }

    let jsonData;
    try {
        jsonData = JSON.parse(jsonText);
    } catch (e) {
        alert('Invalid JSON format.');
        return;
    }

    if (!Array.isArray(jsonData)) {
        alert('JSON root must be an array of test result objects.');
        return;
    }

    if (jsonData.length === 0) {
        alert('JSON array is empty.');
        return;
    }

    // Check required keys on first element
    const requiredCols = ['run_id', 'test_name', 'status', 'run_date', 'start_time', 'end_time'];
    const firstItem = jsonData[0];
    const missing = requiredCols.filter(col => !Object.prototype.hasOwnProperty.call(firstItem, col));

    if (missing.length > 0) {
        alert(`Invalid JSON Format.\nMissing required keys in first item: ${missing.join(', ')}`);
        return;
    }

    const testResults = {};
    const testGroups = {};
    const testHistory = {};
    const testNames = {};
    const testDetails = {};
    const runTypes = new Set();
    const versions = new Set();
    const runStatsMap = {};
    const localRunToTestsMap = {};
    const runIds = new Set();
    const mockRunMetadata = {};
    let totalPassed = 0;
    let totalFailed = 0;
    let totalSkipped = 0;

    for (const item of jsonData) {
        const rawTestName = item.test_name ? String(item.test_name).trim() : '';
        if (!rawTestName) continue;

        let status = item.status ? String(item.status).trim().toLowerCase() : '';
        if (status === 'pass') status = 'passed';
        else if (status === 'fail') status = 'failed';
        else if (status === 'skip') status = 'skipped';

        let groupName = '--';
        if (item.test_group_name) {
            const trimmed = String(item.test_group_name).trim();
            if (trimmed) groupName = trimmed;
        }

        let runId = item.run_id ? String(item.run_id).trim() : '';

        let runType = item.run_type || item.type || '';
        let version = item.version || item.build_number || '';

        if (runId) {
            if (!mockRunMetadata[runId]) {
                const mTypes = ['Nightly', 'CI', 'Sanity', 'Regression'];
                const mVers = ['1.0.0', '1.0.1', '1.1.0', '1.2.0-beta'];
                let hash = 0;
                for (let i = 0; i < runId.length; i++) hash = (hash << 5) - hash + runId.charCodeAt(i);
                hash = Math.abs(hash);
                mockRunMetadata[runId] = {
                    type: mTypes[hash % mTypes.length],
                    version: mVers[(hash >> 2) % mVers.length]
                };
            }
            if (!runType) runType = mockRunMetadata[runId].type;
            if (!version) version = mockRunMetadata[runId].version;
        }

        if (runType) runTypes.add(runType);
        if (version) versions.add(version);

        const testKey = `${rawTestName}|${groupName}`;

        if (runId) runIds.add(runId);

        if (runId) {
            const currentStartTime = item.start_time || null;
            const currentEndTime = item.end_time || null;

            if (!runStatsMap[runId]) {
                runStatsMap[runId] = {
                    id: runId,
                    date: item.run_date || '',
                    passed: 0, failed: 0, skipped: 0, total: 0,
                    startTime: currentStartTime,
                    endTime: currentEndTime,
                    runType: runType,
                    version: version
                };
            }
            runStatsMap[runId].total++;
            if (status === 'passed') runStatsMap[runId].passed++;
            else if (status === 'failed') runStatsMap[runId].failed++;
            else if (status === 'skipped') runStatsMap[runId].skipped++;

            if (currentStartTime && (!runStatsMap[runId].startTime || currentStartTime < runStatsMap[runId].startTime)) {
                runStatsMap[runId].startTime = currentStartTime;
            }
            if (currentEndTime && (!runStatsMap[runId].endTime || currentEndTime > runStatsMap[runId].endTime)) {
                runStatsMap[runId].endTime = currentEndTime;
            }

            // Ensure metadata is captured if it was missing in previous items of the same run
            if (!runStatsMap[runId].runType && runType) runStatsMap[runId].runType = runType;
            if (!runStatsMap[runId].version && version) runStatsMap[runId].version = version;
        }

        if (status === 'passed') totalPassed++;
        else if (status === 'failed') totalFailed++;
        else if (status === 'skipped') totalSkipped++;

        if (!testResults[testKey]) {
            testResults[testKey] = new Set();
        }
        testResults[testKey].add(status);
        testNames[testKey] = rawTestName;

        if (!testGroups[testKey] || testGroups[testKey] === '--') {
            testGroups[testKey] = groupName;
        }

        if (!testHistory[testKey]) {
            testHistory[testKey] = [];
        }
        testHistory[testKey].push(status);

        if (!testDetails[testKey]) {
            testDetails[testKey] = [];
        }
        testDetails[testKey].push({
            runId: runId,
            status: status,
            date: item.run_date || '-',
            start: item.start_time || '-',
            end: item.end_time || '-',
            runType: runType,
            version: version
        });

        if (runId) {
            if (!localRunToTestsMap[runId]) {
                localRunToTestsMap[runId] = new Set();
            }
            localRunToTestsMap[runId].add(testKey);
        }
    }
    globalTestHistory = testHistory;
    globalTestResults = testResults;
    globalTestGroups = testGroups;
    globalTestNames = testNames;
    globalTestDetails = testDetails;
    globalRunTypes = runTypes;
    globalVersions = versions;
    runToTestsMap = localRunToTestsMap;

    globalRunStats = Object.values(runStatsMap).sort((a, b) => {
        const numA = parseFloat(a.id);
        const numB = parseFloat(b.id);
        if (!isNaN(numA) && !isNaN(numB)) return numA - numB;
        return a.id.localeCompare(b.id);
    });

    // Calculate run durations
    globalRunStats.forEach(run => {
        if (run.startTime && run.endTime) {
            let start = parseTimeSeconds(run.startTime);
            let end = parseTimeSeconds(run.endTime);
            let duration = end - start;
            if (duration < 0) duration += 86400;
            run.durationSeconds = duration;
        } else {
            run.durationSeconds = 0;
        }
    });

    // Initialize visible runs
    currentVisibleRunIds = globalRunStats.map(r => r.id);

    // Populate Global Filter Dropdowns
    const typeSelect = document.getElementById('globalRunType');
    const verSelect = document.getElementById('globalVersion');
    typeSelect.innerHTML = '<option value="">All Types</option>';
    verSelect.innerHTML = '<option value="">All Versions</option>';

    Array.from(runTypes).sort().forEach(t => {
        const opt = document.createElement('option');
        opt.value = t;
        opt.textContent = t;
        typeSelect.appendChild(opt);
    });
    Array.from(versions).sort().forEach(v => {
        const opt = document.createElement('option');
        opt.value = v;
        opt.textContent = v;
        verSelect.appendChild(opt);
    });

    const uniqueDates = new Set(globalRunStats.map(r => r.date).filter(d => d));
    const sortedDates = Array.from(uniqueDates).sort();

    const datesList = document.getElementById('availableDatesList');
    if (datesList) {
        datesList.innerHTML = '';
        if (sortedDates.length === 0) {
            datesList.innerHTML = '<div style="color:#9ca3af; font-size:0.75rem;">No dates found</div>';
        } else {
            // Show newest first
            [...sortedDates].reverse().forEach(d => {
                const badge = document.createElement('div');
                badge.textContent = d;
                badge.style.cssText = 'display: inline-block; background: #f3f4f6; padding: 2px 8px; border-radius: 4px; font-size: 0.75rem; color: #4b5563; border: 1px solid #e5e7eb; margin-right: 4px; margin-bottom: 4px; cursor: pointer;';
                badge.onclick = () => {
                    document.getElementById('filterDateFrom').value = d;
                    document.getElementById('filterDateTo').value = d;
                    handleDateRangeChange();
                };
                datesList.appendChild(badge);
            });
        }
    }

    if (sortedDates.length > 0) {
        const minDate = sortedDates[0];
        const maxDate = sortedDates[sortedDates.length - 1];
        const fromInput = document.getElementById('filterDateFrom');
        const toInput = document.getElementById('filterDateTo');
        if (fromInput) { fromInput.min = minDate; fromInput.max = maxDate; }
        if (toInput) { toInput.min = minDate; toInput.max = maxDate; }
    }

    columnFilters = {};

    setFilter('all');
    updateInsights();
    updateInsights(currentVisibleRunIds);

    document.getElementById('dashboard').classList.remove('hidden');
}

function openFilter(event, column) {
    const dropdown = document.getElementById('filterDropdown');
    dropdown.innerHTML = '';

    let options = [];

    options.forEach(opt => {
        const item = document.createElement('div');
        item.className = 'dropdown-item';
        item.textContent = opt;
        if (columnFilters[column] === opt) {
            item.style.fontWeight = 'bold';
            item.style.color = 'var(--primary)';
        }
        item.onclick = () => {
            columnFilters[column] = opt;
            currentPage = 1;
            renderTable();
            dropdown.style.display = 'none';
        };
        dropdown.appendChild(item);
    });

    const rect = event.currentTarget.getBoundingClientRect();
    dropdown.style.top = (rect.bottom + window.scrollY) + 'px';
    dropdown.style.left = rect.left + 'px';
    dropdown.style.display = 'block';
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
});

function getTestDisplayDetails(testName) {
    let details = globalTestDetails[testName] || [];
    if (activeRunFilters.length > 0) {
        details = details.filter(d => activeRunFilters.includes(d.runId));
    }
    const effectiveRunIds = activeRunFilters.length > 0 ? activeRunFilters : currentVisibleRunIds;
    details = details.filter(d => effectiveRunIds.includes(d.runId));

    if (details.length === 0) return { runId: '-', start: '-', end: '-', duration: 0, group: globalTestGroups[testName] || '--', status: '-', runType: '-', version: '-' };

    const latest = details.reduce((prev, current) => {
        const numA = parseFloat(prev.runId);
        const numB = parseFloat(current.runId);
        if (!isNaN(numA) && !isNaN(numB)) return (numA > numB) ? prev : current;
        return (prev.runId > current.runId) ? prev : current;
    });

    let duration = 0;
    if (latest.start !== '-' && latest.end !== '-') {
        const s = parseTimeSeconds(latest.start);
        const e = parseTimeSeconds(latest.end);
        duration = e - s;
        if (duration < 0) duration += 86400;
    }

    return {
        runId: latest.runId,
        start: latest.start,
        end: latest.end,
        duration: duration,
        group: globalTestGroups[testName] || '--',
        status: latest.status,
        runType: latest.runType || '-',
        version: latest.version || '-'
    };
}

function renderTable() {
    const thead = document.querySelector('#details table thead');
    const tbody = document.getElementById('testTableBody');
    tbody.innerHTML = '';
    const filterText = document.getElementById('searchInput').value.toLowerCase();

    // Check if any filter is active
    const isSearchActive = filterText !== '';
    const isAdvancedActive = Object.values(advancedFilters).some(v => v !== '');

    const clearBtn = document.getElementById('btnClearFilters');
    if (clearBtn) {
        if (isSearchActive || isAdvancedActive) {
            clearBtn.classList.remove('hidden');
        } else {
            clearBtn.classList.add('hidden');
        }
    }


    let tests = Object.keys(globalTestHistory);

    if (activeRunFilters.length > 0) {
        const testsInSelectedRuns = new Set();
        activeRunFilters.forEach(runId => {
            const runTests = runToTestsMap[runId] || new Set();
            runTests.forEach(testName => testsInSelectedRuns.add(testName));
        });
        tests = tests.filter(name => testsInSelectedRuns.has(name));
    }
    const effectiveRunIds = activeRunFilters.length > 0 ? activeRunFilters : currentVisibleRunIds;
    const effectiveRunIdsSet = new Set(effectiveRunIds);

    const testsInEffectiveRuns = new Set();
    effectiveRunIds.forEach(runId => {
        const runTests = runToTestsMap[runId] || new Set();
        runTests.forEach(testName => testsInEffectiveRuns.add(testName));
    });
    tests = tests.filter(name => testsInEffectiveRuns.has(name));

    // Then apply search filter
    tests = tests.filter(name => name.toLowerCase().includes(filterText));


    // Apply Toolbar Filters
    if (currentFilter !== 'all') {
        tests = tests.filter(name => {
            const statuses = new Set();
            const details = globalTestDetails[name] || [];
            details.forEach(d => {
                if (effectiveRunIdsSet.has(d.runId)) {
                    statuses.add(d.status);
                }
            });

            if (statuses.size === 0) return false;

            if (currentFilter === 'flaky') {
                return statuses.has('passed') && statuses.has('failed');
            } else if (currentFilter === 'failing') {
                return statuses.has('failed');
            } else if (currentFilter === 'broken') {
                return !statuses.has('passed') && statuses.has('failed');
            } else if (currentFilter === 'passed-only') {
                return statuses.size === 1 && statuses.has('passed');
            } else if (currentFilter === 'skipped-any') {
                return statuses.has('skipped');
            } else if (currentFilter === 'new-failure') {
                // Check if test started failing in the last 7 days
                const details = globalTestDetails[name] || [];
                const failures = details.filter(d => d.status === 'failed');
                if (failures.length === 0) return false;

                // Find earliest failure date
                let earliestFailDate = null;
                failures.forEach(f => {
                    if (!f.date || f.date === '-') return;
                    const d = new Date(f.date);
                    if (!earliestFailDate || d < earliestFailDate) earliestFailDate = d;
                });

                if (!earliestFailDate) return false;

                // Anchor date: latest run date in global stats
                const dates = globalRunStats.map(r => r.date).filter(d => d).sort();
                const latestDate = dates.length > 0 ? new Date(dates[dates.length - 1]) : new Date();
                const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;
                const diff = latestDate - earliestFailDate;
                return diff >= 0 && diff <= sevenDaysMs;
            }
            return true;
        });
    }

    // Apply Advanced Filters
    if (Object.values(advancedFilters).some(v => v !== '')) {
        tests = tests.filter(testName => {
            const details = getTestDisplayDetails(testName);

            if (advancedFilters.testName && !testName.toLowerCase().includes(advancedFilters.testName.toLowerCase())) return false;
            if (advancedFilters.testGroup && !details.group.toLowerCase().includes(advancedFilters.testGroup.toLowerCase())) return false;
            if (advancedFilters.runId && !String(details.runId).includes(advancedFilters.runId)) return false;
            if (advancedFilters.status && details.status.toLowerCase() !== advancedFilters.status.toLowerCase()) return false;

            if (advancedFilters.startTimeMin) {
                if (details.start === '-') return false;
                if (parseTimeSeconds(details.start) < parseTimeSeconds(advancedFilters.startTimeMin + ':00')) return false;
            }
            if (advancedFilters.startTimeMax) {
                if (details.start === '-') return false;
                if (parseTimeSeconds(details.start) > parseTimeSeconds(advancedFilters.startTimeMax + ':59')) return false;
            }

            if (advancedFilters.durationMin && details.duration < parseFloat(advancedFilters.durationMin)) return false;
            if (advancedFilters.durationMax && details.duration > parseFloat(advancedFilters.durationMax)) return false;

            return true;
        });
    }

    // Pre-calculate metrics for filtering
    const testMetrics = {};
    tests.forEach(testName => {
        // Calculate metrics based on effective runs
        const details = globalTestDetails[testName] || [];
        let passedCount = 0;
        let failedCount = 0;
        let skippedCount = 0;

        details.forEach(d => {
            if (effectiveRunIdsSet.has(d.runId)) {
                if (d.status === 'passed') passedCount++;
                else if (d.status === 'failed') failedCount++;
                else if (d.status === 'skipped') skippedCount++;
            }
        });

        const totalRuns = passedCount + failedCount + skippedCount;
        const passRate = totalRuns ? (passedCount / totalRuns) * 100 : 0;
        const isFlaky = passedCount > 0 && failedCount > 0;
        const isBroken = !isFlaky && failedCount > 0;


        let status = 'Passed'; // Default assumption if not broken/flaky
        if (isFlaky) status = 'Flaky';
        else if (isBroken) status = 'Broken';
        else if (globalTestResults[testName].has('skipped') && !globalTestResults[testName].has('passed') && !globalTestResults[testName].has('failed')) status = 'Skipped';
        else if (failedCount > 0) status = 'Failed'; // Catch-all

        testMetrics[testName] = { status, passRate, passedCount, failedCount, skippedCount, isFlaky, isBroken };
    });


    // Pagination Logic
    const totalItems = tests.length;
    const totalPages = Math.ceil(totalItems / itemsPerPage);
    const startIdx = (currentPage - 1) * itemsPerPage;
    const endIdx = startIdx + itemsPerPage;
    const paginatedTests = tests.slice(startIdx, endIdx);

    // Update Pagination Controls
    document.getElementById('pageStart').textContent = totalItems > 0 ? startIdx + 1 : 0;
    document.getElementById('pageEnd').textContent = Math.min(endIdx, totalItems);
    document.getElementById('totalItems').textContent = totalItems;
    document.getElementById('btnPrev').disabled = currentPage <= 1;
    document.getElementById('btnNext').disabled = currentPage >= totalPages;

    if (isComparisonMode && activeRunFilters.length >= 2 && activeRunFilters.length <= 3) {
        // Render Comparison Headers
        const sortedRuns = [...activeRunFilters].sort((a, b) => {
            const numA = parseFloat(a);
            const numB = parseFloat(b);
            if (!isNaN(numA) && !isNaN(numB)) return numA - numB;
            return a.localeCompare(b);
        });

        let headerHtml = '<tr><th>Test Name</th><th>Test Group</th>';
        sortedRuns.forEach(runId => {
            headerHtml += `<th class="text-center">Run ${runId}</th>`;
        });
        headerHtml += '</tr>';
        thead.innerHTML = headerHtml;

        for (const testName of paginatedTests) {
            const row = document.createElement('tr');
            const nameCell = document.createElement('td');
            const nameLink = document.createElement('span');
            nameLink.textContent = globalTestNames[testName] || testName;
            nameLink.className = 'test-name-link';
            nameLink.onclick = () => openTestDetails(testName);
            nameCell.appendChild(nameLink);
            row.appendChild(nameCell);

            const groupCell = document.createElement('td');
            groupCell.textContent = globalTestGroups[testName] || '--';
            row.appendChild(groupCell);

            sortedRuns.forEach(runId => {
                const cell = document.createElement('td');
                cell.className = 'text-center';
                const runDetail = globalTestDetails[testName].find(d => d.runId === runId);
                if (runDetail) {
                    cell.innerHTML = `<span class="status-pill pill-${runDetail.status}"></span>${runDetail.status}`;
                } else {
                    cell.innerHTML = '<span style="color:#ccc">-</span>';
                }
                row.appendChild(cell);
            });
            tbody.appendChild(row);
        }
        return;
    }

    // Standard Headers
    thead.innerHTML = `
                <tr>
                    <th>Test Name</th>
                    <th>Group</th>
                    <th>Status</th>
                    <th>Run ID</th>
                    <th>Start Time</th>
                    <th>End Time</th>
                    <th class="text-right">Duration</th>
                    <th class="text-right" style="width: 10rem;">Deviation (P/F/S)</th>
                </tr>
            `;

    for (const testName of paginatedTests) {
        const row = document.createElement('tr');

        // Use pre-calculated metrics
        const m = testMetrics[testName];
        let { passRate, passedCount, failedCount, skippedCount, isFlaky, isBroken } = m;

        // Determine Status & Styles
        let barColor = '';

        if (passRate >= 90) {
            barColor = 'var(--status-pass)'; // Green
        } else if (passRate >= 60) {
            barColor = 'var(--status-skip)'; // Yellow/Amber
        } else {
            barColor = 'var(--status-fail)'; // Red
        }


        // Calculate Time & Duration (Latest Run)
        let startTime = '-';
        let endTime = '-';
        let durationStr = '-';
        let runId = '-';
        let currentStatus = '-';

        let details = globalTestDetails[testName] || [];
        if (activeRunFilters.length > 0) {
            details = details.filter(d => activeRunFilters.includes(d.runId));
        }
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
            currentStatus = latest.status || '-';

            if (startTime !== '-' && endTime !== '-') {
                const s = parseTimeSeconds(startTime);
                const e = parseTimeSeconds(endTime);
                let d = e - s;
                if (d < 0) d += 86400;

                if (d < 60) durationStr = d.toFixed(1) + 's';
                else {
                    const m = Math.floor(d / 60);
                    const sRem = (d % 60).toFixed(0);
                    durationStr = `${m}m ${sRem}s`;
                }
            }
        }

        // 2. Test Name Column
        const nameCell = document.createElement('td');
        const nameLink = document.createElement('span');
        nameLink.textContent = globalTestNames[testName] || testName;
        nameLink.className = 'test-name-link';
        nameLink.onclick = () => openTestDetails(testName);
        nameCell.appendChild(nameLink);
        row.appendChild(nameCell);

        // Test Group Column
        const groupCell = document.createElement('td');
        groupCell.textContent = globalTestGroups[testName] || '--';
        row.appendChild(groupCell);

        // Status
        const statusCell = document.createElement('td');
        let iconName = 'help';
        let iconColor = 'var(--text-muted)';
        
        if (currentStatus === 'passed') { iconName = 'check_circle'; iconColor = 'var(--status-pass)'; }
        else if (currentStatus === 'failed') { iconName = 'cancel'; iconColor = 'var(--status-fail)'; }
        else if (currentStatus === 'skipped') { iconName = 'remove_circle'; iconColor = 'var(--status-skip)'; }

        if (currentStatus !== '-') {
            statusCell.innerHTML = `<div style="display: flex; align-items: center; gap: 6px;">
                <span class="material-symbols-outlined" style="font-size: 16px; color: ${iconColor};">${iconName}</span>
                <span style="text-transform: capitalize;">${currentStatus}</span></div>`;
        } else {
            statusCell.textContent = '-';
            statusCell.style.color = '#9ca3af';
        }
        row.appendChild(statusCell);

        // Run ID
        const runIdCell = document.createElement('td');
        runIdCell.textContent = runId;
        runIdCell.style.cssText = 'color: #6b7280; font-size: 0.8rem; white-space: nowrap;';
        row.appendChild(runIdCell);

        // Start Time
        const startCell = document.createElement('td');
        startCell.textContent = startTime;
        startCell.style.cssText = 'color: #6b7280; font-size: 0.8rem; white-space: nowrap;';
        row.appendChild(startCell);

        // End Time
        const endCell = document.createElement('td');
        endCell.textContent = endTime;
        endCell.style.cssText = 'color: #6b7280; font-size: 0.8rem; white-space: nowrap;';
        row.appendChild(endCell);

        // Duration
        const durCell = document.createElement('td');
        durCell.textContent = durationStr;
        durCell.className = 'text-right';
        durCell.style.fontFamily = 'var(--font-mono)';
        row.appendChild(durCell);

        // 3. Deviation Column
        const deviationCell = document.createElement('td');
        deviationCell.className = 'text-right';
        deviationCell.innerHTML = `
                    <span class="text-green" style="font-weight: 500;">${passedCount}</span> / 
                    <span class="text-red" style="font-weight: 500;">${failedCount}</span> / 
                    <span style="color: #9ca3af; font-weight: 500;">${skippedCount}</span>
                `;
        row.appendChild(deviationCell);


        tbody.appendChild(row);
    }
}

function openTestDetails(testName) {
    const details = globalTestDetails[testName];
    if (!details) return;

    const displayName = globalTestNames[testName] || testName;
    const group = globalTestGroups[testName] || '--';
    document.getElementById('modalTitle').textContent = `History: ${displayName} (Group: ${group})`;
    const tbody = document.getElementById('modalTableBody');
    tbody.innerHTML = '';

    // Sort details by runId (assuming numeric or string sort works for ID)
    details.sort((a, b) => (a.runId > b.runId) ? 1 : -1);

    // Populate Table
    details.forEach(d => {
        const row = document.createElement('tr');
        row.innerHTML = `
                    <td>${d.runId}</td>
                    <td>${d.date}</td>
                    <td>${d.start} - ${d.end}</td>
                    <td><span class="status-pill pill-${d.status}"></span>${d.status}</td>
                `;
        tbody.appendChild(row);
    });

    document.getElementById('detailModal').classList.remove('hidden');

    // Draw Chart (SVG)
    renderChart(details);
}

function updateInsights(runIds = []) {
    let totalRuns, totalTests, totalPassed = 0, totalFailed = 0, totalSkipped = 0, flakyCount = 0, brokenCount = 0;
    let newFailureCount = 0;
    
    // Determine anchor date for "First Time Failure" (Last 7 days relative to latest run)
    const allDates = globalRunStats.map(r => r.date).filter(d => d).sort();
    const latestDate = allDates.length > 0 ? new Date(allDates[allDates.length - 1]) : new Date();
    const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;

    if (runIds && runIds.length > 0) {
        const selectedRunData = globalRunStats.filter(r => runIds.includes(r.id));
        const testsInRuns = new Set();

        selectedRunData.forEach(runData => {
            totalPassed += runData.passed;
            totalFailed += runData.failed;
            totalSkipped += runData.skipped;
            const testsForThisRun = runToTestsMap[runData.id] || new Set();
            testsForThisRun.forEach(t => testsInRuns.add(t));
        });

        totalRuns = selectedRunData.length;
        totalTests = testsInRuns.size;

        testsInRuns.forEach(testName => {
            const statuses = globalTestResults[testName];
            if (statuses.has('passed') && statuses.has('failed')) {
                flakyCount++;
            }
            if (!statuses.has('passed') && statuses.has('failed')) {
                brokenCount++;
            }
            const details = globalTestDetails[testName] || [];
            let hasPass = false;
            let hasFail = false;

            details.forEach(d => {
                if (runIds.includes(d.runId)) {
                    if (d.status === 'passed') hasPass = true;
                    else if (d.status === 'failed') hasFail = true;
                }
            });

            if (hasPass && hasFail) flakyCount++;
            if (!hasPass && hasFail) brokenCount++;

            // First Time Failure Check
            const allDetails = globalTestDetails[testName] || [];
            const failures = allDetails.filter(d => d.status === 'failed');
            if (failures.length > 0) {
                let earliestFailDate = null;
                failures.forEach(f => {
                    if (!f.date || f.date === '-') return;
                    const d = new Date(f.date);
                    if (!earliestFailDate || d < earliestFailDate) earliestFailDate = d;
                });
                const diff = earliestFailDate ? (latestDate - earliestFailDate) : -1;
                if (diff >= 0 && diff <= sevenDaysMs) newFailureCount++;
            }
        });

    } else { // Global stats
        totalRuns = globalRunStats.length;
        totalTests = Object.keys(globalTestHistory).length;

        globalRunStats.forEach(run => {
            totalPassed += run.passed;
            totalFailed += run.failed;
            totalSkipped += run.skipped;
        });

        for (const testName in globalTestResults) {
            const statuses = globalTestResults[testName];
            if (statuses.has('passed') && statuses.has('failed')) {
                flakyCount++;
            }
            if (!statuses.has('passed') && statuses.has('failed')) {
                brokenCount++;
            }

            // First Time Failure Check
            const allDetails = globalTestDetails[testName] || [];
            const failures = allDetails.filter(d => d.status === 'failed');
            if (failures.length > 0) {
                let earliestFailDate = null;
                failures.forEach(f => {
                    if (!f.date || f.date === '-') return;
                    const d = new Date(f.date);
                    if (!earliestFailDate || d < earliestFailDate) earliestFailDate = d;
                });
                const diff = earliestFailDate ? (latestDate - earliestFailDate) : -1;
                if (diff >= 0 && diff <= sevenDaysMs) newFailureCount++;
            }
        }
    }

    // Update all the DOM elements
    const totalExecutions = totalPassed + totalFailed + totalSkipped;
    const pctPassed = totalExecutions ? (totalPassed / totalExecutions) * 100 : 0;
    const pctFailed = totalExecutions ? (totalFailed / totalExecutions) * 100 : 0;
    const pctSkipped = totalExecutions ? (totalSkipped / totalExecutions) * 100 : 0;

    // Update filter bar counts
    const runCountEl = document.getElementById('filterBarRunCount');
    const testCountEl = document.getElementById('filterBarTestCount');
    if (runCountEl) runCountEl.textContent = totalRuns;
    if (testCountEl) testCountEl.textContent = totalTests;

    document.getElementById('countPassed').textContent = totalPassed;
    document.getElementById('countFailed').textContent = totalFailed;
    document.getElementById('countSkipped').textContent = totalSkipped;
    document.getElementById('totalExecutions').textContent = totalExecutions;
    document.getElementById('barPassed').style.width = pctPassed + '%';
    document.getElementById('barFailed').style.width = pctFailed + '%';
    document.getElementById('barSkipped').style.width = pctSkipped + '%';
    document.getElementById('percentPassed').textContent = pctPassed.toFixed(1);
    document.getElementById('percentFailed').textContent = pctFailed.toFixed(1);
    document.getElementById('percentSkipped').textContent = pctSkipped.toFixed(1);

    const flakyRateNum = totalTests ? (flakyCount / totalTests) * 100 : 0;
    const flakyRateText = flakyRateNum.toFixed(1) + '%';
    const rateEl = document.getElementById('flakyRate');
    rateEl.textContent = flakyRateText;
    rateEl.className = 'card-value';
    if (flakyRateNum > 5) rateEl.classList.add('text-red');
    else if (flakyRateNum > 0) rateEl.classList.add('text-warning');
    else rateEl.classList.add('text-green');

    const brokenRateNum = totalTests ? (brokenCount / totalTests) * 100 : 0;
    const brokenRateText = brokenRateNum.toFixed(1) + '%';
    const brokenRateEl = document.getElementById('brokenRate');
    brokenRateEl.textContent = brokenRateText;
    brokenRateEl.className = 'card-value';
    if (brokenRateNum > 5) brokenRateEl.classList.add('text-red');
    else if (brokenRateNum > 0) brokenRateEl.classList.add('text-warning');
    else brokenRateEl.classList.add('text-green');

    const newFailureRateNum = totalTests ? (newFailureCount / totalTests) * 100 : 0;
    const newFailureRateText = newFailureRateNum.toFixed(1) + '%';
    const newFailureRateEl = document.getElementById('newFailureRate');
    newFailureRateEl.textContent = newFailureRateText;
    newFailureRateEl.className = 'card-value';
    if (newFailureRateNum > 0) newFailureRateEl.classList.add('text-red');
    else newFailureRateEl.classList.add('text-green');
    document.getElementById('newFailureCount').textContent = newFailureCount;

    document.getElementById('flakyCount').textContent = flakyCount;
    document.getElementById('brokenCount').textContent = brokenCount;
    document.getElementById('totalTests').textContent = totalTests;
    document.getElementById('totalTestsBroken').textContent = totalTests;

    // --- Group Status Deviation Logic ---
    const groupStats = {};
    const targetRunIds = (runIds && runIds.length > 0) ? new Set(runIds) : null;

    for (const [testName, details] of Object.entries(globalTestDetails)) {
        const rawGroup = globalTestGroups[testName];
        const group = (rawGroup && rawGroup !== '--') ? rawGroup : 'Unassigned';

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
        const sortedGroups = Object.entries(groupStats).sort((a, b) => {
            if (b[1].failed !== a[1].failed) return b[1].failed - a[1].failed; // Sort by failures desc
            return b[1].total - a[1].total; // Then by total desc
        });

        if (sortedGroups.length === 0) {
            groupContainer.innerHTML = '<div style="color:#9ca3af; font-size:0.9rem;">No data available</div>';
        } else {
            const table = document.createElement('table');
            table.style.width = '100%';
            table.style.borderCollapse = 'collapse';
            table.style.fontSize = '0.85rem';

            const thead = document.createElement('thead');
            thead.innerHTML = `
                <tr style="text-align: left; border-bottom: 1px solid #e5e7eb;">
                    <th style="padding: 0.5rem; font-weight: 600; color: #374151; position: sticky; top: 0; background: #fff; z-index: 1;">Group</th>
                    <th style="padding: 0.5rem; font-weight: 600; color: #374151; text-align: right; position: sticky; top: 0; background: #fff; z-index: 1;">P / F / S</th>
                    <th style="padding: 0.5rem; font-weight: 600; color: #374151; width: 40%; position: sticky; top: 0; background: #fff; z-index: 1;">Distribution</th>
                </tr>
            `;
            table.appendChild(thead);

            const tbody = document.createElement('tbody');
            sortedGroups.forEach(([groupName, stats]) => {
                if (stats.total === 0) return;
                const pPass = (stats.passed / stats.total) * 100;
                const pFail = (stats.failed / stats.total) * 100;
                const pSkip = (stats.skipped / stats.total) * 100;

                const tr = document.createElement('tr');
                tr.style.borderBottom = '1px solid #f3f4f6';
                tr.innerHTML = `
                    <td style="padding: 0.5rem; font-weight: 500; color: #374151;">${groupName}</td>
                    <td style="padding: 0.5rem; text-align: right;">
                        <span class="text-green">${stats.passed}</span> / 
                        <span class="text-red">${stats.failed}</span> / 
                        <span style="color: #9ca3af;">${stats.skipped}</span>
                    </td>
                    <td style="padding: 0.5rem; vertical-align: middle;">
                        <div class="progress-track" style="height: 6px; width: 100%; margin: 0;">
                            <div class="progress-fill bg-green" style="width: ${pPass}%"></div>
                            <div class="progress-fill bg-red" style="width: ${pFail}%"></div>
                            <div class="progress-fill bg-grey" style="width: ${pSkip}%"></div>
                        </div>
                    </td>
                `;
                tbody.appendChild(tr);
            });
            table.appendChild(tbody);
            groupContainer.appendChild(table);
        }
    }
}

function toggleRunFilter(runId, event) {
    const isMultiSelect = event.ctrlKey || event.metaKey || event.shiftKey;
    const index = activeRunFilters.indexOf(runId);

    if (isMultiSelect) {
        if (index > -1) {
            activeRunFilters.splice(index, 1); // Deselect if already selected
        } else {
            activeRunFilters.push(runId); // Add to selection
        }
    } else {
        // Standard click without modifier
        if (activeRunFilters.length === 1 && index === 0) {
            // If the only selected item is clicked again, deselect it
            activeRunFilters = [];
        } else {
            // Otherwise, select only this one
            activeRunFilters = [runId];
        }
    }

    // Clear main filters when a run is selected/deselected to avoid confusion
    currentFilter = 'all';
    document.getElementById('flakyCount').classList.remove('filter-active');
    document.getElementById('brokenCount').classList.remove('filter-active');
    document.getElementById('newFailureCount').classList.remove('filter-active');
    document.getElementById('passedFilterClickable').classList.remove('filter-active');
    document.getElementById('failedFilterClickable').classList.remove('filter-active');
    document.getElementById('skippedFilterClickable').classList.remove('filter-active');
    document.getElementById('totalExecutionsClickable').classList.remove('filter-active');

    const compareBtn = document.getElementById('compareRunsBtn');
    if (activeRunFilters.length >= 2 && activeRunFilters.length <= 3) {
        compareBtn.disabled = false;
        compareBtn.title = "Compare Selected Runs";
    } else {
        compareBtn.disabled = true;
        compareBtn.title = activeRunFilters.length > 3 ? "Select max 3 runs to compare" : "Select 2-3 runs to compare";
        if (isComparisonMode) {
            isComparisonMode = false;
        }
    }

    updateInsights(activeRunFilters);
    updateInsights(activeRunFilters.length > 0 ? activeRunFilters : currentVisibleRunIds);
    document.getElementById('clearRunFilterBtn').disabled = activeRunFilters.length === 0;

    renderTable();
    renderTrendChart('trendChartSmall', globalRunStats);
    renderTrendChart('trendChartLarge', globalRunStats);
}

function toggleDateDropdown(e) {
    e.stopPropagation();
    const menu = document.getElementById('dateFilterMenu');
    menu.style.display = menu.style.display === 'block' ? 'none' : 'block';
}

function handleDateRangeChange() {
    document.getElementById('filterLastDays').value = '';
    updateDateFilterText();
    applyGlobalRunFilters();
}

function clearDateRange() {
    document.getElementById('filterDateFrom').value = '';
    document.getElementById('filterDateTo').value = '';
    updateDateFilterText();
    applyGlobalRunFilters();
}

function updateDateFilterText() {
    const btnText = document.getElementById('dateFilterText');
    const lastDays = document.getElementById('filterLastDays').value;
    const fromDate = document.getElementById('filterDateFrom').value;
    const toDate = document.getElementById('filterDateTo').value;

    if (lastDays) {
        btnText.textContent = `Last ${lastDays} Days`;
    } else if (fromDate && toDate) {
        btnText.textContent = `${fromDate} - ${toDate}`;
    } else if (fromDate) {
        btnText.textContent = `From ${fromDate}`;
    } else if (toDate) {
        btnText.textContent = `Until ${toDate}`;
    } else {
        btnText.textContent = 'All Dates';
    }
}

function handleLastDaysInput() {
    const daysInput = document.getElementById('filterLastDays');
    if (daysInput.value) {
        document.getElementById('filterDateFrom').value = '';
        document.getElementById('filterDateTo').value = '';
    }
    updateDateFilterText();
    applyGlobalRunFilters();
}

function applyGlobalRunFilters() {
    const type = document.getElementById('globalRunType').value;
    const ver = document.getElementById('globalVersion').value;
    const fromDate = document.getElementById('filterDateFrom').value;
    const toDate = document.getElementById('filterDateTo').value;
    const lastDaysInput = document.getElementById('filterLastDays');
    const lastDays = parseInt(lastDaysInput.value);
    let cutoffDateStr = null;

    if (!isNaN(lastDays) && lastDays > 0) {
        const allDates = globalRunStats.map(r => r.date).filter(d => d).sort();
        if (allDates.length > 0) {
            const maxDateStr = allDates[allDates.length - 1];
            const maxDate = new Date(maxDateStr);
            if (!isNaN(maxDate.getTime())) {
                const targetDate = new Date(maxDate);
                targetDate.setDate(maxDate.getDate() - (lastDays - 1));
                cutoffDateStr = targetDate.toISOString().split('T')[0];
            }
        }
    }

    const visibleRuns = globalRunStats.filter(r => {
        let dateMatch = true;
        if (cutoffDateStr) {
            dateMatch = r.date >= cutoffDateStr;
        } else {
            if (fromDate && r.date < fromDate) dateMatch = false;
            if (toDate && r.date > toDate) dateMatch = false;
        }

        return (!type || r.runType === type) && (!ver || r.version === ver) && dateMatch;
    });

    currentVisibleRunIds = visibleRuns.map(r => r.id);

    // Clean up selection if it's no longer visible
    activeRunFilters = activeRunFilters.filter(id => currentVisibleRunIds.includes(id));

    renderTrendChart('trendChartSmall', visibleRuns);
    renderTrendChart('trendChartLarge', visibleRuns);

    updateInsights(activeRunFilters.length > 0 ? activeRunFilters : currentVisibleRunIds);
    renderTable();
}

function toggleComparisonMode() {
    isComparisonMode = !isComparisonMode;
    renderTable();
}

function renderTrendChart(containerId, data) {
    const container = document.getElementById(containerId);
    container.innerHTML = '';
    container.style.position = 'relative';
    container.style.display = 'block';
    container.style.padding = '0';

    if (!data || data.length === 0) {
        container.innerHTML = '<div style="width:100%; height:100%; display:flex; align-items:center; justify-content:center; color:#9ca3af;">No run data available</div>';
        return;
    }

    // Bars Container
    const barsContainer = document.createElement('div');
    barsContainer.style.cssText = 'position: absolute; top: 0; left: 0; width: 100%; height: 100%; display: flex; align-items: flex-end; gap: 1px;';

    // SVG Overlay for Trend Line
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("width", "100%");
    svg.setAttribute("height", "100%");
    svg.setAttribute("viewBox", "0 0 100 100");
    svg.setAttribute("preserveAspectRatio", "none");
    svg.style.cssText = 'position: absolute; top: 0; left: 0; width: 100%; height: 100%; pointer-events: none; z-index: 10;';

    const maxDuration = Math.max(...data.map(r => r.durationSeconds || 0), 1);

    data.forEach((run, index) => {
        const bar = document.createElement('div');
        bar.className = 'chart-bar';
        if (activeRunFilters.includes(run.id)) {
            bar.classList.add('active');
        }

        const pPass = run.total ? (run.passed / run.total) * 100 : 0;
        const pFail = run.total ? (run.failed / run.total) * 100 : 0;
        const pSkip = run.total ? (run.skipped / run.total) * 100 : 0;

        bar.innerHTML = `
                    <div class="chart-bar-segment bg-green" style="height: ${pPass}%"></div>
                    <div class="chart-bar-segment bg-red" style="height: ${pFail}%"></div>
                    <div class="chart-bar-segment bg-grey" style="height: ${pSkip}%"></div>
                `;

        bar.title = `Run: ${run.id}\nDate: ${run.date || '-'}\nTime: ${run.startTime || '?'} - ${run.endTime || '?'}\n\nTotal: ${run.total}\nPassed: ${run.passed}\nFailed: ${run.failed}\nSkipped: ${run.skipped}`;
        // Format Duration
        const d = run.durationSeconds || 0;
        let durStr = d.toFixed(1) + 's';
        if (d > 60) {
            const m = Math.floor(d / 60);
            const s = (d % 60).toFixed(0);
            durStr = `${m}m ${s}s`;
        }

        bar.title = `Run: ${run.id}\nDate: ${run.date || '-'}\nTime: ${run.startTime || '?'} - ${run.endTime || '?'}\nDuration: ${durStr}\n\nTotal: ${run.total}\nPassed: ${run.passed}\nFailed: ${run.failed}\nSkipped: ${run.skipped}`;

        bar.onclick = (event) => toggleRunFilter(run.id, event);

        container.appendChild(bar);
        barsContainer.appendChild(bar);
    });

    container.appendChild(barsContainer);
    container.appendChild(svg);

    // Draw Trend Line
    const points = data.map((run, index) => {
        const xPercent = ((index + 0.5) / data.length) * 100;
        // Scale duration to 90% height (leaving 10% top padding)
        const scaledY = 100 - ((run.durationSeconds || 0) / maxDuration) * 90;
        return `${xPercent},${scaledY}`;
    }).join(' ');

    const polyline = document.createElementNS("http://www.w3.org/2000/svg", "polyline");
    polyline.setAttribute("points", points);
    polyline.setAttribute("fill", "none");
    polyline.setAttribute("stroke", "var(--text-main)");
    polyline.setAttribute("stroke-width", "2");
    polyline.setAttribute("vector-effect", "non-scaling-stroke");
    polyline.setAttribute("stroke-opacity", "0.7");
    svg.appendChild(polyline);

    // Add dots
    data.forEach((run, index) => {
        const xPercent = ((index + 0.5) / data.length) * 100;
        const scaledY = 100 - ((run.durationSeconds || 0) / maxDuration) * 90;

        const dot = document.createElement('div');
        dot.style.cssText = `position: absolute; left: ${xPercent}%; top: ${scaledY}%; width: 6px; height: 6px; background-color: var(--text-main); border-radius: 50%; transform: translate(-50%, -50%); pointer-events: none; z-index: 11;`;
        container.appendChild(dot);
    });
}

function openTrendModal() {
    renderTrendChart('trendChartLarge', globalRunStats);
    document.getElementById('trendModal').classList.remove('hidden');
}

function closeTrendModal() {
    document.getElementById('trendModal').classList.add('hidden');
}

function openAdvancedFilter() {
    document.getElementById('filterTestName').value = advancedFilters.testName;
    document.getElementById('filterTestGroup').value = advancedFilters.testGroup;
    document.getElementById('filterRunId').value = advancedFilters.runId;
    document.getElementById('filterStatus').value = advancedFilters.status;
    document.getElementById('filterStartTimeMin').value = advancedFilters.startTimeMin;
    document.getElementById('filterStartTimeMax').value = advancedFilters.startTimeMax;
    document.getElementById('filterDurationMin').value = advancedFilters.durationMin;
    document.getElementById('filterDurationMax').value = advancedFilters.durationMax;

    document.getElementById('advancedFilterModal').classList.remove('hidden');
}

function closeAdvancedFilter() {
    document.getElementById('advancedFilterModal').classList.add('hidden');
}

function openHelpModal() {
    document.getElementById('helpModal').classList.remove('hidden');
}

function closeHelpModal() {
    document.getElementById('helpModal').classList.add('hidden');
}

function applyAdvancedFilters() {
    advancedFilters.testName = document.getElementById('filterTestName').value;
    advancedFilters.testGroup = document.getElementById('filterTestGroup').value;
    advancedFilters.runId = document.getElementById('filterRunId').value;
    advancedFilters.status = document.getElementById('filterStatus').value;
    advancedFilters.startTimeMin = document.getElementById('filterStartTimeMin').value;
    advancedFilters.startTimeMax = document.getElementById('filterStartTimeMax').value;
    advancedFilters.durationMin = document.getElementById('filterDurationMin').value;
    advancedFilters.durationMax = document.getElementById('filterDurationMax').value;

    currentPage = 1;
    renderTable();
    closeAdvancedFilter();
}

function clearAdvancedFilters() {
    document.getElementById('filterTestName').value = '';
    document.getElementById('filterTestGroup').value = '';
    document.getElementById('filterRunId').value = '';
    document.getElementById('filterStatus').value = '';
    document.getElementById('filterStartTimeMin').value = '';
    document.getElementById('filterStartTimeMax').value = '';
    document.getElementById('filterDurationMin').value = '';
    document.getElementById('filterDurationMax').value = '';
    applyAdvancedFilters();
}

function clearRunSelection() {
    activeRunFilters = [];
    currentFilter = 'all';
    isComparisonMode = false;

    // Reset UI states
    document.getElementById('flakyCount').classList.remove('filter-active');
    document.getElementById('brokenCount').classList.remove('filter-active');
    document.getElementById('newFailureCount').classList.remove('filter-active');
    document.getElementById('passedFilterClickable').classList.remove('filter-active');
    document.getElementById('failedFilterClickable').classList.remove('filter-active');
    document.getElementById('skippedFilterClickable').classList.remove('filter-active');
    document.getElementById('totalExecutionsClickable').classList.remove('filter-active');

    document.getElementById('compareRunsBtn').disabled = true;
    document.getElementById('clearRunFilterBtn').disabled = true;

    renderTrendChart('trendChartSmall', globalRunStats);
    renderTrendChart('trendChartLarge', globalRunStats);
    updateInsights(currentVisibleRunIds);
    renderTable();
}

function clearAllFilters() {
    document.getElementById('searchInput').value = '';

    // Reset Advanced Filters inputs
    document.getElementById('filterTestName').value = '';
    document.getElementById('filterTestGroup').value = '';
    document.getElementById('filterRunId').value = '';
    document.getElementById('filterStatus').value = '';
    document.getElementById('filterStartTimeMin').value = '';
    document.getElementById('filterStartTimeMax').value = '';
    document.getElementById('filterDurationMin').value = '';
    document.getElementById('filterDurationMax').value = '';

    // Reset Advanced Filters state
    advancedFilters = {
        testName: '', testGroup: '', runId: '', status: '',
        startTimeMin: '', startTimeMax: '', durationMin: '', durationMax: ''
    };

    setFilter('all'); // Triggers renderTable
}

function renderChart(details) {
    const container = document.getElementById('chartContainer');
    container.innerHTML = '';

    if (details.length < 2) {
        container.innerHTML = '<div style="padding:1rem; text-align:center; color:#666;">Not enough data for trend chart</div>';
        return;
    }

    const width = container.clientWidth;
    const height = 150;
    const padding = 20;

    // Map status to Y coordinate (Pass = Top/Low Y, Fail = Bottom/High Y)
    // SVG coords: 0 is top. Let's put Pass at 30% height, Fail at 70% height.
    const yPass = height * 0.3;
    const yFail = height * 0.7;
    const ySkip = height * 0.5;

    const points = details.map((d, index) => {
        const x = padding + (index / (details.length - 1)) * (width - (padding * 2));
        let y = ySkip;
        if (d.status === 'passed') y = yPass;
        if (d.status === 'failed') y = yFail;
        return `${x},${y}`;
    }).join(' ');

    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("width", "100%");
    svg.setAttribute("height", "100%");

    // Draw Line
    const polyline = document.createElementNS("http://www.w3.org/2000/svg", "polyline");
    polyline.setAttribute("points", points);
    polyline.setAttribute("fill", "none");
    polyline.setAttribute("stroke", "var(--primary)");
    polyline.setAttribute("stroke-width", "2");
    svg.appendChild(polyline);

    container.appendChild(svg);
}

function closeModal() {
    document.getElementById('detailModal').classList.add('hidden');
}

// Close modal on outside click
document.getElementById('detailModal').addEventListener('click', function (e) {
    if (e.target === this) closeModal();
});
document.getElementById('trendModal').addEventListener('click', function (e) {
    if (e.target === this) closeTrendModal();
});
document.getElementById('advancedFilterModal').addEventListener('click', function (e) {
    if (e.target === this) closeAdvancedFilter();
});

function exportDeepThinkToCsv() {
    if (!lastDeepAnalysisData) return;

    const headers = ['Category', 'Issue', 'Count', 'Recommendation', 'Details'];
    const rows = [];

    // Stability Score
    rows.push(['Score', 'Overall Stability Score', lastDeepAnalysisData.stabilityScore + '/100', 'Based on flaky and broken test rates', '']);

    // Broken Tests
    if (lastDeepAnalysisData.brokenTests.length > 0) {
        rows.push(['Critical', 'Broken Tests', lastDeepAnalysisData.brokenTests.length, 'Quarantine or fix immediately', lastDeepAnalysisData.brokenTests.join('; ')]);
    }

    // Flaky Tests
    if (lastDeepAnalysisData.flakyTests.length > 0) {
        rows.push(['Warning', 'Flaky Tests', lastDeepAnalysisData.flakyTests.length, 'Review test isolation', lastDeepAnalysisData.flakyTests.join('; ')]);
    }

    // Slow Tests
    if (lastDeepAnalysisData.slowTests.length > 0) {
        const details = lastDeepAnalysisData.slowTests.map(t => `${t.name} (${t.duration}m)`).join('; ');
        rows.push(['Performance', 'Slow Tests (>10m)', lastDeepAnalysisData.slowTests.length, 'Optimize performance', details]);
    }

    // Slow Runs
    if (lastDeepAnalysisData.slowRuns.length > 0) {
        const details = lastDeepAnalysisData.slowRuns.map(r => `Run ${r.id} (${r.duration}m)`).join('; ');
        rows.push(['Performance', 'Slow Pipeline Runs', lastDeepAnalysisData.slowRuns.length, 'Check infrastructure/retries', details]);
    }

    // Missing Group
    if (lastDeepAnalysisData.testsWithoutGroup.length > 0) {
        rows.push(['Organization', 'Missing Test Group', lastDeepAnalysisData.testsWithoutGroup.length, 'Assign test_group_name', lastDeepAnalysisData.testsWithoutGroup.join('; ')]);
    }

    const escapeCsv = (txt) => `"${String(txt).replace(/"/g, '""')}"`;
    let csvContent = headers.map(escapeCsv).join(',') + '\r\n';
    csvContent += rows.map(row => row.map(escapeCsv).join(',')).join('\r\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", "deep_think_recommendations.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

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


    const filterText = document.getElementById('searchInput').value.toLowerCase();


    let tests = Object.keys(globalTestHistory);

    if (activeRunFilters.length > 0) {
        const testsInSelectedRuns = new Set();
        activeRunFilters.forEach(runId => {
            const runTests = runToTestsMap[runId] || new Set();
            runTests.forEach(testName => testsInSelectedRuns.add(testName));
        });
        tests = tests.filter(name => testsInSelectedRuns.has(name));
    }


    tests = tests.filter(name => name.toLowerCase().includes(filterText));


    if (currentFilter !== 'all') {
        tests = tests.filter(name => {
            let statuses;
            if (activeRunFilters.length > 0) {
                statuses = new Set();
                const details = globalTestDetails[name] || [];
                details.forEach(d => {
                    if (activeRunFilters.includes(d.runId)) {
                        statuses.add(d.status);
                    }
                });
            } else {
                statuses = globalTestResults[name];
            }

            if (currentFilter === 'flaky') {
                return statuses.has('passed') && statuses.has('failed');
            } else if (currentFilter === 'failing') {
                return statuses.has('failed');
            } else if (currentFilter === 'broken') {
                return !statuses.has('passed') && statuses.has('failed');
            } else if (currentFilter === 'passed-only') {
                return statuses.size === 1 && statuses.has('passed');
            } else if (currentFilter === 'skipped-any') {
                return statuses.has('skipped');
            }
            return true;
        });
    }


    tests.forEach(testName => {
        const history = globalTestHistory[testName];
        const totalRuns = history.length;
        const passedCount = history.filter(s => s === 'passed').length;
        const failedCount = history.filter(s => s === 'failed').length;
        const skippedCount = totalRuns - passedCount - failedCount;
        const groupName = globalTestGroups[testName] || '--';

        // Calculate Time & Duration (Latest Run)
        let startTime = '-';
        let endTime = '-';
        let durationStr = '-';
        let runId = '-';

        let details = globalTestDetails[testName] || [];
        if (activeRunFilters.length > 0) {
            details = details.filter(d => activeRunFilters.includes(d.runId));
        }

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
                const s = parseTimeSeconds(startTime);
                const e = parseTimeSeconds(endTime);
                let d = e - s;
                if (d < 0) d += 86400;
                durationStr = d.toFixed(1) + 's';
            }
        }

        const displayName = globalTestNames[testName] || testName;
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
        { id: 'filterTestName', listId: 'testNameOptions', getData: () => Array.from(new Set(Object.values(globalTestNames))).sort() },
        { id: 'filterTestGroup', listId: 'testGroupOptions', getData: () => Array.from(new Set(Object.values(globalTestGroups))).filter(g => g && g !== '--').sort() },
        { id: 'filterRunId', listId: 'runIdOptions', getData: () => globalRunStats.map(r => r.id).sort() }
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

let isFilterCompact = false;

function toggleFilterCompactMode() {
    isFilterCompact = !isFilterCompact;
    const inputs = document.getElementById('filterInputsContainer');
    const summary = document.getElementById('filterSummaryContainer');
    const icon = document.getElementById('compactModeIcon');
    const chartContainer = document.querySelector('.trend-chart-container');

    if (isFilterCompact) {
        inputs.classList.add('hidden');
        summary.classList.remove('hidden');
        if (chartContainer) chartContainer.classList.add('hidden');
        icon.textContent = 'unfold_more';
        updateFilterSummary();
    } else {
        inputs.classList.remove('hidden');
        summary.classList.add('hidden');
        if (chartContainer) chartContainer.classList.remove('hidden');
        icon.textContent = 'unfold_less';
    }
}

function updateFilterSummary() {
    const type = document.getElementById('globalRunType').value;
    const ver = document.getElementById('globalVersion').value;
    const dateText = document.getElementById('dateFilterText').textContent;
    const container = document.getElementById('filterSummaryContainer');
    container.innerHTML = '';

    const createBadge = (label, value) => {
        const badge = document.createElement('span');
        badge.style.cssText = 'background: #e5e7eb; padding: 2px 8px; border-radius: 4px; font-size: 0.8rem; color: #374151; border: 1px solid #d1d5db;';
        badge.innerHTML = `<strong>${label}:</strong> ${value}`;
        return badge;
    };

    let hasFilter = false;
    if (type) { container.appendChild(createBadge('Type', type)); hasFilter = true; }
    if (ver) { container.appendChild(createBadge('Version', ver)); hasFilter = true; }
    if (dateText && dateText !== 'All Dates') { container.appendChild(createBadge('Date', dateText)); hasFilter = true; }
    if (!hasFilter) {
        const badge = document.createElement('span');
        badge.style.cssText = 'color: #6b7280; font-style: italic; font-size: 0.85rem;';
        badge.textContent = 'No filters applied';
        container.appendChild(badge);
    }
}