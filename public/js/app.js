/**
 * Gym — Compact Minimal Sans-Serif Client Application
 */

(function () {
  'use strict';

  const state = {
    members: [],
    activeMemberId: null,
    currentWeekStart: getMonday(new Date()),
    calendarData: {},
    maxCapacity: 3,
    startHour: 6,
    endHour: 21,
    selectedMobileDayIndex: 0,
    isMobileView: window.innerWidth <= 800,
    rules: [],
    hourTypes: {}
  };

  const elements = {
    memberSelect: document.getElementById('active-member-select'),
    btnRules: document.getElementById('btn-rules'),
    btnManageMembers: document.getElementById('btn-manage-members'),
    btnThemeToggle: document.getElementById('btn-theme-toggle'),
    themeIcon: document.getElementById('theme-icon'),
    btnPrevWeek: document.getElementById('btn-prev-week'),
    btnToday: document.getElementById('btn-today'),
    btnNextWeek: document.getElementById('btn-next-week'),
    currentWeekLabel: document.getElementById('current-week-label'),
    myBookingsText: document.getElementById('my-bookings-text'),
    mobileDayTabs: document.getElementById('mobile-day-tabs'),
    calendarGrid: document.getElementById('calendar-grid'),
    membersModal: document.getElementById('members-modal'),
    btnCloseModal: document.getElementById('btn-close-modal'),
    rulesModal: document.getElementById('rules-modal'),
    btnCloseRulesModal: document.getElementById('btn-close-rules-modal'),
    formAddRule: document.getElementById('form-add-rule'),
    inputRuleText: document.getElementById('input-rule-text'),
    rulesList: document.getElementById('rules-list'),
    rulesCount: document.getElementById('rules-count'),
    formAddMember: document.getElementById('form-add-member'),
    inputMemberName: document.getElementById('input-member-name'),
    inputMemberEmail: document.getElementById('input-member-email'),
    membersList: document.getElementById('members-list'),
    membersCount: document.getElementById('members-count'),
    toastContainer: document.getElementById('toast-container'),
    btnInstallApp: document.getElementById('btn-install-app'),
    iosInstallModal: document.getElementById('ios-install-modal'),
    btnCloseIosInstall: document.getElementById('btn-close-ios-install'),
    btnGotItIos: document.getElementById('btn-got-it-ios'),
    btnFeedback: document.getElementById('btn-feedback'),
    feedbackModal: document.getElementById('feedback-modal'),
    btnCloseFeedbackModal: document.getElementById('btn-close-feedback-modal'),
    formFeedback: document.getElementById('form-feedback'),
    feedbackMemberName: document.getElementById('feedback-member-name'),
    feedbackEmail: document.getElementById('feedback-email'),
    feedbackCategory: document.getElementById('feedback-category'),
    feedbackMessage: document.getElementById('feedback-message'),
    btnEmailClientDirect: document.getElementById('btn-email-client-direct'),
    // Drawer & Consolidated Navigation
    btnMenuToggle: document.getElementById('btn-menu-toggle'),
    sideMenuDrawer: document.getElementById('side-menu-drawer'),
    menuDrawerBackdrop: document.getElementById('menu-drawer-backdrop'),
    btnCloseDrawer: document.getElementById('btn-close-drawer'),
    btnDrawerGuide: document.getElementById('btn-drawer-guide'),
    btnDrawerRules: document.getElementById('btn-drawer-rules'),
    btnDrawerRoster: document.getElementById('btn-drawer-roster'),
    drawerRosterCount: document.getElementById('drawer-roster-count'),
    btnDrawerFeedback: document.getElementById('btn-drawer-feedback'),
    btnDrawerTheme: document.getElementById('btn-drawer-theme'),
    drawerThemeIcon: document.getElementById('drawer-theme-icon'),
    drawerThemeLabel: document.getElementById('drawer-theme-label'),
    btnDrawerInstall: document.getElementById('btn-drawer-install'),
    // How to Use Guide Modal
    guideModal: document.getElementById('guide-modal'),
    btnCloseGuideModal: document.getElementById('btn-close-guide-modal'),
    btnGuideDone: document.getElementById('btn-guide-done')
  };

  // Date Helpers
  function getMonday(d) {
    const date = new Date(d);
    const day = date.getDay();
    const diff = date.getDate() - day + (day === 0 ? -6 : 1);
    date.setDate(diff);
    date.setHours(0, 0, 0, 0);
    return date;
  }

  function addDays(date, days) {
    const result = new Date(date);
    result.setDate(result.getDate() + days);
    return result;
  }

  function formatDateISO(date) {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  function isSlotInPast(dateISO, timeSlot) {
    const now = new Date();
    const todayISO = formatDateISO(now);

    if (dateISO < todayISO) return true;
    if (dateISO > todayISO) return false;

    // Same day: calculate slot end time (e.g. 11:00 slot ends at 12:00:00)
    const [slotHour, slotMin] = timeSlot.split(':').map(Number);
    const slotEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), slotHour + 1, slotMin || 0, 0);
    return now >= slotEnd;
  }

  const DAY_NAMES = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

  // Desaturated Muted Pastel Palette (Washed-out, understated, stylish)
  const PASTEL_COLORS = [
    '#8E9E94', // Washed Sage
    '#AC8F8F', // Washed Dusty Rose
    '#8F9AAC', // Washed Slate
    '#ABA08C', // Washed Sand
    '#9D91A8', // Washed Mauve
    '#849E97', // Washed Seafoam
    '#AB8B80', // Washed Terracotta
    '#869AA8', // Washed Denim
    '#9E9A82', // Washed Olive
    '#A6889B', // Washed Plum
    '#859B8E', // Washed Eucalyptus
    '#998BA6', // Washed Lavender
    '#A89384', // Washed Apricot
    '#829AAB', // Washed Storm
    '#99A68F', // Washed Moss
    '#A6929D'  // Washed Heather
  ];

  function getMemberColor(memberId, name) {
    if (typeof memberId === 'number' && memberId > 0) {
      return PASTEL_COLORS[(memberId - 1) % PASTEL_COLORS.length];
    }
    let hash = 0;
    const str = String(name || '');
    for (let i = 0; i < str.length; i++) {
      hash = str.charCodeAt(i) + ((hash << 5) - hash);
    }
    return PASTEL_COLORS[Math.abs(hash) % PASTEL_COLORS.length];
  }

  // API
  async function fetchConfig() {
    try {
      const res = await fetch('/api/config');
      if (res.ok) {
        const data = await res.json();
        state.maxCapacity = data.max_capacity_per_slot || 4;
        state.startHour = data.start_hour || 6;
        state.endHour = data.end_hour || 21;
      }
    } catch (e) {
      console.error(e);
    }
  }

  async function fetchMembers() {
    try {
      const res = await fetch('/api/members');
      if (res.ok) {
        const data = await res.json();
        state.members = data.members || [];
        renderMemberSelector();
        renderMembersList();
      }
    } catch (e) {
      showToast('Error loading members');
    }
  }

  async function fetchCalendar() {
    const startDate = formatDateISO(state.currentWeekStart);
    const endDate = formatDateISO(addDays(state.currentWeekStart, 6));

    try {
      const res = await fetch(`/api/calendar?start_date=${startDate}&end_date=${endDate}`);
      if (res.ok) {
        const data = await res.json();
        state.calendarData = data.calendar || {};
        state.hourTypes = data.hour_types || {};
        renderCalendar();
        updateMyBookingsSummary();
      }
    } catch (e) {
      showToast('Error loading schedule');
    }
  }

  async function updateHourType(timeSlot, slotType) {
    state.hourTypes[timeSlot] = slotType;
    renderCalendar();

    try {
      const res = await fetch('/api/hour-types', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          time_slot: timeSlot,
          slot_type: slotType
        })
      });

      if (res.ok) {
        showToast(`${timeSlot} → ${slotType}`);
      } else {
        const err = await res.json();
        showToast(err.error || 'Failed to update hour');
        await fetchCalendar();
      }
    } catch (e) {
      showToast('Network error');
    }
  }

  async function bookSlot(dateStr, timeSlot) {
    if (!state.activeMemberId) {
      showToast('Select member first');
      elements.memberSelect.focus();
      return;
    }

    try {
      const res = await fetch('/api/bookings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          member_id: state.activeMemberId,
          date: dateStr,
          time_slot: timeSlot
        })
      });

      const data = await res.json();
      if (res.ok) {
        showToast('Booked');
        await fetchCalendar();
      } else {
        showToast(data.error || 'Failed to book');
      }
    } catch (e) {
      showToast('Network error');
    }
  }

  async function cancelBooking(bookingId) {
    try {
      const res = await fetch(`/api/bookings/${bookingId}`, {
        method: 'DELETE'
      });
      if (res.ok) {
        showToast('Cancelled');
        await fetchCalendar();
      } else {
        const data = await res.json();
        showToast(data.error || 'Failed to cancel');
      }
    } catch (e) {
      showToast('Network error');
    }
  }

  async function addMember(name, email) {
    try {
      const res = await fetch('/api/members', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email })
      });
      const data = await res.json();
      if (res.ok) {
        showToast(`Added ${name}`);
        await fetchMembers();
        if (data.member && data.member.id) {
          setActiveMember(data.member.id);
        }
        return true;
      } else {
        showToast(data.error || 'Failed to add');
        return false;
      }
    } catch (e) {
      showToast('Network error');
      return false;
    }
  }

  async function removeMember(memberId, name) {
    if (!confirm(`Remove ${name}?`)) return;

    try {
      const res = await fetch(`/api/members/${memberId}`, {
        method: 'DELETE'
      });
      if (res.ok) {
        showToast(`Removed ${name}`);
        if (state.activeMemberId === memberId) {
          state.activeMemberId = null;
          localStorage.removeItem('gym_active_member_id');
        }
        await fetchMembers();
        await fetchCalendar();
      } else {
        const data = await res.json();
        showToast(data.error || 'Failed to remove');
      }
    } catch (e) {
      showToast('Network error');
    }
  }

  async function fetchRules() {
    try {
      const res = await fetch('/api/rules');
      if (res.ok) {
        const data = await res.json();
        state.rules = data.rules || [];
        renderRulesList();
      }
    } catch (e) {
      console.error('Failed to fetch rules', e);
    }
  }

  async function addRule(text) {
    try {
      const res = await fetch('/api/rules', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text })
      });
      if (res.ok) {
        const data = await res.json();
        if (data.rule) {
          state.rules.push(data.rule);
        } else {
          await fetchRules();
        }
        renderRulesList();
        showToast('Rule added');
        return true;
      } else {
        const err = await res.json();
        showToast(err.error || 'Failed to add rule');
        return false;
      }
    } catch (e) {
      showToast('Network error');
      return false;
    }
  }

  async function deleteRule(id) {
    try {
      const res = await fetch(`/api/rules/${id}`, { method: 'DELETE' });
      if (res.ok) {
        state.rules = state.rules.filter((r) => r.id !== id);
        renderRulesList();
        showToast('Rule removed');
      } else {
        showToast('Failed to delete rule');
      }
    } catch (e) {
      showToast('Network error');
    }
  }

  function renderRulesList() {
    if (!elements.rulesList) return;
    if (elements.rulesCount) elements.rulesCount.textContent = state.rules.length;
    elements.rulesList.innerHTML = '';

    if (state.rules.length === 0) {
      elements.rulesList.innerHTML = '<div class="empty-rules-hint">No gym rules added yet.</div>';
      return;
    }

    state.rules.forEach((r, idx) => {
      const row = document.createElement('div');
      row.className = 'rule-row-item';
      const text = r.text || r.title || '';
      row.innerHTML = `
        <div class="rule-row-num">${idx + 1}</div>
        <div class="rule-row-text">${escapeHTML(text)}</div>
        <button type="button" class="btn-del-rule" data-id="${r.id}" title="Delete rule" aria-label="Delete rule">&times;</button>
      `;
      elements.rulesList.appendChild(row);
    });
  }

  // Rendering
  function renderMemberSelector() {
    elements.memberSelect.innerHTML = '';

    if (state.members.length === 0) {
      const opt = document.createElement('option');
      opt.value = '';
      opt.textContent = 'No members';
      elements.memberSelect.appendChild(opt);
      return;
    }

    state.members.forEach((m) => {
      const opt = document.createElement('option');
      opt.value = m.id;
      opt.textContent = m.name;
      elements.memberSelect.appendChild(opt);
    });

    const savedId = parseInt(localStorage.getItem('gym_active_member_id'), 10);
    const existing = state.members.find((m) => m.id === savedId);

    if (existing) {
      state.activeMemberId = existing.id;
      elements.memberSelect.value = existing.id;
    } else {
      state.activeMemberId = state.members[0].id;
      elements.memberSelect.value = state.members[0].id;
      localStorage.setItem('gym_active_member_id', state.activeMemberId);
    }
  }

  function setActiveMember(memberId) {
    state.activeMemberId = memberId;
    localStorage.setItem('gym_active_member_id', memberId);
    elements.memberSelect.value = memberId;
    renderCalendar();
    updateMyBookingsSummary();
  }

  function renderMembersList() {
    if (elements.membersCount) elements.membersCount.textContent = state.members.length;
    if (elements.drawerRosterCount) elements.drawerRosterCount.textContent = state.members.length;
    elements.membersList.innerHTML = '';

    if (state.members.length === 0) {
      elements.membersList.innerHTML = '<p style="color:var(--ink-muted); padding:8px 0;">Empty roster.</p>';
      return;
    }

    state.members.forEach((m) => {
      const color = getMemberColor(m.id, m.name);
      const item = document.createElement('div');
      item.className = 'member-item';
      item.style.borderLeft = `2.5px solid ${color}`;
      item.innerHTML = `
        <span>${escapeHTML(m.name)}</span>
        <button class="btn-del" data-id="${m.id}" data-name="${escapeHTML(m.name)}">Del</button>
      `;
      elements.membersList.appendChild(item);
    });
  }

  function renderCalendar() {
    const today = new Date();
    const todayISO = formatDateISO(today);
    const weekEnd = addDays(state.currentWeekStart, 6);

    const startMonth = state.currentWeekStart.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
    const endMonth = weekEnd.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
    elements.currentWeekLabel.textContent = `${startMonth} – ${endMonth}`;

    renderMobileDayTabs(todayISO);
    elements.calendarGrid.innerHTML = '';
    
    // Trigger smooth fade animation
    elements.calendarGrid.classList.remove('grid-animating');
    void elements.calendarGrid.offsetWidth; // Force reflow
    elements.calendarGrid.classList.add('grid-animating');

    if (state.isMobileView) {
      elements.calendarGrid.classList.add('mobile-single-day-mode');
      const targetDate = addDays(state.currentWeekStart, state.selectedMobileDayIndex);
      renderMobileDaySlots(targetDate, todayISO);
    } else {
      elements.calendarGrid.classList.remove('mobile-single-day-mode');
      renderDesktopWeekGrid(todayISO);
    }
  }

  function renderMobileDayTabs(todayISO) {
    elements.mobileDayTabs.innerHTML = '';

    for (let i = 0; i < 7; i++) {
      const date = addDays(state.currentWeekStart, i);
      const dateISO = formatDateISO(date);
      const isToday = dateISO === todayISO;
      const isActive = state.selectedMobileDayIndex === i;

      const tab = document.createElement('button');
      tab.className = `mobile-day-tab ${isActive ? 'active' : ''} ${isToday ? 'is-today' : ''}`;
      tab.innerHTML = `
        <span class="tab-day-name">${DAY_NAMES[i]}</span>
        <span class="tab-date-num">${date.getDate()}</span>
      `;
      tab.addEventListener('click', () => {
        state.selectedMobileDayIndex = i;
        renderCalendar();
      });
      elements.mobileDayTabs.appendChild(tab);
    }
  }

  function renderMobileDaySlots(targetDate, todayISO) {
    const dateISO = formatDateISO(targetDate);
    const dayBookings = state.calendarData[dateISO] || {};

    for (let hour = state.startHour; hour <= state.endHour; hour++) {
      const timeSlot = `${String(hour).padStart(2, '0')}:00`;
      const nextHourStr = `${String(hour + 1).padStart(2, '0')}:00`;
      const bookingsInSlot = dayBookings[timeSlot] || [];
      const isBooked = bookingsInSlot.some(b => b.member_id === state.activeMemberId);
      const isFull = bookingsInSlot.length >= state.maxCapacity;
      const hasAttendees = bookingsInSlot.length > 0;
      const hourType = state.hourTypes[timeSlot] || 'MIXED';
      const isPast = isSlotInPast(dateISO, timeSlot);
      
      const cell = document.createElement('div');
      let cellClasses = ['slot-cell', `hour-type-${hourType.toLowerCase()}`];
      if (isPast) cellClasses.push('is-past');
      if (isBooked) cellClasses.push('is-booked');
      else if (isFull) cellClasses.push('is-full');
      else if (hasAttendees) cellClasses.push('has-attendees');
      cell.className = cellClasses.join(' ');

      const slotCard = createSlotCard(dateISO, timeSlot, `${timeSlot} - ${nextHourStr}`, bookingsInSlot, todayISO);
      cell.appendChild(slotCard);
      elements.calendarGrid.appendChild(cell);
    }
  }

  function renderDesktopWeekGrid(todayISO) {
    const corner = document.createElement('div');
    corner.className = 'grid-header-corner';
    corner.textContent = 'Time';
    elements.calendarGrid.appendChild(corner);

    for (let i = 0; i < 7; i++) {
      const date = addDays(state.currentWeekStart, i);
      const dateISO = formatDateISO(date);
      const isToday = dateISO === todayISO;

      const dayHeader = document.createElement('div');
      dayHeader.className = `grid-header-day ${isToday ? 'is-today' : ''}`;
      dayHeader.innerHTML = `
        <div class="day-name">${DAY_NAMES[i]}</div>
        <div class="day-date">${date.getDate()}</div>
      `;
      elements.calendarGrid.appendChild(dayHeader);
    }

    for (let hour = state.startHour; hour <= state.endHour; hour++) {
      const timeSlot = `${String(hour).padStart(2, '0')}:00`;
      const nextHourStr = `${String(hour + 1).padStart(2, '0')}:00`;
      const hourType = state.hourTypes[timeSlot] || 'MIXED';

      const timeGutter = document.createElement('div');
      timeGutter.className = `time-gutter has-type type-${hourType.toLowerCase()}`;
      timeGutter.innerHTML = `
        <span class="time-label">${timeSlot}</span>
        <div class="hour-type-select-wrap">
          <select class="hour-type-select type-${hourType.toLowerCase()}" data-time-slot="${timeSlot}" title="Category for ${timeSlot}">
            <option value="MIXED" ${hourType === 'MIXED' ? 'selected' : ''}>Mixed</option>
            <option value="MALE" ${hourType === 'MALE' ? 'selected' : ''}>Male</option>
            <option value="FEMALE" ${hourType === 'FEMALE' ? 'selected' : ''}>Female</option>
          </select>
        </div>
      `;

      const select = timeGutter.querySelector('.hour-type-select');
      select.addEventListener('change', (e) => {
        updateHourType(timeSlot, e.target.value);
      });
      elements.calendarGrid.appendChild(timeGutter);

      for (let dayIdx = 0; dayIdx < 7; dayIdx++) {
        const date = addDays(state.currentWeekStart, dayIdx);
        const dateISO = formatDateISO(date);
        const dayBookings = state.calendarData[dateISO] || {};
        const bookingsInSlot = dayBookings[timeSlot] || [];
        const isBooked = bookingsInSlot.some(b => b.member_id === state.activeMemberId);
        const isFull = bookingsInSlot.length >= state.maxCapacity;
        const hasAttendees = bookingsInSlot.length > 0;
        const isPast = isSlotInPast(dateISO, timeSlot);

        const slotCell = document.createElement('div');
        let slotClasses = ['slot-cell'];
        if (isPast) slotClasses.push('is-past');
        if (isBooked) slotClasses.push('is-booked');
        else if (isFull) slotClasses.push('is-full');
        else if (hasAttendees) slotClasses.push('has-attendees');
        slotCell.className = slotClasses.join(' ');

        const slotCard = createSlotCard(dateISO, timeSlot, `${timeSlot} - ${nextHourStr}`, bookingsInSlot, todayISO);
        slotCell.appendChild(slotCard);
        elements.calendarGrid.appendChild(slotCell);
      }
    }
  }

  function createSlotCard(dateISO, timeSlot, displayTime, bookings, todayISO) {
    const card = document.createElement('div');
    card.className = 'slot-card';

    const bookedCount = bookings.length;
    const isFull = bookedCount >= state.maxCapacity;
    const hourType = state.hourTypes[timeSlot] || 'MIXED';

    const myBooking = bookings.find((b) => b.member_id === state.activeMemberId);
    const isBookedByMe = !!myBooking;

    // Compact Top Row: Mobile time + Count
    const topRow = document.createElement('div');
    topRow.className = 'slot-top-row';
    topRow.innerHTML = `
      <div class="slot-top-left">
        <span class="slot-time-mini">${displayTime}</span>
        ${state.isMobileView ? `
          <div class="hour-type-select-wrap">
            <select class="hour-type-select type-${hourType.toLowerCase()}" data-time-slot="${timeSlot}" title="Category for ${timeSlot}">
              <option value="MIXED" ${hourType === 'MIXED' ? 'selected' : ''}>Mixed</option>
              <option value="MALE" ${hourType === 'MALE' ? 'selected' : ''}>Male</option>
              <option value="FEMALE" ${hourType === 'FEMALE' ? 'selected' : ''}>Female</option>
            </select>
          </div>
        ` : ''}
      </div>
      <span class="slot-capacity-pill ${isBookedByMe ? 'mine' : ''}">${bookedCount}/${state.maxCapacity}</span>
    `;

    if (state.isMobileView) {
      const selectMobile = topRow.querySelector('.hour-type-select');
      if (selectMobile) {
        selectMobile.addEventListener('change', (e) => {
          updateHourType(timeSlot, e.target.value);
        });
      }
    }

    card.appendChild(topRow);

    // Attendees list
    const attendeesWrap = document.createElement('div');
    attendeesWrap.className = 'attendees-wrap';

    if (bookings.length > 0) {
      bookings.forEach((b) => {
        const isMe = b.member_id === state.activeMemberId;
        const color = getMemberColor(b.member_id, b.member_name);
        const tag = document.createElement('span');
        tag.className = `attendee-tag ${isMe ? 'is-me' : ''}`;
        tag.style.borderLeftColor = color;
        tag.textContent = b.member_name.split(' ')[0];
        tag.title = b.member_name;
        attendeesWrap.appendChild(tag);
      });
    }
    card.appendChild(attendeesWrap);

    // Action button
    const actionBtn = document.createElement('button');
    const isPast = isSlotInPast(dateISO, timeSlot);

    if (isPast) {
      actionBtn.className = 'slot-btn btn-disabled btn-past';
      actionBtn.textContent = '—';
      actionBtn.disabled = true;
      actionBtn.title = 'Past time slot';
    } else if (isBookedByMe) {
      actionBtn.className = 'slot-btn btn-cancel';
      actionBtn.textContent = 'Cancel';
      actionBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        cancelBooking(myBooking.booking_id);
      });
    } else if (isFull) {
      actionBtn.className = 'slot-btn btn-disabled';
      actionBtn.textContent = 'Full';
      actionBtn.disabled = true;
    } else {
      actionBtn.className = 'slot-btn btn-book';
      actionBtn.innerHTML = '<span class="btn-symbol">+</span><span class="btn-text-expand">Book</span>';
      actionBtn.title = `Book spot for ${timeSlot}`;
      actionBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        bookSlot(dateISO, timeSlot);
      });
    }

    card.appendChild(actionBtn);
    return card;
  }

  function updateMyBookingsSummary() {
    if (!state.activeMemberId) {
      elements.myBookingsText.textContent = 'No member';
      return;
    }

    let count = 0;
    Object.keys(state.calendarData).forEach((dateKey) => {
      const daySlots = state.calendarData[dateKey];
      Object.entries(daySlots).forEach(([timeSlot, bookings]) => {
        if (!isSlotInPast(dateKey, timeSlot) && bookings.some((b) => b.member_id === state.activeMemberId)) {
          count++;
        }
      });
    });

    elements.myBookingsText.textContent = `${count} booked`;

    // Micro-bump animation & accent highlight
    const badge = document.getElementById('my-bookings-count-badge');
    if (badge) {
      if (count > 0) {
        badge.classList.add('has-bookings');
      } else {
        badge.classList.remove('has-bookings');
      }
      badge.classList.remove('pill-bump');
      void badge.offsetWidth;
      badge.classList.add('pill-bump');
    }
  }

  function showToast(message) {
    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.textContent = message;
    elements.toastContainer.appendChild(toast);

    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateY(6px)';
      setTimeout(() => toast.remove(), 200);
    }, 2200);
  }

  function escapeHTML(str) {
    if (!str) return '';
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function initTheme() {
    const savedTheme = localStorage.getItem('gym_theme') || 'light';
    setTheme(savedTheme);
  }

  function setTheme(theme) {
    const isDark = theme === 'dark';
    if (isDark) {
      document.documentElement.setAttribute('data-theme', 'dark');
      if (elements.themeIcon) elements.themeIcon.textContent = '◐';
      if (elements.drawerThemeIcon) elements.drawerThemeIcon.textContent = '◐';
      if (elements.drawerThemeLabel) elements.drawerThemeLabel.textContent = 'Dark';
    } else {
      document.documentElement.removeAttribute('data-theme');
      if (elements.themeIcon) elements.themeIcon.textContent = '◑';
      if (elements.drawerThemeIcon) elements.drawerThemeIcon.textContent = '◑';
      if (elements.drawerThemeLabel) elements.drawerThemeLabel.textContent = 'Light';
    }
    document.querySelectorAll('meta[name="theme-color"]').forEach((meta) => {
      meta.setAttribute('content', isDark ? '#131312' : '#F7F8F9');
    });
    localStorage.setItem('gym_theme', theme);
  }

  function toggleTheme() {
    const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
    setTheme(isDark ? 'light' : 'dark');
  }

  function setupEventListeners() {
    if (elements.memberSelect) {
      elements.memberSelect.addEventListener('change', (e) => {
        const selectedId = parseInt(e.target.value, 10);
        if (selectedId) setActiveMember(selectedId);
      });
    }

    if (elements.btnThemeToggle) {
      elements.btnThemeToggle.addEventListener('click', toggleTheme);
    }

    if (elements.btnPrevWeek) {
      elements.btnPrevWeek.addEventListener('click', () => {
        state.currentWeekStart = addDays(state.currentWeekStart, -7);
        fetchCalendar();
      });
    }

    if (elements.btnToday) {
      elements.btnToday.addEventListener('click', () => {
        state.currentWeekStart = getMonday(new Date());
        const today = new Date();
        state.selectedMobileDayIndex = (today.getDay() + 6) % 7;
        fetchCalendar();
      });
    }

    if (elements.btnNextWeek) {
      elements.btnNextWeek.addEventListener('click', () => {
        state.currentWeekStart = addDays(state.currentWeekStart, 7);
        fetchCalendar();
      });
    }

    if (elements.btnRules) {
      elements.btnRules.addEventListener('click', () => {
        if (elements.rulesModal) elements.rulesModal.classList.remove('hidden');
        if (elements.inputRuleText) elements.inputRuleText.focus();
      });
    }

    if (elements.formAddRule) {
      elements.formAddRule.addEventListener('submit', async (e) => {
        e.preventDefault();
        const text = elements.inputRuleText ? elements.inputRuleText.value.trim() : '';
        if (!text) return;
        const success = await addRule(text);
        if (success && elements.inputRuleText) {
          elements.inputRuleText.value = '';
          elements.inputRuleText.focus();
        }
      });
    }

    if (elements.rulesList) {
      elements.rulesList.addEventListener('click', async (e) => {
        const btn = e.target.closest('.btn-del-rule');
        if (btn) {
          const ruleId = parseInt(btn.dataset.id, 10);
          if (ruleId) {
            await deleteRule(ruleId);
          }
        }
      });
    }

    if (elements.btnCloseRulesModal) {
      elements.btnCloseRulesModal.addEventListener('click', () => {
        if (elements.rulesModal) elements.rulesModal.classList.add('hidden');
      });
    }

    if (elements.rulesModal) {
      elements.rulesModal.addEventListener('click', (e) => {
        if (e.target === elements.rulesModal) {
          elements.rulesModal.classList.add('hidden');
        }
      });
    }

    if (elements.btnManageMembers) {
      elements.btnManageMembers.addEventListener('click', () => {
        if (elements.membersModal) elements.membersModal.classList.remove('hidden');
        if (elements.inputMemberName) elements.inputMemberName.focus();
      });
    }

    if (elements.btnCloseModal) {
      elements.btnCloseModal.addEventListener('click', () => {
        if (elements.membersModal) elements.membersModal.classList.add('hidden');
      });
    }

    if (elements.membersModal) {
      elements.membersModal.addEventListener('click', (e) => {
        if (e.target === elements.membersModal) {
          elements.membersModal.classList.add('hidden');
        }
      });
    }

    if (elements.formAddMember) {
      elements.formAddMember.addEventListener('submit', async (e) => {
        e.preventDefault();
        const name = elements.inputMemberName.value.trim();
        const email = elements.inputMemberEmail.value.trim();
        if (!name) return;

        const success = await addMember(name, email);
        if (success) {
          elements.inputMemberName.value = '';
          elements.inputMemberEmail.value = '';
        }
      });
    }

    elements.membersList.addEventListener('click', (e) => {
      if (e.target.classList.contains('btn-del')) {
        const id = parseInt(e.target.dataset.id, 10);
        const name = e.target.dataset.name;
        removeMember(id, name);
      }
    });

    if (elements.btnInstallApp) {
      elements.btnInstallApp.addEventListener('click', async () => {
        if (deferredInstallPrompt) {
          deferredInstallPrompt.prompt();
          const { outcome } = await deferredInstallPrompt.userChoice;
          if (outcome === 'accepted') {
            elements.btnInstallApp.classList.add('hidden');
          }
          deferredInstallPrompt = null;
        } else if (isIOS()) {
          if (elements.iosInstallModal) elements.iosInstallModal.classList.remove('hidden');
        } else {
          showToast('To install, use browser menu -> Add to Home screen');
        }
      });
    }

    if (elements.btnCloseIosInstall) {
      elements.btnCloseIosInstall.addEventListener('click', () => {
        if (elements.iosInstallModal) elements.iosInstallModal.classList.add('hidden');
      });
    }

    if (elements.btnGotItIos) {
      elements.btnGotItIos.addEventListener('click', () => {
        if (elements.iosInstallModal) elements.iosInstallModal.classList.add('hidden');
      });
    }

    if (elements.iosInstallModal) {
      elements.iosInstallModal.addEventListener('click', (e) => {
        if (e.target === elements.iosInstallModal) {
          elements.iosInstallModal.classList.add('hidden');
        }
      });
    }

    // Feedback Modal & Submission
    const TARGET_FEEDBACK_EMAIL = 'fusetti.riccardo@gmail.com';

    function getMailtoFeedbackUrl(name, email, category, message) {
      const subject = encodeURIComponent(`[Wild Gym Feedback] ${category}${name ? ` - ${name}` : ''}`);
      let body = `Topic: ${category}\n`;
      if (name) body += `From: ${name}\n`;
      if (email) body += `Email: ${email}\n`;
      body += `Date: ${new Date().toLocaleString()}\n`;
      body += `\nMessage:\n${message || '(No message content)'}\n\n---\nSent via Wild Island Gym App`;
      return `mailto:${TARGET_FEEDBACK_EMAIL}?subject=${subject}&body=${encodeURIComponent(body)}`;
    }

    async function submitFeedback(name, email, category, message) {
      try {
        const response = await fetch('/api/feedback', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            member_name: name,
            email: email,
            category: category,
            message: message
          })
        });
        return response.ok;
      } catch (err) {
        console.warn('Feedback API sync error:', err);
        return false;
      }
    }

    function openFeedbackModal() {
      const activeMember = state.members.find(m => m.id === state.activeMemberId);
      if (activeMember) {
        if (elements.feedbackMemberName && !elements.feedbackMemberName.value) {
          elements.feedbackMemberName.value = activeMember.name || '';
        }
        if (elements.feedbackEmail && !elements.feedbackEmail.value && activeMember.email) {
          elements.feedbackEmail.value = activeMember.email || '';
        }
      }
      if (elements.feedbackModal) {
        elements.feedbackModal.classList.remove('hidden');
      }
      if (elements.feedbackMessage) {
        elements.feedbackMessage.focus();
      }
    }

    if (elements.btnFeedback) {
      elements.btnFeedback.addEventListener('click', openFeedbackModal);
    }

    if (elements.btnCloseFeedbackModal) {
      elements.btnCloseFeedbackModal.addEventListener('click', () => {
        if (elements.feedbackModal) elements.feedbackModal.classList.add('hidden');
      });
    }

    if (elements.feedbackModal) {
      elements.feedbackModal.addEventListener('click', (e) => {
        if (e.target === elements.feedbackModal) {
          elements.feedbackModal.classList.add('hidden');
        }
      });
    }

    if (elements.btnEmailClientDirect) {
      elements.btnEmailClientDirect.addEventListener('click', () => {
        const name = elements.feedbackMemberName ? elements.feedbackMemberName.value.trim() : '';
        const email = elements.feedbackEmail ? elements.feedbackEmail.value.trim() : '';
        const category = elements.feedbackCategory ? elements.feedbackCategory.value : 'General Feedback';
        const message = elements.feedbackMessage ? elements.feedbackMessage.value.trim() : '';
        const mailtoUrl = getMailtoFeedbackUrl(name, email, category, message);
        window.location.href = mailtoUrl;
      });
    }
    if (elements.formFeedback) {
      elements.formFeedback.addEventListener('submit', async (e) => {
        e.preventDefault();
        const name = elements.feedbackMemberName ? elements.feedbackMemberName.value.trim() : '';
        const email = elements.feedbackEmail ? elements.feedbackEmail.value.trim() : '';
        const category = elements.feedbackCategory ? elements.feedbackCategory.value : 'General Feedback';
        const message = elements.feedbackMessage ? elements.feedbackMessage.value.trim() : '';

        if (!message) {
          showToast('Please enter your feedback message');
          return;
        }

        // 1. Submit to server API
        await submitFeedback(name, email, category, message);

        // 2. Open email client prefilled for fusetti.riccardo@gmail.com
        const mailtoUrl = getMailtoFeedbackUrl(name, email, category, message);
        window.location.href = mailtoUrl;

        // 3. Show notification and close modal
        showToast('Feedback sent to fusetti.riccardo@gmail.com! Thank you.');
        if (elements.feedbackMessage) elements.feedbackMessage.value = '';
        if (elements.feedbackModal) elements.feedbackModal.classList.add('hidden');
      });
    }

    // ==========================================================================
    // Drawer Navigation Menu Handlers
    // ==========================================================================
    function openDrawer() {
      if (elements.sideMenuDrawer) elements.sideMenuDrawer.classList.remove('hidden');
      if (elements.menuDrawerBackdrop) elements.menuDrawerBackdrop.classList.remove('hidden');
      if (elements.btnMenuToggle) elements.btnMenuToggle.setAttribute('aria-expanded', 'true');
    }

    function closeDrawer() {
      if (elements.sideMenuDrawer) elements.sideMenuDrawer.classList.add('hidden');
      if (elements.menuDrawerBackdrop) elements.menuDrawerBackdrop.classList.add('hidden');
      if (elements.btnMenuToggle) elements.btnMenuToggle.setAttribute('aria-expanded', 'false');
    }

    if (elements.btnMenuToggle) {
      elements.btnMenuToggle.addEventListener('click', openDrawer);
    }

    if (elements.btnCloseDrawer) {
      elements.btnCloseDrawer.addEventListener('click', closeDrawer);
    }

    if (elements.menuDrawerBackdrop) {
      elements.menuDrawerBackdrop.addEventListener('click', closeDrawer);
    }

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        closeDrawer();
        if (elements.rulesModal) elements.rulesModal.classList.add('hidden');
        if (elements.membersModal) elements.membersModal.classList.add('hidden');
        if (elements.feedbackModal) elements.feedbackModal.classList.add('hidden');
        if (elements.guideModal) {
          elements.guideModal.classList.add('hidden');
        }
      }
    });

    if (elements.btnDrawerGuide) {
      elements.btnDrawerGuide.addEventListener('click', () => {
        closeDrawer();
        if (elements.guideModal) elements.guideModal.classList.remove('hidden');
      });
    }

    if (elements.btnCloseGuideModal) {
      elements.btnCloseGuideModal.addEventListener('click', () => {
        if (elements.guideModal) elements.guideModal.classList.add('hidden');
      });
    }

    if (elements.btnGuideDone) {
      elements.btnGuideDone.addEventListener('click', () => {
        if (elements.guideModal) elements.guideModal.classList.add('hidden');
      });
    }

    if (elements.guideModal) {
      elements.guideModal.addEventListener('click', (e) => {
        if (e.target === elements.guideModal) {
          elements.guideModal.classList.add('hidden');
        }
      });
    }

    if (elements.btnDrawerRules) {
      elements.btnDrawerRules.addEventListener('click', () => {
        closeDrawer();
        if (elements.rulesModal) elements.rulesModal.classList.remove('hidden');
        if (elements.inputRuleText) elements.inputRuleText.focus();
      });
    }

    if (elements.btnDrawerRoster) {
      elements.btnDrawerRoster.addEventListener('click', () => {
        closeDrawer();
        if (elements.membersModal) elements.membersModal.classList.remove('hidden');
        if (elements.inputMemberName) elements.inputMemberName.focus();
      });
    }

    if (elements.btnDrawerFeedback) {
      elements.btnDrawerFeedback.addEventListener('click', () => {
        closeDrawer();
        openFeedbackModal();
      });
    }

    if (elements.btnDrawerTheme) {
      elements.btnDrawerTheme.addEventListener('click', () => {
        toggleTheme();
      });
    }

    if (elements.btnDrawerInstall) {
      elements.btnDrawerInstall.addEventListener('click', () => {
        closeDrawer();
        if (deferredInstallPrompt) {
          deferredInstallPrompt.prompt();
          deferredInstallPrompt.userChoice.then(({ outcome }) => {
            if (outcome === 'accepted') {
              if (elements.btnInstallApp) elements.btnInstallApp.classList.add('hidden');
              if (elements.btnDrawerInstall) elements.btnDrawerInstall.classList.add('hidden');
            }
            deferredInstallPrompt = null;
          });
        } else if (isIOS()) {
          if (elements.iosInstallModal) elements.iosInstallModal.classList.remove('hidden');
        } else {
          showToast('To install, use browser menu -> Add to Home screen');
        }
      });
    }



    window.addEventListener('resize', () => {
      const isMobile = window.innerWidth <= 800;
      if (isMobile !== state.isMobileView) {
        state.isMobileView = isMobile;
        renderCalendar();
      }
    });

    setInterval(() => {
      fetchCalendar();
    }, 30000);
  }

  // ==========================================================================
  // PWA Service Worker & Seamless Auto-Updating
  // ==========================================================================
  let deferredInstallPrompt = null;
  let swRegistration = null;

  function isRunningStandalone() {
    return window.matchMedia('(display-mode: standalone)').matches || 
           window.navigator.standalone === true || 
           document.referrer.includes('android-app://');
  }

  function isIOS() {
    return /iphone|ipad|ipod/i.test(navigator.userAgent) && !window.MSStream;
  }

  function initPWA() {
    if (isRunningStandalone()) {
      if (elements.btnInstallApp) elements.btnInstallApp.classList.add('hidden');
    } else if (isIOS()) {
      if (elements.btnInstallApp) elements.btnInstallApp.classList.remove('hidden');
    }

    window.addEventListener('beforeinstallprompt', (e) => {
      e.preventDefault();
      deferredInstallPrompt = e;
      if (!isRunningStandalone() && elements.btnInstallApp) {
        elements.btnInstallApp.classList.remove('hidden');
      }
    });

    window.addEventListener('appinstalled', () => {
      deferredInstallPrompt = null;
      if (elements.btnInstallApp) elements.btnInstallApp.classList.add('hidden');
      showToast('Wild Gym installed successfully!');
    });

    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js', { updateViaCache: 'none' })
        .then((reg) => {
          swRegistration = reg;
          reg.update();

          reg.addEventListener('updatefound', () => {
            const newWorker = reg.installing;
            if (!newWorker) return;

            newWorker.addEventListener('statechange', () => {
              if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                newWorker.postMessage({ type: 'SKIP_WAITING' });
              }
            });
          });
        })
        .catch((err) => {
          console.warn('[PWA] ServiceWorker registration failed:', err);
        });

      let refreshing = false;
      navigator.serviceWorker.addEventListener('controllerchange', () => {
        if (!refreshing) {
          refreshing = true;
          showToast('App updated to latest version');
          setTimeout(() => {
            fetchCalendar();
            fetchRules();
            fetchMembers();
          }, 300);
        }
      });

      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') {
          if (swRegistration) swRegistration.update();
          fetchCalendar();
        }
      });

      setInterval(() => {
        if (swRegistration) swRegistration.update();
      }, 15 * 60 * 1000);
    }
  }

  async function init() {
    initTheme();
    const today = new Date();
    state.selectedMobileDayIndex = (today.getDay() + 6) % 7;

    setupEventListeners();
    initPWA();
    await fetchConfig();
    await fetchMembers();
    await fetchRules();
    await fetchCalendar();
  }

  init();
})();
