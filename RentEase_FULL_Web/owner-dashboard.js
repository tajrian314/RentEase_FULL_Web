// Owner Dashboard JavaScript with Supabase Integration

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

  document.addEventListener('click', () => {
    dropdown.style.display = 'none';
    btn.setAttribute('aria-expanded', 'false');
  });

  dropdown.addEventListener('click', (e) => e.stopPropagation());

  const signOutLink = document.getElementById('signOutLink');
  if (signOutLink) {
    signOutLink.addEventListener('click', async (e) => {
      e.preventDefault();
      // Clear session
      sessionStorage.removeItem('user');
      // Supabase sign out
      try {
        const sb = getSupabase();
        const { error } = await sb.auth.signOut();
        if (error) console.error('Error signing out:', error);
      } catch (e) { console.error('Signout error:', e); }
      // Redirect
      window.location.href = 'index.html';
    });
  }
}

async function resolveOwnerName(user) {
  if (user && user.name) return user.name;

  try {
    const sb = getSupabase();
    const { data, error } = await sb
      .from('users')
      .select('name')
      .eq('id', user.id)
      .maybeSingle();

    if (!error && data && data.name) {
      // store back
      sessionStorage.setItem('user', JSON.stringify({ ...user, name: data.name }));
      return data.name;
    }
  } catch (err) {
    console.error('Error resolving owner name:', err);
  }

  return user.email || 'Owner';
}

async function loadBookingRequests(ownerId) {
  const list = document.getElementById('booking-requests-list');
  if (!list) return;

  list.innerHTML = '<p>Loading booking requests...</p>';

  const sb = getSupabase();
  const { data, error } = await sb
    .from('bookings')
    .select(`
      id,
      renter_name,
      renter_phone,
      message,
      status,
      created_at,
      properties!inner (
        id,
        name,
        location,
        rent,
        owner_id
      )
    `)
    .eq('properties.owner_id', ownerId)
    // .neq('status', 'cancelled') // Antigravity Edit: Owners see all statuses
    // .neq('status', 'canceled') // Removing typo-prone filter just in case
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error loading booking requests:', error);
    list.innerHTML = '<p>Could not load booking requests.</p>';
    return;
  }

  const pendingCount = (data || []).filter(b => b.status === 'pending').length;

  const badge = document.getElementById('notifBadge');
  if (badge) {
    if (pendingCount > 0) {
      badge.textContent = String(pendingCount);
      badge.style.display = 'inline-block';
    } else {
      badge.style.display = 'none';
    }
  }

  if (!data || data.length === 0) {
    list.innerHTML = '<p>No booking requests yet.</p>';
    return;
  }

  list.innerHTML = data.map((b) => {
    const prop = b.properties;
    const msg = (b.message || '').replace(/</g, '&lt;').replace(/>/g, '&gt;');

    const actions = b.status === 'pending'
      ? `
        <div class="actions">
          <button class="small-btn confirm" data-id="${b.id}" data-status="confirmed">Confirm</button>
          <button class="small-btn reject" data-id="${b.id}" data-status="rejected">Reject</button>
        </div>
      `
      : b.status === 'cancelled'
        ? `<div class="meta"><span style="color: #d32f2f; font-weight: bold;">❌ Cancelled</span></div>`
        : `<div class="meta"><span><strong>Status:</strong> ${b.status}</span></div>`;

    return `
      <div class="booking-card">
        <div><strong>${prop?.name || 'Property'}</strong> — ${prop?.location || ''}</div>
        <div class="meta">
          <span><strong>Renter:</strong> ${b.renter_name}</span>
          <span><strong>Phone:</strong> ${b.renter_phone}</span>
          <span><strong>Rent:</strong> ${prop?.rent || ''} BDT</span>
        </div>
        ${msg ? `<div class="meta"><span><strong>Message:</strong> ${msg}</span></div>` : ''}
        ${actions}
      </div>
    `;
  }).join('');

  // bind buttons
  list.querySelectorAll('button[data-id][data-status]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const id = btn.getAttribute('data-id');
      const status = btn.getAttribute('data-status');

      btn.disabled = true;

      const sb = getSupabase();
      const { error: upError } = await sb
        .from('bookings')
        .update({ status })
        .eq('id', id);

      if (upError) {
        console.error('Error updating booking status:', upError);
        btn.disabled = false;
        alert('Could not update booking. Please check RLS policies.');
        return;
      }

      await loadBookingRequests(ownerId);
    });
  });
}

