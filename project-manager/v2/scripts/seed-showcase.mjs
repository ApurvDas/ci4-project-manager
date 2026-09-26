// Builds the public showcase on the live site: a guest login plus four
// realistic projects run by a small made-up team. Everything goes through the
// same RPCs the app uses (signed in as each teammate), so activity history and
// notifications are real. Re-run it to restore the showcase: existing
// showcase accounts are reused and their projects are recreated.
//
//   SUPABASE_URL=... SERVICE_ROLE_KEY=... ANON_KEY=... GUEST_PASSWORD=... node scripts/seed-showcase.mjs
//
// The service-role key is only used to create/reset the accounts and remove
// old showcase projects; never commit it.
import { createClient } from '@supabase/supabase-js';
import { randomBytes } from 'node:crypto';

const { SUPABASE_URL, SERVICE_ROLE_KEY, ANON_KEY, GUEST_PASSWORD } = process.env;
if (!SUPABASE_URL || !SERVICE_ROLE_KEY || !ANON_KEY || !GUEST_PASSWORD) {
    throw new Error('Set SUPABASE_URL, SERVICE_ROLE_KEY, ANON_KEY and GUEST_PASSWORD.');
}

const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, { auth: { persistSession: false } });

const PEOPLE = {
    guest: { email: 'guest@example.com', username: 'guest', password: GUEST_PASSWORD },
    maya: { email: 'maya.patel@example.com', username: 'maya.patel' },
    leo: { email: 'leo.martins@example.com', username: 'leo.martins' },
    aisha: { email: 'aisha.khan@example.com', username: 'aisha.khan' },
    noah: { email: 'noah.fischer@example.com', username: 'noah.fischer' },
};

const day = (offset) => {
    const d = new Date();
    d.setDate(d.getDate() + offset);
    return d.toISOString().slice(0, 10);
};

async function must(promise, what) {
    const { data, error } = await promise;
    if (error) throw new Error(`${what}: ${error.message}`);
    return data;
}

// Create each account (email confirmed), or reset the password if it exists.
// Teammates get random passwords nobody knows; only the guest can sign in.
async function ensureAccounts() {
    const { users } = await must(admin.auth.admin.listUsers({ perPage: 1000 }), 'list users');
    for (const person of Object.values(PEOPLE)) {
        person.password ??= randomBytes(18).toString('base64url');
        const existing = users.find((u) => u.email === person.email);
        if (existing) {
            await must(admin.auth.admin.updateUserById(existing.id, { password: person.password }), `reset ${person.username}`);
            person.id = existing.id;
        } else {
            const { user } = await must(admin.auth.admin.createUser({
                email: person.email, password: person.password, email_confirm: true, user_metadata: { username: person.username },
            }), `create ${person.username}`);
            person.id = user.id;
        }
        person.sb = createClient(SUPABASE_URL, ANON_KEY, { auth: { persistSession: false } });
        await must(person.sb.auth.signInWithPassword({ email: person.email, password: person.password }), `sign in ${person.username}`);
    }
}

// Projects owned by the showcase team are removed first, so re-runs start clean.
async function clearOldShowcase() {
    const ownerIds = Object.values(PEOPLE).map((p) => p.id);
    await must(admin.from('projects').delete().in('owner_id', ownerIds), 'clear old showcase');
    await must(admin.from('notifications').delete().in('user_id', ownerIds), 'clear old notifications');
}

