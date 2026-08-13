'use server';

import { notifyIndexNow } from '@/lib/indexnow';

export async function notifyProfileIndexed(userId: string): Promise<void> {
  notifyIndexNow([`https://www.gigzone.app/profile/${userId}`]).catch(() => {});
}