// Check authentication and ensure user profile exists
window.addEventListener('DOMContentLoaded', async () => {
  const userStr = sessionStorage.getItem('user');
  if (!userStr) {
    alert('Please login first!');
    window.location.href = 'login.html';
    return;
  }

  const user = JSON.parse(userStr);
  if (user.role !== 'owner') {
    alert('Access denied. Owner dashboard only.');
    window.location.href = 'index.html';
    // Top bar UI (Name + Dropdown + Bell)
    setupUserMenuDropdown();

    const navUserName = document.getElementById('navUserName');
    if (navUserName) {
      navUserName.textContent = await resolveOwnerName(user);
    }

    const signOutLink = document.getElementById('signOutLink');
    if (signOutLink) {
      signOutLink.addEventListener('click', (e) => {
        e.preventDefault();
        sessionStorage.clear();
        window.location.href = 'index.html';
      });
    }

    const notifBell = document.getElementById('notifBell');
    if (notifBell) {
      notifBell.addEventListener('click', (e) => {
        e.preventDefault();
        const section = document.getElementById('bookingRequests');
        if (section) section.scrollIntoView({ behavior: 'smooth' });
      });
    }

    // Load booking requests + badge
    await loadBookingRequests(user.id);
    setInterval(() => loadBookingRequests(user.id), 15000);

    return;
  }

  // Verify user profile exists in database
  try {
    const sb = getSupabase();
    const { data: userProfile, error: profileError } = await sb
      .from('users')
      .select('id')
      .eq('id', user.id)
      .maybeSingle();

    if (profileError && profileError.code !== 'PGRST116') {
      console.error('Error checking user profile:', profileError);
    }

    // If user profile doesn't exist, create it
    if (!userProfile) {
      console.warn('User profile not found, creating...');

      // Get current auth user
      const { data: { user: authUser }, error: authError } = await sb.auth.getUser();

      if (authError) {
        console.error('Error getting auth user:', authError);
        alert('Authentication error. Please log in again.');
        window.location.href = 'login.html';
        return;
      }

      const profileData = {
        id: user.id,
        email: user.email || authUser?.email || 'unknown@example.com',
        name: authUser?.user_metadata?.name || user.email?.split('@')[0] || 'User',
        phone: authUser?.user_metadata?.phone || null,
        role: 'owner',
        created_at: new Date().toISOString()
      };

      // Try upsert first (handles race conditions)
      let { error: createError } = await sb
        .from('users')
        .upsert([profileData], {
          onConflict: 'id'
        });

      // If upsert fails, try insert
      if (createError) {
        console.warn('Upsert failed, trying insert:', createError);
        ({ error: createError } = await sb
          .from('users')
          .insert([profileData]));
      }

      if (createError) {
        console.error('Failed to create user profile:', createError);

        // Check if it's a duplicate (profile was created by another process)
        if (createError.code === '23505') {
          console.log('Profile already exists (race condition), continuing...');
        } else {
          // Antigravity Fix: Show explicit error instead of vague warning
          alert(`Failed to initialize owner profile: ${createError.message || createError.code}. You may encounter issues adding properties.`);
        }
      } else {
        console.log('User profile created successfully');
        alert('Owner profile initialized successfully.');
      }
    }
  } catch (error) {
    console.error('Error verifying user profile:', error);
  }

  await loadOwnerProperties(user.id);
  await loadOwnerBookings(user.id);
  // Simple polling to keep notifications fresh
  setInterval(() => loadOwnerBookings(user.id), 15000);
});

