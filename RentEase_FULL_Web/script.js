// Diagnostic function to check Supabase setup

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
async function checkSupabaseSetup() {
  const checks = {
    supabaseLoaded: typeof window.supabase !== 'undefined',
    supabaseInitialized: typeof supabase !== 'undefined' && supabase !== null,
    configValid: false,
    databaseAccessible: false
  };

  if (typeof SUPABASE_URL !== 'undefined' && typeof SUPABASE_ANON_KEY !== 'undefined') {
    checks.configValid = SUPABASE_URL !== 'YOUR_SUPABASE_URL' &&
      SUPABASE_ANON_KEY !== 'YOUR_SUPABASE_ANON_KEY' &&
      SUPABASE_URL.startsWith('https://') &&
      SUPABASE_ANON_KEY.length > 20;
  }

  if (checks.supabaseInitialized) {
    try {
      const sb = getSupabase();
      const { error } = await sb.from('properties').select('count').limit(1);
      checks.databaseAccessible = !error;
      if (error) {
        console.error('Database check error:', error);
      }
    } catch (e) {
      console.error('Database check failed:', e);
    }
  }

  console.group('🔍 Supabase Setup Diagnostic');
  console.log('Supabase library loaded:', checks.supabaseLoaded ? '✅' : '❌');
  console.log('Supabase client initialized:', checks.supabaseInitialized ? '✅' : '❌');
  console.log('Configuration valid:', checks.configValid ? '✅' : '❌');
  console.log('Database accessible:', checks.databaseAccessible ? '✅' : '❌');
  console.groupEnd();

  return checks;
}

// Run diagnostic on page load (only in development)
if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' || window.location.hostname === '') {
  window.addEventListener('load', () => {
    setTimeout(() => checkSupabaseSetup(), 500);
  });
}


// -------------------------------
// Reviews (optional feature)
// -------------------------------
async function getReviewStats(propertyIds = []) {
  if (!propertyIds || propertyIds.length === 0) return {};

  try {
    const sb = getSupabase();
    const { data, error } = await sb
      .from('reviews')
      .select('property_id, rating')
      .in('property_id', propertyIds);

    if (error) {
      // If reviews table is not created yet, keep site working
      console.warn('Reviews not available:', error.message || error);
      return {};
    }

    const stats = {};
    for (const row of (data || [])) {
      const pid = row.property_id;
      if (!stats[pid]) stats[pid] = { sum: 0, count: 0 };
      const r = Number(row.rating);
      if (!Number.isNaN(r)) {
        stats[pid].sum += r;
        stats[pid].count += 1;
      }
    }

    // Convert to avg
    Object.keys(stats).forEach(pid => {
      stats[pid].avg = stats[pid].count ? (stats[pid].sum / stats[pid].count) : 0;
    });

    return stats;
  } catch (e) {
    console.warn('Reviews not available:', e);
    return {};
  }
}

async function updateCardRatings(properties = []) {
  const ids = properties.map(p => p.id).filter(Boolean);
  const stats = await getReviewStats(ids);

  for (const p of properties) {
    const el = document.getElementById(`rating-${p.id}`);
    if (!el) continue;

    const s = stats[p.id];
    if (s && s.count) {
      el.textContent = `⭐ ${s.avg.toFixed(1)} (${s.count})`;
    } else {
      el.textContent = 'No reviews yet';
    }
  }
}

