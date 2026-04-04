// AdsMasters PPC Tools - Auth Guard
// Include after supabase-js CDN in every tool page

const SUPABASE_URL = 'https://moxvqkisroonmdinmjat.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1veHZxa2lzcm9vbm1kaW5tamF0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ3NjcwMjQsImV4cCI6MjA5MDM0MzAyNH0.MuTqA684d3H3ZUrnxOcVQpU10NVa9Pdgb0tviV-kf04';

const ALL_TOOLS = ['dashboard', 'campaign-creator', 'audit', 'negative-manager', 'keyword-harvesting', 'wasted-spend', 'bid-optimizer', 'asin-optimizer', 'invoices', 'contact', 'tutorials'];
const PUBLIC_PAGES = ['index', 'landing', 'pricing', 'reset-password', 'help', 'login'];

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
    const maxAttempts = isPostCheckout ? 20 : 1;
    let sub = null;

    // Show loading screen during post-checkout polling instead of blank page
    let loadingOverlay = null;
    if (isPostCheckout) {
        document.body.style.visibility = 'visible';
        loadingOverlay = document.createElement('div');
        loadingOverlay.style.cssText = 'position:fixed;inset:0;background:#f5f5f5;display:flex;flex-direction:column;align-items:center;justify-content:center;z-index:9999;font-family:Arial,sans-serif;';
        loadingOverlay.innerHTML = `
            <div style="font-size:48px;margin-bottom:20px;">✅</div>
            <div style="font-size:22px;font-weight:700;color:#1a1a1a;margin-bottom:8px;">Zahlung erfolgreich!</div>
            <div style="font-size:14px;color:#666;margin-bottom:32px;">Dein Abo wird aktiviert – einen Moment bitte...</div>
            <div style="width:200px;height:4px;background:#e0e0e0;border-radius:4px;overflow:hidden;">
                <div id="checkout-bar" style="height:100%;background:#3551FF;border-radius:4px;width:0%;transition:width 1.5s ease;"></div>
            </div>
        `;
        document.body.appendChild(loadingOverlay);
        setTimeout(() => { const b = document.getElementById('checkout-bar'); if (b) b.style.width = '90%'; }, 100);
    }

    for (let i = 0; i < maxAttempts; i++) {
        if (i > 0) await new Promise(r => setTimeout(r, 1500));
        const { data } = await sb.from('ppc_subscriptions')
            .select('plan, status, current_period_end')
            .eq('user_id', session.user.id)
            .single();
        // Allow access if active, OR cancelled but period hasn't ended yet
        if (data && (data.status === 'active' || data.status === 'cancelled')) {
            const expired = data.current_period_end && new Date(data.current_period_end) < new Date();
            if (!expired) { sub = data; break; }
        }
    }

    if (loadingOverlay) loadingOverlay.remove();

    // No valid subscription -> pricing page
    if (!sub || (sub.status !== 'active' && sub.status !== 'cancelled')) {
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

    // Append legal footer to all authenticated pages
    const footer = document.createElement('footer');
    footer.style.cssText = 'text-align:center;padding:24px 0 32px;font-size:12px;border-top:1px solid var(--border,#e0e0e0);margin-top:48px;';
    footer.innerHTML = `
        <a href="agb.html" style="color:var(--text-secondary,#888);text-decoration:none;margin:0 12px;">AGB</a>
        <a href="datenschutz.html" style="color:var(--text-secondary,#888);text-decoration:none;margin:0 12px;">Datenschutz</a>
        <a href="impressum.html" style="color:var(--text-secondary,#888);text-decoration:none;margin:0 12px;">Impressum</a>
        <a href="contact.html" style="color:var(--text-secondary,#888);text-decoration:none;margin:0 12px;">Kontakt</a>
        <span style="color:var(--text-secondary,#aaa);margin:0 12px;">© 2026 AdsMasters GmbH</span>
    `;
    document.body.appendChild(footer);
})();

// Logout helper
function ppcLogout() {
    sb.auth.signOut().then(() => {
        location.href = 'login.html';
    });
}
