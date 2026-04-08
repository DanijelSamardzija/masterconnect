/**
 * Test Suite: Rank Penalty Feed Sorting
 *
 * Purpose: Verify that rank_penalty affects post ordering in feed
 *
 * Test Cases:
 * 1. Same timestamp: rank_penalty 1.0 vs 0.4 → 1.0 should be higher
 * 2. Different timestamps: older (1.0) vs newer (0.4) → newer usually wins but penalty matters
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
  const testEmail = `test-rank-${Date.now()}@example.com`;
  const testPassword = 'TestPassword123!';

  const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
    email: testEmail,
    password: testPassword,
  });

  if (signUpError) {
    console.error('❌ Failed to create test user:', signUpError.message);
    process.exit(1);
  }

  const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
    email: testEmail,
    password: testPassword,
  });

  if (signInError) {
    console.error('❌ Failed to sign in test user:', signInError.message);
    process.exit(1);
  }

  return {
    user: signInData.user,
    session: signInData.session,
  };
}

async function insertTestPost(userId, text, rankPenalty, timestampOffset = 0) {
  const createdAt = new Date(Date.now() + timestampOffset);

  const insertData = {
    user_id: userId,
    text: text,
    post_type: 'social_post',
    status: 'published',
    spam_score: rankPenalty === 1.0 ? 10 : 60,
    rank_penalty: rankPenalty,
  };

  if (timestampOffset !== 0) {
    insertData.created_at = createdAt.toISOString();
  }

  const { data, error } = await supabase
    .from('posts')
    .insert(insertData)
    .select()
    .single();

  if (error) {
    console.error('❌ Failed to insert test post:', error.message);
    throw error;
  }

  return data;
}

async function getFeed(userId, accessToken) {
  const { data, error } = await supabase.rpc('get_feed_with_ranking', {
    p_user_id: userId,
    p_city: null,
    p_category: null,
    p_limit: 50,
    p_offset: 0,
  });

  if (error) {
    console.error('❌ Failed to get feed:', error.message);
    throw error;
  }

  return data;
}

async function cleanup(userId, postIds) {
  await supabase.from('posts').delete().in('id', postIds);
  await supabase.from('profiles').delete().eq('id', userId);
  await supabase.auth.admin.deleteUser(userId);
}

async function runTests() {
  console.log('🧪 Starting Rank Penalty Tests\n');

  let testUser = null;
  let testPostIds = [];

  try {
    testUser = await setupTestUser();
    console.log('✅ Test user created:', testUser.user.id);

    console.log('\n📋 Test 1: Same Timestamp - Different Penalties');
    console.log('   Creating 2 posts at same time:');
    console.log('   - Post A: rank_penalty = 1.0 (good)');
    console.log('   - Post B: rank_penalty = 0.4 (penalized)');

    const sameTime = Date.now();
    const postA = await insertTestPost(testUser.user.id, 'Post with rank_penalty 1.0', 1.0, 0);
    await new Promise(resolve => setTimeout(resolve, 10));
    const postB = await insertTestPost(testUser.user.id, 'Post with rank_penalty 0.4', 0.4, 0);

    testPostIds.push(postA.id, postB.id);

    console.log(`   Post A ID: ${postA.id}`);
    console.log(`   Post B ID: ${postB.id}`);

    await new Promise(resolve => setTimeout(resolve, 1000));

    const feed1 = await getFeed(testUser.user.id, testUser.session.access_token);
    const userPosts = feed1.filter(p => p.user_id === testUser.user.id);

    console.log(`\n   Feed returned ${userPosts.length} posts from test user`);

    if (userPosts.length >= 2) {
      const indexA = userPosts.findIndex(p => p.id === postA.id);
      const indexB = userPosts.findIndex(p => p.id === postB.id);

      console.log(`   Post A (penalty 1.0) position: ${indexA}`);
      console.log(`   Post B (penalty 0.4) position: ${indexB}`);
      console.log(`   Post A effective_rank: ${userPosts[indexA]?.effective_rank}`);
      console.log(`   Post B effective_rank: ${userPosts[indexB]?.effective_rank}`);

      if (indexA < indexB) {
        console.log('   ✅ PASS: Post with higher penalty (1.0) appears before lower penalty (0.4)');
      } else {
        console.log('   ❌ FAIL: Post with lower penalty (0.4) appears before higher penalty (1.0)');
      }
    } else {
      console.log('   ⚠️  WARNING: Could not find both test posts in feed');
    }

    console.log('\n📋 Test 2: Different Timestamps - Penalty Effect Over Time');
    console.log('   Creating 2 posts:');
    console.log('   - Post C: 10 minutes old, rank_penalty = 1.0');
    console.log('   - Post D: 1 minute old, rank_penalty = 0.4');

    const postC = await insertTestPost(testUser.user.id, 'Older post rank_penalty 1.0', 1.0, -10 * 60 * 1000);
    await new Promise(resolve => setTimeout(resolve, 10));
    const postD = await insertTestPost(testUser.user.id, 'Newer post rank_penalty 0.4', 0.4, -1 * 60 * 1000);

    testPostIds.push(postC.id, postD.id);

    console.log(`   Post C ID: ${postC.id} (older)`);
    console.log(`   Post D ID: ${postD.id} (newer)`);

    await new Promise(resolve => setTimeout(resolve, 1000));

    const feed2 = await getFeed(testUser.user.id, testUser.session.access_token);
    const userPosts2 = feed2.filter(p => p.user_id === testUser.user.id);

    console.log(`\n   Feed returned ${userPosts2.length} posts from test user`);

    if (userPosts2.length >= 2) {
      const indexC = userPosts2.findIndex(p => p.id === postC.id);
      const indexD = userPosts2.findIndex(p => p.id === postD.id);

      console.log(`   Post C (older, penalty 1.0) position: ${indexC}`);
      console.log(`   Post D (newer, penalty 0.4) position: ${indexD}`);
      console.log(`   Post C effective_rank: ${userPosts2[indexC]?.effective_rank}`);
      console.log(`   Post D effective_rank: ${userPosts2[indexD]?.effective_rank}`);

      const effectiveRankC = parseFloat(userPosts2[indexC]?.effective_rank || '0');
      const effectiveRankD = parseFloat(userPosts2[indexD]?.effective_rank || '0');

      console.log('\n   Analysis:');
      console.log(`   - Post C created_at: ${new Date(postC.created_at).toISOString()}`);
      console.log(`   - Post D created_at: ${new Date(postD.created_at).toISOString()}`);
      console.log(`   - Post C effective_rank: ${effectiveRankC} (10 min old * 1.0 penalty)`);
      console.log(`   - Post D effective_rank: ${effectiveRankD} (1 min old * 0.4 penalty)`);

      if (indexD < indexC) {
        console.log('   ✅ PASS: Newer post (with penalty) appears higher due to recency advantage');
      } else {
        console.log('   ❌ FAIL: Older post ranking higher than newer post (recency should win)');
      }

      if (effectiveRankD > effectiveRankC) {
        console.log('   ✅ PASS: Newer penalized post has higher effective rank than older normal post');
        console.log('   ✅ This confirms recency advantage is working correctly');
      } else {
        console.log('   ❌ FAIL: Newer penalized post should have higher rank due to recency');
      }

      const ageDifferenceMinutes = 9;
      const penaltyRatio = 0.4 / 1.0;
      console.log(`\n   Penalty Effect:`);
      console.log(`   - As time passes, penalized posts (0.4) decay ${((1 - penaltyRatio) * 100).toFixed(0)}% faster`);
      console.log(`   - Over ${ageDifferenceMinutes} minutes, penalty reduces rank by ~${(penaltyRatio * 100).toFixed(0)}%`);
      console.log(`   - This makes spam posts sink faster while keeping fresh content on top`);
    } else {
      console.log('   ⚠️  WARNING: Could not find both test posts in feed');
    }

    console.log('\n✅ All tests completed');

  } catch (error) {
    console.error('\n❌ Test failed with error:', error.message);
  } finally {
    if (testUser && testPostIds.length > 0) {
      console.log('\n🧹 Cleaning up test data...');
      await cleanup(testUser.user.id, testPostIds);
      console.log('✅ Cleanup completed');
    }
  }
}

runTests().catch(console.error);
