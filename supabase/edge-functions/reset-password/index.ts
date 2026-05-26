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

  if (!operatorProfile || !['admin', 'super_admin'].includes(operatorProfile.role)) {
    return new Response('Forbidden', { status: 403 })
  }

  const { student_id } = await req.json()
  if (!/^202[0-9][0-9]{4}$/.test(student_id)) {
    return new Response('Invalid student id', { status: 400 })
  }

  const { data: targetUser } = await adminClient
    .from('users')
    .select('id, student_id')
    .eq('student_id', student_id)
    .single()

  if (!targetUser) {
    return new Response('User not found', { status: 404 })
  }

  const { error: updateError } = await adminClient.auth.admin.updateUserById(targetUser.id, {
    password: student_id,
  })

  if (updateError) {
    return new Response(updateError.message, { status: 500 })
  }

  await adminClient.from('audit_logs').insert({
    target_type: 'user',
    target_id: targetUser.id,
    action: 'reset_password',
    operator_id: operator.id,
    reason: 'Admin reset password to student id',
  })

  return Response.json({ success: true, reset_to: student_id })
})
