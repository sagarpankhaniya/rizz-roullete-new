import { apiUrl } from '../utils/api';
import { getOrCreateVisitorSessionId } from '../utils/visitor';

export async function recordVisit(path: string) {
  try {
    await fetch(apiUrl('/api/visits'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sessionId: getOrCreateVisitorSessionId(),
        path,
        referrer: document.referrer || undefined,
      }),
      keepalive: true,
    });
  } catch {
    // Ignore tracking failures.
  }
}
