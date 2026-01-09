if (!window.UI) window.UI = {};

window.UI.TableWidgetCard = function({ title, containerId }) {
    return `
        <div class="card">
            <div class="card-title">${title}</div>
            <div id="${containerId}" style="margin-top: 0.5rem; max-height: 300px; overflow-y: auto; padding-right: 5px;">
            </div>
        </div>
    `;
};