async function loadReviewsIntoModal(propertyId) {
  const panel = document.getElementById('reviews-panel');
  const summary = document.getElementById('reviews-summary');
  const list = document.getElementById('reviews-list');

  if (!panel || !summary || !list) return;

  panel.style.display = 'block';
  summary.textContent = 'Loading reviews...';
  list.innerHTML = '';

  try {
    const sb = getSupabase();
    const { data, error } = await sb
      .from('reviews')
      .select('rating, comment, created_at, users(name)')
      .eq('property_id', propertyId)
      .order('created_at', { ascending: false })
      .limit(10);

    if (error) {
      console.warn('Reviews not available:', error.message || error);
      summary.textContent = 'Reviews are not available yet.';
      return;
    }

    const reviews = data || [];
    if (!reviews.length) {
      summary.textContent = 'No reviews yet.';
      return;
    }

    const avg = reviews.reduce((acc, r) => acc + Number(r.rating || 0), 0) / reviews.length;
    summary.textContent = `Avg ${avg.toFixed(1)} based on ${reviews.length} recent reviews`;

    list.innerHTML = reviews.map(r => {
      const name = r.users?.name || 'Renter';
      const date = r.created_at ? new Date(r.created_at).toLocaleDateString() : '';
      const ratingVal = Number(r.rating || 0);
      const safeRating = Math.max(0, Math.min(5, ratingVal));
      const stars = '*'.repeat(safeRating) + '.'.repeat(5 - safeRating);
      const text = (r.comment || '').replace(/</g, '&lt;').replace(/>/g, '&gt;');
      return `
        <div class="review-item">
          <div class="review-meta">
            <span><strong>${name}</strong></span>
            <span>${date}</span>
          </div>
          <div class="review-stars">${stars}</div>
          <div class="review-text">${text}</div>
        </div>
      `;
    }).join('');

  } catch (e) {
    console.warn('Reviews not available:', e);
    summary.textContent = 'Reviews are not available yet.';
  }
}
// sticky header
const header = document.getElementById('site-header');
if (header) window.addEventListener('scroll', () => header.classList.toggle('scrolled', window.scrollY > 10));

// mobile menu
const navToggle = document.getElementById('nav-toggle');
const primaryMenu = document.getElementById('primary-menu');
if (navToggle && primaryMenu) {
  navToggle.addEventListener('click', () => {
    const expanded = navToggle.getAttribute('aria-expanded') === 'true';
    navToggle.setAttribute('aria-expanded', String(!expanded));
    primaryMenu.classList.toggle('show');
  });
}

// smooth scroll
document.querySelectorAll('a[href^="#"]').forEach(a => {
  a.addEventListener('click', e => {
    const target = document.querySelector(a.getAttribute('href'));
    if (!target) return;
    e.preventDefault();
    const offset = 70;
    const scrollTop = window.pageYOffset + target.getBoundingClientRect().top - offset;
    window.scrollTo({ top: scrollTop, behavior: 'smooth' });
    if (primaryMenu && primaryMenu.classList.contains('show')) {
      primaryMenu.classList.remove('show');
      navToggle.setAttribute('aria-expanded', 'false');
    }
  });
});

// Load properties from Supabase


// -------------------------------
// Location -> Map link helper
// -------------------------------
function makeMapSearchUrl(locationText) {
  const q = encodeURIComponent((locationText || '').trim());
  // Google Maps Search URL (no API key needed for basic search link)
  return `https://www.google.com/maps/search/?api=1&query=${q}`;
}

