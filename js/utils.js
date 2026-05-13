// ── Avatar ────────────────────────────────────────────────────

const AVATAR_COLORS = [
  '#4F46E5', '#0891B2', '#059669', '#D97706',
  '#DC2626', '#7C3AED', '#DB2777', '#0284C7',
  '#65A30D', '#EA580C', '#0D9488', '#9333EA',
  '#BE185D', '#1D4ED8', '#B45309', '#047857',
]

function avatarColor(name) {
  let hash = 5381
  for (let i = 0; i < name.length; i++) {
    hash = ((hash << 5) + hash) ^ name.charCodeAt(i)
    hash = hash & 0x7fffffff
  }
  return AVATAR_COLORS[hash % AVATAR_COLORS.length]
}

function avatar(name, small = false, initials = null, color = null) {
  const text = (initials || name.slice(0, 2)).toUpperCase()
  const bg   = color || avatarColor(name)
  const cls  = small ? 'avatar avatar-sm' : 'avatar'
  return `<span class="${cls}" title="${esc(name)}" style="background:${bg}">${esc(text)}</span>`
}

// ── Formátování ──────────────────────────────────────────────

function formatDate(iso) {
  if (!iso) return '–'
  const d = new Date(iso)
  return d.toLocaleDateString('cs-CZ', { day: 'numeric', month: 'numeric', year: 'numeric' })
}

function formatDateTime(iso) {
  if (!iso) return '–'
  const d = new Date(iso)
  return d.toLocaleString('cs-CZ', { day: 'numeric', month: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

function isOverdue(dueDateStr) {
  if (!dueDateStr) return false
  return new Date(dueDateStr) < new Date(new Date().toDateString())
}

// ── Status ────────────────────────────────────────────────────

const STATUS_LABELS = {
  'neudělano':              'Neudělano',
  'rozpracováno':           'Rozpracováno',
  'připraveno ke kontrole': 'Ke kontrole',
  'hotovo':                 'Hotovo',
}

const STATUS_CLASS = {
  'neudělano':              'status-todo',
  'rozpracováno':           'status-inprogress',
  'připraveno ke kontrole': 'status-review',
  'hotovo':                 'status-done',
}

function statusBadge(status) {
  const label = STATUS_LABELS[status] || status
  const cls   = STATUS_CLASS[status]  || ''
  return `<span class="badge ${cls}">${label}</span>`
}

// ── Priorita ──────────────────────────────────────────────────

const PRIORITY_LABELS = { low: 'Nízká', medium: 'Střední', high: 'Vysoká' }
const PRIORITY_CLASS  = { low: 'priority-low', medium: 'priority-medium', high: 'priority-high' }

function priorityBadge(priority) {
  const label = PRIORITY_LABELS[priority] || priority
  const cls   = PRIORITY_CLASS[priority]  || ''
  return `<span class="badge ${cls}">${label}</span>`
}

// ── UI helpers ────────────────────────────────────────────────

function showToast(message, type = 'success') {
  const existing = document.querySelector('.toast')
  if (existing) existing.remove()

  const toast = document.createElement('div')
  toast.className = `toast toast-${type}`
  toast.textContent = message
  document.body.appendChild(toast)

  setTimeout(() => toast.classList.add('toast-visible'), 10)
  setTimeout(() => {
    toast.classList.remove('toast-visible')
    setTimeout(() => toast.remove(), 300)
  }, 3000)
}

function showError(message) { showToast(message, 'error') }

function setLoading(btn, loading) {
  if (loading) {
    btn.dataset.originalText = btn.textContent
    btn.disabled = true
    btn.textContent = 'Načítám…'
  } else {
    btn.disabled = false
    btn.textContent = btn.dataset.originalText || btn.textContent
  }
}

// ── Navigace ──────────────────────────────────────────────────

function renderNav(activePage) {
  const name = currentProfile?.name || ''
  const adminItems = isAdmin()
    ? `<button class="btn-link" onclick="navCreateProject()">+ Nový projekt</button>`
    : ''
  const reviewLink = isAdmin() ? `
    <a href="review.html" class="${activePage === 'review' ? 'active' : ''}">
      Ke kontrole<span id="review-badge" class="nav-badge hidden"></span>
    </a>` : ''

  return `
    <nav class="navbar">
      <div class="nav-brand">
        <img src="img/logo.png" alt="Valbek" class="nav-logo">
        <span class="nav-brand-text">VIZUALIZACE</span>
      </div>
      <div class="nav-links">
        <a href="dashboard.html" class="${activePage === 'dashboard' ? 'active' : ''}">Projekty</a>
        <a href="my-tasks.html"  class="${activePage === 'my-tasks'  ? 'active' : ''}">Moje úkoly</a>
        ${reviewLink}
        ${adminItems}
      </div>
      <div class="nav-user">
        <button class="notif-btn" id="notif-btn" onclick="toggleNotifDropdown()" title="Upozornění">
          🔔<span id="notif-badge" class="nav-badge hidden"></span>
        </button>
        <span>${esc(name)}</span>
        <button class="btn-link" onclick="logout()">Odhlásit</button>
      </div>
    </nav>
  `
}

async function updateReviewBadge() {
  if (!isAdmin()) return
  const badge = document.getElementById('review-badge')
  if (!badge) return
  const { count } = await db
    .from('tasks')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'připraveno ke kontrole')
  if (count > 0) {
    badge.textContent = count
    badge.classList.remove('hidden')
  } else {
    badge.classList.add('hidden')
  }
}

function initReviewBadge() {
  if (!isAdmin()) return
  updateReviewBadge()
  db.channel('review-badge-watch')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'tasks' }, updateReviewBadge)
    .subscribe()
}

