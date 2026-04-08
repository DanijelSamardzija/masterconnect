const { computeSpamScore } = require('./lib/antiSpam/score');

const NORMAL_USER = {
  created_at: '2023-01-01T00:00:00Z',
  phone_verified: true,
  avg_rating: 4.8,
  review_count: 12,
  bio: 'Experienced professional',
  city: 'Belgrade',
  categories: ['Electricity', 'Plumbing'],
};

const NEW_USER = {
  created_at: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
  phone_verified: false,
  bio: null,
  city: null,
  categories: [],
};

const NORMAL_POSTING = {
  posts_last_hour: 0,
  posts_last_24h: 2,
};

const RAPID_POSTING = {
  posts_last_hour: 5,
  posts_last_24h: 15,
};

const TEST_EXAMPLES = [
  {
    name: 'Normal Post #1 - Professional Service',
    text: 'Nudim profesionalne usluge elektrike u Beogradu. Imam 10 godina iskustva. Kontakt: 0601234567',
    user: NORMAL_USER,
    postingStats: NORMAL_POSTING,
    isDuplicate: false,
    expectedScore: '0-20',
    expectedStatus: 'published',
  },
  {
    name: 'Normal Post #2 - Service Request',
    text: 'Tražim majstora za popravku klime u stanu. Može danas ili sutra. Lokacija Novi Beograd.',
    user: NORMAL_USER,
    postingStats: NORMAL_POSTING,
    isDuplicate: false,
    expectedScore: '0-15',
    expectedStatus: 'published',
  },
  {
    name: 'Normal Post #3 - With Website',
    text: 'Nudim vodoinstalaterske usluge u celom Beogradu. Pogledajte moje radove na www.mojsajt.rs',
    user: NORMAL_USER,
    postingStats: NORMAL_POSTING,
    isDuplicate: false,
    expectedScore: '0-20',
    expectedStatus: 'published',
  },
  {
    name: 'Spam Post #1 - Multiple Contacts',
    text: 'HITNO!!! Majstor za SVE!!! 📞 060-123-4567 📞 065-987-6543 📞 069-111-2222 💻 www.spam.com 🌐 kontakt.rs ⚡ #majstor #hitno #besplatno #brzo #kvalitet #garancija #povoljno #akcija #profesionalac #iskusan #najbolji',
    user: NEW_USER,
    postingStats: RAPID_POSTING,
    isDuplicate: false,
    expectedScore: '75-100',
    expectedStatus: 'shadow_hidden',
  },
  {
    name: 'Spam Post #2 - Excessive Caps',
    text: 'RADIM SVE POSLOVE BRZO I KVALITETNO!!! ZOVITE ODMAH 0601234567 ILI POSETITE sajt.com POVOLJNO!!!',
    user: NEW_USER,
    postingStats: NORMAL_POSTING,
    isDuplicate: false,
    expectedScore: '40-60',
    expectedStatus: 'published',
  },
  {
    name: 'Spam Post #3 - Duplicate Content',
    text: 'Nudim usluge elektrike pozovite 0601234567',
    user: NORMAL_USER,
    postingStats: NORMAL_POSTING,
    isDuplicate: true,
    expectedScore: '25-35',
    expectedStatus: 'published',
  },
];

console.log('\n=== ANTI-SPAM TEST RESULTS ===\n');

TEST_EXAMPLES.forEach((example, index) => {
  const result = computeSpamScore(
    example.text,
    example.user,
    example.postingStats,
    example.isDuplicate
  );

  console.log(`\n--- Test ${index + 1}: ${example.name} ---`);
  console.log(`Text: "${example.text.substring(0, 60)}${example.text.length > 60 ? '...' : ''}"`);
  console.log(`\nExpected: ${example.expectedScore} points → ${example.expectedStatus}`);
  console.log(`Actual: ${result.spam_score} points → ${result.status}`);
  console.log(`Rank Penalty: ${result.rank_penalty}`);
  console.log(`\nDetected:`);
  console.log(`  - Phones: ${result.phone_count}`);
  console.log(`  - Links: ${result.link_count}`);
  console.log(`  - Hashtags: ${result.hashtag_count}`);
  console.log(`  - Caps Ratio: ${(result.caps_ratio * 100).toFixed(1)}%`);
  console.log(`\nPenalties Applied:`);
  console.log(`  - Phone: +${result.features.phone_penalty}`);
  console.log(`  - Link: +${result.features.link_penalty}`);
  console.log(`  - Combo Spam: +${result.features.combo_penalty}`);
  console.log(`  - Hashtags: +${result.features.hashtag_penalty}`);
  console.log(`  - Caps: +${result.features.caps_penalty}`);
  console.log(`  - Rapid Posting: +${result.features.rapid_posting_penalty}`);
  console.log(`  - Duplicate: +${result.features.duplicate_penalty}`);
  console.log(`  - New Account: +${result.features.new_account_penalty}`);
  console.log(`\nBonuses Applied:`);
  console.log(`  - Phone Verified: ${result.features.phone_verified_bonus}`);
  console.log(`  - Reputation: ${result.features.reputation_bonus}`);
  console.log(`  - Complete Profile: ${result.features.complete_profile_bonus}`);
  console.log(`\nStatus: ${result.status === example.expectedStatus ? '✅ PASS' : '⚠️  CHECK'}`);
});

console.log('\n=== END OF TESTS ===\n');
