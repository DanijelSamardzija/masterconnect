# Feed Pagination Fix - Summary

## Problem
Feed pagination prikazivao je "stigao si do kraja" pre vremena, iako je u bazi bilo ~100 postova. Uzrok:

1. **Feed funkcija vraćala SVE tipove postova** (social_post, hiring_post, service_listing, itd)
   - Baza: 93 posta ukupno
   - Social posts: samo 83
   - Feed page trebao da prikazuje samo social_post

2. **Service worker keširao /api/* rute** sa zastarelim Authorization header-ima
   - Uzrokovalo 401 Unauthorized tokom infinite scroll-a
   - Feed se zaustavljao zbog 401, ne zato što je kraj

## Rešenje

### 1. Dodao `post_type` filter u feed funkciju

**Migration:** `supabase/migrations/20260227161353_add_post_type_filter_to_feed.sql`

```sql
CREATE OR REPLACE FUNCTION get_feed_with_ranking(
  p_user_id uuid DEFAULT NULL,
  p_city text DEFAULT NULL,
  p_category text DEFAULT NULL,
  p_limit int DEFAULT 50,
  p_offset int DEFAULT 0,
  p_as_of timestamptz DEFAULT NOW(),
  p_post_type text DEFAULT 'social_post'  -- NOVO!
)
```

Filter u WHERE klauzuli:
```sql
WHERE
  -- Filter by post_type
  (p_post_type IS NULL OR p.post_type = p_post_type)
  -- ... ostali filteri
```

### 2. Ažurirao API da prosleđuje `p_post_type`

**File:** `app/api/posts/route.ts`

```typescript
const { data: postsData, error } = await supabase.rpc('get_feed_with_ranking', {
  p_user_id: user.id,
  p_city: city,
  p_category: category,
  p_limit: limit,
  p_offset: offset,
  p_as_of: asOf || new Date().toISOString(),
  p_post_type: 'social_post'  // NOVO!
});
```

### 3. Dodao debug logove i `totalCount` metrike

**File:** `app/api/posts/route.ts`

```typescript
// Count total posts
const { count: totalPostsCount } = await supabase
  .from('posts')
  .select('id', { count: 'exact', head: true });

// Count posts matching feed criteria (status + post_type)
const { count: publishedPostsCount } = await supabase
  .from('posts')
  .select('id', { count: 'exact', head: true })
  .eq('post_type', 'social_post')
  .or(`user_id.eq.${user.id},status.eq.published`);

// Return meta info
return NextResponse.json({
  data: postsWithMedia,
  meta: {
    totalPostsInDB: totalPostsCount,
    totalAvailablePosts: publishedPostsCount,
    returnedCount: postsWithMedia.length,
    limit,
    offset
  }
});
```

### 4. Frontend koristi `meta.totalAvailablePosts` za tačan kraj feed-a

**File:** `app/feed/page.tsx`

```typescript
const nextOffset = currentOffset + newPosts.length;
const totalAvailable = meta?.totalAvailablePosts || 0;

if (nextOffset >= totalAvailable || newPosts.length < limit) {
  console.log('[Feed] Reached end of feed:', {
    nextOffset,
    totalAvailable,
    returnedLessThanLimit: newPosts.length < limit
  });
  setHasMore(false);
}
```

### 5. Service worker NE kešira `/api/*` rute

**File:** `public/sw.js`

```javascript
// Don't intercept API routes - they have authentication headers that change
if (url.pathname.startsWith('/api/')) {
  console.log('[SW] Bypassing cache for API route:', url.pathname);
  return;
}
```

**Cache version updated:** `2025-02-27-v7-no-api-cache`

### 6. Kreirao `fetchWithAuth` helper sa automatskim retry logikom

**File:** `lib/api-client.ts`

```typescript
/**
 * Enhanced fetch wrapper with automatic 401 retry logic
 *
 * If an API call returns 401, this function will:
 * 1. Refresh the Supabase session
 * 2. Retry the request once with the new token
 * 3. If still 401, throw error
 */
export async function fetchWithAuth(url: string, options: RequestInit = {}): Promise<Response>

export async function fetchJSON<T = any>(url: string, options: RequestInit = {}): Promise<T>
```

### 7. Feed page koristi novi `fetchJSON` helper

**File:** `app/feed/page.tsx`

```typescript
import { fetchJSON } from '@/lib/api-client';

// Replace manual fetch logic with helper
const responseData = await fetchJSON<{
  data: any[];
  meta: { /* ... */ };
}>(`/api/posts?limit=${limit}&offset=${currentOffset}`);
```

## Rezultat

✅ Feed sada prikazuje samo `social_post` postove (83, ne 93)
✅ Pagination radi tačno do kraja feed-a
✅ Service worker ne kešira API rute
✅ Automatski retry na 401 sa refresh session
✅ Debug logovi pokazuju tačan broj postova na svakom nivou
✅ Frontend zna tačan totalCount i prikazuje "kraj" samo kada je stvarno kraj

## Debug Console Output

Kada korisnik skroluje, videćeš:

```
[Feed] Loading posts: { offset: 0, limit: 15, reset: true }
[Feed] Fetched posts: {
  returnedCount: 15,
  totalPostsInDB: 93,
  totalAvailablePosts: 83,
  limit: 15,
  offset: 0
}

[Posts GET] Feed statistics: {
  totalPostsInDB: 93,
  publishedOrOwnPosts: 83,
  allPostsStatusBreakdown: { published: 81, shadow_hidden: 2 },
  requestedLimit: 15,
  requestedOffset: 0,
  returnedPosts: 15,
  returnedPostsStatusBreakdown: { published: 15 },
  userId: '...'
}
```

## Post Types u Bazi

```sql
SELECT post_type, COUNT(*) as count
FROM posts
GROUP BY post_type
ORDER BY count DESC;

-- Rezultat:
-- social_post:      83
-- hiring_post:       3
-- service_listing:   3
-- service_request:   2
-- job_seeker_post:   2
-- TOTAL:            93
```