// ── Modální okno ──────────────────────────────────────────────

let _modalEscHandler = null
let _pendingConfirmResolve = null

function openModal(content, modalClass = '') {
  let overlay = document.getElementById('modal-overlay')
  if (!overlay) {
    overlay = document.createElement('div')
    overlay.id = 'modal-overlay'
    overlay.className = 'modal-overlay'
    overlay.addEventListener('click', e => {
      if (e.target === overlay) closeModal()
    })
    document.body.appendChild(overlay)
  }
  overlay.innerHTML = `<div class="modal ${modalClass}">${content}</div>`
  overlay.classList.add('active')
  document.body.style.overflow = 'hidden'

  if (_modalEscHandler) document.removeEventListener('keydown', _modalEscHandler)
  _modalEscHandler = e => { if (e.key === 'Escape') closeModal() }
  document.addEventListener('keydown', _modalEscHandler)
}

function closeModal() {
  const overlay = document.getElementById('modal-overlay')
  if (overlay) {
    overlay.classList.remove('active')
    document.body.style.overflow = ''
  }
  if (_modalEscHandler) {
    document.removeEventListener('keydown', _modalEscHandler)
    _modalEscHandler = null
  }
  if (_pendingConfirmResolve) {
    const fn = _pendingConfirmResolve
    _pendingConfirmResolve = null
    fn(false)
  }
}

function confirmDialog(message, { confirmLabel = 'Potvrdit', cancelLabel = 'Zrušit', danger = false } = {}) {
  return new Promise(resolve => {
    _pendingConfirmResolve = resolve
    openModal(`
      <p style="font-size:1rem;margin:4px 0 24px">${esc(message)}</p>
      <div class="modal-actions">
        <button class="btn btn-secondary" onclick="_resolveConfirm(false)">${esc(cancelLabel)}</button>
        <button class="btn ${danger ? 'btn-danger' : 'btn-primary'}" onclick="_resolveConfirm(true)">${esc(confirmLabel)}</button>
      </div>
    `, 'modal-sm')
  })
}

function _resolveConfirm(val) {
  const fn = _pendingConfirmResolve
  _pendingConfirmResolve = null
  closeModal()
  if (fn) fn(val)
}

function debounce(fn, delay) {
  let timer
  return (...args) => { clearTimeout(timer); timer = setTimeout(() => fn(...args), delay) }
}

// ── Escape ────────────────────────────────────────────────────

