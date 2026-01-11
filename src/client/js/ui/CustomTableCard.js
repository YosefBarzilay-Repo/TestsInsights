if (!window.UI) window.UI = {};

window.UI.CustomTableCard = function({ id, title, data, columns }) {
    // Default columns if not provided
    if (!columns) columns = [
        { key: 'testName', label: 'Test Name' },
        { key: 'group', label: 'Group' },
        { key: 'runId', label: 'Run ID' },
        { key: 'status', label: 'Status' }
    ];

    let headerHtml = columns.map(c => `<th>${c.label}</th>`).join('');

    let rows = '';
    const maxRows = 100; // Performance limit for DOM
    const displayData = data.slice(0, maxRows);
    
    if (displayData.length === 0) {
        rows = `<tr><td colspan="${columns.length}" style="text-align:center; padding: 1rem; color: var(--text-muted);">No matching data found</td></tr>`;
    } else {
        displayData.forEach(row => {
            let cells = '';
            columns.forEach(col => {
                let content = row[col.key] || '-';
                
                if (col.key === 'testName') {
                    cells += `<td style="white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 250px;" title="${content}">${content}</td>`;
                } else if (col.key === 'status' || col.key.startsWith('run_') || col.key.startsWith('test_')) {
                    let lower = String(content).toLowerCase();
                    if (['passed', 'failed', 'skipped'].includes(lower)) {
                        let pillClass = (lower === 'passed' ? 'pill-passed' : (lower === 'failed' ? 'pill-failed' : 'pill-skipped'));
                        cells += `<td><span class="status-pill ${pillClass}"></span>${content}</td>`;
                    } else {
                        cells += `<td>${content}</td>`;
                    }
                } else {
                    cells += `<td>${content}</td>`;
                }
            });
            rows += `<tr>${cells}</tr>`;
        });
    }

    let footerMsg = `${data.length} results`;
    if (data.length > maxRows) footerMsg += ` (showing first ${maxRows})`;

    return `
        <div class="card" style="display: flex; flex-direction: column; height: 100%;">
            <div class="card-title" style="margin-bottom: 0.75rem;">${title}</div>
            <div class="table-scroll-wrapper" style="flex: 1; overflow: auto; max-height: 400px;">
                <table>
                    <thead>
                        <tr>
                            ${headerHtml}
                        </tr>
                    </thead>
                    <tbody>
                        ${rows}
                    </tbody>
                </table>
            </div>
            <div style="margin-top: 0.5rem; font-size: 0.75rem; color: var(--text-muted); text-align: right;">
                ${footerMsg}
            </div>
        </div>
    `;
};