const PROJECTS = [
    {
        owner: 'maya', name: 'Harbor Coffee — Online Ordering',
        description: 'Let customers order ahead from the Harbor Coffee website and pick up at the counter: menu, cart, checkout and live order status.',
        status: 'active', priority: 'high', start: -21, due: 24, dueTime: '18:00',
        members: [['leo', 'manager'], ['aisha', 'member'], ['noah', 'member'], ['guest', 'member']],
        tags: [['Design', '#EC4899'], ['Frontend', '#6366F1'], ['Backend', '#10B981'], ['Payments', '#F59E0B'], ['Testing', '#EAB308'], ['Urgent', '#F97316']],
        tasks: [
            { by: 'maya', title: 'Design the menu and cart screens', status: 'completed', priority: 'high', due: -9, who: ['aisha'], tags: ['Design', 'Frontend'],
              description: 'Mobile-first layouts for the menu, item options (size, milk, extra shot) and the cart drawer.',
              checklist: [['Menu grid', true], ['Item options sheet', true], ['Cart drawer', true], ['Empty and error states', true]],
              comments: [['leo', 'Looks great. The options sheet is much clearer than the old kiosk.'], ['aisha', 'Thanks! Handing off to frontend today.']] },
            { by: 'maya', title: 'Build checkout with UPI and cards', status: 'in_progress', priority: 'critical', due: 6, dueTime: '17:00', who: ['leo', 'guest'], tags: ['Backend', 'Payments', 'Urgent'],
              description: 'Payment intent on the server, UPI collect and card flows, and a receipt email once the payment clears.',
              checklist: [['Payment intent endpoint', true], ['UPI collect flow', true], ['Card flow with 3-D Secure', false], ['Receipt email', false], ['Refund path for cancelled orders', false]],
              comments: [['maya', 'This is the launch blocker, please flag anything that slips.'], ['leo', 'UPI is working in sandbox. Starting on cards tomorrow.']] },
            { by: 'leo', title: 'Order status notifications', status: 'review', priority: 'high', due: -2, who: ['aisha'], tags: ['Frontend'],
              description: 'Show "received → being made → ready for pickup" on the order page and send a push when it is ready.',
              checklist: [['Status timeline component', true], ['Push when ready', true], ['Copy review', false]],
              comments: [['aisha', 'Ready for review. Push works on Android; iOS needs one more check.']] },
            { by: 'maya', title: 'Pickup time slots and store hours', status: 'todo', priority: 'medium', due: 10, who: ['noah'], tags: ['Backend'],
              description: 'Customers pick a 10-minute slot; hide slots outside store hours and when the queue is full.' },
            { by: 'leo', title: 'Accessibility pass on the ordering flow', status: 'todo', priority: 'medium', due: 14, who: ['guest'], tags: ['Testing', 'Frontend'],
              description: 'Keyboard and screen-reader walkthrough of menu → cart → checkout; log anything below WCAG AA.',
              checklist: [['Keyboard-only order', false], ['Screen reader labels', false], ['Colour contrast', false]] },
            { by: 'leo', title: 'Load test for the morning rush', status: 'todo', priority: 'low', due: 18, who: ['noah'], tags: ['Testing'],
              description: 'Simulate 300 orders in 15 minutes against staging and watch checkout latency.' },
        ],
    },
    {
        owner: 'leo', name: 'Atlas Fitness — Workout Tracker v2',
        description: 'Second version of the Atlas workout app: faster logging between sets, progress charts and shareable routines.',
        status: 'planning', priority: 'medium', start: 3, due: 75,
        members: [['maya', 'member'], ['guest', 'member'], ['noah', 'viewer']],
        tags: [['Research', '#8B5CF6'], ['Design', '#EC4899'], ['Mobile', '#22C55E'], ['Data', '#3B82F6']],
        tasks: [
            { by: 'leo', title: 'Interview ten regular gym-goers', status: 'in_progress', priority: 'high', due: 5, who: ['maya'], tags: ['Research'],
              description: 'What slows people down when logging a set? Record the top three frustrations.',
              checklist: [['Recruit participants', true], ['Interview script', true], ['Run interviews', false], ['Summary deck', false]],
              comments: [['maya', 'Six interviews booked so far, most people hate typing weights.']] },
            { by: 'leo', title: 'Pick a charting library', status: 'review', priority: 'medium', due: 8, who: ['guest'], tags: ['Mobile', 'Data'],
              description: 'Compare three options for progress charts on low-end Android phones.',
              comments: [['leo', 'Please include bundle size in the comparison.']] },
            { by: 'leo', title: 'Wireframe one-tap set logging', status: 'todo', priority: 'high', due: 20, who: ['maya'], tags: ['Design'] },
            { by: 'leo', title: 'Data model for routines, sets and reps', status: 'todo', priority: 'medium', due: 26, who: ['guest'], tags: ['Data'] },
        ],
    },
    {
        owner: 'aisha', name: 'Brand Refresh 2026',
        description: 'Modernise the studio brand: logo, colour palette, type scale and every template the team uses day to day.',
        status: 'active', priority: 'medium', start: -10, due: 12,
        members: [['maya', 'manager'], ['guest', 'member']],
        tags: [['Design', '#EC4899'], ['Content', '#8B5CF6'], ['Social', '#06B6D4']],
        tasks: [
            { by: 'aisha', title: 'Logo exploration, round two', status: 'review', priority: 'high', due: 3, who: ['aisha'], tags: ['Design'],
              description: 'Three directions from round one, refined with the feedback from the team review.',
              comments: [['maya', 'Direction B is my favourite, it works well at small sizes.'], ['aisha', 'Agreed. Preparing final files for B.']] },
            { by: 'aisha', title: 'New colour palette and type scale', status: 'in_progress', priority: 'medium', due: 6, who: ['guest'], tags: ['Design'],
              checklist: [['Primary and neutral colours', true], ['Contrast check', false], ['Type scale for web', false], ['Type scale for print', false]] },
            { by: 'maya', title: 'Refresh social media templates', status: 'todo', priority: 'low', due: 11, who: ['guest'], tags: ['Social'] },
            { by: 'aisha', title: 'Write the brand guidelines', status: 'todo', priority: 'medium', due: 12, dueTime: '12:00', who: ['maya'], tags: ['Content'] },
        ],
    },
    {
        owner: 'noah', name: 'Customer Support Portal',
        description: 'Self-service help centre with searchable articles and a ticket form that routes to the right team.',
        status: 'completed', priority: 'low', start: -90, due: -20,
        members: [['leo', 'member'], ['guest', 'viewer']],
        tags: [['Docs', '#64748B'], ['Frontend', '#6366F1']],
        tasks: [
            { by: 'noah', title: 'Migrate the top 50 help articles', status: 'completed', priority: 'medium', due: -35, who: ['noah'], tags: ['Docs'] },
            { by: 'noah', title: 'Search with typo tolerance', status: 'completed', priority: 'high', due: -28, who: ['leo'], tags: ['Frontend'],
              comments: [['leo', 'Shipped. "pasword" now finds the password reset article.']] },
            { by: 'leo', title: 'Ticket form with team routing', status: 'completed', priority: 'medium', due: -22, who: ['leo'], tags: ['Frontend'] },
        ],
    },
];