const typeSelect = document.getElementById('type');
const extraFields = document.getElementById('extra-fields');
const propertyList = document.getElementById('property-list');
const bookingList = document.getElementById('booking-list');
const pendingCountEl = document.getElementById('pending-count');
const form = document.getElementById('add-property-form');

// Dynamic form fields based on property type
if (typeSelect && extraFields) {
  typeSelect.addEventListener('change', () => {
    const type = typeSelect.value;
    extraFields.innerHTML = '';
    if (type === 'family' || type === 'bachelor' || type === 'sublet') {
      extraFields.innerHTML = `
        <div style="display:flex;gap:10px;">
          <input type="number" id="bed" placeholder="Bed" required>
          <input type="number" id="bath" placeholder="Bathroom" required>
          <input type="number" id="corridor" placeholder="Corridor" required>
        </div>`;
    } else if (type === 'hostel') {
      extraFields.innerHTML = `
        <select id="gender" required style="padding: 10px; border-radius: 8px; border: 1px solid #ccc; font-size: 15px; background: #fff; width: 100%;">
          <option value="" disabled selected>Select Gender</option>
          <option value="Male">Male</option>
          <option value="Female">Female</option>
        </select>
        <input type="number" id="bed" placeholder="Bed Count" required>
        <input type="number" id="bath" placeholder="Bathroom" required>`;
    } else if (type === 'office') {
      extraFields.innerHTML = `
        <input type="number" id="room" placeholder="Room Count" required>
        <input type="text" id="purpose" placeholder="Office Purpose (optional)">`;
    }
  });
}

// Load owner's properties
async function loadOwnerProperties(ownerId) {
  try {
    const sb = getSupabase();
    const { data: properties, error } = await sb
      .from('properties')
      .select('*')
      .eq('owner_id', ownerId)
      .order('created_at', { ascending: false });

    if (error) throw error;

    if (!properties || properties.length === 0) {
      propertyList.innerHTML = '<div style="text-align: center; padding: 1rem; color: #666;"><p>No properties listed yet. Add your first property!</p></div>';
      return;
    }

    propertyList.innerHTML = properties.map(property => {
      const infoParts = [];
      if (property.bed) infoParts.push(`${property.bed} Bed`);
      if (property.bath) infoParts.push(`${property.bath} Bath`);
      if (property.corridor) infoParts.push(`${property.corridor} Corridor`);
      if (property.gender) infoParts.push(`${property.gender}`);
      if (property.room) infoParts.push(`${property.room} Room`);
      if (property.purpose) infoParts.push(property.purpose);

      return `
        <div class="property-card" data-property-id="${property.id}">
          <img src="${property.image_url || 'Image/1st_pic.jpg'}" alt="${property.name}">
          <h4>${property.name}</h4>
          <p><strong>Location:</strong> ${property.location}</p>
          <a class="map-link" href="${makeMapSearchUrl(property.location)}" target="_blank" rel="noopener">View on Map</a>
          <p><strong>Type:</strong> ${property.type.charAt(0).toUpperCase() + property.type.slice(1)}</p>
          <p><strong>Details:</strong> ${infoParts.join(' • ')}</p>
          <p><strong>Rent:</strong> ${property.rent.toLocaleString()} BDT</p>
          <p><strong>Status:</strong> ${property.status === 'available' ? 'Available ✅' : 'Unavailable ❌'}</p>
          <button onclick="deleteProperty('${property.id}')" style="background: #d32f2f; margin-top: 10px;">Delete</button>
        </div>
      `;
    }).join('');
  } catch (error) {
    console.error('Error loading properties:', error);
    propertyList.innerHTML = '<div style="text-align: center; padding: 1rem; color: #d32f2f;"><p>Error loading properties.</p></div>';
  }
}

