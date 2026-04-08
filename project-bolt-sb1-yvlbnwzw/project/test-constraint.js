/**
 * Test Suite: Rank Penalty Constraint
 *
 * Purpose: Verify that rank_penalty is constrained between 0.1 and 1.0
 */

const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing Supabase credentials in .env file');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function setupTestUser() {
  const testEmail = `test-constraint-${Date.now()}@example.com`;
  const testPassword = 'TestPassword123!';

  const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
    email: testEmail,
    password: testPassword,
  });

  if (signUpError) throw signUpError;

  const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
    email: testEmail,
    password: testPassword,
  });

  if (signInError) throw signInError;

  return {
    user: signInData.user,
    session: signInData.session,
  };
}

async function cleanup(userId) {
  await supabase.from('posts').delete().eq('user_id', userId);
  await supabase.auth.admin.deleteUser(userId);
}

async function testConstraint() {
  console.log('🧪 Testing Rank Penalty Constraint\n');

  let testUser;

  try {
    testUser = await setupTestUser();
    console.log('✅ Test user created:', testUser.user.id);

    console.log('\n📋 Test 1: Attempt to insert rank_penalty = 0 (should be rejected)');
    const { error: error1 } = await supabase
      .from('posts')
      .insert({
        user_id: testUser.user.id,
        text: 'Test post with invalid penalty 0',
        post_type: 'social_post',
        status: 'published',
        rank_penalty: 0
      });

    if (error1) {
      console.log('   ✅ PASS: Insertion rejected with error:', error1.message);
    } else {
      console.log('   ❌ FAIL: Insertion should have been rejected');
    }

    console.log('\n📋 Test 2: Attempt to insert rank_penalty = 5.0 (should be rejected)');
    const { error: error2 } = await supabase
      .from('posts')
      .insert({
        user_id: testUser.user.id,
        text: 'Test post with invalid penalty 5.0',
        post_type: 'social_post',
        status: 'published',
        rank_penalty: 5.0
      });

    if (error2) {
      console.log('   ✅ PASS: Insertion rejected with error:', error2.message);
    } else {
      console.log('   ❌ FAIL: Insertion should have been rejected');
    }

    console.log('\n📋 Test 3: Attempt to insert rank_penalty = 0.05 (should be rejected)');
    const { error: error3 } = await supabase
      .from('posts')
      .insert({
        user_id: testUser.user.id,
        text: 'Test post with invalid penalty 0.05',
        post_type: 'social_post',
        status: 'published',
        rank_penalty: 0.05
      });

    if (error3) {
      console.log('   ✅ PASS: Insertion rejected with error:', error3.message);
    } else {
      console.log('   ❌ FAIL: Insertion should have been rejected');
    }

    console.log('\n📋 Test 4: Insert rank_penalty = 0.1 (minimum valid value)');
    const { data: data4, error: error4 } = await supabase
      .from('posts')
      .insert({
        user_id: testUser.user.id,
        text: 'Test post with valid penalty 0.1',
        post_type: 'social_post',
        status: 'published',
        rank_penalty: 0.1
      })
      .select()
      .single();

    if (error4) {
      console.log('   ❌ FAIL: Insertion should have succeeded:', error4.message);
    } else {
      console.log('   ✅ PASS: Post created with rank_penalty =', data4.rank_penalty);
    }

    console.log('\n📋 Test 5: Insert rank_penalty = 1.0 (maximum valid value)');
    const { data: data5, error: error5 } = await supabase
      .from('posts')
      .insert({
        user_id: testUser.user.id,
        text: 'Test post with valid penalty 1.0',
        post_type: 'social_post',
        status: 'published',
        rank_penalty: 1.0
      })
      .select()
      .single();

    if (error5) {
      console.log('   ❌ FAIL: Insertion should have succeeded:', error5.message);
    } else {
      console.log('   ✅ PASS: Post created with rank_penalty =', data5.rank_penalty);
    }

    console.log('\n📋 Test 6: Insert rank_penalty = 0.4 (mid-range valid value)');
    const { data: data6, error: error6 } = await supabase
      .from('posts')
      .insert({
        user_id: testUser.user.id,
        text: 'Test post with valid penalty 0.4',
        post_type: 'social_post',
        status: 'published',
        rank_penalty: 0.4
      })
      .select()
      .single();

    if (error6) {
      console.log('   ❌ FAIL: Insertion should have succeeded:', error6.message);
    } else {
      console.log('   ✅ PASS: Post created with rank_penalty =', data6.rank_penalty);
    }

    console.log('\n📋 Test 7: Insert without rank_penalty (should default to 1.0)');
    const { data: data7, error: error7 } = await supabase
      .from('posts')
      .insert({
        user_id: testUser.user.id,
        text: 'Test post with default penalty',
        post_type: 'social_post',
        status: 'published'
      })
      .select()
      .single();

    if (error7) {
      console.log('   ❌ FAIL: Insertion should have succeeded:', error7.message);
    } else if (data7.rank_penalty === 1.0) {
      console.log('   ✅ PASS: Post created with default rank_penalty = 1.0');
    } else {
      console.log('   ❌ FAIL: Default rank_penalty should be 1.0, got:', data7.rank_penalty);
    }

    console.log('\n✅ All constraint tests completed');

  } catch (error) {
    console.error('\n❌ Test failed with error:', error.message);
  } finally {
    if (testUser) {
      console.log('\n🧹 Cleaning up test data...');
      await cleanup(testUser.user.id);
      console.log('✅ Cleanup completed');
    }
  }
}

testConstraint().catch(console.error);
