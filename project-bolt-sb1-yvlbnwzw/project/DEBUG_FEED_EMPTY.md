# Debug: Feed Empty Issue

## Problem
Feed je prazan nakon sw.js i api-client.ts izmena. U Network tab-u nema request-a za `/api/posts`.

## Dodati Debug Logovi

### 1. AuthContext (`lib/contexts/auth-context.tsx`)

Dodati logovi za praćenje inicijalizacije:

```
[AuthContext] Calling initializeAuth...
[AuthContext] Initializing auth...
[AuthContext] Found cached profile: {userId}
[AuthContext] Getting session from Supabase...
[AuthContext] Session found, user ID: {userId}
[AuthContext] Finished initialization, loading=false
```

Ili ako nema sesije:
```
[AuthContext] No session found
```

### 2. Feed Page (`app/feed/page.tsx`)

**useEffect [user] trigger:**
```
[Feed] useEffect [user] triggered { user: true/false, userId: {id} }
[Feed] User exists, calling loadPosts(true)
```

Ili:
```
[Feed] No user yet, waiting...
```

**loadPosts function:**
```
[Feed] loadPosts called { reset: true, user: true, hasMore: true, offset: 0 }
[Feed] About to fetchJSON: { url: '/api/posts?limit=15&offset=0', currentOffset: 0, limit: 15, reset: true }
[Feed] Response received: { data: [...], meta: {...} }
[Feed] Fetched posts: { returnedCount: 15, totalPostsInDB: 93, totalAvailablePosts: 79, ... }
```

**Error handling:**
```
[Feed] Error loading posts: Error: ...
[Feed] Error details: { message: '...', stack: '...', name: '...' }
```

### 3. API Client (`lib/api-client.ts`)

**fetchJSON:**
```
[API Client] fetchJSON called: /api/posts?limit=15&offset=0
```

**fetchWithAuth:**
```
[API Client] fetchWithAuth called: /api/posts?limit=15&offset=0
[API Client] Getting session...
[API Client] Session check: { hasSession: true, hasToken: true }
[API Client] Making fetch request to: /api/posts?limit=15&offset=0
[API Client] Response status: 200
[API Client] JSON parsed successfully
```

**Ako je 401:**
```
[API Client] Got 401, refreshing session and retrying... /api/posts?limit=15&offset=0
[API Client] Retrying with refreshed token...
[API Client] Retry response status: 200
```

**Ako je error:**
```
[API Client] Error in fetchWithAuth: Error: ...
[API Client] Response not OK: { status: 500, errorText: '...' }
```

### 4. Service Worker (`public/sw.js`)

**Bypass API routes:**
```
[SW] Bypassing cache for API route: /api/posts
```

## Dijagnostički Scenario-i

### Scenario 1: User nije postavljen na vreme
**Očekivani logovi:**
```
[AuthContext] Calling initializeAuth...
[AuthContext] Initializing auth...
[AuthContext] Getting session from Supabase...
[AuthContext] No session found
[AuthContext] Finished initialization, loading=false
[Feed] useEffect [user] triggered { user: false, userId: undefined }
[Feed] No user yet, waiting...
```
**Rešenje:** Sesija nije pronađena ili je istekla. User mora da se re-login-uje.

### Scenario 2: fetchJSON baca error pre fetch-a
**Očekivani logovi:**
```
[Feed] loadPosts called { reset: true, user: true, hasMore: true, offset: 0 }
[Feed] About to fetchJSON: { url: '...', ... }
[API Client] fetchJSON called: /api/posts?limit=15&offset=0
[API Client] fetchWithAuth called: /api/posts?limit=15&offset=0
[API Client] Getting session...
[API Client] Session check: { hasSession: false, hasToken: false }
[API Client] Error in fetchWithAuth: Error: No access token available
[Feed] Error loading posts: Error: No access token available
```
**Rešenje:** Token nije dostupan u Supabase client-u. Možda SSR problem ili stale cache.

### Scenario 3: API vraća 401 i refresh ne uspeva
**Očekivani logovi:**
```
[API Client] Response status: 401
[API Client] Got 401, refreshing session and retrying...
[API Client] Session refresh failed: AuthSessionMissingError
[API Client] Error in fetchWithAuth: Error: Session expired. Please log in again.
[Feed] Error loading posts: Error: Session expired. Please log in again.
```
**Rešenje:** Session je istekao i ne može se refresh-ovati. User mora da se logout/login.

### Scenario 4: API radi ali vraća 0 postova
**Očekivani logovi:**
```
[API Client] Response status: 200
[API Client] JSON parsed successfully
[Feed] Response received: { data: [], meta: { totalPostsInDB: 93, totalAvailablePosts: 0, ... } }
[Feed] Fetched posts: { returnedCount: 0, totalPostsInDB: 93, totalAvailablePosts: 0, ... }
```
**Rešenje:** `p_post_type='social_post'` filter isključuje sve postove. Proveriti da li postoje social_post postovi u bazi.

### Scenario 5: Service worker kešira request
**Network tab:**
- Request nije vidljiv u Network tab-u
- Ili pokazuje "from Service Worker"

**Očekivani log:**
```
[SW] Bypassing cache for API route: /api/posts
```

**Ako log nije vidljiv:**
- Service worker nije ažuriran
- Potreban hard refresh (Ctrl+Shift+R) ili clear cache

## Provera Baze Podataka

```sql
-- Proveriti post tipove
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

-- Proveriti statuse social_post-ova
SELECT post_type, status, COUNT(*) as count
FROM posts
WHERE post_type = 'social_post'
GROUP BY post_type, status
ORDER BY count DESC;

-- Rezultat:
-- social_post | published       | 79
-- social_post | shadow_hidden   | 4
```

## Kako Testirati

1. Otvoriti `/feed` stranicu
2. Otvoriti Developer Console (F12)
3. Očistiti console (Clear)
4. Osvežiti stranicu (F5 ili Ctrl+R)
5. Proveriti logove redom:
   - `[AuthContext]` logovi (inicijalizacija, sesija, user)
   - `[Feed]` logovi (useEffect, loadPosts)
   - `[API Client]` logovi (fetchJSON, fetchWithAuth, response)
   - `[SW]` logovi (bypass API)
6. Otvoriti Network tab
   - Filter: "posts"
   - Proveriti da li postoji request za `/api/posts?limit=15&offset=0`
   - Proveriti status (200, 401, 500, itd)
   - Proveriti response body

## Sledeći Koraci

Kada korisnik pokrene stranicu sa otvorenim console-om, dobićemo tačan scenario i moći ćemo da identifikujemo:

1. Da li je problem u AuthContext (user nije postavljen)
2. Da li je problem u API Client (token, fetch error)
3. Da li je problem u Service Worker (keširanje)
4. Da li je problem u backend-u (0 rezultata, 401, 500)

---

**VAŽNO:** Nakon što korisnik pokrene stranicu, potrebno je da copy-paste-uje SVE logove iz console-a koji počinju sa:
- `[AuthContext]`
- `[Feed]`
- `[API Client]`
- `[SW]`

Takođe je korisno videti Network tab screenshot ili copy-paste request details.