async function loadProperties(filters = {}) {
  const userStr = sessionStorage.getItem('user');
  let currentUser = userStr ? JSON.parse(userStr) : null;

  const propertyCards = document.getElementById('property-cards');
  if (!propertyCards) return;

  // Check if Supabase is configured and initialized
  try {
    getSupabase();
  } catch (e) {
    console.error('Supabase client is not initialized');
    propertyCards.innerHTML = `
      <div style="text-align: center; padding: 2rem; color: #d32f2f;">
        <p><strong>⚠️ Supabase not configured</strong></p>
        <p style="font-size: 0.9rem; margin-top: 0.5rem;">
          Please configure your Supabase credentials in <code>supabase-config.js</code> or use <code>.env</code> file.
        </p>
        <p style="font-size: 0.85rem; margin-top: 0.5rem; color: #666;">
          See <code>README-SUPABASE-SETUP.md</code> for setup instructions.
        </p>
      </div>
    `;
    return;
  }

  try {
    const sb = getSupabase();
    let query = sb
      .from('properties')
      .select('*')
      .in('status', ['available', 'rented'])
      .order('created_at', { ascending: false });

    // Apply limit if specified (default 4 for initial load)
    if (filters.limit) {
      query = query.limit(filters.limit);
    }

    // Apply filters
    if (filters.location) {
      query = query.ilike('location', `%${filters.location}%`);
    }
    if (filters.type) {
      query = query.eq('type', filters.type);
    }
    if (filters.budgetMin !== undefined) {
      query = query.gte('rent', filters.budgetMin);
    }
    if (filters.budgetMax !== undefined) {
      query = query.lte('rent', filters.budgetMax);
    }

    const { data: properties, error } = await query;

    if (error) throw error;

    if (!properties || properties.length === 0) {
      propertyCards.innerHTML = '<div style="text-align: center; padding: 2rem; color: #666;"><p>No properties found. Try different search criteria.</p></div>';
      return;
    }

    propertyCards.innerHTML = properties.map(property => {
      const infoParts = [];
      if (property.bed) infoParts.push(`${property.bed} Bed`);
      if (property.bath) infoParts.push(`${property.bath} Bath`);
      if (property.corridor) infoParts.push(`${property.corridor} Corridor`);
      if (property.gender) infoParts.push(`${property.gender}`);
      if (property.room) infoParts.push(`${property.room} Room`);
      if (property.purpose) infoParts.push(property.purpose);

      return `
        <article class="card" data-property-id="${property.id}" onclick="openPropertyModal('${property.id}')" style="cursor:pointer">
          <img loading="lazy" src="${property.image_url || 'Image/1st_pic.jpg'}" alt="${property.name}">
          <div class="card-details">
            <p class="location">${property.location}</p>
             <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:0.8rem;">
               <a class="map-link" href="${makeMapSearchUrl(property.location)}" target="_blank" rel="noopener" onclick="event.stopPropagation()" style="margin:0;">View on Map</a>
               <span style="font-size:0.75rem; background:#e0f2fe; color:#0284c7; padding:2px 8px; border-radius:12px; font-weight:600; text-transform:capitalize;">${property.type || 'Apartment'}</span>
             </div>
             <div class="card-rating" id="rating-${property.id}">Loading rating...</div>
            <div class="info">${infoParts.map(part => `<span>${part}</span>`).join('')}</div>
            <div class="booking">
  ${currentUser && currentUser.role === "owner"
          ? ""
          : property.status === 'rented'
            ? `<button class="book-now" disabled style="background-color: #ccc; cursor: not-allowed;">Booked</button>`
            : `<button class="book-now" data-property-id="${property.id}">Book Now</button>`
        }
  <span class="price">${property.rent.toLocaleString()} BDT</span>
</div>

          </div>
        </article>
      `;
    }).join('');

    // Update rating display (if reviews table exists)
    await updateCardRatings(properties);


    // Re-attach event listeners for book buttons
    document.querySelectorAll('.book-now').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation(); // Prevent opening detail modal
        const propertyId = btn.getAttribute('data-property-id');
        openBookingModal(propertyId);
      });
    });
  } catch (error) {
    console.error('Error loading properties:', error);

    // Provide more detailed error messages
    let errorMessage = 'Error loading properties. ';
    let errorDetails = '';

    if (error.message) {
      if (error.message.includes('relation') || error.message.includes('does not exist')) {
        errorMessage = 'Database table not found. ';
        errorDetails = 'Please run the database-schema.sql script in your Supabase SQL Editor.';
      } else if (error.message.includes('JWT') || error.message.includes('token')) {
        errorMessage = 'Authentication error. ';
        errorDetails = 'Please check your Supabase API key in supabase-config.js';
      } else if (error.message.includes('permission') || error.message.includes('policy')) {
        errorMessage = 'Permission denied. ';
        errorDetails = 'Please check your Row Level Security (RLS) policies in Supabase.';
      } else if (error.message.includes('network') || error.message.includes('fetch')) {
        errorMessage = 'Network error. ';
        errorDetails = 'Please check your internet connection and Supabase URL.';
      } else {
        errorDetails = error.message;
      }
    }

    propertyCards.innerHTML = `
      <div style="text-align: center; padding: 2rem; color: #d32f2f;">
        <p><strong>${errorMessage}</strong></p>
        ${errorDetails ? `<p style="font-size: 0.9rem; margin-top: 0.5rem;">${errorDetails}</p>` : ''}
        <p style="font-size: 0.85rem; margin-top: 0.5rem; color: #666;">
          Check the browser console (F12) for more details.
        </p>
      </div>
    `;
  }
}

