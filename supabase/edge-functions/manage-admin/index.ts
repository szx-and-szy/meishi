import { createClient } from 'jsr:@supabase/supabase-js@2'

const supabaseUrl = Deno.env.get('SUPABASE_URL')!
const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

Deno.serve(async (req) => {
  if (req.method !== 'POST') {
    return new Response('Method Not Allowed', { status: 405 })
  }

  const authHeader = req.headers.get('Authorization')
  if (!authHeader) {
    return new Response('Missing Authorization header', { status: 401 })
  }

  const adminClient = createClient(supabaseUrl, serviceRoleKey)
  const token = authHeader.replace('Bearer ', '')
  const {
    data: { user: operator },
    error: operatorError,
  } = await adminClient.auth.getUser(token)

  if (operatorError || !operator) {
    return new Response('Unauthorized', { status: 401 })
  }

  const { data: operatorProfile } = await adminClient
    .from('users')
    .select('role')
    .eq('id', operator.id)
    .single()

  if (!operatorProfile || operatorProfile.role !== 'super_admin') {
    return new Response('Forbidden', { status: 403 })
  }

  const { student_id, action } = await req.json()
  if (!/^202[0-9][0-9]{4}$/.test(student_id)) {
    return new Response('Invalid student id', { status: 400 })
  }
  if (!['grant_admin', 'remove_admin'].includes(action)) {
    return new Response('Invalid action', { status: 400 })
  }

  const { data: targetUser } = await adminClient
    .from('users')
    .select('id, role')
    .eq('student_id', student_id)
    .single()

  if (!targetUser) {
    return new Response('User not found', { status: 404 })
  }

  const nextRole = action === 'grant_admin' ? 'admin' : 'user'

  const { error } = await adminClient
    .from('users')
    .update({ role: nextRole })
    .eq('id', targetUser.id)

  if (error) {
    return new Response(error.message, { status: 500 })
  }

  await adminClient.from('audit_logs').insert({
    target_type: 'user',
    target_id: targetUser.id,
    action,
    operator_id: operator.id,
    reason: `Super admin changed role to ${nextRole}`,
  })

  return Response.json({ success: true, role: nextRole })
})
