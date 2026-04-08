# Anti-Spam System Documentation

## Overview

Rule-based anti-spam detection system for Feed posts. Analyzes post content and user behavior to calculate a spam score (0-100) and assign status.

## Status Types

- **published** (0-69 score) - Visible to all users
  - 0-49: Full ranking (rank_penalty: 1.0)
  - 50-69: Reduced ranking (rank_penalty: 0.4) - sinks faster over time
- **shadow_hidden** (70-100 score) - Hidden from feed, only visible to owner

## Spam Detection Rules

### Aggressive Penalties

| Violation | Score Penalty |
|-----------|--------------|
| Each phone number | +10 per phone |
| Each link | +5 per link |
| Each hashtag | +2 per hashtag |
| 3+ phones AND 3+ links | +15 (combo bonus) |
| >35% uppercase letters | +10 + x1.5 multiplier |
| >3 posts in 1h OR >10 in 24h | +20 |
| Duplicate content | +25 |
| Account < 7 days old | +10 |

### Auto Shadow Rules
- **10+ links** → minimum score 70 (shadow_hidden)
- **5+ phones** → minimum score 70 (shadow_hidden)

### Bonuses (score reduction)

| Bonus | Score Reduction |
|-------|----------------|
| Phone verified | -10 |
| 5+ reviews with 4.5+ rating | -10 |
| Complete profile (bio, city, categories) | -5 |

## Phone Detection

Valid phone: 9-15 digits, may include `+`, `-`, `/`, `()`, spaces

**Ignored patterns:**
- Years (4 digits starting with "20")
- Numbers near currency symbols ("din", "rsd", "eur", "€", "$")

## Link Detection

Detects:
- `http://` or `https://` URLs
- `www.` domains
- Domain extensions: `.com`, `.net`, `.org`, `.rs`, `.me`, `.ba`, `.hr`, `.de`, `.at`, `.it`, `.info`

## Test Examples

### ✅ Normal Posts

#### Test 1: Professional Service
```
Text: "Nudim profesionalne usluge elektrike u Beogradu. Imam 10 godina iskustva. Kontakt: 0601234567"
User: Experienced, phone verified, 4.8 rating (12 reviews)
Expected: 0-10 points → published (full rank)
Penalties: 1 phone (+10)
Bonuses: Phone verified (-10), reputation (-10), complete profile (-5)
Total: 0 points (max 0)
```

#### Test 2: Service Request
```
Text: "Tražim majstora za popravku klime u stanu. Može danas ili sutra. Lokacija Novi Beograd."
User: Experienced, good reputation
Expected: 0-15 points → published (full rank)
Reason: No contact info, clean post
```

#### Test 3: With Website
```
Text: "Nudim vodoinstalaterske usluge u celom Beogradu. Pogledajte moje radove na www.mojsajt.rs"
User: Experienced, good reputation
Expected: 0-5 points → published (full rank)
Penalties: 1 link (+5)
Bonuses: Reputation (-10), complete profile (-5)
Total: 0 points (max 0)
```

### ❌ Spam Posts

#### Test 4: Multiple Contacts
```
Text: "HITNO!!! Majstor za SVE!!! 📞 060-123-4567 📞 065-987-6543 📞 069-111-2222 💻 www.spam.com 🌐 kontakt.rs ⚡ #majstor #hitno #besplatno #brzo #kvalitet #garancija #povoljno #akcija #profesionalac #iskusan #najbolji"
User: New account (3 days old), no verification
Posting: 5 posts in 1h, 15 in 24h
Expected: 90+ points → shadow_hidden
Penalties: 3 phones (+30), 2 links (+10), combo (+15), 11 hashtags (+22), caps (+10), rapid posting (+20), new account (+10)
Base total: 117, capped at 100
Multipliers: x1.5 caps multiplier applied
```

#### Test 5: Excessive Caps
```
Text: "RADIM SVE POSLOVE BRZO I KVALITETNO!!! ZOVITE ODMAH 0601234567 ILI POSETITE sajt.com POVOLJNO!!!"
User: New account (3 days old)
Expected: 50-65 points → published (low rank)
Penalties: 1 phone (+10), 1 link (+5), caps (+10), new account (+10)
Base: 35 points, x1.5 caps multiplier = 52 points
Note: Caps ratio ~45%, triggers penalty and multiplier
```

#### Test 6: Duplicate Content
```
Text: "Nudim usluge elektrike pozovite 0601234567"
User: Experienced, good reputation
Duplicate: Yes (same content posted before)
Expected: 10-20 points → published (full rank)
Penalties: 1 phone (+10), duplicate (+25)
Bonuses: Phone verified (-10), reputation (-10), complete profile (-5)
Total: 10 points
```

## Database Schema

### posts table (new columns)
```sql
spam_score integer (0-100)
status text ('published' | 'needs_review' | 'shadow_hidden')
rank_penalty numeric (0.0-1.0)
duplicate_hash text
link_count integer
phone_count integer
hashtag_count integer
caps_ratio numeric (0.0-1.0)
```

## API Integration

Posts are analyzed on creation in `/api/posts` (POST):

1. Fetch user profile and posting stats
2. Check for duplicate hash
3. Compute spam score
4. Save post with spam analysis fields
5. Feed filters out `shadow_hidden` status

## Configuration

All thresholds and penalties are configurable in `/lib/antiSpam/config.ts`

## Usage

```typescript
import { computeSpamScore } from '@/lib/antiSpam';

const result = computeSpamScore(
  postText,
  userProfile,
  postingStats,
  isDuplicate
);

// result contains:
// - spam_score: number (0-100)
// - status: 'published' | 'needs_review' | 'shadow_hidden'
// - rank_penalty: number (0.0-1.0)
// - duplicate_hash: string
// - link_count, phone_count, hashtag_count, caps_ratio
// - features: detailed breakdown of all penalties/bonuses
```
