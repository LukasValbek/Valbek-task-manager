// Globální stav přihlášeného uživatele
let currentUser   = null
let currentProfile = null

// Vrátí přihlášeného uživatele (nebo null)
async function getSession() {
  const { data: { session } } = await db.auth.getSession()
  return session
}

// Načte profil z DB a uloží do currentProfile
async function loadProfile(userId) {
  const { data } = await db
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .single()
  currentProfile = data
  return data
}

// Přihlášení přes username + password
async function login(username, password) {
  const { data: email, error: rpcErr } = await db
    .rpc('get_email_by_username', { p_username: username.trim().toLowerCase() })

  if (rpcErr || !email) {
    throw new Error('Uživatel nenalezen.')
  }

  const { data, error } = await db.auth.signInWithPassword({ email, password })
  if (error) throw new Error('Špatné heslo nebo uživatelské jméno.')

  currentUser = data.user
  await loadProfile(data.user.id)
  return currentProfile
}

// Odhlášení
async function logout() {
  await db.auth.signOut()
  currentUser    = null
  currentProfile = null
  window.location.href = 'index.html'
}

// Reset hesla přes email (zadá username, email jde na skutečnou adresu)
async function requestPasswordReset(username) {
  const { data: email, error } = await db
    .rpc('get_email_by_username', { p_username: username.trim().toLowerCase() })

  if (error || !email) throw new Error('Uživatel nenalezen.')

  const { error: resetErr } = await db.auth.resetPasswordForEmail(email, {
    redirectTo: window.location.origin + '/index.html'
  })
  if (resetErr) throw resetErr
}

// Guard: volat na začátku každé chráněné stránky
// Pokud není session → přesměruje na login
// Vrátí profil přihlášeného uživatele
async function requireAuth() {
  const session = await getSession()
  if (!session) {
    window.location.href = 'index.html'
    return null
  }
  currentUser = session.user
  if (!currentProfile) {
    await loadProfile(session.user.id)
  }
  return currentProfile
}

// Guard pro login stránku: pokud je session → jdi na dashboard
async function redirectIfLoggedIn() {
  const session = await getSession()
  if (session) {
    window.location.href = 'dashboard.html'
  }
}

function isAdmin() {
  return currentProfile?.role === 'admin'
}
