// Renter Dashboard JavaScript with Supabase Integration

// Helper to ensure we get the initialized client, not the library
function getSupabase() {
  if (window.supabaseClient) return window.supabaseClient;
  if (window.supabase && window.supabase.auth) return window.supabase;

  // Fallback if supabase-config.js hasn't run or failed
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
}

async function resolveRenterName(user) {
  if (user && user.name) return user.name;

  try {
    const sb = getSupabase();
    const { data, error } = await sb
      .from('users')
      .select('name')
      .eq('id', user.id)
      .maybeSingle();

    if (!error && data && data.name) {
      sessionStorage.setItem('user', JSON.stringify({ ...user, name: data.name }));
      return data.name;
    }
  } catch (err) {
    console.error('Error resolving renter name:', err);
  }

  return user.email || 'Renter';
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
  if (user.role !== 'renter') {
    alert('Access denied. Renter dashboard only.');
    window.location.href = 'index.html';
    return;
  }

  // Top bar UI (Name + Dropdown)
  setupUserMenuDropdown();

  const navUserName = document.getElementById('navUserName');
  if (navUserName) {
    navUserName.textContent = await resolveRenterName(user);
  }

  const signOutLink = document.getElementById('signOutLink');
  if (signOutLink) {
    signOutLink.addEventListener('click', async (e) => {
      e.preventDefault();
      // Clear session
      sessionStorage.clear();
      // Supabase sign out
      try {
        const sb = getSupabase();
        const { error } = await sb.auth.signOut();
        if (error) console.error('Error signing out:', error);
      } catch (e) { console.error('Sign out error:', e); }
      // Redirect
      window.location.href = 'index.html';
    });
  }

  // Ensure user profile exists
  try {
    const sb = getSupabase();
    const { data: userProfile, error: fetchError } = await sb
      .from('users')
      .select('id')
      .eq('id', user.id)
      .maybeSingle();

    if (fetchError && fetchError.code !== 'PGRST116') {
      console.error('Error fetching profile:', fetchError);
    }

    if (!userProfile) {
      console.warn('User profile not found, creating...');
      const { data: { user: authUser } } = await sb.auth.getUser();

      // Retry logic for profile creation
      const { error: createError } = await sb
        .from('users')
        .upsert([{
          id: user.id,
          email: user.email || authUser?.email || 'unknown@example.com',
          name: authUser?.user_metadata?.name || user.email?.split('@')[0] || 'User',
          phone: authUser?.user_metadata?.phone || null,
          role: 'renter',
          created_at: new Date().toISOString()
        }], {
          onConflict: 'id'
        });

      if (createError) {
        console.error('Failed to create profile:', createError);
        alert(`Failed to initialize user profile: ${createError.message || createError.code}. You may experience issues.`);
      } else {
        console.log('Profile created successfully.');
      }
    }
  } catch (error) {
    console.error('Error ensuring user profile:', error);
    alert('Unexpected error initializing profile. Check console for details.');
  }

  await loadUserProfile(user.id);
  await loadUserBookings(user.id);
  await loadPaymentHistory(user.id);
});

// Load user profile
async function loadUserProfile(userId) {
  try {
    const sb = getSupabase();
    const { data: userProfile, error } = await sb
      .from('users')
      .select('*')
      .eq('id', userId)
      .maybeSingle(); // Use maybeSingle() to handle missing profiles

    if (error) throw error;

    const profileSection = document.querySelector('.profile-info');
    if (profileSection) {
      if (userProfile) {
        profileSection.innerHTML = `
          <h4>🧍‍♂️ My Profile</h4>
          <p><strong>Name:</strong> ${userProfile.name || 'N/A'}</p>
          <p><strong>Email:</strong> ${userProfile.email || 'N/A'}</p>
          <p><strong>Phone:</strong> ${userProfile.phone || 'Not provided'}</p>
          <p><strong>Member Since:</strong> ${userProfile.created_at ? new Date(userProfile.created_at).toLocaleDateString() : 'N/A'}</p>
        `;
      } else {
        profileSection.innerHTML = `
          <h4>🧍‍♂️ My Profile</h4>
          <p style="color: #d32f2f;">Profile not found. Please contact support.</p>
        `;
      }
    }
  } catch (error) {
    console.error('Error loading profile:', error);
    const profileSection = document.querySelector('.profile-info');
    if (profileSection) {
      profileSection.innerHTML = `
        <h4>🧍‍♂️ My Profile</h4>
        <p style="color: #d32f2f;">Error loading profile: ${error.message || 'Unknown'}</p>
      `;
    }
  }
}