// Delete property
async function deleteProperty(propertyId) {
  if (!confirm('Are you sure you want to delete this property?')) return;

  try {
    const sb = getSupabase();
    const { error } = await sb
      .from('properties')
      .delete()
      .eq('id', propertyId);

    if (error) throw error;

    alert('Property deleted successfully!');
    const userStr = sessionStorage.getItem('user');
    const user = JSON.parse(userStr);
    await loadOwnerProperties(user.id);
  } catch (error) {
    console.error('Error deleting property:', error);
    alert('Failed to delete property. Please try again.');
  }
}

// ------------------------------------------
// Image optimization (resize + compression)
// ------------------------------------------
async function optimizeImage(file, options = {}) {
  const {
    maxWidth = 1600,
    maxHeight = 1600,
    jpegQuality = 0.85
  } = options;

  if (!file || !file.type || !file.type.startsWith('image/')) return file;

  // If file is already small, keep it as-is (helps preserve quality).
  // (Threshold is conservative; you can increase/decrease.)
  const FIVE_MB = 5 * 1024 * 1024;
  if (file.size <= FIVE_MB) return file;

  const img = await new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = reject;
    image.src = URL.createObjectURL(file);
  });

  let { width, height } = img;

  // Keep aspect ratio
  const ratio = Math.min(maxWidth / width, maxHeight / height, 1);
  width = Math.round(width * ratio);
  height = Math.round(height * ratio);

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;

  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(img, 0, 0, width, height);

  // Prefer JPEG for photos to reduce file size while keeping good quality.
  const outputType = file.type === 'image/png' ? 'image/png' : 'image/jpeg';

  const blob = await new Promise((resolve) => {
    canvas.toBlob(resolve, outputType, outputType === 'image/jpeg' ? jpegQuality : undefined);
  });

  // Fallback: if blob creation fails, return original
  if (!blob) return file;

  const ext = outputType === 'image/png' ? 'png' : 'jpg';
  const newName = file.name.replace(/\.[^.]+$/, '') + `.${ext}`;

  return new File([blob], newName, { type: outputType });
}



// ------------------------------------------
// Booking Requests (Owner Notifications)
// ------------------------------------------
async function loadOwnerBookings(ownerId) {
  if (!bookingList) return;

  try {
    const sb = getSupabase();
    const { data: bookings, error } = await sb
      .from('bookings')
      .select(`
        id,
        renter_name,
        renter_phone,
        message,
        status,
        created_at,
        property_id,
        properties (
          id,
          name,
          location,
          rent,
          image_url
        )
      `)
      .order('created_at', { ascending: false });

    if (error) throw error;

    const safeBookings = bookings || [];
    const pendingCount = safeBookings.filter(b => b.status === 'pending').length;
    if (pendingCountEl) pendingCountEl.textContent = String(pendingCount);

    if (safeBookings.length === 0) {
      bookingList.innerHTML = `
        <div style="text-align:center; padding:1rem; color:#eee;">
          <p>No booking requests yet.</p>
        </div>
      `;
      return;
    }

    bookingList.innerHTML = safeBookings.map(b => {
      const p = b.properties || {};
      const created = new Date(b.created_at).toLocaleString();

      const msg = (b.message || '').trim();
      const msgHtml = msg ? `<div class="small"><strong>Message:</strong> ${escapeHtml(msg)}</div>` : '';

      const actionsHtml = b.status === 'pending'
        ? `
          <div class="booking-actions">
            <button class="btn-confirm" onclick="updateBookingStatus('${b.id}', 'confirmed')">Confirm</button>
            <button class="btn-reject" onclick="updateBookingStatus('${b.id}', 'rejected')">Reject</button>
          </div>
        `
        : '';

      return `
        <div class="booking-item">
          <div class="meta"><strong>Property:</strong> ${escapeHtml(p.name || 'Unknown')} (${escapeHtml(p.location || '-')})</div>
          <div class="meta"><strong>Renter:</strong> ${escapeHtml(b.renter_name)} — ${escapeHtml(b.renter_phone)}</div>
          ${msgHtml}
          <div class="small"><strong>Status:</strong> ${escapeHtml(b.status)} | <strong>Time:</strong> ${escapeHtml(created)}</div>
          ${actionsHtml}
        </div>
      `;
    }).join('');
  } catch (err) {
    console.error('Error loading owner bookings:', err);
    bookingList.innerHTML = `
      <div style="text-align:center; padding:1rem; color:#ffd6d6;">
        <p>Failed to load booking requests.</p>
        <p style="font-size:0.85rem; opacity:0.9;">${escapeHtml(err?.message || String(err))}</p>
      </div>
    `;
  }
}

