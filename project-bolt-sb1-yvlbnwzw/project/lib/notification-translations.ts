type NotificationTranslation = { title: string; body: string };

const SR_SUFFIXES: Record<string, string> = {
  new_follower:        ' vas je zapratio',
  post_reaction:       ' je reagovao na vaš post',
  post_comment:        ' je komentarisao vaš post',
  comment_reply:       ' je odgovorio na vaš komentar',
  comment_reaction:    ' je reagovao na vaš komentar',
  message:             ' vam je poslao poruku',
  post_saved:          ' je sačuvao vaš post',
  new_job_application: ' je aplicirao na vaš oglas',
};

function extractActorName(title: string, actionType: string): string {
  const suffix = SR_SUFFIXES[actionType];
  if (suffix && title.endsWith(suffix)) {
    return title.slice(0, title.length - suffix.length);
  }
  return title.split(' ').slice(0, 2).join(' ');
}

export function translateNotification(
  n: { title: string; body?: string; action_type?: string; meta?: any },
  language: string
): NotificationTranslation {
  const actionType = n.action_type || '';
  const actorName = n.meta?.actor_name || extractActorName(n.title, actionType);

  // Admin announcements — use stored translations from meta
  if (actionType === 'announcement') {
    if (language === 'en' && n.meta?.title_en) return { title: n.meta.title_en, body: n.meta.body_en || n.body || '' };
    if (language === 'de' && n.meta?.title_de) return { title: n.meta.title_de, body: n.meta.body_de || n.body || '' };
    return { title: n.title, body: n.body || '' };
  }

  // Serbian — return as stored
  if (language === 'sr') {
    return { title: n.title, body: n.body || '' };
  }

  // English
  if (language === 'en') {
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
        return { title: `${actorName} applied to your listing`, body: n.body || '' };
      case 'new_review':
        return { title: `${actorName} left you a review ${'⭐'.repeat(n.meta?.rating || 0)}`, body: n.body || '' };
      case 'application_accepted':
        return { title: `${actorName} accepted your application`, body: n.body || '' };
      case 'application_declined':
        return { title: `${actorName} declined your application`, body: n.body || '' };
      case 'credit_received':
        return n.meta?.anonymous
          ? { title: `You received ${n.meta?.net ?? ''} credits from an anonymous user`, body: 'Added to your GigZone balance' }
          : { title: `${actorName} sent you ${n.meta?.net ?? ''} credits`, body: 'Added to your GigZone balance' };
      case 'admin_grant':
        return { title: `You received ${n.meta?.amount ?? ''} credits`, body: 'Added to your GigZone balance by admin' };
      case 'missing_location':
        return { title: 'Add your location', body: "We couldn't find your city. Add your location to receive listings from your region." };
      default:
        return { title: n.title, body: n.body || '' };
    }
  }

  // German
  if (language === 'de') {
    switch (actionType) {
      case 'new_follower':
        return { title: `${actorName} folgt Ihnen jetzt`, body: 'Sie haben einen neuen Follower' };
      case 'post_reaction':
        return { title: `${actorName} hat auf Ihren Beitrag reagiert`, body: n.body || 'Ihr Beitrag' };
      case 'post_comment':
        return { title: `${actorName} hat Ihren Beitrag kommentiert`, body: n.body || 'Ihr Beitrag' };
      case 'comment_reply':
        return { title: `${actorName} hat auf Ihren Kommentar geantwortet`, body: n.body || '' };
      case 'comment_reaction':
        return { title: `${actorName} hat auf Ihren Kommentar reagiert`, body: n.body || 'Ihr Kommentar' };
      case 'message':
        return { title: `${actorName} hat Ihnen eine Nachricht gesendet`, body: 'Sie haben eine neue Nachricht' };
      case 'post_saved':
        return { title: `${actorName} hat Ihren Beitrag gespeichert`, body: n.body || 'Ihr Beitrag' };
      case 'new_job_application':
        return { title: `${actorName} hat sich auf Ihre Anzeige beworben`, body: n.body || '' };
      case 'new_review':
        return { title: `${actorName} hat eine Bewertung hinterlassen ${'⭐'.repeat(n.meta?.rating || 0)}`, body: n.body || '' };
      case 'application_accepted':
        return { title: `${actorName} hat Ihre Bewerbung angenommen`, body: n.body || '' };
      case 'application_declined':
        return { title: `${actorName} hat Ihre Bewerbung abgelehnt`, body: n.body || '' };
      case 'credit_received':
        return n.meta?.anonymous
          ? { title: `Sie haben ${n.meta?.net ?? ''} Credits von einem anonymen Nutzer erhalten`, body: 'Ihrem GigZone-Guthaben hinzugefügt' }
          : { title: `${actorName} hat Ihnen ${n.meta?.net ?? ''} Credits gesendet`, body: 'Ihrem GigZone-Guthaben hinzugefügt' };
      case 'admin_grant':
        return { title: `Sie haben ${n.meta?.amount ?? ''} Credits erhalten`, body: 'Vom Admin zu Ihrem Guthaben hinzugefügt' };
      case 'missing_location':
        return { title: 'Fügen Sie Ihren Standort hinzu', body: 'Wir konnten Ihre Stadt nicht finden. Fügen Sie Ihren Standort hinzu, um Anzeigen aus Ihrer Region zu erhalten.' };
      default:
        return { title: n.title, body: n.body || '' };
    }
  }

  return { title: n.title, body: n.body || '' };
}
