type NotificationTranslation = { title: string; body: string };

const SR_SUFFIXES: Record<string, string> = {
  new_follower:      ' vas je zapratio',
  post_reaction:     ' je reagovao na vaš post',
  post_comment:      ' je komentarisao vaš post',
  comment_reply:     ' je odgovorio na vaš komentar',
  comment_reaction:  ' je reagovao na vaš komentar',
  message:           ' vam je poslao poruku',
  post_saved:        ' je sačuvao vaš post',
  new_job_application: ' je aplicirao na vaš oglas',
};

function extractActorName(title: string, actionType: string): string {
  const suffix = SR_SUFFIXES[actionType];
  if (suffix && title.endsWith(suffix)) {
    return title.slice(0, title.length - suffix.length);
  }
  // fallback: return first two words
  return title.split(' ').slice(0, 2).join(' ');
}

export function translateNotification(
  n: { title: string; body?: string; action_type?: string; meta?: any },
  language: string
): NotificationTranslation {
  if (language !== 'en') {
    return { title: n.title, body: n.body || '' };
  }

  const actionType = n.action_type || '';
  const actorName = n.meta?.actor_name || extractActorName(n.title, actionType);

  switch (actionType) {
    case 'new_follower':
      return { title: `${actorName} started following you`, body: 'You have a new follower' };
    case 'post_reaction':
      return { title: `${actorName} reacted to your post`, body: n.body || 'Your post' };
    case 'post_comment':
      return { title: `${actorName} commented on your post`, body: n.body || 'Your post' };
    case 'comment_reply':
      return { title: `${actorName} replied to your comment`, body: n.body || '' };
    case 'comment_reaction':
      return { title: `${actorName} reacted to your comment`, body: n.body || 'Your comment' };
    case 'message':
      return { title: `${actorName} sent you a message`, body: 'You have a new message' };
    case 'post_saved':
      return { title: `${actorName} saved your post`, body: n.body || 'Your post' };
    case 'new_job_application':
      return { title: `${actorName} applied to your job`, body: n.body || '' };
    case 'new_review':
      return { title: `${actorName} left you a review ${'⭐'.repeat(n.meta?.rating || 0)}`, body: n.body || '' };
    case 'application_accepted':
      return { title: `${actorName} accepted your application`, body: n.body || '' };
    case 'application_declined':
      return { title: `${actorName} declined your application`, body: n.body || '' };
    case 'announcement':
      return { title: n.title, body: n.body || '' };
    case 'missing_location':
      return { title: 'Add your location', body: 'We couldn\'t find your city. Add your location to receive listings from your region.' };
    default:
      return { title: n.title, body: n.body || '' };
  }
}
