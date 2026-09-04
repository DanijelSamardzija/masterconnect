import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { sendEmail } from '@/lib/brevo';

const BALKAN_COUNTRIES = ['Serbia', 'Srbija', 'Croatia', 'Hrvatska', 'Bosnia and Herzegovina', 'Bosna i Hercegovina', 'Montenegro', 'Crna Gora', 'Slovenia', 'Slovenija', 'North Macedonia', 'Sjeverna Makedonija'];
const GERMAN_COUNTRIES = ['Germany', 'Deutschland', 'Austria', 'Österreich', 'Switzerland', 'Schweiz'];
const SPANISH_COUNTRIES = ['Spain', 'España', 'Mexico', 'México', 'Argentina', 'Colombia', 'Chile', 'Peru', 'Perú', 'Venezuela', 'Ecuador', 'Bolivia', 'Paraguay', 'Uruguay'];
const FRENCH_COUNTRIES = ['France', 'Belgium', 'Belgique', 'Switzerland', 'Schweiz', 'Canada', 'Luxembourg'];

function getContent(isPro: boolean, lang: 'sr' | 'de' | 'en' | 'es' | 'fr', firstName: string) {
  if (lang === 'sr') {
    return {
      subject: `Dobrodošao na GigZone, ${firstName}!`,
      greeting: `Zdravo, ${firstName}! 👋`,
      intro: 'Dobrodošao na GigZone — platformu koja spaja profesionalce i klijente na jednom mestu. Ovde možeš ponuditi usluge, tražiti radnike, oglasiti potrebu — ili pratiti šta rade drugi.',
      bullets: isPro
        ? `<li>🔧 <strong>Stranica Usluge</strong> — Objavi svoju uslugu ili portfolio. Tu te pronalaze klijenti koji traže nekog poput tebe.<br/><span style="color:#888;font-size:13px">Npr. "Elektroinstalacije — Beograd, iskustvo 10 godina"</span></li>
           <li>👷 <strong>Stranica Poslovi → Zapošljavanje</strong> — Trebaš radnika? Objavi oglas i čekaj prijave.</li>
           <li>📱 <strong>Feed</strong> — Podeli slike svojih radova i projekata. Gradi reputaciju i privuci klijente organskim putem.</li>
           <li>🖼️ <strong>Dodaj profilnu sliku</strong> — Profili sa slikom dobijaju 3× više pažnje.</li>`
        : `<li>🔍 <strong>Stranica Poslovi → Tražim uslugu</strong> — Objavi šta ti treba i čekaj ponude majstora.<br/><span style="color:#888;font-size:13px">Npr. "Trebam molera za stan 60m², Novi Sad"</span></li>
           <li>💼 <strong>Stranica Poslovi → Tražim posao</strong> — Oglasi se ako tražiš posao za sebe.<br/><span style="color:#888;font-size:13px">Npr. "Tražim posao konobara, Beograd"</span></li>
           <li>👷 <strong>Stranica Poslovi → Tražim radnika</strong> — Trebaš nekoga za posao? Objavi oglas i čekaj prijave.<br/><span style="color:#888;font-size:13px">Npr. "Tražim konobara za restoran, Beograd"</span></li>
           <li>🛠️ <strong>Stranica Usluge</strong> — Pregledaj profesionalce, čitaj recenzije i kontaktiraj direktno.</li>
           <li>📱 <strong>Feed</strong> — Objavljuj projekte, pitaj za savete, prati profesionalce.</li>
           <li>🖼️ <strong>Dodaj profilnu sliku</strong> — Profili sa slikom dobijaju 3× više pažnje.</li>`,
      cta: isPro ? 'Objavi prvi oglas' : 'Istraži GigZone',
      social: 'Povremeno dijelimo najbolje oglase na našem <strong>TikTok</strong> i <strong>Instagram</strong> nalogu — tvoj oglas može biti jedan od njih!',
      footer: 'Ako imaš pitanja, samo odgovori na ovaj mejl.',
      team: 'GigZone tim',
    };
  }

  if (lang === 'de') {
    return {
      subject: `Willkommen bei GigZone, ${firstName}!`,
      greeting: `Hallo, ${firstName}! 👋`,
      intro: 'Willkommen bei GigZone — der Plattform, die Profis und Kunden verbindet. Hier kannst du Dienstleistungen anbieten, Mitarbeiter suchen oder einfach verfolgen, was andere tun.',
      bullets: isPro
        ? `<li>🔧 <strong>Seite Dienstleistungen</strong> — Veröffentliche deine Dienstleistung oder Portfolio. Hier finden dich Kunden.<br/><span style="color:#888;font-size:13px">Bsp. "Elektroinstallationen — Berlin, 10 Jahre Erfahrung"</span></li>
           <li>👷 <strong>Jobs → Stellenanzeige</strong> — Brauchst du Mitarbeiter? Schalte eine Anzeige und warte auf Bewerbungen.</li>
           <li>📱 <strong>Feed</strong> — Teile Fotos deiner Projekte. Baue deinen Ruf auf und gewinne Kunden.</li>
           <li>🖼️ <strong>Profilbild hinzufügen</strong> — Profile mit Foto erhalten 3× mehr Aufmerksamkeit.</li>`
        : `<li>🔍 <strong>Jobs → Dienstleistung suchen</strong> — Beschreibe, was du brauchst, und warte auf Angebote.<br/><span style="color:#888;font-size:13px">Bsp. "Suche Maler für 60m² Wohnung, Wien"</span></li>
           <li>💼 <strong>Jobs → Arbeit suchen</strong> — Melde dich, wenn du eine Stelle für dich suchst.<br/><span style="color:#888;font-size:13px">Bsp. "Suche Kellnerstelle, Berlin"</span></li>
           <li>👷 <strong>Jobs → Mitarbeiter suchen</strong> — Brauchst du jemanden für eine Stelle? Schalte eine Anzeige.<br/><span style="color:#888;font-size:13px">Bsp. "Suche Kellner für Restaurant, Berlin"</span></li>
           <li>🛠️ <strong>Seite Dienstleistungen</strong> — Durchsuche Profile, lies Bewertungen und kontaktiere direkt.</li>
           <li>📱 <strong>Feed</strong> — Teile Projekte, frage um Rat, folge Profis.</li>
           <li>🖼️ <strong>Profilbild hinzufügen</strong> — Profile mit Foto erhalten 3× mehr Aufmerksamkeit.</li>`,
      cta: isPro ? 'Erste Anzeige schalten' : 'GigZone entdecken',
      social: 'Wir teilen gelegentlich die besten Anzeigen auf unserem <strong>TikTok</strong> und <strong>Instagram</strong> — deine könnte dabei sein!',
      footer: 'Bei Fragen antworte einfach auf diese E-Mail.',
      team: 'Das GigZone-Team',
    };
  }

  if (lang === 'es') {
    return {
      subject: `¡Bienvenido a GigZone, ${firstName}!`,
      greeting: `¡Hola, ${firstName}! 👋`,
      intro: 'Bienvenido a GigZone — la plataforma que conecta profesionales y clientes en un solo lugar. Ofrece servicios, busca trabajadores, publica una solicitud de trabajo o sigue lo que hacen los demás.',
      bullets: isPro
        ? `<li>🔧 <strong>Página de Servicios</strong> — Publica tu servicio o portfolio. Aquí te encuentran los clientes.<br/><span style="color:#888;font-size:13px">Ej. "Instalaciones eléctricas — Madrid, 10 años de experiencia"</span></li>
           <li>👷 <strong>Empleos → Contratación</strong> — ¿Necesitas un trabajador? Publica un anuncio y espera solicitudes.</li>
           <li>📱 <strong>Feed</strong> — Comparte fotos de tu trabajo. Construye tu reputación y atrae clientes.</li>
           <li>🖼️ <strong>Añade foto de perfil</strong> — Los perfiles con foto reciben 3× más atención.</li>`
        : `<li>🔍 <strong>Empleos → Busco servicio</strong> — Publica lo que necesitas y espera ofertas de profesionales.<br/><span style="color:#888;font-size:13px">Ej. "Necesito pintor para piso de 60m², Madrid"</span></li>
           <li>💼 <strong>Empleos → Busco trabajo</strong> — Publica que estás buscando empleo.<br/><span style="color:#888;font-size:13px">Ej. "Busco puesto de camarero, Barcelona"</span></li>
           <li>👷 <strong>Empleos → Contratación</strong> — ¿Necesitas a alguien? Publica un anuncio y espera solicitudes.<br/><span style="color:#888;font-size:13px">Ej. "Busco camarero para restaurante, Madrid"</span></li>
           <li>🛠️ <strong>Página de Servicios</strong> — Explora profesionales, lee reseñas y contáctalos directamente.</li>
           <li>📱 <strong>Feed</strong> — Comparte proyectos, pide consejos, sigue profesionales.</li>
           <li>🖼️ <strong>Añade foto de perfil</strong> — Los perfiles con foto reciben 3× más atención.</li>`,
      cta: isPro ? 'Publica tu primer anuncio' : 'Explorar GigZone',
      social: 'De vez en cuando compartimos los mejores anuncios en nuestro <strong>TikTok</strong> e <strong>Instagram</strong> — ¡el tuyo podría ser uno de ellos!',
      footer: 'Si tienes preguntas, solo responde a este correo.',
      team: 'El equipo de GigZone',
    };
  }

  if (lang === 'fr') {
    return {
      subject: `Bienvenue sur GigZone, ${firstName} !`,
      greeting: `Bonjour, ${firstName} ! 👋`,
      intro: "Bienvenue sur GigZone — la plateforme qui connecte professionnels et clients en un seul endroit. Proposez des services, trouvez des travailleurs, publiez une demande d'emploi ou suivez ce que font les autres.",
      bullets: isPro
        ? `<li>🔧 <strong>Page Services</strong> — Publiez votre service ou portfolio. C'est ici que les clients vous trouvent.<br/><span style="color:#888;font-size:13px">Ex. "Installations électriques — Paris, 10 ans d'expérience"</span></li>
           <li>👷 <strong>Emplois → Recrutement</strong> — Besoin d'un travailleur ? Publiez une annonce et attendez les candidatures.</li>
           <li>📱 <strong>Feed</strong> — Partagez des photos de vos travaux. Construisez votre réputation et attirez des clients.</li>
           <li>🖼️ <strong>Ajoutez une photo de profil</strong> — Les profils avec photo reçoivent 3× plus d'attention.</li>`
        : `<li>🔍 <strong>Emplois → Cherche service</strong> — Publiez ce dont vous avez besoin et attendez des offres de professionnels.<br/><span style="color:#888;font-size:13px">Ex. "Besoin d'un peintre pour 60m², Paris"</span></li>
           <li>💼 <strong>Emplois → Cherche travail</strong> — Publiez que vous cherchez un emploi.<br/><span style="color:#888;font-size:13px">Ex. "Cherche poste de serveur, Lyon"</span></li>
           <li>👷 <strong>Emplois → Recrutement</strong> — Besoin de quelqu'un ? Publiez une annonce.<br/><span style="color:#888;font-size:13px">Ex. "Cherche serveur pour restaurant, Paris"</span></li>
           <li>🛠️ <strong>Page Services</strong> — Parcourez les profils, lisez les avis et contactez directement.</li>
           <li>📱 <strong>Feed</strong> — Partagez des projets, demandez des conseils, suivez des professionnels.</li>
           <li>🖼️ <strong>Ajoutez une photo de profil</strong> — Les profils avec photo reçoivent 3× plus d'attention.</li>`,
      cta: isPro ? 'Publier votre première annonce' : 'Explorer GigZone',
      social: 'Nous partageons occasionnellement les meilleures annonces sur notre <strong>TikTok</strong> et <strong>Instagram</strong> — la vôtre pourrait en faire partie !',
      footer: 'Si vous avez des questions, répondez simplement à cet e-mail.',
      team: "L'équipe GigZone",
    };
  }

  return {
    subject: `Welcome to GigZone, ${firstName}!`,
    greeting: `Hello, ${firstName}! 👋`,
    intro: 'Welcome to GigZone — the platform connecting professionals and clients in one place. Offer services, find workers, post a job request — or just follow what others are doing.',
    bullets: isPro
      ? `<li>🔧 <strong>Services page</strong> — Post your service or portfolio. This is where clients find you.<br/><span style="color:#888;font-size:13px">E.g. "Electrical work — Belgrade, 10 years experience"</span></li>
         <li>👷 <strong>Jobs → Hiring</strong> — Need a worker? Post a job listing and wait for applications.</li>
         <li>📱 <strong>Feed</strong> — Share photos of your work and projects. Build your reputation and attract clients.</li>
         <li>🖼️ <strong>Add a profile photo</strong> — Profiles with photos get 3× more attention.</li>`
      : `<li>🔍 <strong>Jobs → Looking for a service</strong> — Post what you need and wait for offers from professionals.<br/><span style="color:#888;font-size:13px">E.g. "Need a painter for 60m² apartment, Novi Sad"</span></li>
         <li>💼 <strong>Jobs → Looking for work</strong> — Post that you're looking for a job for yourself.<br/><span style="color:#888;font-size:13px">E.g. "Looking for waiter position, Belgrade"</span></li>
         <li>👷 <strong>Jobs → Hiring</strong> — Need someone for a role? Post a listing and wait for applications.<br/><span style="color:#888;font-size:13px">E.g. "Looking for a waiter for restaurant, Belgrade"</span></li>
         <li>🛠️ <strong>Services page</strong> — Browse professionals, read reviews and contact them directly.</li>
         <li>📱 <strong>Feed</strong> — Share projects, ask for advice, follow professionals.</li>
         <li>🖼️ <strong>Add a profile photo</strong> — Profiles with photos get 3× more attention.</li>`,
    cta: isPro ? 'Post your first listing' : 'Explore GigZone',
    social: 'We occasionally share the best listings on our <strong>TikTok</strong> and <strong>Instagram</strong> — yours could be one of them!',
    footer: 'If you have any questions, just reply to this email.',
    team: 'The GigZone Team',
  };
}