function esc(str) {
  if (!str) return ''
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

// ── Select options helpers ────────────────────────────────────

function statusOptions(selected) {
  return Object.entries(STATUS_LABELS).map(([val, label]) =>
    `<option value="${val}" ${selected === val ? 'selected' : ''}>${label}</option>`
  ).join('')
}

function priorityOptions(selected) {
  return Object.entries(PRIORITY_LABELS).map(([val, label]) =>
    `<option value="${val}" ${selected === val ? 'selected' : ''}>${label}</option>`
  ).join('')
}

function memberOptions(profiles, selected) {
  return profiles.map(p =>
    `<option value="${p.id}" ${selected === p.id ? 'selected' : ''}>${esc(p.name)}</option>`
  ).join('')
}

// ── Cesta k souboru ──────────────────────────────────────────

async function copyPath(text) {
  try {
    await navigator.clipboard.writeText(text)
    showToast('Cesta zkopírována!')
  } catch {
    showError('Kopírování se nezdařilo – zkopírujte ručně.')
  }
}

// ── Inline editace buňky tabulky ─────────────────────────────

function navCreateProject() {
  if (typeof openCreateProject === 'function') {
    openCreateProject()
  } else {
    window.location.href = 'dashboard.html?new'
  }
}

async function inlineStatus(event, taskId, currentStatus) {
  event.stopPropagation()
  const cell = event.currentTarget
  const original = cell.innerHTML
  let saved = false

  cell.innerHTML = `<select class="inline-select" onclick="event.stopPropagation()">${statusOptions(currentStatus)}</select>`
  const sel = cell.querySelector('select')
  sel.focus()

  sel.addEventListener('change', async () => {
    if (saved) return; saved = true
    const val = sel.value
    const { error } = await db.from('tasks').update({ status: val, updated_by: currentProfile.id }).eq('id', taskId)
    if (error) { showError(error.message); cell.innerHTML = original; return }
    cell.innerHTML = statusBadge(val)
    showToast('Stav uložen.')
  })
  sel.addEventListener('blur', () => { if (!saved) cell.innerHTML = original })
}

async function inlinePriority(event, taskId, currentPriority) {
  event.stopPropagation()
  const cell = event.currentTarget
  const original = cell.innerHTML
  let saved = false

  cell.innerHTML = `<select class="inline-select" onclick="event.stopPropagation()">${priorityOptions(currentPriority)}</select>`
  const sel = cell.querySelector('select')
  sel.focus()

  sel.addEventListener('change', async () => {
    if (saved) return; saved = true
    const val = sel.value
    const { error } = await db.from('tasks').update({ priority: val, updated_by: currentProfile.id }).eq('id', taskId)
    if (error) { showError(error.message); cell.innerHTML = original; return }
    cell.innerHTML = priorityBadge(val)
    showToast('Priorita uložena.')
  })
  sel.addEventListener('blur', () => { if (!saved) cell.innerHTML = original })
}

// ── Notifikace ────────────────────────────────────────────────

async function loadNotifications() {
  const { data } = await db
    .from('notifications')
    .select('*')
    .eq('user_id', currentProfile.id)
    .order('created_at', { ascending: false })
    .limit(50)
  const list = data || []
  updateNotifBadge(list.filter(n => !n.is_read).length)
  return list
}

function updateNotifBadge(count) {
  const badge = document.getElementById('notif-badge')
  if (!badge) return
  if (count > 0) {
    badge.textContent = count > 9 ? '9+' : count
    badge.classList.remove('hidden')
  } else {
    badge.classList.add('hidden')
  }
}

async function toggleNotifDropdown() {
  const existing = document.getElementById('notif-dropdown')
  if (existing) { existing.remove(); return }

  const notifications = await loadNotifications()

  const btn = document.getElementById('notif-btn')
  const dropdown = document.createElement('div')
  dropdown.id = 'notif-dropdown'
  dropdown.className = 'notif-dropdown'
  dropdown.innerHTML = `
    <div class="notif-header">
      <strong>Upozornění</strong>
      ${notifications.some(n => !n.is_read)
        ? `<button class="btn-link" onclick="markAllNotifsRead()">Přečíst vše</button>`
        : ''}
    </div>
    <div class="notif-list">
      ${notifications.length === 0
        ? '<p class="notif-empty">Žádná upozornění.</p>'
        : notifications.map(n => `
          <div class="notif-item ${n.is_read ? '' : 'notif-unread'}"
               data-id="${n.id}"
               onclick="openNotif('${n.project_id || ''}','${n.id}')">
            <div class="notif-message">${esc(n.message)}</div>
            <div class="notif-time">${formatDateTime(n.created_at)}</div>
          </div>
        `).join('')}
    </div>
  `

  document.body.appendChild(dropdown)

  const rect = btn.getBoundingClientRect()
  dropdown.style.top  = (rect.bottom + 6) + 'px'
  dropdown.style.right = (window.innerWidth - rect.right) + 'px'

  setTimeout(() => {
    document.addEventListener('click', function closeDropdown(e) {
      if (!dropdown.contains(e.target) && e.target !== btn && !btn.contains(e.target)) {
        dropdown.remove()
        document.removeEventListener('click', closeDropdown)
      }
    })
  }, 0)
}

async function openNotif(projId, notifId) {
  await db.from('notifications').update({ is_read: true }).eq('id', notifId)
  document.getElementById('notif-dropdown')?.remove()
  await loadNotifications()
  if (projId) window.location.href = `project.html#${projId}`
}

async function markAllNotifsRead() {
  await db.from('notifications')
    .update({ is_read: true })
    .eq('user_id', currentProfile.id)
    .eq('is_read', false)
  document.getElementById('notif-dropdown')?.remove()
  updateNotifBadge(0)
}

function initNotifications() {
  loadNotifications()
  db.channel('notif-realtime')
    .on('postgres_changes', {
      event: 'INSERT', schema: 'public', table: 'notifications',
      filter: `user_id=eq.${currentProfile.id}`
    }, () => loadNotifications())
    .subscribe()
}

async function inlineDueDate(event, taskId, currentDue) {
  event.stopPropagation()
  const cell = event.currentTarget
  const original = cell.innerHTML
  let saved = false

  cell.innerHTML = `<input type="date" class="inline-date" value="${currentDue || ''}" onclick="event.stopPropagation()">`
  const input = cell.querySelector('input')
  input.focus()

  const save = async () => {
    if (saved) return; saved = true
    const val = input.value || null
    const { error } = await db.from('tasks').update({ due_date: val, updated_by: currentProfile.id }).eq('id', taskId)
    if (error) { showError(error.message); cell.innerHTML = original; return }
    const overdue = isOverdue(val)
    cell.className = `editable-cell${overdue ? ' overdue-text' : ''}`
    cell.textContent = formatDate(val)
    showToast('Termín uložen.')
  }
  input.addEventListener('change', save)
  input.addEventListener('blur', () => { if (!saved) cell.innerHTML = original })
}
