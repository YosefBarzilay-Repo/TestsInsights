window.App = window.App || {};

window.App.AnalysisService = {
    lastDeepAnalysisData: null,

    generateDeepAnalysis: function() {
        const DataStore = App.DataStore;
        const Utils = App.Utils;
        const FilterManager = App.FilterManager;

        if (!FilterManager.isAnyFilterActive()) {
            const container = document.getElementById('deepThinkResults');
            container.innerHTML = '<div style="padding: 1rem; color: var(--text-muted); text-align: center;">No filter selected. Please select a filter to analyze.</div>';
            container.style.display = 'block';
            document.getElementById('deepThinkIntro').style.display = 'none';
            return;
        }
        const container = document.getElementById('deepThinkResults');
        const intro = document.getElementById('deepThinkIntro');
        const btn = document.getElementById('btnGenerateAnalysis');
        const exportBtn = document.getElementById('btnExportDeepThink');

        btn.innerHTML = '<span class="material-symbols-outlined spin">sync</span> Analyzing...';
        btn.disabled = true;

        setTimeout(() => {
            const totalTests = Object.keys(DataStore.testHistory).length;
            const flakyTests = Object.keys(DataStore.testResults).filter(t => DataStore.testResults[t].has('passed') && DataStore.testResults[t].has('failed'));
            const brokenTests = Object.keys(DataStore.testResults).filter(t => !DataStore.testResults[t].has('passed') && DataStore.testResults[t].has('failed'));

            // Analyze Slow Tests (> 10 mins avg)
            const slowTests = [];
            for (const [testName, details] of Object.entries(DataStore.testDetails)) {
                let totalDuration = 0;
                let count = 0;
                details.forEach(d => {
                    if (d.start && d.end && d.start !== '-' && d.end !== '-') {
                        let start = Utils.parseTimeSeconds(d.start);
                        let end = Utils.parseTimeSeconds(d.end);
                        let duration = end - start;
                        if (duration < 0) duration += 24 * 3600;
                        totalDuration += duration;
                        count++;
                    }
                });
                if (count > 0) {
                    const avgMinutes = (totalDuration / count) / 60;
                    if (avgMinutes > 10) {
                        slowTests.push({ name: DataStore.testNames[testName] || testName, duration: avgMinutes.toFixed(1) });
                    }
                }
            }

            // Analyze Slow Runs (> 1.5x avg)
            const slowRuns = [];
            let totalRunDuration = 0;
            let runCount = 0;
            const runDurations = [];
            DataStore.runStats.forEach(run => {
                if (run.startTime && run.endTime) {
                    let start = Utils.parseTimeSeconds(run.startTime);
                    let end = Utils.parseTimeSeconds(run.endTime);
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
            const testsWithoutGroup = Object.keys(DataStore.testGroups).filter(t => !DataStore.testGroups[t] || DataStore.testGroups[t] === '--');

            // Stability Score
            const stabilityScore = Math.max(0, 100 - ((flakyTests.length + brokenTests.length) / totalTests * 100)).toFixed(1);

            this.lastDeepAnalysisData = {
                stabilityScore,
                brokenTests,
                flakyTests,
                slowTests,
                slowRuns,
                testsWithoutGroup
            };

            let html = '';

            html += `
                        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem;">
                            <h4 style="margin: 0;">AI Recommendations</h4>
                            <button class="btn btn-secondary" onclick="App.AnalysisService.exportDeepThinkToCsv()" style="padding: 0.25rem 0.75rem; font-size: 0.8rem;" id="btnExportDeepThink">
                                <span class="material-symbols-outlined" style="font-size: 1.1rem;">download</span>
                                Export
                            </button>
                        </div>
                    `;

            if (brokenTests.length > 0) {
                html += this._createRecommendationCard('red', 'error', 'Fix Broken Tests First', 
                    `${brokenTests.length} tests are consistently failing. These provide no value and block the pipeline.`,
                    'Quarantine or fix these tests immediately.');
            }
            if (flakyTests.length > 0) {
                const flakyList = flakyTests.map(t => DataStore.testNames[t] || t).join(', ');
                html += this._createRecommendationCard('yellow', 'warning', 'Address Flakiness',
                    `${flakyTests.length} tests are exhibiting flaky behavior:`,
                    'Review test isolation and environment stability.', flakyList);
            }
            if (slowTests.length > 0) {
                const slowList = slowTests.map(t => `${t.name} (${t.duration}m)`).join(', ');
                html += this._createRecommendationCard('yellow', 'timer', 'Optimize Slow Tests',
                    `${slowTests.length} tests have an average execution time > 10 minutes:`,
                    'Investigate these tests for performance optimization.', slowList);
            }
            if (slowRuns.length > 0) {
                const slowRunList = slowRuns.map(r => `Run ${r.id} (${r.duration}m)`).join(', ');
                html += this._createRecommendationCard('yellow', 'history_toggle_off', 'Long Pipeline Runs Detected',
                    `Some runs took significantly longer than the average (${slowRuns[0].avg}m):`,
                    'Check infrastructure load or test retries in these runs.', slowRunList);
            }
            if (testsWithoutGroup.length > 0) {
                html += this._createRecommendationCard('yellow', 'group_off', 'Missing Test Ownership',
                    `${testsWithoutGroup.length} tests are not assigned to any group. Tests without a group may lack ownership.`,
                    "Assign a 'test_group_name' to ensure accountability and better organization.");
            }
            if (brokenTests.length === 0 && flakyTests.length === 0 && slowTests.length === 0 && slowRuns.length === 0 && testsWithoutGroup.length === 0) {
                html += this._createRecommendationCard('green', 'check_circle', 'Great Stability!',
                    'Your test suite appears very stable and performant.',
                    'Keep up the good work!');
            }

            container.innerHTML = html;
            container.style.display = 'block';
            if (intro) intro.style.display = 'none';
            btn.innerHTML = '<span class="material-symbols-outlined">refresh</span> Regenerate Analysis';
            btn.disabled = false;
            if (exportBtn) exportBtn.classList.remove('hidden');

            const totalIssues = brokenTests.length + flakyTests.length + slowTests.length + slowRuns.length + testsWithoutGroup.length;
            App.UIManager.updateDeepThinkBadge(totalIssues);
        }, 800);
    },

    _createRecommendationCard: function(color, icon, title, description, recommendation, listData = null) {
        const colorMap = { 'red': '#ef4444', 'yellow': '#f59e0b', 'green': '#10b981' };
        const borderColor = colorMap[color] || '#ccc';
        const iconClass = `rec-icon-${color}`;
        
        let listHtml = '';
        if (listData) {
            listHtml = `<div style="margin-top:0.5rem; font-size: 0.85rem; background: var(--bg-body); padding: 0.5rem; border-radius: 0.25rem; border: 1px solid var(--border-color); max-height: 100px; overflow-y: auto;">${listData}</div>`;
        }

        return `
            <div class="recommendation-card" style="border-left: 4px solid ${borderColor};">
                <div class="recommendation-header" style="justify-content: space-between;">
                    <div style="display: flex; align-items: center; gap: 1rem;">
                        <div class="recommendation-icon-box ${iconClass}"><span class="material-symbols-outlined">${icon}</span></div>
                        <div class="recommendation-title">${title}</div>
                    </div>
                    <label style="display: flex; align-items: center; gap: 0.5rem; cursor: pointer;" title="Mark as resolved">
                        <span style="font-size: 0.75rem; color: var(--text-muted);">Done</span>
                        <input type="checkbox" onchange="App.UIManager.dismissCard(this)" style="width: 1.1rem; height: 1.1rem; cursor: pointer; accent-color: #10b981;">
                    </label>
                </div>
                <div style="color: var(--text-secondary); font-size: 0.95rem; line-height: 1.5;">
                    ${description}
                    ${listHtml}
                </div>
                <div class="recommendation-action">
                    <span class="material-symbols-outlined" style="color: var(--primary);">lightbulb</span>
                    <span style="font-size: 0.9rem; font-weight: 500; color: var(--text-main);"><strong>Recommendation:</strong> ${recommendation}</span>
                </div>
            </div>`;
    },

    exportDeepThinkToCsv: function() {
        if (!this.lastDeepAnalysisData) return;
        const data = this.lastDeepAnalysisData;

        const headers = ['Category', 'Issue', 'Count', 'Recommendation', 'Details'];
        const rows = [];

        rows.push(['Score', 'Overall Stability Score', data.stabilityScore + '/100', 'Based on flaky and broken test rates', '']);
        if (data.brokenTests.length > 0) rows.push(['Critical', 'Broken Tests', data.brokenTests.length, 'Quarantine or fix immediately', data.brokenTests.join('; ')]);
        if (data.flakyTests.length > 0) rows.push(['Warning', 'Flaky Tests', data.flakyTests.length, 'Review test isolation', data.flakyTests.join('; ')]);
        if (data.slowTests.length > 0) rows.push(['Performance', 'Slow Tests (>10m)', data.slowTests.length, 'Optimize performance', data.slowTests.map(t => `${t.name} (${t.duration}m)`).join('; ')]);
        if (data.slowRuns.length > 0) rows.push(['Performance', 'Slow Pipeline Runs', data.slowRuns.length, 'Check infrastructure/retries', data.slowRuns.map(r => `Run ${r.id} (${r.duration}m)`).join('; ')]);
        if (data.testsWithoutGroup.length > 0) rows.push(['Organization', 'Missing Test Group', data.testsWithoutGroup.length, 'Assign test_group_name', data.testsWithoutGroup.join('; ')]);

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
};