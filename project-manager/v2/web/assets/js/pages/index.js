import { sb } from '../app.js';

const { data: { session } } = await sb.auth.getSession();
location.replace(session ? 'dashboard.html' : 'login.html');