// Load properties on page load
if (document.getElementById('property-cards')) {
  const initProperties = () => {
    // Initial load with limit of 4
    setTimeout(() => loadProperties({ limit: 4 }), 100);
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initProperties);
  } else {
    initProperties();
  }

  // Handle Explore More / Show Less
  const exploreBtn = document.getElementById('explore-more-btn');
  const showLessBtn = document.getElementById('show-less-btn');

  if (exploreBtn && showLessBtn) {
    // Show All
    exploreBtn.addEventListener('click', (e) => {
      e.preventDefault();
      loadProperties({ limit: 100 });
      exploreBtn.style.display = 'none';
      showLessBtn.style.display = 'inline-block';
    });

    // Show Less
    showLessBtn.addEventListener('click', (e) => {
      e.preventDefault();
      loadProperties({ limit: 4 });
      showLessBtn.style.display = 'none';
      exploreBtn.style.display = 'inline-block';

      // Smooth scroll back to top of section
      document.getElementById('property').scrollIntoView({ behavior: 'smooth' });
    });
  }

  // Handle Navbar 'Properties' click -> Show All
  const navPropLink = document.getElementById('nav-properties-link');
  if (navPropLink && exploreBtn && showLessBtn) {
    navPropLink.addEventListener('click', (e) => {
      // Allow default scroll but also trigger show all
      loadProperties({ limit: 100 });
      exploreBtn.style.display = 'none';
      showLessBtn.style.display = 'inline-block';
    });
  }
}

// search form
const searchForm = document.getElementById('search-form');
if (searchForm) {
  searchForm.addEventListener('submit', async e => {
    e.preventDefault();
    const location = document.getElementById('location')?.value.trim() || '';
    const type = document.getElementById('type')?.value || '';
    const budgetValue = document.getElementById('budget-range')?.value || '';

    if (!location && !type && !budgetValue) {
      return alert('Enter at least one search criterion.');
    }

    const budgetMap = {
      lt5000: { min: 0, max: 5000 },
      "5to20": { min: 5000, max: 20000 },
      "20to50": { min: 20000, max: 50000 },
      gt50000: { min: 50000, max: Infinity }
    };
    const budgetRange = budgetMap[budgetValue] || null;

    const filters = {};
    if (location) filters.location = location;
    if (type) filters.type = type;
    if (budgetRange) {
      filters.budgetMin = budgetRange.min;
      filters.budgetMax = budgetRange.max === Infinity ? undefined : budgetRange.max;
    }

    await loadProperties(filters);
  });

  // Auto-reload all properties when search fields are cleared
  const locationInput = document.getElementById('location');
  const typeSelect = document.getElementById('type');
  const budgetSelect = document.getElementById('budget-range');

  if (locationInput) {
    locationInput.addEventListener('input', async () => {
      const loc = locationInput.value.trim();
      const type = typeSelect?.value || '';
      const budget = budgetSelect?.value || '';
      
      // If all fields are empty, reload all properties
      if (!loc && !type && !budget) {
        await loadProperties({ limit: 100 });
      }
    });
  }

  if (typeSelect) {
    typeSelect.addEventListener('change', async () => {
      const loc = locationInput?.value.trim() || '';
      const type = typeSelect.value || '';
      const budget = budgetSelect?.value || '';
      
      // If all fields are empty/default, reload all properties
      if (!loc && !type && !budget) {
        await loadProperties({ limit: 100 });
      }
    });
  }

  if (budgetSelect) {
    budgetSelect.addEventListener('change', async () => {
      const loc = locationInput?.value.trim() || '';
      const type = typeSelect?.value || '';
      const budget = budgetSelect.value || '';
      
      // If all fields are empty/default, reload all properties
      if (!loc && !type && (!budget || budget === 'all')) {
        await loadProperties({ limit: 100 });
      }
    });
  }
}

// booking modal
let currentPropertyId = null;

function openBookingModal(propertyId) {
  // Check login first
  const userStr = sessionStorage.getItem('user');

  if (!userStr) {
    // Save where user came from (property ID)
    sessionStorage.setItem('pendingBookingProperty', propertyId);

    // Redirect to login page
    window.location.href = "login.html";
    return;
  }

  // If logged in → show modal
  currentPropertyId = propertyId;
  const modal = document.getElementById('booking-modal');
  if (modal) modal.style.display = 'flex';

  // Load reviews (optional feature)
  loadReviewsIntoModal(propertyId);

}

function hideBookingModal() {
  const modalEl = document.getElementById('booking-modal');
  if (modalEl) {
    modalEl.style.display = 'none';
  }
  const panel = document.getElementById('reviews-panel');
  const summary = document.getElementById('reviews-summary');
  const list = document.getElementById('reviews-list');
  if (panel) {
    panel.style.display = 'none';
  }
  if (summary) summary.textContent = '';
  if (list) list.innerHTML = '';
  currentPropertyId = null;
}

