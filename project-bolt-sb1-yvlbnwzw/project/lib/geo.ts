type GeoResult = { city?: string; country?: string };

export async function detectGeo(): Promise<GeoResult> {
  const tryFetch = () =>
    fetch('https://ipapi.co/json/', { signal: AbortSignal.timeout(4000) })
      .then(r => r.json() as Promise<{ city?: string; country_name?: string }>);

  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      if (attempt > 0) await new Promise<void>(r => setTimeout(r, 1500));
      const geo = await tryFetch();
      if (geo.country_name) {
        return { city: geo.city ?? undefined, country: geo.country_name };
      }
    } catch {}
  }
  return {};
}
