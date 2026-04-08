/**
 * Simple API client wrapper for fetch
 * No Supabase client needed - just plain fetch
 */

/**
 * Simple fetch wrapper that parses JSON response
 */
export async function fetchJSON<T = any>(
  url: string,
  options: RequestInit = {}
): Promise<T> {
  console.log('[API Client] fetchJSON called:', url);

  try {
    console.log('[API Client] Making fetch request to:', url);
    const response = await fetch(url, {
      ...options,
      cache: 'no-store'
    });

    console.log('[API Client] Response status:', response.status);

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[API Client] Response not OK:', { status: response.status, errorText });
      throw new Error(`API error (${response.status}): ${errorText}`);
    }

    const data = await response.json();
    console.log('[API Client] JSON parsed successfully');
    return data;
  } catch (error) {
    console.error('[API Client] Error in fetchJSON:', error);
    throw error;
  }
}
