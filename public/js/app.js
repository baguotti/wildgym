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
    rules: []
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
    btnEditRules: document.getElementById('btn-edit-rules'),
    rulesViewContainer: document.getElementById('rules-view-container'),
    rulesEditContainer: document.getElementById('rules-edit-container'),
    rulesList: document.getElementById('rules-list'),
    rulesEditList: document.getElementById('rules-edit-list'),
    btnAddRuleRow: document.getElementById('btn-add-rule-row'),
    btnCancelRulesEdit: document.getElementById('btn-cancel-rules-edit'),
    btnSaveRules: document.getElementById('btn-save-rules'),
    formAddMember: document.getElementById('form-add-member'),
    inputMemberName: document.getElementById('input-member-name'),
    inputMemberEmail: document.getElementById('input-member-email'),
    membersList: document.getElementById('members-list'),
    membersCount: document.getElementById('members-count'),
    toastContainer: document.getElementById('toast-container')
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
        renderCalendar();
        updateMyBookingsSummary();
      }
    } catch (e) {
      showToast('Error loading schedule');
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
        renderRulesView();
      }
    } catch (e) {
      console.error('Failed to fetch rules', e);
    }
  }

  async function saveRules(rulesArray) {
    try {
      const res = await fetch('/api/rules', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rules: rulesArray })
      });
      if (res.ok) {
        const data = await res.json();
        state.rules = data.rules || rulesArray;
        renderRulesView();
        toggleRulesEditMode(false);
        showToast('Rules updated');
      } else {
        const err = await res.json();
        showToast(err.error || 'Failed to save rules');
      }
    } catch (e) {
      showToast('Network error');
    }
  }

  function renderRulesView() {
    elements.rulesList.innerHTML = '';
    if (state.rules.length === 0) {
      elements.rulesList.innerHTML = '<p style="color:var(--ink-muted); padding:8px 0;">No rules set.</p>';
      return;
    }

    state.rules.forEach((r) => {
      const item = document.createElement('div');
      item.className = 'rule-item';
      item.innerHTML = `
        <span class="rule-tag">${escapeHTML(r.category || 'Rule')}</span>
        <div class="rule-content">
          <div class="rule-title">${escapeHTML(r.title)}</div>
          ${r.subtitle ? `<div class="rule-sub">${escapeHTML(r.subtitle)}</div>` : ''}
        </div>
      `;
      elements.rulesList.appendChild(item);
    });
  }

  function toggleRulesEditMode(isEdit) {
    if (isEdit) {
      elements.rulesViewContainer.classList.add('hidden');
      elements.rulesEditContainer.classList.remove('hidden');
      elements.btnEditRules.classList.add('hidden');
      renderRulesEdit();
    } else {
      elements.rulesViewContainer.classList.remove('hidden');
      elements.rulesEditContainer.classList.add('hidden');
      elements.btnEditRules.classList.remove('hidden');
    }
  }

  function renderRulesEdit() {
    elements.rulesEditList.innerHTML = '';
    state.rules.forEach((r) => {
      elements.rulesEditList.appendChild(createRuleEditRow(r.category, r.title, r.subtitle));
    });
    if (state.rules.length === 0) {
      elements.rulesEditList.appendChild(createRuleEditRow('Rule', '', ''));
    }
  }

  function createRuleEditRow(category = 'Rule', title = '', subtitle = '') {
    const row = document.createElement('div');
    row.className = 'rule-edit-row';
    row.innerHTML = `
      <div class="rule-edit-fields">
        <div class="rule-edit-top">
          <input type="text" class="rule-edit-cat" placeholder="Tag" value="${escapeHTML(category)}" maxlength="25">
          <input type="text" class="rule-edit-title" placeholder="Rule headline" value="${escapeHTML(title)}" maxlength="100">
        </div>
        <input type="text" class="rule-edit-sub" placeholder="Description / details (optional)" value="${escapeHTML(subtitle)}" maxlength="200">
      </div>
      <button class="btn-delete-rule" type="button" title="Delete rule">&times;</button>
    `;
    return row;
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
    elements.membersCount.textContent = state.members.length;
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
      
      const cell = document.createElement('div');
      let cellClasses = ['slot-cell'];
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

      const timeGutter = document.createElement('div');
      timeGutter.className = 'time-gutter';
      timeGutter.textContent = timeSlot;
      elements.calendarGrid.appendChild(timeGutter);

      for (let dayIdx = 0; dayIdx < 7; dayIdx++) {
        const date = addDays(state.currentWeekStart, dayIdx);
        const dateISO = formatDateISO(date);
        const dayBookings = state.calendarData[dateISO] || {};
        const bookingsInSlot = dayBookings[timeSlot] || [];
        const isBooked = bookingsInSlot.some(b => b.member_id === state.activeMemberId);
        const isFull = bookingsInSlot.length >= state.maxCapacity;
        const hasAttendees = bookingsInSlot.length > 0;

        const slotCell = document.createElement('div');
        let slotClasses = ['slot-cell'];
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

    const myBooking = bookings.find((b) => b.member_id === state.activeMemberId);
    const isBookedByMe = !!myBooking;

    // Compact Top Row: Mobile time + Count
    const topRow = document.createElement('div');
    topRow.className = 'slot-top-row';
    topRow.innerHTML = `
      <span class="slot-time-mini">${displayTime}</span>
      <span class="slot-capacity-pill ${isBookedByMe ? 'mine' : ''}">${isBookedByMe ? 'You' : `${bookedCount}/${state.maxCapacity}`}</span>
    `;
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
        tag.textContent = isMe ? 'You' : b.member_name.split(' ')[0];
        tag.title = b.member_name;
        attendeesWrap.appendChild(tag);
      });
    }
    card.appendChild(attendeesWrap);

    // Action button
    const actionBtn = document.createElement('button');
    const isPast = dateISO < todayISO;

    if (isPast) {
      actionBtn.className = 'slot-btn btn-disabled';
      actionBtn.textContent = '—';
      actionBtn.disabled = true;
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
    const todayISO = formatDateISO(new Date());

    Object.keys(state.calendarData).forEach((dateKey) => {
      if (dateKey >= todayISO) {
        const daySlots = state.calendarData[dateKey];
        Object.values(daySlots).forEach((bookings) => {
          if (bookings.some((b) => b.member_id === state.activeMemberId)) {
            count++;
          }
        });
      }
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
    if (theme === 'dark') {
      document.documentElement.setAttribute('data-theme', 'dark');
      elements.themeIcon.textContent = '◐';
    } else {
      document.documentElement.removeAttribute('data-theme');
      elements.themeIcon.textContent = '◑';
    }
    localStorage.setItem('gym_theme', theme);
  }

  function toggleTheme() {
    const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
    setTheme(isDark ? 'light' : 'dark');
  }

  function setupEventListeners() {
    elements.memberSelect.addEventListener('change', (e) => {
      const selectedId = parseInt(e.target.value, 10);
      if (selectedId) setActiveMember(selectedId);
    });

    elements.btnThemeToggle.addEventListener('click', toggleTheme);

    elements.btnPrevWeek.addEventListener('click', () => {
      state.currentWeekStart = addDays(state.currentWeekStart, -7);
      fetchCalendar();
    });

    elements.btnToday.addEventListener('click', () => {
      state.currentWeekStart = getMonday(new Date());
      const today = new Date();
      state.selectedMobileDayIndex = (today.getDay() + 6) % 7;
      fetchCalendar();
    });

    elements.btnNextWeek.addEventListener('click', () => {
      state.currentWeekStart = addDays(state.currentWeekStart, 7);
      fetchCalendar();
    });

    elements.btnRules.addEventListener('click', () => {
      toggleRulesEditMode(false);
      elements.rulesModal.classList.remove('hidden');
    });

    elements.btnCloseRulesModal.addEventListener('click', () => {
      elements.rulesModal.classList.add('hidden');
    });

    elements.rulesModal.addEventListener('click', (e) => {
      if (e.target === elements.rulesModal) {
        elements.rulesModal.classList.add('hidden');
      }
    });

    elements.btnEditRules.addEventListener('click', () => {
      toggleRulesEditMode(true);
    });

    elements.btnCancelRulesEdit.addEventListener('click', () => {
      toggleRulesEditMode(false);
    });

    elements.btnAddRuleRow.addEventListener('click', () => {
      const newRow = createRuleEditRow('Rule', '', '');
      elements.rulesEditList.appendChild(newRow);
      const titleInput = newRow.querySelector('.rule-edit-title');
      if (titleInput) titleInput.focus();
    });

    elements.rulesEditList.addEventListener('click', (e) => {
      if (e.target.classList.contains('btn-delete-rule')) {
        const row = e.target.closest('.rule-edit-row');
        if (row) row.remove();
      }
    });

    elements.btnSaveRules.addEventListener('click', () => {
      const rows = elements.rulesEditList.querySelectorAll('.rule-edit-row');
      const updatedRules = [];
      rows.forEach((row) => {
        const cat = row.querySelector('.rule-edit-cat').value.trim();
        const title = row.querySelector('.rule-edit-title').value.trim();
        const sub = row.querySelector('.rule-edit-sub').value.trim();
        if (title) {
          updatedRules.push({
            category: cat || 'Rule',
            title: title,
            subtitle: sub
          });
        }
      });
      if (updatedRules.length === 0) {
        showToast('Please provide at least 1 rule');
        return;
      }
      saveRules(updatedRules);
    });

    elements.btnManageMembers.addEventListener('click', () => {
      elements.membersModal.classList.remove('hidden');
      elements.inputMemberName.focus();
    });

    elements.btnCloseModal.addEventListener('click', () => {
      elements.membersModal.classList.add('hidden');
    });

    elements.membersModal.addEventListener('click', (e) => {
      if (e.target === elements.membersModal) {
        elements.membersModal.classList.add('hidden');
      }
    });

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

    elements.membersList.addEventListener('click', (e) => {
      if (e.target.classList.contains('btn-del')) {
        const id = parseInt(e.target.dataset.id, 10);
        const name = e.target.dataset.name;
        removeMember(id, name);
      }
    });

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

  async function init() {
    initTheme();
    const today = new Date();
    state.selectedMobileDayIndex = (today.getDay() + 6) % 7;

    setupEventListeners();
    await fetchConfig();
    await fetchMembers();
    await fetchRules();
    await fetchCalendar();
  }

  init();
})();
