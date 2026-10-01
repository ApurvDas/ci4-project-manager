// Project analytics: headline numbers, tasks completed per week, a 30-day
// burndown and hours logged per member. All figures come from the
// project_analytics() RPC; the charts are plain SVG in the site's own ink.
import { page, render, html, call, sb, idParam, notFound, projectAndRole, today, fmtMinutes, fmtShort } from '../app.js';

const id = idParam('project');
const content = await page('Analytics');
const { project } = id ? await projectAndRole(id) : {};
if (!project) await notFound(content);
document.title = `Analytics · ${project.name} · Project Manager`;

const a = await call(sb.rpc('project_analytics', { p_project: id, p_today: today() }));
const t = a.totals;

const stat = (value, label, cls = '') => html`<div class="stat ${cls}"><div class="stat-value">${value}</div><div class="stat-label">${label}</div></div>`;

// A small, dependency-free chart frame: 0 at the bottom, a few faint gridlines.
const W = 640;
const H = 220;
const PAD = { top: 16, right: 12, bottom: 28, left: 32 };
const plotW = W - PAD.left - PAD.right;
const plotH = H - PAD.top - PAD.bottom;
const niceMax = (v) => Math.max(1, Math.ceil(v / 4) * 4 || 4);
const grid = (max) => [0, 0.25, 0.5, 0.75, 1].map((f) => {
    const y = PAD.top + plotH * (1 - f);
    return html`<line class="chart-grid" x1="${PAD.left}" x2="${W - PAD.right}" y1="${y}" y2="${y}"/>
        <text class="chart-axis" x="${PAD.left - 6}" y="${y + 4}" text-anchor="end">${Math.round(max * f)}</text>`;
});

// Tasks completed per week: bars with rounded tops, a 2px gap between them.
function weeklyChart(rows) {
    const max = niceMax(Math.max(...rows.map((r) => r.completed)));
    const slot = plotW / rows.length;
    const barW = Math.min(40, slot - 2);
    return html`<svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="Tasks completed per week, last 8 weeks">
        ${grid(max)}
        ${rows.map((r, i) => {
            const h = Math.max(6, (r.completed / max) * plotH); // room for the rounded top
            const x = PAD.left + i * slot + (slot - barW) / 2;
            const label = `Week of ${fmtShort(r.week)}: ${r.completed} completed`;
            return html`<g class="chart-hit">
                <rect x="${PAD.left + i * slot}" y="${PAD.top}" width="${slot}" height="${plotH}" fill="transparent"><title>${label}</title></rect>
                ${r.completed ? html`<path class="chart-bar" d="M${x},${PAD.top + plotH} v${-(h - 4)} q0,-4 4,-4 h${barW - 8} q4,0 4,4 v${h - 4} z"><title>${label}</title></path>` : ''}
                <text class="chart-axis" x="${x + barW / 2}" y="${H - 8}" text-anchor="middle">${fmtShort(r.week)}</text>
            </g>`;
        })}
    </svg>`;
}

// Burndown: open tasks at the end of each of the last 30 days.
function burndownChart(rows) {
    const max = niceMax(Math.max(...rows.map((r) => r.open)));
    const step = plotW / (rows.length - 1);
    const pt = (r, i) => [PAD.left + i * step, PAD.top + plotH * (1 - r.open / max)];
    const line = rows.map((r, i) => pt(r, i).map((n) => n.toFixed(1)).join(',')).join(' ');
    return html`<svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="Open tasks per day, last 30 days">
        ${grid(max)}
        <polyline class="chart-line" points="${line}"/>
        ${rows.map((r, i) => {
            const [x, y] = pt(r, i);
            const label = `${fmtShort(r.day)}: ${r.open} open`;
            return html`<g class="chart-hit">
                <rect x="${x - step / 2}" y="${PAD.top}" width="${step}" height="${plotH}" fill="transparent"><title>${label}</title></rect>
                <circle class="chart-dot" cx="${x}" cy="${y}" r="4"><title>${label}</title></circle>
                ${(i % 7 === 0 && rows.length - 1 - i >= 4) || i === rows.length - 1 ? html`<text class="chart-axis" x="${x}" y="${H - 8}" text-anchor="middle">${fmtShort(r.day)}</text>` : ''}
            </g>`;
        })}
    </svg>`;
}

// Hours per member: horizontal bars, labelled directly.
function memberBars(rows) {
    const max = Math.max(...rows.map((r) => r.minutes), 1);
    return html`<ul class="member-bars">${rows.map((r) => html`
        <li>
            <span class="member-bars__name">${r.username}</span>
            <span class="member-bars__track"><span class="member-bars__fill" style="width: ${Math.max(2, (r.minutes / max) * 100)}%"></span></span>
            <span class="member-bars__value">${fmtMinutes(r.minutes)}</span>
        </li>`)}</ul>`;
}

const table = (head, rows) => html`<details class="chart-table"><summary>Show as table</summary>
    <table><thead><tr>${head.map((h) => html`<th scope="col">${h}</th>`)}</tr></thead>
    <tbody>${rows.map((r) => html`<tr>${r.map((c) => html`<td>${c}</td>`)}</tr>`)}</tbody></table></details>`;

const estimateNote = t.estimateMinutes
    ? `${fmtMinutes(a.loggedMinutes)} of ${fmtMinutes(t.estimateMinutes)}`
    : fmtMinutes(a.loggedMinutes);

render(content, html`
    <div class="page-header-row">
        <div>
            <h1>Analytics</h1>
            <p class="text-muted">How <a href="project.html?id=${id}">${project.name}</a> is going</p>
        </div>
    </div>

    <div class="stat-grid">
        ${stat(`${t.completed} / ${t.tasks}`, 'Tasks completed')}
        ${stat(t.overdue, 'Overdue now', t.overdue > 0 ? 'is-alert' : '')}
        ${stat(a.avgDaysToFinish === null ? '—' : `${a.avgDaysToFinish} d`, 'Average time to finish a task')}
        ${stat(estimateNote, t.estimateMinutes ? 'Time logged vs estimated' : 'Time logged', t.estimateMinutes && a.loggedMinutes > t.estimateMinutes ? 'is-warn' : '')}
    </div>

    <div class="panels panels--even">
        <section class="card">
            <div class="panel-head"><h2>Completed per week</h2></div>
            <div class="card-body">
                ${weeklyChart(a.weekly)}
                ${table(['Week of', 'Completed'], a.weekly.map((r) => [fmtShort(r.week), r.completed]))}
            </div>
        </section>
        <section class="card">
            <div class="panel-head"><h2>Burndown: open tasks</h2></div>
            <div class="card-body">
                ${burndownChart(a.burndown)}
                ${table(['Day', 'Open tasks'], a.burndown.map((r) => [fmtShort(r.day), r.open]))}
            </div>
        </section>
    </div>

    <section class="card mt-4">
        <div class="panel-head"><h2>Time logged by member</h2></div>
        <div class="card-body">
            ${a.byMember.length ? memberBars(a.byMember) : html`<p class="text-muted mt-0">No time logged yet. Start a timer or log time on any task.</p>`}
        </div>
    </section>`);
