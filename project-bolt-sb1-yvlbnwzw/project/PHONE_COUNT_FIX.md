# Phone Count Fix - Summary

## Problem
`phone_count` je uvek bio 1 iako je tekst sadržao više brojeva telefona.

## Root Cause
API endpoint `/api/posts/analyze-spam` je primao samo `text` polje, ali nije uzimao u obzir ostala polja gde korisnik može da unese brojeve:
- `title` (naslov posta)
- `jobTitle` (naziv pozicije za job postove)

## Solution

### 1. Backend Fix (`app/api/posts/analyze-spam/route.ts`)

**Prije:**
```typescript
const { text } = body;
const spamAnalysis = computeSpamScore(text || '', userProfile, postingStats, isDuplicate);
```

**Poslije:**
```typescript
const { text, title, jobTitle } = body;

const combinedText = [
  text,
  title,
  jobTitle
].filter(Boolean).join('\n');

console.log('[Spam Analysis] ANTI SPAM INPUT TEXT:', combinedText);
console.log('[Spam Analysis] Text parts:', {
  text: text?.length || 0,
  title: title?.length || 0,
  jobTitle: jobTitle?.length || 0
});

const spamAnalysis = computeSpamScore(combinedText, userProfile, postingStats, isDuplicate);

console.log('[Spam Analysis] PHONE COUNT:', spamAnalysis.phone_count);
```

### 2. Frontend Fix (`components/create-marketplace-post-modal.tsx`)

**Prije:**
```typescript
body: JSON.stringify({
  text: text.trim() || '',
}),
```

**Poslije:**
```typescript
body: JSON.stringify({
  text: text.trim() || '',
  title: title.trim() || '',
  jobTitle: jobTitle.trim() || '',
}),
```

### 3. Phone Detection Logic Fix (`lib/antiSpam/phones.ts`)

Takođe smo popravili regex koji je bio previše "greedy" i spajao više brojeva u jedan.

**Nova logika:**
1. Deli tekst po delimiterima: `,`, `;`, `|`, `\n`, `\t`
2. Ide karakter-po-karakter kroz svaki segment
3. Skuplja cifre i phone karaktere (`+`, `-`, `(`, `)`, `.`, razmak)
4. Kada naiđe na ne-phone karakter, završava trenutni broj
5. Deduplikacija preko `Set()` sa normalizovanim brojevima

## Test Results

### Test 1: Pojedinačno brojanje
```
Text: "064 123 4567, 065 234 5678, 066 345 6789"
Result: phone_count = 3 ✅
```

### Test 2: Kombinovani unos (3 broja)
```
Text: "Pozovite 064 123 4567"
Title: "Usluge - Beograd"
Job Title: "Kontakt: 065 234 5678, 066 345 6789"
Result: phone_count = 3 ✅
```

### Test 3: Auto-shadow (5 brojeva)
```
Text: "064 123 4567, 065 234 5678"
Title: "Kontakt: 066 345 6789"
Job Title: "Tel: 069 456 7890, 060 567 8901"
Result:
  - phone_count = 5 ✅
  - status = shadow_hidden ✅
  - spam_score = 70 ✅
```

### Test 4: Internacionalni brojevi
```
Text: "+44 20 1234 5678, +49 151 2345678"
Result: phone_count = 2 ✅
```

## Debug Logging

Kada se post kreira, u konzoli će se videti:

```
[Spam Analysis] ANTI SPAM INPUT TEXT: <combined text>
[Spam Analysis] Text parts: { text: 50, title: 20, jobTitle: 30 }
PHONE DEBUG {
  text: "Prvi 100 karaktera...",
  candidates: 5,
  uniquePhones: ["+381641234567", ...],
  phone_count: 5
}
[Spam Analysis] PHONE COUNT: 5
```

## Expected Behavior

- **1 phone** → `published`, `spam_score: 10`
- **2 phones** → `published`, `spam_score: 20`, warning
- **3-4 phones** → `published`, `spam_score: 30-40`
- **5+ phones** → `shadow_hidden`, `spam_score: ≥70` (auto-shadow)

## Files Modified

1. `/app/api/posts/analyze-spam/route.ts` - Backend API
2. `/components/create-marketplace-post-modal.tsx` - Frontend modal
3. `/lib/antiSpam/phones.ts` - Phone detection logic (već popravljeno ranije)
