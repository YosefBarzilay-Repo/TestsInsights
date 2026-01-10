window.App = window.App || {};

window.App.DataStore = {
    testHistory: {},
    testResults: {},
    testGroups: {},
    testNames: {},
    testDetails: {},
    runToTestsMap: {},
    runTypes: new Set(),
    versions: new Set(),
    statuses: new Set(),
    runStats: [],
    runMetadata: {},

    processJSON: function(jsonText) {
        if (!jsonText || !jsonText.trim()) {
            alert('The uploaded JSON file is empty.');
            return false;
        }

        if (jsonText.charCodeAt(0) === 0xFEFF) {
            jsonText = jsonText.slice(1);
        }

        let jsonData;
        try {
            jsonData = JSON.parse(jsonText);
        } catch (e) {
            alert('Invalid JSON format.');
            return false;
        }

        if (!Array.isArray(jsonData) || jsonData.length === 0) {
            alert('JSON root must be a non-empty array.');
            return false;
        }

        const runStatsMap = {};
        this.runStats.forEach(r => runStatsMap[r.id] = r);

        for (const item of jsonData) {
            const rawTestName = item.test_name ? String(item.test_name).trim() : '';
            if (!rawTestName) continue;

            let status = item.status ? String(item.status).trim().toLowerCase() : '';
            if (status === 'pass') status = 'passed';
            else if (status === 'fail') status = 'failed';
            else if (status === 'skip') status = 'skipped';

            if (status) this.statuses.add(status);

            let groupName = '--';
            if (item.test_group_name) {
                const trimmed = String(item.test_group_name).trim();
                if (trimmed) groupName = trimmed;
            }

            let runId = item.run_id ? String(item.run_id).trim() : '';
            let runType = item.run_type || item.type || '';
            let version = item.version || item.build_number || '';

            if (runId && this.runMetadata[runId]) {
                const meta = this.runMetadata[runId];
                if (!runType) runType = meta.type;
                if (!version) version = meta.version;
            }

            if (runType) this.runTypes.add(runType);
            if (version) this.versions.add(version);

            const testKey = `${rawTestName}|${groupName}`;

            if (runId) {
                const currentStartTime = item.start_time || null;
                const currentEndTime = item.end_time || null;

                let testDuration = 0;
                if (currentStartTime && currentEndTime) {
                    let s = App.Utils.parseTimeSeconds(currentStartTime);
                    let e = App.Utils.parseTimeSeconds(currentEndTime);
                    testDuration = e - s;
                    if (testDuration < 0) testDuration += 86400;
                }

                if (!runStatsMap[runId]) {
                    let runDate = item.run_date || '';
                    let rStart = currentStartTime;
                    let rEnd = currentEndTime;
                    let rStatus = '';
                    let rUrl = '';

                    if (this.runMetadata[runId]) {
                        const meta = this.runMetadata[runId];
                        if (!runDate && meta.start_time) runDate = meta.start_time.split(' ')[0];
                        if (meta.start_time) rStart = meta.start_time.split(' ')[1] || rStart;
                        if (meta.end_time) rEnd = meta.end_time.split(' ')[1] || rEnd;
                        rStatus = meta.status || '';
                        rUrl = meta.url || '';
                    }

                    runStatsMap[runId] = {
                        id: runId, date: runDate, passed: 0, failed: 0, skipped: 0, total: 0,
                        startTime: rStart, endTime: rEnd, runType: runType, version: version,
                        status: rStatus, url: rUrl, totalTestDuration: 0
                    };
                }
                runStatsMap[runId].totalTestDuration = (runStatsMap[runId].totalTestDuration || 0) + testDuration;

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
                if (!runStatsMap[runId].runType && runType) runStatsMap[runId].runType = runType;
                if (!runStatsMap[runId].version && version) runStatsMap[runId].version = version;
            }

            if (!this.testResults[testKey]) this.testResults[testKey] = new Set();
            this.testResults[testKey].add(status);
            this.testNames[testKey] = rawTestName;
            if (!this.testGroups[testKey] || this.testGroups[testKey] === '--') this.testGroups[testKey] = groupName;
            if (!this.testHistory[testKey]) this.testHistory[testKey] = [];
            this.testHistory[testKey].push(status);
            if (!this.testDetails[testKey]) this.testDetails[testKey] = [];
            this.testDetails[testKey].push({ runId, status, date: item.run_date || '-', start: item.start_time || '-', end: item.end_time || '-', runType, version });
            if (runId) { if (!this.runToTestsMap[runId]) this.runToTestsMap[runId] = new Set(); this.runToTestsMap[runId].add(testKey); }
        }

        this.runStats = Object.values(runStatsMap).sort((a, b) => (parseFloat(a.id) || 0) - (parseFloat(b.id) || 0));
        this.runStats.forEach(run => { if (run.startTime && run.endTime) { let s = App.Utils.parseTimeSeconds(run.startTime), e = App.Utils.parseTimeSeconds(run.endTime); run.durationSeconds = (e - s < 0 ? e - s + 86400 : e - s); } else run.durationSeconds = 0; });
        return true;
    }
};