const modal = document.getElementById('booking-modal');
const closeBtn = document.querySelector('.close-btn');
if (modal && closeBtn) {
  closeBtn.addEventListener('click', hideBookingModal);
  window.addEventListener('click', e => { if (e.target === modal) hideBookingModal(); });

  const bookingForm = document.getElementById('booking-form');
  if (bookingForm) {
    bookingForm.addEventListener('submit', async e => {
      e.preventDefault();

      const name = document.getElementById('name').value;
      const phone = document.getElementById('phone').value;
      const message = document.getElementById('message').value;

      if (!currentPropertyId) {
        alert('Property ID missing. Please try again.');
        return;
      }

      try {
        // Check if Supabase is available
        const sb = getSupabase();

        // Get current user if logged in
        const userStr = sessionStorage.getItem('user');
        let userId = null;
        if (userStr) {
          const user = JSON.parse(userStr);
          userId = user.id;
        }

        const { error } = await sb
          .from('bookings')
          .insert([
            {
              property_id: currentPropertyId,
              renter_name: name,
              renter_phone: phone,
              message: message || null,
              user_id: userId,
              status: 'pending',
              created_at: new Date().toISOString()
            }
          ]);

        if (error) throw error;

        alert('Your booking has been submitted! The owner will contact you soon.');
        bookingForm.reset();
        hideBookingModal();
        window.location.href = "renter-dashboard.html";

      } catch (error) {
        console.error('Booking error:', error);
        alert('Failed to submit booking. Please try again.');
      }
    });
  }
}

// Owner dashboard functionality is now in owner-dashboard.html
// When returning from login, auto-open booking modal
window.addEventListener('DOMContentLoaded', () => {
  const params = new URLSearchParams(window.location.search);
  const propertyId = params.get('property');

  if (propertyId) {
    openBookingModal(propertyId);
  }
});
// -------------------------------
// Navbar Login/Logout Toggle
// -------------------------------

function setupUserMenuDropdown() {
  const btn = document.getElementById('userMenuBtn');
  const dropdown = document.getElementById('userDropdown');
  if (!btn || !dropdown) return;

  btn.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();

    const isOpen = dropdown.style.display === 'block';
    dropdown.style.display = isOpen ? 'none' : 'block';
    btn.setAttribute('aria-expanded', String(!isOpen));
  });

  // close on outside click
  document.addEventListener('click', () => {
    dropdown.style.display = 'none';
    btn.setAttribute('aria-expanded', 'false');
  });

  dropdown.addEventListener('click', (e) => e.stopPropagation());
}

async function updateOwnerNotifBadge(user) {
  const notifBadge = document.getElementById('notifBadge');
  const notifBell = document.getElementById('notifBell');

  if (!notifBell || !notifBadge) return;

  if (!user || user.role !== 'owner') {
    notifBell.style.display = 'none';
    notifBadge.style.display = 'none';
    return;
  }

  notifBell.style.display = 'inline-flex';

  // Count pending bookings for this owner
  try {
    const sb = getSupabase();

    const { count, error } = await sb
      .from('bookings')
      .select('id, properties!inner(owner_id)', { count: 'exact', head: true })
      .eq('properties.owner_id', user.id)
      .eq('status', 'pending');

    if (error) {
      console.error('Error fetching booking count:', error);
      notifBadge.style.display = 'none';
      return;
    }

    if (count && count > 0) {
      notifBadge.textContent = String(count);
      notifBadge.style.display = 'inline-block';
    } else {
      notifBadge.style.display = 'none';
    }
  } catch (err) {
    console.error('Error updating notifications:', err);
  }
}

