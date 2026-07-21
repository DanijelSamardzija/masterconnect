import { devLog } from './dev-log';

export async function fetchJSON<T = any>(
  url: string,
  options: RequestInit = {}
): Promise<T> {
  devLog('[API Client] fetchJSON called:', url);

  try {
    const response = await fetch(url, {
      ...options,
      cache: 'no-store'
    });

    devLog('[API Client] Response status:', response.status);

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[API Client] Response not OK:', { status: response.status, errorText });
      throw new Error(`API error (${response.status}): ${errorText}`);
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error('[API Client] Error in fetchJSON:', error);
    throw error;
  }
}
