import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  const json = (body: object, status = 200) =>
    new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) return json({ error: 'Unauthorized' }, 401)

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    )

    // Ověř, že volající je admin
    const { data: { user: caller }, error: authErr } = await supabaseAdmin.auth.getUser(
      authHeader.replace('Bearer ', '')
    )
    if (authErr || !caller) return json({ error: 'Unauthorized' }, 401)

    const { data: callerProfile } = await supabaseAdmin
      .from('profiles')
      .select('role')
      .eq('id', caller.id)
      .single()
    if (callerProfile?.role !== 'admin') return json({ error: 'Forbidden – pouze admin může vytvářet uživatele.' }, 403)

    // Načti data z požadavku
    const { username, name, email, password, role } = await req.json()
    if (!username || !name || !email || !password) return json({ error: 'Chybí povinné pole.' }, 400)
    if (!/^[a-z0-9_]+$/.test(username)) return json({ error: 'Uživatelské jméno smí obsahovat jen malá písmena, číslice a _' }, 400)
    if (password.length < 6) return json({ error: 'Heslo musí mít alespoň 6 znaků.' }, 400)

    // Vytvoř auth uživatele
    const { data: newUser, error: createErr } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    })
    if (createErr) return json({ error: createErr.message }, 400)

    // Vlož profil
    const { error: profileErr } = await supabaseAdmin.from('profiles').insert({
      id:       newUser.user.id,
      username: username.toLowerCase(),
      name,
      role:     role === 'admin' ? 'admin' : 'user',
    })

    if (profileErr) {
      // Rollback: smaž auth uživatele pokud se nepodařilo vložit profil
      await supabaseAdmin.auth.admin.deleteUser(newUser.user.id)
      return json({ error: profileErr.message }, 400)
    }

    return json({ success: true, userId: newUser.user.id })
  } catch (err) {
    return json({ error: err.message }, 500)
  }
})