async function updateNavbarAuthUI() {
  const userStr = sessionStorage.getItem('user');

  const authSection = document.getElementById('auth-section');
  const userSection = document.getElementById('user-section');

  const navUserName = document.getElementById('navUserName');
  const dashboardLink = document.getElementById('dashboardLink');
  const signOutLink = document.getElementById('signOutLink');

  const notifBell = document.getElementById('notifBell');

  // Guest
  if (!userStr) {
    if (authSection) authSection.style.display = 'block';
    if (userSection) userSection.style.display = 'none';
    return;
  }

  // Logged in
  if (authSection) authSection.style.display = 'none';
  if (userSection) userSection.style.display = 'flex';

  let user = {};
  try {
    user = JSON.parse(userStr) || {};
  } catch {
    user = {};
  }

  // Resolve user's display name from DB if not present in sessionStorage
  let displayName = user.name;

  try {
    const sb = getSupabase();
    if (!displayName && sb && user.id) {
      const { data, error } = await sb
        .from('users')
        .select('name, role')
        .eq('id', user.id)
        .maybeSingle();

      if (!error && data) {
        displayName = data.name;
        if (!user.role && data.role) user.role = data.role;

        // store back for faster next loads
        sessionStorage.setItem('user', JSON.stringify({
          ...user,
          name: displayName
        }));
      }
    }
  } catch (err) {
    console.error('Error resolving user name:', err);
  }

  if (navUserName) {
    navUserName.textContent = displayName || user.email || 'Account';
  }

  // Dropdown actions
  if (dashboardLink) {
    dashboardLink.onclick = (e) => {
      e.preventDefault();
      if (user.role === 'renter') {
        window.location.href = 'renter-dashboard.html';
      } else {
        window.location.href = 'owner-dashboard.html';
      }
    };
  }

  if (signOutLink) {
    signOutLink.onclick = (e) => {
      e.preventDefault();
      sessionStorage.clear();
      window.location.href = 'index.html';
    };
  }

  // Bell click (go to booking requests section)
  if (notifBell) {
    notifBell.onclick = (e) => {
      e.preventDefault();
      if (user.role === 'owner') {
        window.location.href = 'owner-dashboard.html#bookingRequests';
      }
    };
  }

  // Update notification badge
  await updateOwnerNotifBadge(user);
}

// Init
window.addEventListener('DOMContentLoaded', () => {
  setupUserMenuDropdown();
  updateNavbarAuthUI();

  // keep badge fresh (light polling)
  setInterval(() => {
    const userStr = sessionStorage.getItem('user');
    if (!userStr) return;
    try {
      const user = JSON.parse(userStr);
      updateOwnerNotifBadge(user);
    } catch { }
  }, 15000);
});

// ------------------------------------------
// Property Details Modal & Gallery Logic
// ------------------------------------------

// Close modal logic
const propertyModal = document.getElementById('property-modal');
const closePropertyBtn = document.querySelector('.close-property-btn');

if (closePropertyBtn && propertyModal) {
  closePropertyBtn.onclick = () => {
    propertyModal.style.display = "none";
  };
  window.addEventListener('click', (e) => {
    if (e.target === propertyModal) {
      propertyModal.style.display = "none";
    }
  });
}

function changeMainImage(url) {
  const mainImg = document.getElementById('detail-main-image');
  if (mainImg) mainImg.src = url;
}