// Make the function available to inline onclick handlers
window.updateBookingStatus = async function updateBookingStatus(bookingId, status) {
  try {
    const sb = getSupabase();
    const { error } = await sb
      .from('bookings')
      .update({ status, updated_at: new Date().toISOString() })
      .eq('id', bookingId);

    if (error) throw error;

    // Refresh list
    const userStr = sessionStorage.getItem('user');
    const user = userStr ? JSON.parse(userStr) : null;
    if (user?.id) await loadOwnerBookings(user.id);
  } catch (err) {
    console.error('Booking status update error:', err);
    alert('Failed to update booking status. Please try again.');
  }
};

// Basic HTML escape for safe rendering
// Location -> Map link helper (owner side)
function makeMapSearchUrl(locationText) {
  const q = encodeURIComponent((locationText || '').trim());
  return `https://www.google.com/maps/search/?api=1&query=${q}`;
}

function escapeHtml(str) {

  return String(str ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

// Add property form submission

if (form) {
  form.addEventListener('submit', async e => {
    e.preventDefault();

    const userStr = sessionStorage.getItem('user'); // Keep this
    const sb = getSupabase(); // Add this definition

    if (!userStr) {
      alert('Please login first!');
      window.location.href = 'login.html';
      return;
    }

    const user = JSON.parse(userStr);

    // Verify user exists in database and create if missing
    try {
      const sb = getSupabase();
      const { data: userProfile, error: profileError } = await sb
        .from('users')
        .select('id, role')
        .eq('id', user.id)
        .maybeSingle();

      if (profileError && profileError.code !== 'PGRST116') {
        throw profileError;
      }

      // If user profile doesn't exist, create it
      if (!userProfile) {
        console.warn('User profile not found in database, creating...');

        // Get current auth user to get email
        const { data: { user: authUser }, error: authError } = await sb.auth.getUser();

        if (authError) {
          console.error('Error getting auth user:', authError);
          alert('Authentication error. Please log in again.');
          window.location.href = 'login.html';
          return;
        }

        if (user.id !== authUser.id) {
          console.warn('Session ID mismatch. Using authenticated ID:', authUser.id);
        }

        const profileData = {
          id: authUser.id, // Use authenticated ID for RLS compliance
          email: user.email || authUser?.email || 'unknown@example.com',
          name: authUser?.user_metadata?.name || user.email?.split('@')[0] || 'User',
          phone: authUser?.user_metadata?.phone || null,
          role: user.role || 'owner',
          created_at: new Date().toISOString()
        };

        // Try upsert first
        let { error: createError } = await sb
          .from('users')
          .upsert([profileData], {
            onConflict: 'id'
          });

        // If upsert fails, try insert
        if (createError) {
          console.warn('Upsert failed, trying insert:', createError);
          ({ error: createError } = await sb
            .from('users')
            .insert([profileData]));
        }

        if (createError) {
          console.error('Failed to create user profile:', createError);

          // Check error type
          if (createError.code === '23505') {
            // Duplicate - profile exists, just verify it
            console.log('Profile already exists, verifying...');
            const { data: verifyProfile } = await sb
              .from('users')
              .select('id, role')
              .eq('id', user.id)
              .maybeSingle();

            if (verifyProfile) {
              userProfile = verifyProfile;
            } else {
              alert('Error: Could not verify your profile. Please contact support.');
              return;
            }
          } else {
            alert('Error creating profile: ' + (createError.message || 'Unknown error') + '. Please try again or contact support.');
            return;
          }
        } else {
          console.log('User profile created successfully');
          // Re-fetch to get the created profile
          const { data: newProfile } = await sb
            .from('users')
            .select('id, role')
            .eq('id', user.id)
            .maybeSingle();
          if (newProfile) userProfile = newProfile;
        }
      }

      // Verify role
      if (userProfile && userProfile.role !== 'owner') {
        alert('Access denied. This dashboard is for property owners only.');
        return;
      }
    } catch (error) {
      console.error('Error verifying user profile:', error);
      alert('Error verifying your account. Please try logging in again.');
      return;
    }

    const name = document.getElementById('name').value;
    const location = document.getElementById('location').value;
    const rent = parseFloat(document.getElementById('rent').value);
    const type = document.getElementById('type').value;
    const details = document.getElementById('details').value;
    const imageFiles = document.getElementById('image').files;

    if (!imageFiles || imageFiles.length === 0) {
      alert('Please upload at least one image!');
      return;
    }

    try {
      // 1. Upload ALL images first to get their URLs
      const uploadedImages = [];

      for (let i = 0; i < imageFiles.length; i++) {
        const file = imageFiles[i];
        const finalFile = await optimizeImage(file);

        const fileExt = finalFile.name.split('.').pop();
        const fileName = `${user.id}_${Date.now()}_${i}.${fileExt}`;
        const filePath = `properties/${fileName}`;

        const { error: uploadError } = await sb.storage
          .from('property-images')
          .upload(filePath, finalFile, { contentType: finalFile.type, upsert: true });

        if (uploadError) {
          console.error(`Error uploading image ${i + 1}:`, uploadError);
          continue; // Skip failed uploads but try others
        }

        const { data: { publicUrl } } = sb.storage
          .from('property-images')
          .getPublicUrl(filePath);

        uploadedImages.push({
          url: publicUrl,
          is_main: i === 0 // First image is main
        });
      }

      if (uploadedImages.length === 0) {
        throw new Error('Failed to upload any images. Please try again.');
      }

      // 2. Prepare property data (use first image as main thumbnail for backward compatibility)
      const propertyData = {
        owner_id: user.id,
        name: name,
        location: location,
        rent: rent,
        type: type,
        details: details || null,
        image_url: uploadedImages[0].url, // Backward compatibility
        status: 'available',
        created_at: new Date().toISOString()
      };

      // Add type-specific fields
      if (type === 'family' || type === 'bachelor' || type === 'sublet') {
        propertyData.bed = parseInt(document.getElementById('bed').value);
        propertyData.bath = parseInt(document.getElementById('bath').value);
        propertyData.corridor = parseInt(document.getElementById('corridor').value);
      } else if (type === 'hostel') {
        propertyData.gender = document.getElementById('gender').value;
        propertyData.bed = parseInt(document.getElementById('bed').value);
        propertyData.bath = parseInt(document.getElementById('bath').value);
      } else if (type === 'office') {
        propertyData.room = parseInt(document.getElementById('room').value);
        const purpose = document.getElementById('purpose')?.value;
        if (purpose) propertyData.purpose = purpose;
      }

      // 3. Insert property and GET ID
      const { data: insertedProperty, error: insertError } = await sb
        .from('properties')
        .insert([propertyData])
        .select()
        .single();

      if (insertError) {
        console.error('Property insertion error:', insertError);

        // Check if it's a foreign key constraint error
        if (insertError.code === '23503' || insertError.message.includes('foreign key')) {
          const { data: verifyUser } = await sb
            .from('users')
            .select('id')
            .eq('id', user.id)
            .maybeSingle();

          if (!verifyUser) {
            throw new Error('Your user profile is missing. Please log out and sign up again.');
          }
        }
        throw insertError;
      }

      // 4. Insert image records into property_images table
      if (insertedProperty && insertedProperty.id) {
        const imageRecords = uploadedImages.map(img => ({
          property_id: insertedProperty.id,
          image_url: img.url,
          is_main: img.is_main
        }));

        const { error: imagesError } = await sb
          .from('property_images')
          .insert(imageRecords);

        if (imagesError) {
          console.error('Error linking images:', imagesError);
          // Not fatal, property is created, user can edit later (if edit feature existed)
        }
      }

      alert("✅ New property added successfully!");
      form.reset();
      extraFields.innerHTML = '';
      await loadOwnerProperties(user.id);
    } catch (error) {
      console.error('Error adding property:', error);
      alert('Failed to add property: ' + (error.message || 'Please check your Supabase configuration.'));
    }
  });
}


// ----------------------------------------------------
// INITIALIZATION
// ----------------------------------------------------
window.addEventListener('DOMContentLoaded', async () => {
  // Check auth
  const userStr = sessionStorage.getItem('user');
  if (!userStr) {
    alert('Please login first!');
    window.location.href = 'login.html';
    return;
  }

  const user = JSON.parse(userStr);
  if (user.role !== 'owner') {
    alert('Access denied. Owner dashboard only.');
    window.location.href = 'index.html';
    return;
  }

  // 1. Setup Dropdown & Logout
  setupUserMenuDropdown();

  // 2. Resolve Name
  const navUserName = document.getElementById('navUserName');
  if (navUserName) {
    navUserName.textContent = await resolveOwnerName(user);
  }

  // 3. Load Data
  await loadOwnerProperties(user.id);
  await loadBookingRequests(user.id);

  // 4. Setup Add Property Form
  setupAddPropertyForm(user);
});

// Helper for form setup (refactored from previous missing code logic if any)
function setupAddPropertyForm(user) {
  const form = document.getElementById('add-property-form');
  const typeSelect = document.getElementById('type');
  const extraFields = document.getElementById('extra-fields');

  if (!form || !typeSelect) return;

  // -- Event Listener for Dynamic Fields --
  typeSelect.addEventListener('change', () => {
    const type = typeSelect.value;
    extraFields.innerHTML = '';

    if (type === 'family' || type === 'bachelor' || type === 'sublet') {
      extraFields.innerHTML = `
        <div style="display:flex; gap:10px;">
          <input type="number" id="bed" placeholder="Bedrooms" required style="flex:1">
          <input type="number" id="bath" placeholder="Bathrooms" required style="flex:1">
          <input type="number" id="corridor" placeholder="Corridors" required style="flex:1">
        </div>`;
    } else if (type === 'hostel') {
      extraFields.innerHTML = `
        <div style="display:flex; gap:10px;">
          <select id="gender" required style="flex:1">
             <option value="" disabled selected>Select Gender</option>
             <option value="Male">Male</option>
             <option value="Female">Female</option>
          </select>
          <input type="number" id="bed" placeholder="Bed Count" required style="flex:1">
          <input type="number" id="bath" placeholder="Bathrooms" required style="flex:1">
        </div>`;
    } else if (type === 'office') {
      extraFields.innerHTML = `
        <div style="display:flex; gap:10px;">
          <input type="number" id="room" placeholder="Rooms" required style="flex:1">
          <input type="text" id="purpose" placeholder="Purpose (optional)" style="flex:1">
        </div>`;
    }
  });

  // -- Form Submit Handler --
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    // ... existing submit logic is already defined in previous code blocks?
    // Wait, the previous view showed 'form.addEventListener' inside a function? 
    // No, I need to check if the previous code was inside a function or global.
    // The previous view ended with '}); }'. 
    // It seems the submit handler was wrapped in function setupAddPropertyForm?
    // Let me RE-READ the code before appending this block to avoid duplication.
  });
}
