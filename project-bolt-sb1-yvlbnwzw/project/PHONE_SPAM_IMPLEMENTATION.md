# Phone Number Anti-Spam Implementation

## Overview
Comprehensive phone number spam detection system with deduplication, UI warnings, and automatic shadow banning for posts with excessive phone numbers.

## Implementation Details

### 1. Configuration (`lib/antiSpam/config.ts`)
- **WARN_PHONES_OVER**: 1 (warning shown when 2+ unique phones detected)
- **AUTO_SHADOW_PHONES**: 5 (post automatically shadow-hidden at 5+ unique phones)
- **PHONE_PER_ITEM**: 10 (penalty points per unique phone number)

### 2. Phone Detection Module (`lib/antiSpam/phones.ts`)

**Features:**
- Extracts phone numbers using regex: `/(\+?\d[\d\s().\-]{7,}\d)/g`
- Normalizes phone numbers to E.164 format
- Deduplicates identical numbers in different formats
- Validates 9-15 digit range (E.164 standard)

**Normalization Rules:**
- `00381...` → `+381...` (convert 00 prefix to +)
- `381...` → `+381...` (add + prefix for country code)
- `0641234567` → `+381641234567` (Serbian local to international)
- Remove leading 0 after country code if present
- Strip all non-digit characters except `+` at the start

**Functions:**
- `normalizePhone(raw: string): string | null` - Normalize single phone number
- `extractUniquePhones(text: string): string[]` - Extract all unique normalized phones
- `countPhones(text: string): number` - Count unique phone numbers

### 3. Scoring Integration (`lib/antiSpam/score.ts`)
- Uses `countPhones()` instead of old `extractPhones().length`
- Adds penalty: `score += phone_count * PHONE_PER_ITEM`
- Auto-shadow trigger: if `phone_count >= 5`, force `score = max(score, 70)`
- Warning generation: if `phone_count > 1`, add `'TOO_MANY_PHONES_WARNING'`

### 4. API Response (`app/api/posts/analyze-spam/route.ts`)
- Returns `warnings` array in response (already implemented for links)
- Phone warnings included automatically via `spamAnalysis.warnings`

### 5. Frontend Integration
**Both modals updated:**
- `components/create-post-modal.tsx`
- `components/create-marketplace-post-modal.tsx`

**Toast Logic:**
```typescript
if (spamAnalysis.warnings.includes('TOO_MANY_PHONES_WARNING')) {
  setTimeout(() => {
    toast.warning(t('warnings.tooManyPhones'), {
      duration: 6000,
    });
  }, 700);
}
```

### 6. Translations
**Serbian (`lib/translations/sr.ts`):**
```
'warnings.tooManyPhones': 'Imaš više brojeva telefona — objava može biti ograničena i neće je svi videti u Feed-u.'
```

**English (`lib/translations/en.ts`):**
```
'warnings.tooManyPhones': 'You have multiple phone numbers — your post may be limited and not shown to everyone in the Feed.'
```

## Test Results

### Deduplication Tests (7/7 passed)
✓ Single Serbian number with spaces: `064 123 4567` → 1 unique
✓ Duplicate formats: `0641234567` + `+381 64 123 4567` → 1 unique (deduplicated)
✓ International 00 format: `00381641234567` → normalized to `+381641234567`
✓ Duplicate international: `+49 151 23456789` + `+49-151-23456789` → 1 unique
✓ Five different numbers → 5 unique
✓ Serbian local format: `0641234567` → normalized to `+381641234567`
✓ Multiple formats mixed → all deduplicated correctly

### Auto-Shadow Tests (4/4 passed)
✓ 1 phone → status: `published`, warnings: 0
✓ 2 phones → status: `published`, warnings: 1 (TOO_MANY_PHONES_WARNING)
✓ 5 phones → status: `shadow_hidden`, score: 70, warnings: 1
✓ 7 phones → status: `shadow_hidden`, score: 70, warnings: 1

## Example Scenarios

### Scenario 1: Normal Post (1 phone)
**Input:** "Pozovi 064 123 4567"
- Phone count: 1
- Spam score: 10
- Status: `published`
- Warning: None
- User experience: Post published normally

### Scenario 2: Warning Threshold (2 phones)
**Input:** "Pozovi 064 123 4567 ili 065 234 5678"
- Phone count: 2
- Spam score: 20
- Status: `published`
- Warning: TOO_MANY_PHONES_WARNING
- User experience: Post published + warning toast shown

### Scenario 3: Auto Shadow (5+ phones)
**Input:** "064 123 4567, 065 234 5678, 066 345 6789, +49 151 2345678, +1 555 123 4567"
- Phone count: 5
- Spam score: 70 (forced minimum)
- Status: `shadow_hidden`
- Warning: TOO_MANY_PHONES_WARNING
- User experience: Post appears to user but hidden from others, warning toast shown

## Integration with Existing Anti-Spam

Works seamlessly with:
- Link detection (TOO_MANY_LINKS_WARNING)
- Hashtag penalties
- Caps ratio detection
- Rapid posting limits
- Combo spam detection (3+ phones + 3+ links)

Both phone and link warnings can appear simultaneously if both thresholds are exceeded.

## Files Modified

1. `lib/antiSpam/config.ts` - Added WARN_PHONES_OVER
2. `lib/antiSpam/phones.ts` - **NEW** - Phone extraction and normalization
3. `lib/antiSpam/detect.ts` - Updated to use new phone functions
4. `lib/antiSpam/score.ts` - Added phone warning logic
5. `lib/translations/sr.ts` - Added SR phone warning
6. `lib/translations/en.ts` - Added EN phone warning
7. `components/create-post-modal.tsx` - Added phone warning toast
8. `components/create-marketplace-post-modal.tsx` - Added phone warning toast

## Test Files Created

1. `test-phone-detection.js` - Tests normalization and deduplication
2. `test-phone-shadow.js` - Tests auto-shadow and warning thresholds
