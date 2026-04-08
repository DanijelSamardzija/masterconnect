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

  if (digitCount < 9 || digitCount > 15) {
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

// Test cases
const tests = [
  {
    name: 'Single Serbian number with spaces',
    text: 'Pozovi 064 123 4567',
    expected: 1,
    expectedNormalized: ['+381641234567']
  },
  {
    name: 'Duplicate numbers (different format)',
    text: '0641234567 ili +381 64 123 4567',
    expected: 1,
    expectedNormalized: ['+381641234567']
  },
  {
    name: 'International format with 00',
    text: '00381641234567',
    expected: 1,
    expectedNormalized: ['+381641234567']
  },
  {
    name: 'Duplicate international numbers',
    text: '+49 151 23456789 i +49-151-23456789',
    expected: 1,
    expectedNormalized: ['+4915123456789']
  },
  {
    name: 'Five different numbers',
    text: '064 123 4567, 065 234 5678, 066 345 6789, +49 151 2345678, +1 555 123 4567',
    expected: 5,
    expectedNormalized: ['+381641234567', '+381652345678', '+381663456789', '+491512345678', '+15551234567']
  },
  {
    name: 'Serbian local format',
    text: 'Zovi me na 0641234567',
    expected: 1,
    expectedNormalized: ['+381641234567']
  },
  {
    name: 'Multiple formats mixed',
    text: 'Kontakt: 064-123-4567, 00381641234567, +381 64 123 4567',
    expected: 1,
    expectedNormalized: ['+381641234567']
  }
];

console.log('=== Phone Detection Test Results ===\n');

let passed = 0;
let failed = 0;

tests.forEach((test, index) => {
  const result = countPhones(test.text);
  const normalized = extractUniquePhones(test.text);
  const success = result === test.expected;

  if (success) {
    passed++;
    console.log(`✓ Test ${index + 1}: ${test.name}`);
  } else {
    failed++;
    console.log(`✗ Test ${index + 1}: ${test.name}`);
    console.log(`  Expected: ${test.expected}`);
    console.log(`  Got: ${result}`);
  }

  console.log(`  Input: "${test.text}"`);
  console.log(`  Normalized: ${JSON.stringify(normalized)}`);
  console.log(`  Expected normalized: ${JSON.stringify(test.expectedNormalized)}`);
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