window.openPropertyModal = async function (propertyId) {
  const modal = document.getElementById('property-modal');
  if (!modal) return;

  // 1. Fetch Property Details (Single)
  try {
    const sb = getSupabase();
    const { data: property, error } = await sb
      .from('properties')
      .select('*')
      .eq('id', propertyId)
      .single();

    if (error || !property) throw error;

    // Fill Info
    document.getElementById('detail-title').textContent = property.name;
    document.getElementById('detail-location').innerHTML = `<i class="fa-solid fa-location-dot"></i> ${property.location}`;
    document.getElementById('detail-price').textContent = `${property.rent.toLocaleString()} BDT`;
    document.getElementById('detail-description').textContent = property.details || "No description available.";

    // Fill Attributes
    const attrs = [];
    if (property.bed) attrs.push(`🛏️ ${property.bed} Bed`);
    if (property.bath) attrs.push(`🚿 ${property.bath} Bath`);
    if (property.corridor) attrs.push(`🚪 ${property.corridor} Corridor`);
    if (property.gender) attrs.push(`👥 ${property.gender}`);
    if (property.room) attrs.push(`🏢 ${property.room} Room`);
    if (property.type) attrs.push(`🏠 ${property.type.charAt(0).toUpperCase() + property.type.slice(1)}`);

    document.getElementById('detail-attributes').innerHTML = attrs.map(a =>
      `<span style="background:#f0f2f5; padding:5px 10px; border-radius:20px; font-size:0.9rem;">${a}</span>`
    ).join('');

    // Setup Book Button
    const bookBtn = document.getElementById('detail-book-btn');

    // Antigravity Edit: Hide book button for owners
    const userStr = sessionStorage.getItem('user');
    let isOwner = false;
    if (userStr) {
      try {
        const u = JSON.parse(userStr);
        if (u.role === 'owner') isOwner = true;
      } catch (e) { }
    }

    if (isOwner) {
      bookBtn.style.display = 'none';
    } else {
      bookBtn.style.display = 'inline-block'; // or whatever the default was, usually inline-block or block. check css if needed, but safe to assume visible
      bookBtn.onclick = () => {
        // Close detail modal, open booking modal
        modal.style.display = "none";
        openBookingModal(property.id);
      };
    }

    // 2. Setup Gallery
    const mainImg = document.getElementById('detail-main-image');
    const thumbnailsContainer = document.getElementById('detail-thumbnails');

    // Default image
    const defaultUrl = property.image_url || 'Image/1st_pic.jpg';
    mainImg.src = defaultUrl;
    thumbnailsContainer.innerHTML = ''; // Clear previous

    // Fetch all images for this property
    const { data: images } = await sb
      .from('property_images')
      .select('image_url')
      .eq('property_id', propertyId)
      .order('is_main', { ascending: false }); // main first

    // Combine distinct images (default + fetched)
    const allUrls = [];
    // Always add the default one first if logic dictates, or rely on fetched
    if ((!images || images.length === 0) && property.image_url) {
      allUrls.push(property.image_url);
    } else if (images && images.length > 0) {
      images.forEach(img => allUrls.push(img.image_url));
    }

    // Add legacy image if not in list yet (rare case)
    if (property.image_url && !allUrls.includes(property.image_url)) {
      allUrls.unshift(property.image_url);
    }

    // Render Thumbnails
    allUrls.forEach((url, index) => {
      const thumb = document.createElement('img');
      thumb.src = url;
      thumb.style.cssText = "width:80px; height:60px; object-fit:cover; border-radius:6px; cursor:pointer; opacity:0.8; transition:0.2s; border:2px solid transparent;";
      thumb.onmouseover = () => { thumb.style.opacity = "1"; };
      thumb.onmouseout = () => { thumb.style.opacity = "0.8"; };
      thumb.onclick = () => {
        changeMainImage(url);
        // highlight active thumb logic could go here
      };

      // Auto-set first image
      if (index === 0) mainImg.src = url;

      thumbnailsContainer.appendChild(thumb);
    });

    // 3. Load Reviews
    document.getElementById('detail-reviews-list').textContent = "Loading reviews...";
    await loadReviewsIntoDetailModal(propertyId);

    // Show Modal
    modal.style.display = "block";

  } catch (err) {
    console.error('Error opening property details:', err);
    alert('Failed to load property details.');
  }
};

async function loadReviewsIntoDetailModal(propertyId) {
  try {
    const list = document.getElementById('detail-reviews-list');
    const { data: reviews, error } = await supabase
      .from('reviews')
      .select('rating, comment, created_at, users(name)')
      .eq('property_id', propertyId)
      .order('created_at', { ascending: false });

    if (error || !reviews || reviews.length === 0) {
      list.textContent = "No reviews yet.";
      return;
    }

    list.innerHTML = reviews.map(r => {
      const stars = '⭐'.repeat(r.rating);
      return `
            <div style="margin-bottom:15px; padding-bottom:15px; border-bottom:1px solid #f0f0f0;">
                <div style="display:flex; justify-content:space-between; font-size:0.9rem;">
                    <strong>${r.users?.name || 'User'}</strong>
                    <span style="color:#888;">${new Date(r.created_at).toLocaleDateString()}</span>
                </div>
                <div style="color:#f39c12; font-size:0.85rem; margin:4px 0;">${stars}</div>
                <p style="font-size:0.95rem; color:#444; margin:0;">${(r.comment || '').replace(/</g, '&lt;')}</p>
            </div>`;
    }).join('');
  } catch (e) {
    console.error(e);
    document.getElementById('detail-reviews-list').textContent = "Could not load reviews.";
  }
}

// ------------------------------------------
// Image Lightbox Logic
// ------------------------------------------
const lightboxModal = document.getElementById('lightbox-modal');
const lightboxImg = document.getElementById('lightbox-img');
const closeLightbox = document.querySelector('.close-lightbox');

if (lightboxModal && lightboxImg) {
  // Open lightbox on main image click
  document.getElementById('detail-main-image').onclick = function () {
    lightboxModal.style.display = "block";
    lightboxImg.src = this.src;
  }

  // Close when clicking X
  if (closeLightbox) {
    closeLightbox.onclick = function () {
      lightboxModal.style.display = "none";
    }
  }

  // Close when clicking outside image
  lightboxModal.onclick = function (e) {
    if (e.target === lightboxModal) {
      lightboxModal.style.display = "none";
    }
  }
}
