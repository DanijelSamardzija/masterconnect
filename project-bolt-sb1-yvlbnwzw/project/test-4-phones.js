const ANTI_SPAM_CONFIG = {
  PHONE_VALIDATION: {
    MIN_DIGITS: 9,
    MAX_DIGITS: 15,
  },
};

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

function extractPhoneFromSegment(segment) {
  const cleaned = segment.trim();
  if (!cleaned) return null;

  const hasDigits = /\d/.test(cleaned);
  if (!hasDigits) return null;

  const digitCount = (cleaned.match(/\d/g) || []).length;
  if (digitCount < 8 || digitCount > 20) return null;

  return normalizePhone(cleaned);
}

function extractUniquePhones(text) {
  const delimiters = /[,;|\n\t]+/;
  const segments = text.split(delimiters);

  const candidates = [];

  for (const segment of segments) {
    let buffer = '';
    let digitCount = 0;
    let hasStarted = false;

    for (let i = 0; i < segment.length; i++) {
      const char = segment[i];
      const isDigit = /\d/.test(char);
      const isPhoneChar = /[\d\+\-\(\)\.\s]/.test(char);

      if (isDigit) {
        buffer += char;
        digitCount++;
        hasStarted = true;
      } else if (isPhoneChar && (hasStarted || char === '+') && digitCount < 20) {
        buffer += char;
        if (char === '+' && !hasStarted) {
          hasStarted = true;
        }
      } else {
        if (digitCount >= 8 && buffer.trim()) {
          candidates.push(buffer.trim());
        }
        buffer = '';
        digitCount = 0;
        hasStarted = false;
      }
    }

    if (digitCount >= 8 && buffer.trim()) {
      candidates.push(buffer.trim());
    }
  }

  const normalized = new Set();

  for (const candidate of candidates) {
    const norm = extractPhoneFromSegment(candidate);
    if (norm) {
      normalized.add(norm);
    }
  }

  const uniquePhones = Array.from(normalized);
  console.log('PHONE DEBUG', {
    text: text.slice(0, 100),
    candidates: candidates.length,
    candidatesList: candidates,
    uniquePhones,
    phone_count: uniquePhones.length
  });

  return uniquePhones;
}

function countPhones(text) {
  return extractUniquePhones(text).length;
}

// Test with 4 phones
console.log('=== Testing 4 Different Phone Numbers ===\n');

const test1 = 'Pozovi 064 123 4567, 065 234 5678, 066 345 6789, 069 456 7890';
const result1 = extractUniquePhones(test1);
console.log(`Test 1: 4 Serbian numbers separated by commas`);
console.log(`Expected: 4, Got: ${result1.length}`);
console.log(`Numbers: ${JSON.stringify(result1)}\n`);

const test2 = '064 123 4567 ili 065 234 5678 ili 066 345 6789 ili 069 456 7890';
const result2 = extractUniquePhones(test2);
console.log(`Test 2: 4 Serbian numbers separated by spaces`);
console.log(`Expected: 4, Got: ${result2.length}`);
console.log(`Numbers: ${JSON.stringify(result2)}\n`);

const test3 = '064 123 4567, +49 151 2345678, +1 555 123 4567, +44 20 1234 5678';
const result3 = extractUniquePhones(test3);
console.log(`Test 3: 4 international numbers`);
console.log(`Expected: 4, Got: ${result3.length}`);
console.log(`Numbers: ${JSON.stringify(result3)}\n`);

const test4 = 'Prvi: 064 123 4567, Drugi: 065 234 5678, Treci: 066 345 6789, Cetvrti: 069 456 7890';
const result4 = extractUniquePhones(test4);
console.log(`Test 4: 4 numbers with labels`);
console.log(`Expected: 4, Got: ${result4.length}`);
console.log(`Numbers: ${JSON.stringify(result4)}\n`);

const allPassed = result1.length === 4 && result2.length === 4 && result3.length === 4 && result4.length === 4;

if (allPassed) {
  console.log('✓ All tests passed! Phone detection correctly identifies 4 different numbers.');
  process.exit(0);
} else {
  console.log('✗ Some tests failed!');
  process.exit(1);
}
