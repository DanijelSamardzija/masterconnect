const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://xgtcmistiacinfyfvmkc.supabase.co';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseServiceKey) {
  console.error('SUPABASE_SERVICE_ROLE_KEY environment variable is required');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function createUser() {
  const email = 'dssama08@gmail.com';
  const password = 'dragan123';
  const name = 'Dragan Kis';

  const { data: authData, error: authError } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: {
      name
    }
  });

  if (authError) {
    console.error('Error creating user:', authError);
    return;
  }

  console.log('User created successfully!');
  console.log('Email:', email);
  console.log('Password:', password);
  console.log('User ID:', authData.user.id);

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', authData.user.id)
    .single();

  if (profileError) {
    console.error('Error fetching profile:', profileError);
  } else {
    console.log('Profile created:', profile);
  }
}

createUser();
