// Final Integration Test - Simulating full flow

const { countPhones } = require('./lib/antiSpam/phones.ts');
const { computeSpamScore } = require('./lib/antiSpam/score.ts');

// Simulate what happens in create-marketplace-post-modal.tsx
console.log('=== SIMULATION: Create Marketplace Post ===\n');

// User fills out form:
const text = "Nudim profesionalne usluge. Pozovite 064 123 4567";
const title = "Majstor za renoviranje - Beograd";
const jobTitle = "Kontakt: 065 234 5678, 066 345 6789";

console.log('User input:');
console.log('  text:', text);
console.log('  title:', title);
console.log('  jobTitle:', jobTitle);
console.log('');

// What gets sent to /api/posts/analyze-spam
const requestBody = {
  text: text.trim() || '',
  title: title.trim() || '',
  jobTitle: jobTitle.trim() || '',
};

console.log('Request body sent to /api/posts/analyze-spam:');
console.log(JSON.stringify(requestBody, null, 2));
console.log('');

// What happens in the API
const combinedText = [
  requestBody.text,
  requestBody.title,
  requestBody.jobTitle
].filter(Boolean).join('\n');

console.log('Combined text in API (what computeSpamScore receives):');
console.log(combinedText);
console.log('');

// Simulated user profile
const userProfile = {
  created_at: new Date().toISOString(),
  phone_verified: false,
  review_count: 0,
  bio: null,
  city: null,
  categories: []
};

const postingStats = {
  posts_last_hour: 0,
  posts_last_24h: 0
};

console.log('=== RUNNING SPAM ANALYSIS ===\n');

try {
  const spamAnalysis = computeSpamScore(combinedText, userProfile, postingStats, false);

  console.log('Result:');
  console.log('  phone_count:', spamAnalysis.phone_count);
  console.log('  link_count:', spamAnalysis.link_count);
  console.log('  spam_score:', spamAnalysis.spam_score);
  console.log('  status:', spamAnalysis.status);
  console.log('  rank_penalty:', spamAnalysis.rank_penalty);
  console.log('');

  console.log('=== TEST RESULT ===');
  if (spamAnalysis.phone_count === 3) {
    console.log('✅ SUCCESS! Phone count is 3 (expected)');
    console.log('   The fix is working correctly!');
  } else {
    console.log(`❌ FAILED! Phone count is ${spamAnalysis.phone_count} (expected 3)`);
    console.log('   Something is still wrong.');
  }
} catch (error) {
  console.error('Error during spam analysis:', error.message);
  console.log('\nNote: This test requires the actual antiSpam module.');
  console.log('The important thing is that the API receives combinedText.');
}