async function buildProject(spec) {
    const owner = PEOPLE[spec.owner].sb;
    const pid = await must(owner.rpc('create_project', { p: {
        name: spec.name, description: spec.description, status: spec.status, priority: spec.priority,
        start_date: day(spec.start), due_date: day(spec.due), due_time: spec.dueTime ?? '',
    } }), `create ${spec.name}`);

    for (const [who, role] of spec.members) {
        await must(owner.rpc('add_member', { p_project: pid, p_user: PEOPLE[who].id, p_role: role }), `add ${who}`);
    }

    const tagIds = {};
    for (const [name, color] of spec.tags) {
        const tag = await must(owner.from('tags').insert({ project_id: pid, name, color }).select('id').single(), `tag ${name}`);
        tagIds[name] = tag.id;
    }

    for (const t of spec.tasks) {
        const by = PEOPLE[t.by].sb;
        const tid = await must(by.rpc('save_task', {
            p_project: pid, p_task: null,
            p: { title: t.title, description: t.description ?? '', status: t.status, priority: t.priority, due_date: day(t.due), due_time: t.dueTime ?? '' },
            p_assignees: (t.who ?? []).map((w) => PEOPLE[w].id),
            p_tags: (t.tags ?? []).map((n) => tagIds[n]),
        }), `task ${t.title}`);

        if (t.checklist) {
            await must(by.rpc('add_checklist_items', { p_task: tid, p_items: t.checklist.map(([text]) => text) }), `checklist ${t.title}`);
            const items = await must(by.from('task_checklist_items').select('id, content, task_checklists!inner(task_id)').eq('task_checklists.task_id', tid), 'items');
            for (const [text, done] of t.checklist) {
                if (done) await must(by.rpc('toggle_item', { p_item: items.find((i) => i.content === text).id }), `tick ${text}`);
            }
        }
        for (const [who, text] of t.comments ?? []) {
            await must(PEOPLE[who].sb.rpc('add_comment', { p_task: tid, p_comment: text }), 'comment');
        }
    }
    console.log(`built: ${spec.name}`);
}

await ensureAccounts();
await clearOldShowcase();
for (const spec of PROJECTS) await buildProject(spec);
console.log(`Showcase ready. Sign in as ${PEOPLE.guest.email}.`);
