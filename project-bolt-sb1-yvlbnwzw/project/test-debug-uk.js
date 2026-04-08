const text = '064 123 4567, +49 151 2345678, +1 555 123 4567, +44 20 1234 5678';

console.log('Original text:', text);
console.log('\nSplit by comma:');
const segments = text.split(/[,;|\n\t]+/);
segments.forEach((seg, i) => {
  console.log(`  Segment ${i}: "${seg}"`);
});

console.log('\nProcessing segment 3: "+44 20 1234 5678"');
const segment = segments[3].trim();

let buffer = '';
let digitCount = 0;
let hasStarted = false;

for (let i = 0; i < segment.length; i++) {
  const char = segment[i];
  const isDigit = /\d/.test(char);
  const isPhoneChar = /[\d\+\-\(\)\.\s]/.test(char);

  console.log(`  [${i}] char="${char}" isDigit=${isDigit} isPhoneChar=${isPhoneChar} hasStarted=${hasStarted} buffer="${buffer}" digitCount=${digitCount}`);

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
      console.log(`    -> Candidate: "${buffer.trim()}"`);
    }
    buffer = '';
    digitCount = 0;
    hasStarted = false;
  }
}

if (digitCount >= 8 && buffer.trim()) {
  console.log(`  Final candidate: "${buffer.trim()}"`);
}
