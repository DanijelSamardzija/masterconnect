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

  return Array.from(normalized);
}

// Simulate API call
const text = "Nudim usluge vodoinstalatera. Pozovite na 064 123 4567";
const title = "Vodoinstalerske usluge - Beograd";
const jobTitle = "Majstor vodoinstalater - kontakt: 065 234 5678, 066 345 6789";

const combinedText = [
  text,
  title,
  jobTitle
].filter(Boolean).join('\n');

console.log('=== Full Integration Test ===\n');
console.log('ANTI SPAM INPUT TEXT:', combinedText);
console.log('\n');

const phones = extractUniquePhones(combinedText);
console.log('PHONE COUNT:', phones.length);
console.log('Phones found:', phones);

console.log('\n=== Test Result ===');
if (phones.length === 3) {
  console.log('✅ SUCCESS! Found 3 unique phone numbers as expected.');
  console.log('This means the fix is working correctly!');
} else {
  console.log(`❌ FAILED! Expected 3 but got ${phones.length}`);
}
