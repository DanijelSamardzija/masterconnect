# UI Warning for Links Implementation

This document summarizes the implementation of user-facing warnings for posts with many links.

## 1. Config Changes (lib/antiSpam/config.ts)

Added new UI_WARNINGS section:
```typescript
UI_WARNINGS: {
  WARN_LINKS_OVER: 3,
}
```

This threshold is **independent** from:
- `AUTO_SHADOW_LINKS: 10` (hard blocking threshold)
- `STATUS_RANGES` (spam score-based status)

## 2. Spam Analysis (lib/antiSpam/score.ts)

Updated `SpamAnalysis` interface to include:
```typescript
warnings: string[]
```

Added warning logic in `computeSpamScore()`:
```typescript
const warnings: string[] = [];
if (link_count > ANTI_SPAM_CONFIG.UI_WARNINGS.WARN_LINKS_OVER) {
  warnings.push('TOO_MANY_LINKS_WARNING');
}
```

## 3. API Response (app/api/posts/route.ts)

POST endpoint now returns:
```typescript
return NextResponse.json({
  data,
  warnings: spamAnalysis.warnings
});
```

Status calculation remains unchanged - warnings do NOT block posts.

## 4. Translations

**Serbian (sr.ts):**
```
'warnings.tooManyLinks': 'Imaš više od 3 linka — objava može biti ograničena i neće je svi videti u Feed-u.'
```

**English (en.ts):**
```
'warnings.tooManyLinks': 'You have more than 3 links — your post may be limited and not shown to everyone in the Feed.'
```

## 5. Frontend Integration

### create-post-modal.tsx
After successful post creation, shows warning toast if applicable:
```typescript
if (spamAnalysis.warnings && spamAnalysis.warnings.includes('TOO_MANY_LINKS_WARNING')) {
  toast.warning(t('warnings.tooManyLinks'), {
    duration: 6000,
  });
}
```

### create-marketplace-post-modal.tsx
Same implementation for marketplace posts (service listings, job posts, etc.)

## Behavior

- **4+ links**: User sees warning toast (6 seconds)
- **Post is NOT blocked** - it gets created with appropriate spam score
- **Status calculation unchanged**: 
  - Score < 50: `published` with full rank
  - Score 50-69: `published` with 40% rank
  - Score 70+: `shadow_hidden`
- **Warning appears AFTER** post creation (non-blocking)

## Testing

Build completed successfully with all changes.
