// Helper to ensure we get the initialized client
function getSupabase() {
    if (window.supabaseClient) return window.supabaseClient;
    if (window.supabase && window.supabase.auth) return window.supabase;

    console.warn("Supabase client not found in window, initializing fallback...");
    const SupabaseLib = window.supabase || window.Supabase;
    const URL = (typeof SUPABASE_URL !== 'undefined') ? SUPABASE_URL : 'https://rffytsmzijylmesvrvxy.supabase.co';
    const KEY = (typeof SUPABASE_ANON_KEY !== 'undefined') ? SUPABASE_ANON_KEY : 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJmZnl0c216aWp5bG1lc3Zydnh5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQ4Njk0MzksImV4cCI6MjA4MDQ0NTQzOX0.RNvmeJij6SPG20aCO0TQSJzH33-L4azoEplxTAHjwj4';

    if (SupabaseLib && SupabaseLib.createClient) {
        window.supabaseClient = SupabaseLib.createClient(URL, KEY);
        return window.supabaseClient;
    }
    throw new Error("Supabase library not loaded.");
}

// Check Admin Auth
const userStr = sessionStorage.getItem('user');
if (!userStr) {
    window.location.href = 'login.html';
}
const user = JSON.parse(userStr);
if (user.role !== 'admin') {
    alert('Access Denied. Admins only.');
    window.location.href = 'index.html';
}

document.getElementById('adminName').textContent = user.name || 'Admin';

document.getElementById('logoutBtn').addEventListener('click', () => {
    sessionStorage.clear();
    window.location.href = 'index.html';
});

async function loadStats() {
    try {
        const sb = getSupabase();
        const { count: userCount } = await sb.from('users').select('*', { count: 'exact', head: true });
        const { count: propCount } = await sb.from('properties').select('*', { count: 'exact', head: true });
        const { count: bookCount } = await sb.from('bookings').select('*', { count: 'exact', head: true });

        document.getElementById('count-users').textContent = userCount || 0;
        document.getElementById('count-properties').textContent = propCount || 0;
        document.getElementById('count-bookings').textContent = bookCount || 0;
    } catch (e) {
        console.error('Stats error:', e);
    }
}

async function loadUsers() {
    const tbody = document.querySelector('#users-table tbody');
    const sb = getSupabase();
    const { data: users, error } = await sb
        .from('users')
        .select('*')
        .order('created_at', { ascending: false });

    if (error) {
        tbody.innerHTML = `<tr><td colspan="5">Error loading users</td></tr>`;
        return;
    }

    tbody.innerHTML = users.map(u => `
    <tr>
      <td>${u.name}</td>
      <td>${u.email}</td>
      <td><span class="role-badge role-${u.role}">${u.role}</span></td>
      <td>${new Date(u.created_at).toLocaleDateString()}</td>
      <td>
        ${u.role !== 'admin' ? `<button class="delete-btn" onclick="deleteUser('${u.id}')">Delete</button>` : '-'}
      </td>
    </tr>
  `).join('');
}

async function loadProperties() {
    const tbody = document.querySelector('#properties-table tbody');
    const sb = getSupabase();
    const { data: props, error } = await sb
        .from('properties')
        .select('*, users(name)') // Join to show owner name
        .order('created_at', { ascending: false });

    if (error) {
        tbody.innerHTML = `<tr><td colspan="6">Error loading properties</td></tr>`;
        return;
    }

    tbody.innerHTML = props.map(p => `
    <tr>
      <td>${p.name}</td>
      <td>${p.location}</td>
      <td>${p.users?.name || 'Unknown'}</td>
      <td>${p.rent.toLocaleString()} BDT</td>
      <td>${p.status}</td>
      <td>
        <button class="delete-btn" onclick="deleteProperty('${p.id}')">Delete</button>
      </td>
    </tr>
  `).join('');
}

window.deleteUser = async (id) => {
    if (!confirm('Are you sure you want to delete this user? This will delete all their properties and bookings.')) return;
    // Supabase Auth deletion requires SERVICE ROLE key usually (admin API), 
    // but let's try deleting from 'users' table which cascades.
    // Note: Only works if RLS checks pass. We might need an RLS policy for admins.
    const sb = getSupabase();
    const { error } = await sb.from('users').delete().eq('id', id);
    if (error) {
        alert('Failed to delete: ' + error.message);
    } else {
        alert('User deleted.');
        loadUsers();
        loadStats();
    }
};

window.deleteProperty = async (id) => {
    if (!confirm('Delete this property?')) return;
    const sb = getSupabase();
    const { error } = await sb.from('properties').delete().eq('id', id);
    if (error) {
        alert('Failed to delete: ' + error.message);
    } else {
        alert('Property deleted.');
        loadProperties();
        loadStats();
    }
};

// Initial Load
loadStats();
loadUsers();
loadProperties();
