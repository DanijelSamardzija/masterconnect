// Test combining text from multiple fields

const text = "Nudim usluge vodoinstalatera. Pozovite na 064 123 4567";
const title = "Vodoinstalerske usluge - Beograd";
const jobTitle = "Majstor vodoinstalater - kontakt: 065 234 5678, 066 345 6789";

const combinedText = [
  text,
  title,
  jobTitle
].filter(Boolean).join('\n');

console.log('=== Combined Text Test ===\n');
console.log('Text:', text);
console.log('Title:', title);
console.log('Job Title:', jobTitle);
console.log('\nCombined:\n', combinedText);
console.log('\n=== Expected Result ===');
console.log('Should have 3 different phone numbers:');
console.log('  - 064 123 4567 → +381641234567');
console.log('  - 065 234 5678 → +381652345678');
console.log('  - 066 345 6789 → +381663456789');
