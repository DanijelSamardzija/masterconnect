const ANTI_SPAM_CONFIG = {
  PHONE_VALIDATION: {
    MIN_DIGITS: 9,
    MAX_DIGITS: 15,
  },
  PENALTIES: {
    PHONE_PER_ITEM: 10,
    LINK_PER_ITEM: 5,
    HASHTAG_PER_ITEM: 2,
    COMBO_SPAM: 15,
    EXCESSIVE_CAPS: 10,
    CAPS_MULTIPLIER: 1.5,
    RAPID_POSTING: 20,
    DUPLICATE_CONTENT: 25,
    NEW_ACCOUNT: 10,
  },
  THRESHOLDS: {
    AUTO_SHADOW_PHONES: 5,
  },
  UI_WARNINGS: {
    WARN_PHONES_OVER: 1,
  },
};

const PHONE_REGEX = /(\+?\d[\d\s().\-]{7,}\d)/g;

function normalizePhone(raw) {
  let cleaned = raw.replace(/[^\d+]/g, '');

  if (cleaned.startsWith('00')) {
    cleaned = '+' + cleaned.slice(2);
  }

  if (cleaned.startsWith('+381')) {
    const rest = cleaned.slice(4);
    if (rest.startsWith('0')) {
      cleaned = '+381' + rest.slice(1);
    }
  } else if (cleaned.startsWith('381') && !cleaned.startsWith('+')) {
    const rest = cleaned.slice(3);
    if (rest.startsWith('0')) {
      cleaned = '+381' + rest.slice(1);
    } else {
      cleaned = '+381' + rest;
    }
  } else if (cleaned.match(/^0\d{8,}$/)) {
    cleaned = '+381' + cleaned.slice(1);
  } else if (!cleaned.startsWith('+') && cleaned.length >= 9) {
    return null;
  }

  const digitCount = cleaned.replace(/\+/g, '').length;

  if (digitCount < ANTI_SPAM_CONFIG.PHONE_VALIDATION.MIN_DIGITS ||
      digitCount > ANTI_SPAM_CONFIG.PHONE_VALIDATION.MAX_DIGITS) {
    return null;
  }

  return cleaned;
}

function extractUniquePhones(text) {
  const matches = text.match(PHONE_REGEX);
  if (!matches) return [];

  const normalized = new Set();

  for (const match of matches) {
    const norm = normalizePhone(match);
    if (norm) {
      normalized.add(norm);
    }
  }

  return Array.from(normalized);
}

function countPhones(text) {
  return extractUniquePhones(text).length;
}

function computeSpamScore(text) {
  const phone_count = countPhones(text);

  let score = 0;
  score += phone_count * ANTI_SPAM_CONFIG.PENALTIES.PHONE_PER_ITEM;

  if (phone_count >= ANTI_SPAM_CONFIG.THRESHOLDS.AUTO_SHADOW_PHONES) {
    score = Math.max(score, 70);
  }

  score = Math.max(0, Math.min(100, score));

  let status = 'published';
  if (score >= 70) {
    status = 'shadow_hidden';
  } else if (score >= 50) {
    status = 'published_low_rank';
  }

  const warnings = [];
  if (phone_count > ANTI_SPAM_CONFIG.UI_WARNINGS.WARN_PHONES_OVER) {
    warnings.push('TOO_MANY_PHONES_WARNING');
  }

  return {
    phone_count,
    spam_score: score,
    status,
    warnings,
  };
}

// Test cases
console.log('=== Phone Auto-Shadow Test Results ===\n');

const tests = [
  {
    name: '1 phone - should be published',
    text: 'Pozovi 064 123 4567',
    expectedStatus: 'published',
    expectedWarnings: 0
  },
  {
    name: '2 phones - should show warning',
    text: 'Pozovi 064 123 4567 ili 065 234 5678',
    expectedStatus: 'published',
    expectedWarnings: 1
  },
  {
    name: '5 phones - should auto shadow',
    text: '064 123 4567, 065 234 5678, 066 345 6789, +49 151 2345678, +1 555 123 4567',
    expectedStatus: 'shadow_hidden',
    expectedWarnings: 1
  },
  {
    name: '7 phones - should auto shadow',
    text: '064 123 4567, 065 234 5678, 066 345 6789, +49 151 2345678, +1 555 123 4567, +44 20 1234 5678, +33 1 23 45 67 89',
    expectedStatus: 'shadow_hidden',
    expectedWarnings: 1
  }
];

let passed = 0;
let failed = 0;

tests.forEach((test, index) => {
  const result = computeSpamScore(test.text);
  const statusMatch = result.status === test.expectedStatus;
  const warningsMatch = result.warnings.length === test.expectedWarnings;
  const success = statusMatch && warningsMatch;

  if (success) {
    passed++;
    console.log(`✓ Test ${index + 1}: ${test.name}`);
  } else {
    failed++;
    console.log(`✗ Test ${index + 1}: ${test.name}`);
  }

  console.log(`  Phone count: ${result.phone_count}`);
  console.log(`  Spam score: ${result.spam_score}`);
  console.log(`  Status: ${result.status} (expected: ${test.expectedStatus})`);
  console.log(`  Warnings: ${result.warnings.length} (expected: ${test.expectedWarnings})`);
  if (result.warnings.length > 0) {
    console.log(`    - ${result.warnings.join(', ')}`);
  }
  console.log('');
});

console.log('=== Summary ===');
console.log(`Passed: ${passed}/${tests.length}`);
console.log(`Failed: ${failed}/${tests.length}`);

if (failed === 0) {
  console.log('\n✓ All tests passed!');
  process.exit(0);
} else {
  console.log(`\n✗ ${failed} test(s) failed`);
  process.exit(1);
}