export async function POST(request: NextRequest) {
  try {
    const { userId } = await request.json();
    if (!userId) return NextResponse.json({ error: 'Missing userId' }, { status: 400 });

    if (!process.env.BREVO_API_KEY) return NextResponse.json({ ok: true });

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const { data: profile } = await supabase
      .from('profiles')
      .select('name, email, account_type, is_premium, country')
      .eq('id', userId)
      .single();

    if (!profile?.email) return NextResponse.json({ ok: true });

    const firstName = profile.name?.split(' ')[0] || profile.name || 'there';
    const isPro = (profile as any).is_premium === true;

    let lang: 'sr' | 'de' | 'en' | 'es' | 'fr' = 'en';
    if (BALKAN_COUNTRIES.includes(profile.country)) lang = 'sr';
    else if (GERMAN_COUNTRIES.includes(profile.country)) lang = 'de';
    else if (SPANISH_COUNTRIES.includes(profile.country)) lang = 'es';
    else if (FRENCH_COUNTRIES.includes(profile.country)) lang = 'fr';

    const c = getContent(isPro, lang, firstName);
    const ctaUrl = isPro ? 'https://gigzone.app/create-post' : 'https://gigzone.app/feed';

    await sendEmail({
      to: profile.email,
      replyTo: 'support@gigzone.app',
      subject: c.subject,
      html: `
          <div style="font-family:sans-serif;max-width:520px;margin:0 auto;color:#1a1a1a">
            <div style="text-align:center;padding:32px 0 16px">
              <span style="font-size:24px;font-weight:900;letter-spacing:-0.5px">
                Gig<span style="color:#ea580c">Zone</span>
              </span>
            </div>

            <div style="background:#ffffff;border:1px solid #e5e7eb;border-radius:16px;padding:32px">
              <h2 style="margin:0 0 8px;font-size:22px">${c.greeting}</h2>
              <p style="color:#555;margin:0 0 20px">${c.intro}</p>

              <ul style="color:#333;margin:0 0 24px;padding-left:20px;line-height:2">
                ${c.bullets}
              </ul>

              <div style="text-align:center;margin:28px 0">
                <a href="${ctaUrl}"
                   style="background:#ea580c;color:#fff;text-decoration:none;padding:14px 32px;border-radius:12px;font-weight:700;font-size:16px;display:inline-block">
                  ${c.cta}
                </a>
              </div>

              <p style="color:#555;font-size:14px;background:#fff7ed;border:1px solid #fed7aa;border-radius:10px;padding:14px 16px;margin:0 0 20px">
                📱 ${c.social}
              </p>

              <p style="color:#888;font-size:13px;margin:24px 0 0">
                ${c.footer}<br/>
                <strong>${c.team}</strong>
              </p>
            </div>

            <p style="text-align:center;color:#aaa;font-size:11px;margin-top:20px">
              GigZone · gigzone.app
            </p>
          </div>
        `,
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('Welcome email error:', err);
    return NextResponse.json({ ok: true });
  }
}
