window.App = window.App || {};

window.App.FilterManager = {
    currentFilter: 'all',
    activeRunFilters: [],
    currentVisibleRunIds: [],
    columnFilters: {},
    advancedFilters: {
        testName: '', testGroup: '', runId: '', status: '',
        startTimeMin: '', startTimeMax: '', durationMin: '', durationMax: ''
    },

    isAnyFilterActive: function() {
        const type = document.getElementById('globalRunType')?.value;
        const ver = document.getElementById('globalVersion')?.value;
        const runId = document.getElementById('globalRunId')?.value;
        const fromDate = document.getElementById('filterDateFrom')?.value;
        const toDate = document.getElementById('filterDateTo')?.value;
        const lastDays = document.getElementById('filterLastDays')?.value;

        if (type || ver || runId || fromDate || toDate || lastDays) return true;
        if (this.activeRunFilters.length > 0) return true;
        if (this.currentFilter !== 'all') return true;
        return false;
    },

    toggleRunFilter: function(runId, isMultiSelect) {
        const index = this.activeRunFilters.indexOf(runId);
        if (isMultiSelect) {
            if (index > -1) this.activeRunFilters.splice(index, 1);
            else this.activeRunFilters.push(runId);
        } else {
            if (this.activeRunFilters.length === 1 && index === 0) this.activeRunFilters = [];
            else this.activeRunFilters = [runId];
        }
        this.currentFilter = 'all';
    },

    clearAll: function() {
        this.currentFilter = 'all';
        this.activeRunFilters = [];
        this.columnFilters = {};
        this.advancedFilters = {
            testName: '', testGroup: '', runId: '', status: '',
            startTimeMin: '', startTimeMax: '', durationMin: '', durationMax: ''
        };
    }
};