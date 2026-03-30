// AdsMasters PPC Tools - Auth Guard
// Include after supabase-js CDN in every tool page

const SUPABASE_URL = 'https://moxvqkisroonmdinmjat.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1veHZxa2lzcm9vbm1kaW5tamF0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ3NjcwMjQsImV4cCI6MjA5MDM0MzAyNH0.MuTqA684d3H3ZUrnxOcVQpU10NVa9Pdgb0tviV-kf04';

const ALL_TOOLS = ['dashboard', 'campaign-creator', 'audit', 'negative-manager', 'keyword-harvesting', 'wasted-spend', 'bid-optimizer', 'asin-optimizer', 'invoices', 'contact'];
const PUBLIC_PAGES = ['index', 'landing', 'pricing', 'reset-password', 'help'];

const sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Hide body until auth check completes (wait for DOM if script is in <head>)
if (document.body) {
    document.body.style.visibility = 'hidden';
} else {
    document.addEventListener('DOMContentLoaded', () => { document.body.style.visibility = 'hidden'; });
}

(async () => {
    // Wait for body to exist
    while (!document.body) await new Promise(r => setTimeout(r, 10));
    const { data: { session } } = await sb.auth.getSession();
    const currentPage = location.pathname.split('/').pop().replace('.html', '') || 'index';

    // Public pages don't need auth
    if (PUBLIC_PAGES.includes(currentPage)) {
        document.body.style.visibility = 'visible';
        return;
    }

    // Not logged in -> redirect to login
    if (!session) {
        location.href = 'login.html';
        return;
    }

    // Check subscription (with retry after checkout to handle webhook delay)
    const isPostCheckout = location.search.includes('checkout=success');
    const maxAttempts = isPostCheckout ? 8 : 1;
    let sub = null;

    for (let i = 0; i < maxAttempts; i++) {
        if (i > 0) await new Promise(r => setTimeout(r, 1500));
        const { data } = await sb.from('ppc_subscriptions')
            .select('plan, status')
            .eq('user_id', session.user.id)
            .single();
        if (data && data.status === 'active') { sub = data; break; }
    }

    // No active subscription -> pricing page
    if (!sub || sub.status !== 'active') {
        location.href = 'pricing.html';
        return;
    }

    // Check tool access
    if (!ALL_TOOLS.includes(currentPage)) {
        location.href = 'dashboard.html';
        return;
    }

    // Auth OK - expose user info and show page
    window.ppcUser = session.user;
    window.ppcPlan = sub.plan;
    window.ppcSub = sub;
    document.body.style.visibility = 'visible';
})();

// Logout helper
function ppcLogout() {
    sb.auth.signOut().then(() => {
        location.href = 'login.html';
    });
}