// Load user bookings
// Load user bookings
async function loadUserBookings(userId) {
  let reviewedBookingIds = new Map(); // Store full review object
  let paidBookingIds = new Set();

  const sections = document.querySelectorAll('.section');
  const bookingsSection = sections[1]; // bookings
  if (!bookingsSection) return;

  bookingsSection.innerHTML = `
    <h4>🏡 My Bookings</h4>
    <div style="text-align: center; padding: 1rem; color: #666;">
      <p>Loading bookings...</p>
    </div>
  `;

  try {
    const sb = getSupabase();
    const { data: bookings, error } = await sb
      .from('bookings')
      .select(`
        id,
        status,
        created_at,
        property_id,
        message,
        renter_name,
        renter_phone,
        properties (
          id,
          name,
          location,
          rent,
          image_url
        )
      `)
      .eq('user_id', userId)
      .neq('status', 'cancelled')
      .order('created_at', { ascending: false });

    if (error) throw error;

    const safeBookings = bookings || [];
    const bookingIds = safeBookings.map(b => b.id).filter(Boolean);

    // Reviews (optional)
    try {
      if (bookingIds.length) {
        const { data: myReviews } = await sb
          .from('reviews')
          .select('id, booking_id, rating, comment')
          .eq('renter_id', userId)
          .in('booking_id', bookingIds);

        // Store full review object keyed by booking_id
        if (myReviews) {
          reviewedBookingIds = new Map(); // Change from Set to Map
          myReviews.forEach(r => reviewedBookingIds.set(r.booking_id, r));
        }
      }
    } catch (e) {
      console.warn('Reviews not available:', e);
    }

    // Payments (completed) — pay-once + review gating
    try {
      if (bookingIds.length) {
        const { data: paidRows } = await sb
          .from('payments')
          .select('booking_id')
          .eq('user_id', userId)
          .in('booking_id', bookingIds)
          .eq('status', 'completed');

        if (paidRows) paidBookingIds = new Set(paidRows.map(p => p.booking_id));
      }
    } catch (e) {
      console.warn('Payments lookup failed:', e);
    }

    if (!safeBookings.length) {
      bookingsSection.innerHTML = `
        <h4>🏡 My Bookings</h4>
        <div style="text-align: center; padding: 1rem; color: #666;">
          <p>You have no bookings yet.</p>
          <a href="index.html" style="color: #0b61ff; text-decoration: none;">Browse properties</a>
        </div>
      `;
      return;
    }

    const cardsHTML = safeBookings.map(booking => {
      const property = booking.properties || {};
      const statusEmoji =
        booking.status === 'confirmed' ? '✅' :
          booking.status === 'rejected' ? '❌' :
            '⏳';

      const statusText = booking.status
        ? booking.status.charAt(0).toUpperCase() + booking.status.slice(1)
        : 'Pending';

      const isPaid = paidBookingIds.has(booking.id);

      const paymentLine = booking.status === 'confirmed'
        ? `<p><strong>Payment:</strong> ${isPaid ? 'Paid ✅' : 'Unpaid'}</p>`
        : '';

      // Map.has works for keys too? Yes.
      // But wait we changed Set to Map.
      const existingReview = reviewedBookingIds.get(booking.id);

      const canCancel = (booking.status === 'pending' || booking.status === 'confirmed') && !isPaid;
      const canPay = booking.status === 'confirmed' && !isPaid;
      const canReview = booking.status === 'confirmed' && isPaid && !existingReview;
      const canEditReview = booking.status === 'confirmed' && isPaid && existingReview;

      const actions = `
        <div class="booking-actions">
          ${canReview ? `<button class="review-btn" data-booking-id="${booking.id}" data-property-id="${property?.id || booking.property_id}" data-property-name="${String(property?.name || '').replace(/"/g, '&quot;')}">Leave Review</button>` : ''}
          
          ${canEditReview ? `
            <div style="display:flex; align-items:center; gap:10px;">
               <span class="reviewed-tag" style="display: inline-flex; align-items: center; height: 36px; padding: 0 12px; background-color: #d1fae5; color: #065f46; border-radius: 8px; font-size: 0.85rem; font-weight: 600; border: 1px solid #a7f3d0;">Reviewed ✅</span>
               <button class="review-btn" style="display: inline-flex; align-items: center; height: 36px; padding: 0 12px; background:#fff; border: 1px solid #4caf50; color: #4caf50; border-radius: 8px; font-size: 0.85rem; cursor: pointer;" data-mode="edit" data-review-id="${existingReview.id}" data-rating="${existingReview.rating}" data-comment="${String(existingReview.comment || '').replace(/"/g, '&quot;')}"  data-booking-id="${booking.id}" data-property-id="${property?.id || booking.property_id}" data-property-name="${String(property?.name || '').replace(/"/g, '&quot;')}">Edit Review</button>
            </div>
            ` : ''}

          ${canPay ? `<button class="pay-btn" data-booking-id="${booking.id}" data-property-name="${String(property?.name || '').replace(/"/g, '&quot;')}" data-amount="${property?.rent || 0}">Pay Now</button>` : ''}
          ${canCancel ? `<button class="cancel-btn" data-booking-id="${booking.id}">Cancel Booking</button>` : ''}
        </div>
      `;

      return `
        <div class="booking-card">
          <h4>${property?.name || 'Property'}</h4>
          <p><strong>Location:</strong> ${property?.location || 'N/A'}</p>
          <p><strong>Rent:</strong> ${property?.rent ? `${property.rent} BDT` : 'N/A'}</p>
          <p><strong>Status:</strong> ${statusText} ${statusEmoji}</p>
          ${paymentLine}
          ${actions}
        </div>
      `;
    }).join('');

    bookingsSection.innerHTML = `<h4>🏡 My Bookings</h4>${cardsHTML}`;

    bookingsSection.querySelectorAll('.cancel-btn').forEach(btn => {
      btn.addEventListener('click', async () => {
        const id = btn.dataset.bookingId;
        if (id) await handleCancelBooking(id, userId);
      });
    });

    bookingsSection.querySelectorAll('.pay-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        openPaymentModal({
          bookingId: btn.dataset.bookingId,
          amount: btn.dataset.amount,
          propertyName: btn.dataset.propertyName
        });
      });
    });

    bookingsSection.querySelectorAll('.review-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        openReviewModal({
          bookingId: btn.dataset.bookingId,
          propertyId: btn.dataset.propertyId,
          propertyName: btn.dataset.propertyName,
          mode: btn.dataset.mode || 'create',
          reviewId: btn.dataset.reviewId,
          rating: btn.dataset.rating,
          comment: btn.dataset.comment
        });
      });
    });

  } catch (err) {
    console.error('Error loading bookings:', err);
    bookingsSection.innerHTML = `
      <h4>🏡 My Bookings</h4>
      <div style="text-align: center; padding: 1rem; color: #b00020;">
        <p>Could not load bookings.</p>
      </div>
    `;
  }
}



// Load payment history
async function loadPaymentHistory(userId) {
  try {
    const sb = getSupabase();
    const { data: payments, error } = await sb
      .from('payments')
      .select(`
        *,
        bookings!inner (
          properties (
            name
          )
        )
      `)
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error && error.code !== 'PGRST116') throw error; // PGRST116 = no rows returned

    const paymentSection = document.querySelector('.payment-history') ||
      document.querySelectorAll('.section')[2];

    if (paymentSection) {
      if (!payments || payments.length === 0) {
        paymentSection.innerHTML = `
          <h4>💳 Payment History</h4>
          <p style="color: #666;">No payment history yet.</p>
        `;
        return;
      }

      const paymentsHTML = payments.map(payment => {
        const propertyName = payment.bookings?.properties?.name || 'Property';
        const statusEmoji = payment.status === 'completed' ? '✅' : '⏳';
        return `
          <p><strong>${new Date(payment.created_at).toLocaleDateString()}:</strong> 
             ${payment.amount.toLocaleString()} BDT – ${propertyName} ${statusEmoji}</p>
        `;
      }).join('');

      paymentSection.innerHTML = `
        <h4>💳 Payment History</h4>
        ${paymentsHTML}
      `;
    }
  } catch (error) {
    console.error('Error loading payment history:', error);
  }
}
// Attach click handlers for booking actions
function attachBookingActionHandlers(userId) {
  // Review
  document.querySelectorAll('.review-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const bookingId = btn.dataset.bookingId;
      const propertyId = btn.dataset.propertyId;
      const propertyName = btn.dataset.propertyName;
      openReviewModal({ bookingId, propertyId, propertyName, userId });
    });
  });

  // Cancel booking
  document.querySelectorAll('.cancel-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const bookingId = btn.dataset.bookingId;
      handleCancelBooking(bookingId, userId);
    });
  });

  // Make payment
  document.querySelectorAll('.pay-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      openPaymentModal({
        bookingId: btn.dataset.bookingId,
        amount: btn.dataset.amount,
        propertyName: btn.dataset.propertyName
      });
    });
  });
}

// Cancel booking logic
async function handleCancelBooking(bookingId, userId) {
  if (!confirm('Are you sure you want to cancel this booking?')) return;

  try {
    const sb = getSupabase();
    const { data: paidRow, error: paidErr } = await sb
      .from('payments')
      .select('id')
      .eq('booking_id', bookingId)
      .eq('user_id', userId)
      .eq('status', 'completed')
      .maybeSingle();

    if (paidErr && paidErr.code !== 'PGRST116') throw paidErr;
    if (paidRow) {
      alert('This booking is already paid. Cancellation is disabled from the dashboard.');
      return;
    }

    // Antigravity Edit: Soft cancel only (update status), do not delete.
    const { error } = await sb
      .from('bookings')
      .update({ status: 'cancelled', updated_at: new Date().toISOString() })
      .eq('id', bookingId)
      .eq('user_id', userId);

    if (error) throw error;

    alert('Booking canceled successfully.');
    await loadUserBookings(userId);
    await loadPaymentHistory(userId);
  } catch (e) {
    console.error('Cancel booking error:', e);
    alert('Failed to cancel booking. Please try again.');
  }
}


// Make payment logic
const __paymentLocks = new Set();

async function handleMakePayment(bookingId, userId, amountVal, paymentMethod) {
  if (__paymentLocks.has(bookingId)) return;
  __paymentLocks.add(bookingId);

  try {
    const sb = getSupabase();
    const { data: bookingRow, error: bookingErr } = await sb
      .from('bookings')
      .select('status, property_id')
      .eq('id', bookingId)
      .eq('user_id', userId)
      .maybeSingle();

    if (bookingErr && bookingErr.code !== 'PGRST116') throw bookingErr;
    if (!bookingRow || bookingRow.status !== 'confirmed') {
      alert('Payment is only available for confirmed bookings.');
      return;
    }

    const { data: existing, error: exErr } = await sb
      .from('payments')
      .select('id')
      .eq('booking_id', bookingId)
      .eq('user_id', userId)
      .eq('status', 'completed')
      .maybeSingle();

    if (exErr && exErr.code !== 'PGRST116') throw exErr;
    if (existing) {
      alert('Payment already completed for this booking.');
      return;
    }

    let amount = Number(amountVal);
    if (!amount || isNaN(amount)) {
      alert('Invalid amount.');
      return;
    }

    const { error } = await sb
      .from('payments')
      .insert([{
        booking_id: bookingId,
        user_id: userId,
        amount,
        status: 'completed',
        payment_method: paymentMethod || 'manual',
        transaction_id: 'TXN-' + Date.now(),
        created_at: new Date().toISOString()
      }]);

    if (error) throw error;

    // Antigravity Edit: Update property status to 'rented' so it doesn't show up in search
    const { error: propError } = await sb
      .from('properties')
      .update({ status: 'rented' })
      .eq('id', bookingRow.property_id || bookingRow.properties.id); // Handle join if needed, but bookingRow likely has property_id

    // Fallback: if bookingRow didn't have property_id directly (it usually does), fetching it might be safer, but let's try direct update first or fetch property_id if missing.
    // Actually bookingRow was fetched with just 'status'. We need to be sure we have the property_id.
    // Let's refactor the fetch above to include property_id.

    // ... wait, I need to update the fetching part first to ensure I have property_id. 
    // I will do that in a separate edit or just blindly trust `bookingRow.property_id` if I change the fetch.
    // Let's check the fetch at line 461. It only selects 'status'. 
    // I MUST Change the fetch first.

    // Actually, I can do a two-step edit. 
    // 1. Update the fetch to get property_id.
    // 2. Update the property status.

    // Let's combine this into a multi-replace or just do it right here if I can replace the block.
    // The previous fetch is lines 459-464.
    // I am currently editing lines 492-506 (the insert). 
    // I should simply fetch properties(id) or property_id in the check block.

    // Let's assume I will fix the fetch in a previous step? No, sequential.
    // I will cancel this tool call and do the fetch update first? 
    // Actually, `bookingRow` is `data`. 
    // Let's look at `handleMakePayment`.

    // Lines 459-464: .select('status') ... 
    // I need to change this to .select('status, property_id')

    // I will abort this specific tool call and use multi_replace to do both safely.
    await loadUserBookings(userId);
    await loadPaymentHistory(userId);
    alert('Payment recorded successfully!');
  } catch (e) {
    console.error('Payment error:', e);
    alert(`Failed to record payment: ${e.message || e.code || 'Unknown error'}. Check console for details.`);
  } finally {
    __paymentLocks.delete(bookingId);
  }
}





// -------------------------------
// Review Modal logic
// -------------------------------
// -------------------------------
// Review Modal logic (Updated for Edit)
// -------------------------------
function openReviewModal({ bookingId, propertyId, propertyName, mode = 'create', reviewId = null, rating = '', comment = '' }) {
  const modal = document.getElementById('review-modal');
  const closeBtn = document.querySelector('.close-review');
  const form = document.getElementById('review-form');
  const title = modal.querySelector('h2');
  const submitBtn = form.querySelector('button[type="submit"]');

  if (!modal || !form) return;

  // Set fields
  document.getElementById('reviewBookingId').value = bookingId || '';
  document.getElementById('reviewPropertyId').value = propertyId || '';
  document.getElementById('reviewPropertyName').textContent = propertyName ? `Property: ${propertyName}` : '';

  // Fill data if editing
  document.getElementById('reviewRating').value = rating || '';
  document.getElementById('reviewComment').value = comment || '';

  // Store edit mode metadata on the form
  form.dataset.mode = mode;
  form.dataset.reviewId = reviewId || '';

  // Update UI text
  if (mode === 'edit') {
    title.textContent = 'Edit Your Review';
    submitBtn.textContent = 'Update Review';
    submitBtn.style.background = '#4caf50';
  } else {
    title.textContent = 'Leave a Review';
    submitBtn.textContent = 'Submit Review';
    submitBtn.style.background = '#0b61ff';
  }

  modal.style.display = 'flex';

  if (closeBtn) {
    closeBtn.onclick = () => { modal.style.display = 'none'; };
  }

  modal.addEventListener('click', (e) => {
    if (e.target === modal) modal.style.display = 'none';
  }, { once: true });

  form.onsubmit = async (e) => {
    e.preventDefault();

    const newRating = Number(document.getElementById('reviewRating').value);
    const newComment = document.getElementById('reviewComment').value || '';
    const bId = document.getElementById('reviewBookingId').value;
    const pId = document.getElementById('reviewPropertyId').value;
    const currentMode = form.dataset.mode;
    const rId = form.dataset.reviewId;

    if (!newRating || newRating < 1 || newRating > 5) {
      alert('Please select a rating (1 to 5).');
      return;
    }

    try {
      const userStr = sessionStorage.getItem('user');
      const currentUser = userStr ? JSON.parse(userStr) : null;
      const renterId = currentUser?.id;

      if (!renterId) {
        alert('Please login again.');
        return;
      }

      if (form.dataset.submitting === 'true') return;
      form.dataset.submitting = 'true';
      submitBtn.disabled = true;

      let error = null;

      if (currentMode === 'edit' && rId) {
        // UPDATE
        const sb = getSupabase();
        const { error: upError } = await sb
          .from('reviews')
          .update({ rating: newRating, comment: newComment, created_at: new Date().toISOString() })
          .eq('id', rId)
          .eq('renter_id', renterId);
        error = upError;
      } else {
        // INSERT
        const sb = getSupabase();
        const { error: inError } = await sb
          .from('reviews')
          .insert([{
            booking_id: bId,
            property_id: pId,
            renter_id: renterId,
            rating: newRating,
            comment: newComment
          }]);
        error = inError;
      }

      if (error) throw error;

      alert(currentMode === 'edit' ? 'Review updated successfully.' : 'Review submitted successfully.');
      modal.style.display = 'none';
      await loadUserBookings(renterId);

    } catch (err) {
      console.error('Review error:', err);
      alert('Failed to save review. Ensure you have run "allow-review-edit.sql" if editing.');
    } finally {
      form.dataset.submitting = 'false';
      submitBtn.disabled = false;
    }
  };
}
// -------------------------------
// Payment Modal logic
// -------------------------------
function openPaymentModal({ bookingId, amount, propertyName }) {
  const modal = document.getElementById('payment-modal');
  const closeBtn = document.querySelector('.close-payment');
  const form = document.getElementById('payment-form');

  if (!modal || !form) return;

  document.getElementById('paymentBookingId').value = bookingId || '';
  document.getElementById('paymentAmountValue').value = amount || '';
  document.getElementById('paymentPropertyName').textContent = propertyName ? `Property: ${propertyName}` : '';
  document.getElementById('paymentAmount').textContent = amount ? `Amount: ${Number(amount).toLocaleString()} BDT` : '';

  // Reset radio buttons
  form.querySelectorAll('input[name="paymentMethod"]').forEach(el => el.checked = false);

  modal.style.display = 'flex';

  if (closeBtn) {
    closeBtn.onclick = () => { modal.style.display = 'none'; };
  }

  modal.addEventListener('click', (e) => {
    if (e.target === modal) modal.style.display = 'none';
  }, { once: true });

  form.onsubmit = async (e) => {
    e.preventDefault();
    const bId = document.getElementById('paymentBookingId').value;
    const amt = document.getElementById('paymentAmountValue').value;
    const methodInput = form.querySelector('input[name="paymentMethod"]:checked');

    if (!methodInput) {
      alert('Please select a payment method.');
      return;
    }

    const startBtn = form.querySelector('button[type="submit"]');
    const originalText = startBtn.textContent;
    startBtn.disabled = true;
    startBtn.textContent = 'Processing...';

    try {
      const userStr = sessionStorage.getItem('user');
      const currentUser = userStr ? JSON.parse(userStr) : null;
      if (!currentUser) {
        alert('Please login again.');
        return;
      }

      await handleMakePayment(bId, currentUser.id, amt, methodInput.value);
      modal.style.display = 'none';
    } catch (err) {
      console.error(err);
    } finally {
      startBtn.disabled = false;
      startBtn.textContent = originalText;
    }
  };
}
