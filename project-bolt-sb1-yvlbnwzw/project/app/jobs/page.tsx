'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase/client';
import { useAuth } from '@/lib/contexts/auth-context';
import { findOrCreateThread } from '@/lib/thread-utils';
import { usePageTracking } from '@/lib/hooks/use-page-tracking';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Briefcase, Users, UserCircle, MessageCircle, Plus, MoreVertical, Trash2, Send, X, Bookmark, Share2, MapPin, Star, Clock } from 'lucide-react';
import { toast } from 'sonner';
import { formatDistanceToNow } from 'date-fns';

export const revalidate = 0;

import { useLanguage } from '@/lib/contexts/language-context';
import { CreateMarketplacePostModal } from '@/components/create-marketplace-post-modal';
import { SharePostModal } from '@/components/share-post-modal';
import { CityAutocomplete } from '@/components/city-autocomplete';
import { CategoryCombobox } from '@/components/category-combobox';
import { OfferServiceModal } from '@/components/offer-service-modal';
import { SendOfferModal } from '@/components/send-offer-modal-v2';
import { JobApplicationModal } from '@/components/job-application-modal';

type Post = {
  id: string;
  user_id: string;
  text: string | null;
  post_type: 'portfolio_post' | 'hiring_post' | 'service_request' | 'job_seeker_post' | 'social_post';
  job_title?: string | null;
  profession?: string | null;
  category?: string | null;
  city?: string | null;
  experience_level?: string | null;
  location?: string | null;
  availability?: string | null;
  price_type?: string | null;
  price_value?: number | null;
  currency?: string | null;
  created_at: string;
  user: {
    name: string;
    email: string;
    account_type: 'professional' | 'customer';
    avatar_url?: string | null;
  };
};

const DEMO_POSTS: Post[] = [
  // ── HIRING (20) ──────────────────────────────────────────────────────────
  {
    id: 'demo-h1',
    user_id: '00000000-0000-0000-0000-000000000001',
    text: 'Tražimo iskusnog vodoinstalatera za opremanje novogradnje u Novom Beogradu. Posao uključuje montažu kupatila, kuhinja i instalacionih šahtova. Prednost imaju kandidati sa iskustvom na sličnim projektima.',
    post_type: 'hiring_post',
    job_title: 'Vodoinstalater za novogradnju',
    category: 'Vodoinstalater',
    city: 'Beograd',
    experience_level: 'Mid',
    availability: 'Within 1 week',
    created_at: new Date(Date.now() - 1 * 60 * 60 * 1000).toISOString(),
    user: { name: 'Gradnja Plus d.o.o.', email: 'demo@example.com', account_type: 'customer' },
  },
  {
    id: 'demo-h2',
    user_id: '00000000-0000-0000-0000-000000000002',
    text: 'Potreban električar za završne radove u stambeno-poslovnom objektu. Ugradnja razvodnih tabli, utičnica, osvetljenja i spoljašnje rasvete. Rad po potrebi i vikendom.',
    post_type: 'hiring_post',
    job_title: 'Elektroinstalatere — stambeni objekat',
    category: 'Elektricar',
    city: 'Novi Sad',
    experience_level: 'Senior',
    availability: 'Immediately',
    created_at: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
    user: { name: 'InvestBuild NS', email: 'demo@example.com', account_type: 'customer' },
  },
  {
    id: 'demo-h3',
    user_id: '00000000-0000-0000-0000-000000000003',
    text: 'Tražimo majstora za renoviranje stana 65m² — farbanje, gletovanje, postavljanje pločica u kupatilu i kuhinji. Stan u Zemunu, slobodan odmah.',
    post_type: 'hiring_post',
    job_title: 'Majstor za renoviranje stana',
    category: 'Soboslikar',
    city: 'Beograd',
    experience_level: 'Entry',
    availability: 'Immediately',
    created_at: new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString(),
    user: { name: 'Milena Jovanović', email: 'demo@example.com', account_type: 'customer' },
  },
  {
    id: 'demo-h4',
    user_id: '00000000-0000-0000-0000-000000000104',
    text: 'Agencija za nekretnine traži iskusnog zidara za kompletno uređenje dva stana na Vračaru. Gips, cigla, betonski radovi. Cena po dogovoru, posao kreće odmah.',
    post_type: 'hiring_post',
    job_title: 'Zidar — kompletna adaptacija stanova',
    category: 'Zidar',
    city: 'Beograd',
    experience_level: 'Senior',
    availability: 'Immediately',
    created_at: new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString(),
    user: { name: 'Remax Nekretnine', email: 'demo@example.com', account_type: 'customer' },
  },
  {
    id: 'demo-h5',
    user_id: '00000000-0000-0000-0000-000000000105',
    text: 'IT kompanija traži junior web developera (React/Next.js). Rad od kuće, fleksibilno radno vreme. Obuka i mentorstvo uključeni za prave kandidate.',
    post_type: 'hiring_post',
    job_title: 'Junior Web Developer (React)',
    category: 'IT',
    city: 'Beograd',
    experience_level: 'Entry',
    availability: 'Within 2 weeks',
    created_at: new Date(Date.now() - 5 * 60 * 60 * 1000).toISOString(),
    user: { name: 'TechSoft d.o.o.', email: 'demo@example.com', account_type: 'customer' },
  },
  {
    id: 'demo-h6',
    user_id: '00000000-0000-0000-0000-000000000106',
    text: 'Restoran u centru Beograda traži iskusnog kuvara specijalizovanog za domaću kuhinju. Puna radna nedelja, redovna primanja, dobri uslovi.',
    post_type: 'hiring_post',
    job_title: 'Kuvar — restoran, domaća kuhinja',
    category: 'Ugostiteljstvo',
    city: 'Beograd',
    experience_level: 'Mid',
    availability: 'Immediately',
    created_at: new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString(),
    user: { name: 'Restoran Kod Dragana', email: 'demo@example.com', account_type: 'customer' },
  },
  {
    id: 'demo-h7',
    user_id: '00000000-0000-0000-0000-000000000107',
    text: 'Tražimo vozača kategorije C+E za distribuciju robe na teritoriji Srbije. Pozitivna vozačka istorija obavezna. Stalno zaposlenje, redovna plata + dnevnice.',
    post_type: 'hiring_post',
    job_title: 'Vozač C+E — distribucija robe',
    category: 'Transport',
    city: 'Subotica',
    experience_level: 'Mid',
    availability: 'Within 1 week',
    created_at: new Date(Date.now() - 7 * 60 * 60 * 1000).toISOString(),
    user: { name: 'Logistika Pro d.o.o.', email: 'demo@example.com', account_type: 'customer' },
  },
  {
    id: 'demo-h8',
    user_id: '00000000-0000-0000-0000-000000000108',
    text: 'Stolarija Nikolić traži stolara za izradu kuhinja i nameštaja po meri. Rad u radionici u Kragujevcu, stabilno zaposlenje, mogućnost napredovanja.',
    post_type: 'hiring_post',
    job_title: 'Stolar — nameštaj po meri',
    category: 'Stolar',
    city: 'Kragujevac',
    experience_level: 'Mid',
    availability: 'Immediately',
    created_at: new Date(Date.now() - 9 * 60 * 60 * 1000).toISOString(),
    user: { name: 'Stolarija Nikolić', email: 'demo@example.com', account_type: 'customer' },
  },
  {
    id: 'demo-h9',
    user_id: '00000000-0000-0000-0000-000000000109',
    text: 'Auto servis u Beogradu traži automehaničara sa iskustvom u dijagnostici i popravci putničkih vozila svih marki. Moderna oprema, dobri uslovi rada.',
    post_type: 'hiring_post',
    job_title: 'Automehaničar — dijagnostika i servis',
    category: 'Automehaničar',
    city: 'Beograd',
    experience_level: 'Senior',
    availability: 'Immediately',
    created_at: new Date(Date.now() - 10 * 60 * 60 * 1000).toISOString(),
    user: { name: 'AutoFix Servis', email: 'demo@example.com', account_type: 'customer' },
  },
  {
    id: 'demo-h10',
    user_id: '00000000-0000-0000-0000-000000000110',
    text: 'Privatna stomatološka ordinacija u Novom Sadu traži medicinsku sestru/tehničara sa iskustvom u stomatologiji. Prijavite se sa CV-om.',
    post_type: 'hiring_post',
    job_title: 'Medicinska sestra — stomatologija',
    category: 'Medicina',
    city: 'Novi Sad',
    experience_level: 'Mid',
    availability: 'Within 2 weeks',
    created_at: new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString(),
    user: { name: 'Ordinacija Dr. Marić', email: 'demo@example.com', account_type: 'customer' },
  },
  {
    id: 'demo-h11',
    user_id: '00000000-0000-0000-0000-000000000111',
    text: 'Frizerski salon u Nišu traži iskusnog frizera/frizerana za puno radno vreme. Moderna oprema, stalni klijenti, dobra zarada.',
    post_type: 'hiring_post',
    job_title: 'Frizer — puno radno vreme',
    category: 'Frizer',
    city: 'Niš',
    experience_level: 'Mid',
    availability: 'Immediately',
    created_at: new Date(Date.now() - 14 * 60 * 60 * 1000).toISOString(),
    user: { name: 'Salon Glamour', email: 'demo@example.com', account_type: 'customer' },
  },
  {
    id: 'demo-h12',
    user_id: '00000000-0000-0000-0000-000000000112',
    text: 'Osnovna škola u Nišu traži profesora matematike za dopunsku nastavu i pripremu učenika za prijemni ispit. Honorarni angažman, fleksibilno vreme.',
    post_type: 'hiring_post',
    job_title: 'Profesor matematike — dopunska nastava',
    category: 'Edukacija',
    city: 'Niš',
    experience_level: 'Mid',
    availability: 'Within 1 week',
    created_at: new Date(Date.now() - 16 * 60 * 60 * 1000).toISOString(),
    user: { name: 'OŠ Branko Radičević', email: 'demo@example.com', account_type: 'customer' },
  },
  {
    id: 'demo-h13',
    user_id: '00000000-0000-0000-0000-000000000113',
    text: 'Marketing agencija traži grafičkog dizajnera sa iskustvom u Adobe paketu i Figmi. Rad od kuće, projekti za regionalna tržišta. Šalji portfolio.',
    post_type: 'hiring_post',
    job_title: 'Grafički dizajner — remote',
    category: 'Dizajn',
    city: 'Beograd',
    experience_level: 'Mid',
    availability: 'Within 1 week',
    created_at: new Date(Date.now() - 18 * 60 * 60 * 1000).toISOString(),
    user: { name: 'PixelMind Agency', email: 'demo@example.com', account_type: 'customer' },
  },
  {
    id: 'demo-h14',
    user_id: '00000000-0000-0000-0000-000000000114',
    text: 'Advokatska kancelarija traži advokatskog pripravnika ili mlađeg pravnika za rad u oblastima privrednog i radnog prava. Beograd, puno radno vreme.',
    post_type: 'hiring_post',
    job_title: 'Advokatski pripravnik / Mlađi pravnik',
    category: 'Pravo',
    city: 'Beograd',
    experience_level: 'Entry',
    availability: 'Within 2 weeks',
    created_at: new Date(Date.now() - 20 * 60 * 60 * 1000).toISOString(),
    user: { name: 'Advokatska kancelarija Đorđić', email: 'demo@example.com', account_type: 'customer' },
  },
  {
    id: 'demo-h15',
    user_id: '00000000-0000-0000-0000-000000000115',
    text: 'Privatna fizioterapeutska klinika u Novom Sadu traži fizioterapeuta za rad sa pacijentima. Potrebna licenca i iskustvo u manuelnoj terapiji.',
    post_type: 'hiring_post',
    job_title: 'Fizioterapeut — privatna klinika',
    category: 'Fizioterapija',
    city: 'Novi Sad',
    experience_level: 'Mid',
    availability: 'Within 1 week',
    created_at: new Date(Date.now() - 22 * 60 * 60 * 1000).toISOString(),
    user: { name: 'Klinika Vital NS', email: 'demo@example.com', account_type: 'customer' },
  },
  {
    id: 'demo-h16',
    user_id: '00000000-0000-0000-0000-000000000116',
    text: 'Računovodstvena agencija traži računovođu sa iskustvom u vođenju knjiga za mala i srednja preduzeća. Poznavanje softvera Pantheon ili Minimax je prednost.',
    post_type: 'hiring_post',
    job_title: 'Računovođa — mala i srednja preduzeća',
    category: 'Računovodstvo',
    city: 'Novi Sad',
    experience_level: 'Mid',
    availability: 'Within 2 weeks',
    created_at: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
    user: { name: 'Finans Konsalting', email: 'demo@example.com', account_type: 'customer' },
  },
  {
    id: 'demo-h17',
    user_id: '00000000-0000-0000-0000-000000000117',
    text: 'Građevinska firma traži iskusnog keramičara za postavljanje pločica u novim stanovima. Dugotrajni angažman, redovne isplate, rad na Novom Beogradu.',
    post_type: 'hiring_post',
    job_title: 'Keramičar — novogradnja Novi Beograd',
    category: 'Keramičar',
    city: 'Beograd',
    experience_level: 'Senior',
    availability: 'Immediately',
    created_at: new Date(Date.now() - 28 * 60 * 60 * 1000).toISOString(),
    user: { name: 'Megabuild d.o.o.', email: 'demo@example.com', account_type: 'customer' },
  },
  {
    id: 'demo-h18',
    user_id: '00000000-0000-0000-0000-000000000118',
    text: 'Manja IT firma traži senior backend developera (Node.js/PostgreSQL). Remote rad, kompetitivna plata, internacionalni projekti. Pošalji GitHub profil.',
    post_type: 'hiring_post',
    job_title: 'Senior Backend Developer (Node.js)',
    category: 'IT',
    city: 'Beograd',
    experience_level: 'Senior',
    availability: 'Within 2 weeks',
    created_at: new Date(Date.now() - 32 * 60 * 60 * 1000).toISOString(),
    user: { name: 'DevCore Solutions', email: 'demo@example.com', account_type: 'customer' },
  },
  {
    id: 'demo-h19',
    user_id: '00000000-0000-0000-0000-000000000119',
    text: 'Hotel u Vrnjačkoj Banji traži konobara/konobaricu sa iskustvom u fine dining restoranu. Smeštaj obezbeđen, sezonski posao april–oktobar.',
    post_type: 'hiring_post',
    job_title: 'Konobar/Konobarica — hotel 4*',
    category: 'Ugostiteljstvo',
    city: 'Vrnjačka Banja',
    experience_level: 'Entry',
    availability: 'Immediately',
    created_at: new Date(Date.now() - 36 * 60 * 60 * 1000).toISOString(),
    user: { name: 'Hotel Merkur', email: 'demo@example.com', account_type: 'customer' },
  },
  {
    id: 'demo-h20',
    user_id: '00000000-0000-0000-0000-000000000120',
    text: 'Firma za uređenje enterijera traži molera sa iskustvom u dekorativnim tehnikama (venecijaner, štukatura, mikročement). Beograd i okolina.',
    post_type: 'hiring_post',
    job_title: 'Moler — dekorativne tehnike',
    category: 'Soboslikar',
    city: 'Beograd',
    experience_level: 'Expert',
    availability: 'Within 1 week',
    created_at: new Date(Date.now() - 40 * 60 * 60 * 1000).toISOString(),
    user: { name: 'Enterijer Design Studio', email: 'demo@example.com', account_type: 'customer' },
  },

  // ── SERVICE REQUESTS (20) ─────────────────────────────────────────────────
  {
    id: 'demo-s1',
    user_id: '00000000-0000-0000-0000-000000000201',
    text: 'Potrebna kompletna rekonstrukcija krovišta na porodičnoj kući površine 120m². Uključuje zamenu letvi, pokrivanje crepom i ugradnju oluka.',
    post_type: 'service_request',
    job_title: 'Rekonstrukcija krovišta — kuća 120m²',
    category: 'Krovopokrivač',
    city: 'Kragujevac',
    availability: 'Within 2 weeks',
    price_type: 'fixed',
    price_value: 3500,
    currency: 'EUR',
    created_at: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
    user: { name: 'Dragan Petrović', email: 'demo@example.com', account_type: 'customer' },
  },
  {
    id: 'demo-s2',
    user_id: '00000000-0000-0000-0000-000000000202',
    text: 'Tražim servisera za klimu — čišćenje i punjenje freonom za 3 klima uređaja u poslovnom prostoru. Hitno, za sledeću nedelju.',
    post_type: 'service_request',
    job_title: 'Servis klima uređaja — 3 komada',
    category: 'Klima tehničar',
    city: 'Niš',
    availability: 'Within 1 week',
    price_type: 'fixed',
    price_value: 120,
    currency: 'EUR',
    created_at: new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString(),
    user: { name: 'Aleksa Stojanović', email: 'demo@example.com', account_type: 'customer' },
  },
  {
    id: 'demo-s3',
    user_id: '00000000-0000-0000-0000-000000000203',
    text: 'Pukla cev pod podom u kupatilu. Potrebna hitna intervencija vodoinstalatera. Lokacija: Čukarica, Beograd. Dostupan tokom celog dana.',
    post_type: 'service_request',
    job_title: 'Hitna popravka vodovodne cevi',
    category: 'Vodoinstalater',
    city: 'Beograd',
    availability: 'Immediately',
    price_type: 'negotiable',
    created_at: new Date(Date.now() - 1 * 60 * 60 * 1000).toISOString(),
    user: { name: 'Ivana Lukić', email: 'demo@example.com', account_type: 'customer' },
  },
  {
    id: 'demo-s4',
    user_id: '00000000-0000-0000-0000-000000000204',
    text: 'Tražim majstora za ugradnju centralnog grejanja u stanu 55m². Potrebna izrada projekta i postavljanje radijatora, kotla i svih instalacija.',
    post_type: 'service_request',
    job_title: 'Ugradnja centralnog grejanja — stan 55m²',
    category: 'Vodoinstalater',
    city: 'Novi Sad',
    availability: 'Within 2 weeks',
    price_type: 'fixed',
    price_value: 2200,
    currency: 'EUR',
    created_at: new Date(Date.now() - 5 * 60 * 60 * 1000).toISOString(),
    user: { name: 'Marko Đorđević', email: 'demo@example.com', account_type: 'customer' },
  },
  {
    id: 'demo-s5',
    user_id: '00000000-0000-0000-0000-000000000205',
    text: 'Potrebno farbanje cele kuće spolja — fasada i drveni delovi (prozori, vrata, kapija). Kuća u Zemunu, oko 180m² fasade. Nudite cenu i rok.',
    post_type: 'service_request',
    job_title: 'Farbanje fasade i drvenih delova — kuća',
    category: 'Soboslikar',
    city: 'Beograd',
    availability: 'Within 2 weeks',
    price_type: 'negotiable',
    created_at: new Date(Date.now() - 7 * 60 * 60 * 1000).toISOString(),
    user: { name: 'Stefan Pavlović', email: 'demo@example.com', account_type: 'customer' },
  },
  {
    id: 'demo-s6',
    user_id: '00000000-0000-0000-0000-000000000206',
    text: 'Tražim keramičara za postavljanje pločica u novom kupatilu — oko 22m² zidova i 6m² poda. Pločice su kupljene. Novi Sad, Detelinara.',
    post_type: 'service_request',
    job_title: 'Postavljanje pločica — kupatilo 6m²',
    category: 'Keramičar',
    city: 'Novi Sad',
    availability: 'Within 1 week',
    price_type: 'fixed',
    price_value: 450,
    currency: 'EUR',
    created_at: new Date(Date.now() - 9 * 60 * 60 * 1000).toISOString(),
    user: { name: 'Jelena Nikolić', email: 'demo@example.com', account_type: 'customer' },
  },
  {
    id: 'demo-s7',
    user_id: '00000000-0000-0000-0000-000000000207',
    text: 'Potrebne kompletne elektro instalacije u kući površine 140m². Ugradnja razvoda, osvetljenja, alarmnog sistema i video nadzora. Kragujevac.',
    post_type: 'service_request',
    job_title: 'Kompletne elektro instalacije — kuća',
    category: 'Elektricar',
    city: 'Kragujevac',
    availability: 'Within 2 weeks',
    price_type: 'negotiable',
    created_at: new Date(Date.now() - 11 * 60 * 60 * 1000).toISOString(),
    user: { name: 'Bojan Simić', email: 'demo@example.com', account_type: 'customer' },
  },
  {
    id: 'demo-s8',
    user_id: '00000000-0000-0000-0000-000000000208',
    text: 'Tražim firmu za selidbu. Dvosobni stan (40m²) sa Vračara na Novi Beograd. Ima nameštaj, kućni aparati i oko 30 kutija. Potrebno za petak 25.04.',
    post_type: 'service_request',
    job_title: 'Selidba dvosobnog stana — Beograd',
    category: 'Selidbe',
    city: 'Beograd',
    availability: 'Within 1 week',
    price_type: 'negotiable',
    created_at: new Date(Date.now() - 13 * 60 * 60 * 1000).toISOString(),
    user: { name: 'Ana Vuković', email: 'demo@example.com', account_type: 'customer' },
  },
  {
    id: 'demo-s9',
    user_id: '00000000-0000-0000-0000-000000000209',
    text: 'Automobil BMW E90 ima problem sa automatskim menjačem — proklizava u trećoj brzini. Tražim iskusnog auto-mehaničara za dijagnostiku i popravku. Beograd.',
    post_type: 'service_request',
    job_title: 'Popravka automatskog menjača — BMW',
    category: 'Automehaničar',
    city: 'Beograd',
    availability: 'Within 1 week',
    price_type: 'negotiable',
    created_at: new Date(Date.now() - 15 * 60 * 60 * 1000).toISOString(),
    user: { name: 'Milan Todorović', email: 'demo@example.com', account_type: 'customer' },
  },
  {
    id: 'demo-s10',
    user_id: '00000000-0000-0000-0000-000000000210',
    text: 'Potrebna ugradnja laminatnog parketa u trosobnom stanu 75m² u Novom Sadu. Parket je kupljen, potrebna priprema podloge i montaža.',
    post_type: 'service_request',
    job_title: 'Ugradnja parketa — stan 75m²',
    category: 'Parketar',
    city: 'Novi Sad',
    availability: 'Within 2 weeks',
    price_type: 'fixed',
    price_value: 600,
    currency: 'EUR',
    created_at: new Date(Date.now() - 17 * 60 * 60 * 1000).toISOString(),
    user: { name: 'Snežana Ilić', email: 'demo@example.com', account_type: 'customer' },
  },
  {
    id: 'demo-s11',
    user_id: '00000000-0000-0000-0000-000000000211',
    text: 'Tražim majstora za montažu IKEA kuhinje. Kutije su isporučene, potrebna montaža sa ugradnjom peći, sudopere i nape. Čukarica, Beograd.',
    post_type: 'service_request',
    job_title: 'Montaža IKEA kuhinje',
    category: 'Stolar',
    city: 'Beograd',
    availability: 'Within 1 week',
    price_type: 'negotiable',
    created_at: new Date(Date.now() - 19 * 60 * 60 * 1000).toISOString(),
    user: { name: 'Tamara Ristić', email: 'demo@example.com', account_type: 'customer' },
  },
  {
    id: 'demo-s12',
    user_id: '00000000-0000-0000-0000-000000000212',
    text: 'Pranje i čišćenje tepiha (4 komada, ukupno 30m²) kod vas. Može i dostava i preuzimanje. Lokacija: Beograd Stari grad.',
    post_type: 'service_request',
    job_title: 'Pranje tepiha — 4 komada dostava',
    category: 'Čišćenje',
    city: 'Beograd',
    availability: 'Within 1 week',
    price_type: 'fixed',
    price_value: 6000,
    currency: 'RSD',
    created_at: new Date(Date.now() - 21 * 60 * 60 * 1000).toISOString(),
    user: { name: 'Gordana Popović', email: 'demo@example.com', account_type: 'customer' },
  },
  {
    id: 'demo-s13',
    user_id: '00000000-0000-0000-0000-000000000213',
    text: 'Potrebno generalno čišćenje stana 80m² nakon renoviranja. Prašina od gletovanja i farbanja, čišćenje svih površina. Novi Sad, hitno.',
    post_type: 'service_request',
    job_title: 'Generalno čišćenje posle renoviranja',
    category: 'Čišćenje',
    city: 'Novi Sad',
    availability: 'Immediately',
    price_type: 'fixed',
    price_value: 8000,
    currency: 'RSD',
    created_at: new Date(Date.now() - 23 * 60 * 60 * 1000).toISOString(),
    user: { name: 'Katarina Đurić', email: 'demo@example.com', account_type: 'customer' },
  },
  {
    id: 'demo-s14',
    user_id: '00000000-0000-0000-0000-000000000214',
    text: 'Tražim web developera za izradu jednostavnog sajta za frizerski salon — galerija, cenik, kontakt forma, rezervacija termina online. Beograd.',
    post_type: 'service_request',
    job_title: 'Izrada web sajta za frizerski salon',
    category: 'IT',
    city: 'Beograd',
    availability: 'Within 2 weeks',
    price_type: 'fixed',
    price_value: 500,
    currency: 'EUR',
    created_at: new Date(Date.now() - 25 * 60 * 60 * 1000).toISOString(),
    user: { name: 'Salon Mila', email: 'demo@example.com', account_type: 'customer' },
  },
  {
    id: 'demo-s15',
    user_id: '00000000-0000-0000-0000-000000000215',
    text: 'Laptop Lenovo ThinkPad ne pali. Tražim servisera koji može da dijagnostikuje i popravi motherboard ili zameni komponente. Niš.',
    post_type: 'service_request',
    job_title: 'Servis laptopa — dijagnostika i popravka',
    category: 'IT servis',
    city: 'Niš',
    availability: 'Immediately',
    price_type: 'negotiable',
    created_at: new Date(Date.now() - 27 * 60 * 60 * 1000).toISOString(),
    user: { name: 'Petar Milošević', email: 'demo@example.com', account_type: 'customer' },
  },
  {
    id: 'demo-s16',
    user_id: '00000000-0000-0000-0000-000000000216',
    text: 'Potrebna ugradnja kamene obloge na fasadu kuće — oko 60m². Tražim firmu ili majstora sa iskustvom u kamenu. Subotica.',
    post_type: 'service_request',
    job_title: 'Ugradnja kamene obloge — fasada 60m²',
    category: 'Zidar',
    city: 'Subotica',
    availability: 'Within 2 weeks',
    price_type: 'negotiable',
    created_at: new Date(Date.now() - 29 * 60 * 60 * 1000).toISOString(),
    user: { name: 'Zoltán Kovač', email: 'demo@example.com', account_type: 'customer' },
  },
  {
    id: 'demo-s17',
    user_id: '00000000-0000-0000-0000-000000000217',
    text: 'Tražim stomatologa za ekstrakciju umnjaka. Tražim preporuku ili direktnu vezu sa stomatologom koji prima van reda. Beograd.',
    post_type: 'service_request',
    job_title: 'Ekstrakcija umnjaka — hitno',
    category: 'Stomatologija',
    city: 'Beograd',
    availability: 'Immediately',
    price_type: 'negotiable',
    created_at: new Date(Date.now() - 31 * 60 * 60 * 1000).toISOString(),
    user: { name: 'Nataša Filipović', email: 'demo@example.com', account_type: 'customer' },
  },
  {
    id: 'demo-s18',
    user_id: '00000000-0000-0000-0000-000000000218',
    text: 'Potrebna ugradnja tende nad terasom 4x3m. Tražim ponude sa materijalima i montažom. Kuća u Zemunu, lako dostupna.',
    post_type: 'service_request',
    job_title: 'Ugradnja tende — terasa 4x3m',
    category: 'Bravarija',
    city: 'Beograd',
    availability: 'Within 2 weeks',
    price_type: 'negotiable',
    created_at: new Date(Date.now() - 33 * 60 * 60 * 1000).toISOString(),
    user: { name: 'Vesna Jović', email: 'demo@example.com', account_type: 'customer' },
  },
  {
    id: 'demo-s19',
    user_id: '00000000-0000-0000-0000-000000000219',
    text: 'Pranje fasade zgrade od 5 spratova visokotlačnom pompom. Potrebna ponuda sa skelihamom ili auto dizalicom. Novi Sad, Grbavica.',
    post_type: 'service_request',
    job_title: 'Pranje fasade zgrade — 5 spratova',
    category: 'Čišćenje',
    city: 'Novi Sad',
    availability: 'Within 2 weeks',
    price_type: 'negotiable',
    created_at: new Date(Date.now() - 35 * 60 * 60 * 1000).toISOString(),
    user: { name: 'Uprava zgrade Zmaj Jovina', email: 'demo@example.com', account_type: 'customer' },
  },
  {
    id: 'demo-s20',
    user_id: '00000000-0000-0000-0000-000000000220',
    text: 'Potrebna kompletna adaptacija stana 48m² — rušenje pregradnih zidova, nova elektrika, vodoinstalacije, gletovanje i keramika. Kragujevac.',
    post_type: 'service_request',
    job_title: 'Kompletna adaptacija stana 48m²',
    category: 'Građevinar',
    city: 'Kragujevac',
    availability: 'Within 2 weeks',
    price_type: 'fixed',
    price_value: 8000,
    currency: 'EUR',
    created_at: new Date(Date.now() - 37 * 60 * 60 * 1000).toISOString(),
    user: { name: 'Radoslav Stanković', email: 'demo@example.com', account_type: 'customer' },
  },

  // ── JOB SEEKERS (20) ──────────────────────────────────────────────────────
  {
    id: 'demo-j1',
    user_id: '00000000-0000-0000-0000-000000000301',
    text: 'Iskusan vodoinstalater sa 8 godina iskustva traži posao. Radim brzo i kvalitetno, dostupan za hitne intervencije i vikende. Reference na uvid.',
    post_type: 'job_seeker_post',
    job_title: 'Vodoinstalater — tražim posao',
    category: 'Vodoinstalater',
    city: 'Beograd',
    experience_level: 'Senior',
    availability: 'Immediately',
    price_type: 'hourly',
    price_value: 1500,
    currency: 'RSD',
    created_at: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
    user: { name: 'Nemanja Ilić', email: 'demo@example.com', account_type: 'professional' },
  },
  {
    id: 'demo-j2',
    user_id: '00000000-0000-0000-0000-000000000302',
    text: 'Majstor za gletovanje i farbanje sa 12 godina iskustva. Radim sva gletovanja — fino, grubo, dekorativna. Savestan i tačan. Dostupan u Beogradu i okolini.',
    post_type: 'job_seeker_post',
    job_title: 'Gletač/farbač — tražim angažman',
    category: 'Soboslikar',
    city: 'Beograd',
    experience_level: 'Expert',
    availability: 'Within 1 week',
    price_type: 'hourly',
    price_value: 1200,
    currency: 'RSD',
    created_at: new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString(),
    user: { name: 'Zoran Marković', email: 'demo@example.com', account_type: 'professional' },
  },
  {
    id: 'demo-j3',
    user_id: '00000000-0000-0000-0000-000000000303',
    text: 'Elektricar sa licencom, 10 godina iskustva u instalacijama i servisiranju električne opreme. Radim stambene i poslovne objekte. Novi Sad i okolina.',
    post_type: 'job_seeker_post',
    job_title: 'Elektroinstalatere — tražim angažman',
    category: 'Elektricar',
    city: 'Novi Sad',
    experience_level: 'Senior',
    availability: 'Immediately',
    price_type: 'hourly',
    price_value: 1800,
    currency: 'RSD',
    created_at: new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString(),
    user: { name: 'Dragan Vasić', email: 'demo@example.com', account_type: 'professional' },
  },
  {
    id: 'demo-j4',
    user_id: '00000000-0000-0000-0000-000000000304',
    text: 'Full-stack developer (React, Node.js, PostgreSQL) sa 5 godina iskustva. Radim remote. Dostupan za freelance i dugorocne projekte. Portfolio na uvid.',
    post_type: 'job_seeker_post',
    job_title: 'Full-stack Developer — remote',
    category: 'IT',
    city: 'Beograd',
    experience_level: 'Senior',
    availability: 'Within 1 week',
    price_type: 'hourly',
    price_value: 35,
    currency: 'EUR',
    created_at: new Date(Date.now() - 5 * 60 * 60 * 1000).toISOString(),
    user: { name: 'Miloš Savić', email: 'demo@example.com', account_type: 'professional' },
  },
  {
    id: 'demo-j5',
    user_id: '00000000-0000-0000-0000-000000000305',
    text: 'Iskusna računovođa sa 7 godina prakse u vođenju knjiga za privredna društva i preduzetnike. Poznaje Pantheon, SEF. Povoljna cena, tačnost zagarantovana.',
    post_type: 'job_seeker_post',
    job_title: 'Računovođa — preduzeća i preduzetnici',
    category: 'Računovodstvo',
    city: 'Beograd',
    experience_level: 'Senior',
    availability: 'Immediately',
    price_type: 'fixed',
    price_value: 15000,
    currency: 'RSD',
    created_at: new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString(),
    user: { name: 'Mirjana Kovačević', email: 'demo@example.com', account_type: 'professional' },
  },
  {
    id: 'demo-j6',
    user_id: '00000000-0000-0000-0000-000000000306',
    text: 'Kuvar sa 8 godina iskustva u srpskoj i međunarodnoj kuhinji. Radim u restoranima, cateringima i privatnim proslavama. Brz, čist, kreativan.',
    post_type: 'job_seeker_post',
    job_title: 'Kuvar — restoran ili catering',
    category: 'Ugostiteljstvo',
    city: 'Beograd',
    experience_level: 'Senior',
    availability: 'Immediately',
    price_type: 'negotiable',
    created_at: new Date(Date.now() - 7 * 60 * 60 * 1000).toISOString(),
    user: { name: 'Aleksandar Đokić', email: 'demo@example.com', account_type: 'professional' },
  },
  {
    id: 'demo-j7',
    user_id: '00000000-0000-0000-0000-000000000307',
    text: 'Zidar sa 15 godina iskustva u zidanju, malterisanju i armiranobetonskim radovima. Radim solo i u ekipi. Dostupan odmah u Nišu i okolini.',
    post_type: 'job_seeker_post',
    job_title: 'Zidar — tražim angažman',
    category: 'Zidar',
    city: 'Niš',
    experience_level: 'Expert',
    availability: 'Immediately',
    price_type: 'hourly',
    price_value: 1600,
    currency: 'RSD',
    created_at: new Date(Date.now() - 8 * 60 * 60 * 1000).toISOString(),
    user: { name: 'Slobodan Mitić', email: 'demo@example.com', account_type: 'professional' },
  },
  {
    id: 'demo-j8',
    user_id: '00000000-0000-0000-0000-000000000308',
    text: 'Profesionalni vozač CE kategorije sa ADR sertifikatom i 12 godina iskustva u međunarodnom transportu. Bez saobraćajnih prekršaja. Tražim stalnu firmu.',
    post_type: 'job_seeker_post',
    job_title: 'Vozač CE — međunarodni transport',
    category: 'Transport',
    city: 'Subotica',
    experience_level: 'Expert',
    availability: 'Within 1 week',
    price_type: 'negotiable',
    created_at: new Date(Date.now() - 9 * 60 * 60 * 1000).toISOString(),
    user: { name: 'Ferenc Horváth', email: 'demo@example.com', account_type: 'professional' },
  },
  {
    id: 'demo-j9',
    user_id: '00000000-0000-0000-0000-000000000309',
    text: 'Stolar sa 9 godina iskustva u izradi nameštaja po meri. Specijalizovan za kuhinje, garderobe i dečije sobe. Radim u Kragujevcu i celoj Šumadiji.',
    post_type: 'job_seeker_post',
    job_title: 'Stolar — nameštaj po meri',
    category: 'Stolar',
    city: 'Kragujevac',
    experience_level: 'Senior',
    availability: 'Within 1 week',
    price_type: 'negotiable',
    created_at: new Date(Date.now() - 10 * 60 * 60 * 1000).toISOString(),
    user: { name: 'Vladimir Janković', email: 'demo@example.com', account_type: 'professional' },
  },
  {
    id: 'demo-j10',
    user_id: '00000000-0000-0000-0000-000000000310',
    text: 'Automehaničar sa 11 godina iskustva, specijalizovan za Volkswagen grupu i BMW. Dijagnostika, servis, mehanički radovi. Tražim servis ili zaposlenje u Beogradu.',
    post_type: 'job_seeker_post',
    job_title: 'Automehaničar — VW/BMW specijalist',
    category: 'Automehaničar',
    city: 'Beograd',
    experience_level: 'Expert',
    availability: 'Within 1 week',
    price_type: 'negotiable',
    created_at: new Date(Date.now() - 11 * 60 * 60 * 1000).toISOString(),
    user: { name: 'Nikola Bogdanović', email: 'demo@example.com', account_type: 'professional' },
  },
  {
    id: 'demo-j11',
    user_id: '00000000-0000-0000-0000-000000000311',
    text: 'Diplomirani fizioterapeut sa 6 godina prakse. Radim manuelnu terapiju, kineziterapiju i sportsku rehabilitaciju. Tražim angažman u klinici ili privatno. Novi Sad.',
    post_type: 'job_seeker_post',
    job_title: 'Fizioterapeut — rehabilitacija i terapija',
    category: 'Fizioterapija',
    city: 'Novi Sad',
    experience_level: 'Mid',
    availability: 'Immediately',
    price_type: 'hourly',
    price_value: 2500,
    currency: 'RSD',
    created_at: new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString(),
    user: { name: 'Jovana Stanojević', email: 'demo@example.com', account_type: 'professional' },
  },
  {
    id: 'demo-j12',
    user_id: '00000000-0000-0000-0000-000000000312',
    text: 'Frizer sa 7 godina iskustva u ženskom i muškom friziranju. Imam sertifikate za balayage i keratinske tretmane. Tražim salon ili radim kod klijenata.',
    post_type: 'job_seeker_post',
    job_title: 'Frizer — ženska i muška frizura',
    category: 'Frizer',
    city: 'Beograd',
    experience_level: 'Senior',
    availability: 'Immediately',
    price_type: 'hourly',
    price_value: 1500,
    currency: 'RSD',
    created_at: new Date(Date.now() - 13 * 60 * 60 * 1000).toISOString(),
    user: { name: 'Sara Cvetković', email: 'demo@example.com', account_type: 'professional' },
  },
  {
    id: 'demo-j13',
    user_id: '00000000-0000-0000-0000-000000000313',
    text: 'Profesor matematike i fizike sa 10 godina iskustva u pripremi učenika za malu maturu i prijemni ispit. Individualne i grupne časove. Niš i online.',
    post_type: 'job_seeker_post',
    job_title: 'Profesor matematike/fizike — privatni čas',
    category: 'Edukacija',
    city: 'Niš',
    experience_level: 'Senior',
    availability: 'Flexible',
    price_type: 'hourly',
    price_value: 1200,
    currency: 'RSD',
    created_at: new Date(Date.now() - 14 * 60 * 60 * 1000).toISOString(),
    user: { name: 'Dr. Srđan Milić', email: 'demo@example.com', account_type: 'professional' },
  },
  {
    id: 'demo-j14',
    user_id: '00000000-0000-0000-0000-000000000314',
    text: 'Grafički dizajner sa 5 godina iskustva. Specijalizovan za brendiranje, logotipe i digitalni marketing materijal. Radim remote za celo tržište. Portfolio na zahtev.',
    post_type: 'job_seeker_post',
    job_title: 'Grafički dizajner — brendiranje i logotipi',
    category: 'Dizajn',
    city: 'Beograd',
    experience_level: 'Mid',
    availability: 'Within 1 week',
    price_type: 'fixed',
    price_value: 200,
    currency: 'EUR',
    created_at: new Date(Date.now() - 15 * 60 * 60 * 1000).toISOString(),
    user: { name: 'Maja Nikolić', email: 'demo@example.com', account_type: 'professional' },
  },
  {
    id: 'demo-j15',
    user_id: '00000000-0000-0000-0000-000000000315',
    text: 'Advokat sa 8 godina iskustva u oblasti porodičnog i naslednog prava. Dostupan za konsultacije i zastupanje. Beograd, cene dostupne.',
    post_type: 'job_seeker_post',
    job_title: 'Advokat — porodično i nasljedno pravo',
    category: 'Pravo',
    city: 'Beograd',
    experience_level: 'Senior',
    availability: 'Within 1 week',
    price_type: 'hourly',
    price_value: 50,
    currency: 'EUR',
    created_at: new Date(Date.now() - 16 * 60 * 60 * 1000).toISOString(),
    user: { name: 'Adv. Ivana Spasić', email: 'demo@example.com', account_type: 'professional' },
  },
  {
    id: 'demo-j16',
    user_id: '00000000-0000-0000-0000-000000000316',
    text: 'Keramičar sa 14 godina iskustva, radim mozaike, velike formate, antikne obrade. Preciznost i čistoća na prvom mestu. Beograd i okolina.',
    post_type: 'job_seeker_post',
    job_title: 'Keramičar — sve vrste pločica',
    category: 'Keramičar',
    city: 'Beograd',
    experience_level: 'Expert',
    availability: 'Within 1 week',
    price_type: 'fixed',
    price_value: 900,
    currency: 'RSD',
    created_at: new Date(Date.now() - 17 * 60 * 60 * 1000).toISOString(),
    user: { name: 'Predrag Đurović', email: 'demo@example.com', account_type: 'professional' },
  },
  {
    id: 'demo-j17',
    user_id: '00000000-0000-0000-0000-000000000317',
    text: 'Moler sa iskustvom u svim vrstama dekorativnih tehnika — venecijaner, mikročement, štukatura. Radim u Zrenjaninu, Novom Sadu i Beogradu.',
    post_type: 'job_seeker_post',
    job_title: 'Moler — dekorativne tehnike',
    category: 'Soboslikar',
    city: 'Zrenjanin',
    experience_level: 'Expert',
    availability: 'Within 1 week',
    price_type: 'hourly',
    price_value: 1400,
    currency: 'RSD',
    created_at: new Date(Date.now() - 18 * 60 * 60 * 1000).toISOString(),
    user: { name: 'Igor Petrović', email: 'demo@example.com', account_type: 'professional' },
  },
  {
    id: 'demo-j18',
    user_id: '00000000-0000-0000-0000-000000000318',
    text: 'Digital marketing stručnjak sa 4 godine iskustva u SEO, Google Ads i Meta Ads. Vodio sam kampanje sa budžetima do 10.000 EUR/mesec. Remote dostupan.',
    post_type: 'job_seeker_post',
    job_title: 'Digital Marketing — SEO i Ads',
    category: 'Marketing',
    city: 'Beograd',
    experience_level: 'Mid',
    availability: 'Within 1 week',
    price_type: 'fixed',
    price_value: 1200,
    currency: 'EUR',
    created_at: new Date(Date.now() - 19 * 60 * 60 * 1000).toISOString(),
    user: { name: 'Luka Đorđević', email: 'demo@example.com', account_type: 'professional' },
  },
  {
    id: 'demo-j19',
    user_id: '00000000-0000-0000-0000-000000000319',
    text: 'Bravar sa 20 godina iskustva. Izrada i montaža ograda, kapija, ramova i metalnih konstrukcija. Imam sopstvenu radionicu u Beogradu.',
    post_type: 'job_seeker_post',
    job_title: 'Bravar — ograde, kapije i konstrukcije',
    category: 'Bravarija',
    city: 'Beograd',
    experience_level: 'Expert',
    availability: 'Within 1 week',
    price_type: 'negotiable',
    created_at: new Date(Date.now() - 20 * 60 * 60 * 1000).toISOString(),
    user: { name: 'Radomir Peković', email: 'demo@example.com', account_type: 'professional' },
  },
  {
    id: 'demo-j20',
    user_id: '00000000-0000-0000-0000-000000000320',
    text: 'Medicinska sestra sa 12 godina iskustva u internom odeljenju i kućnoj nezi. Dostupna za kućne posete, nega starih i postoperativna nega. Novi Sad.',
    post_type: 'job_seeker_post',
    job_title: 'Medicinska sestra — kućna nega',
    category: 'Medicina',
    city: 'Novi Sad',
    experience_level: 'Senior',
    availability: 'Flexible',
    price_type: 'hourly',
    price_value: 1800,
    currency: 'RSD',
    created_at: new Date(Date.now() - 21 * 60 * 60 * 1000).toISOString(),
    user: { name: 'Biljana Antić', email: 'demo@example.com', account_type: 'professional' },
  },
];

const EXP_LEVEL_KEYS: Record<string, string> = {
  'Entry': 'marketplace.expEntry',
  'Mid': 'marketplace.expMid',
  'Senior': 'marketplace.expSenior',
  'Expert': 'marketplace.expExpert',
};

const AVAIL_KEYS: Record<string, string> = {
  'Immediately': 'marketplace.availImmediately',
  'Within 1 week': 'marketplace.avail1Week',
  'Within 2 weeks': 'marketplace.avail2Weeks',
  'Within 1 month': 'marketplace.avail1Month',
  'Flexible': 'marketplace.availFlexible',
};

function JobsMarketplaceContent() {
  const { user, profile } = useAuth();
  const { t } = useLanguage();
  const router = useRouter();
  usePageTracking('jobs');
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('hiring');
  const [contactingPostId, setContactingPostId] = useState<string | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [deleteConfirmPostId, setDeleteConfirmPostId] = useState<string | null>(null);
  const [cityFilter, setCityFilter] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [sortOrder, setSortOrder] = useState<'newest' | 'oldest'>('newest');
  const [categories, setCategories] = useState<string[]>([]);
  const [appliedPosts, setAppliedPosts] = useState<Set<string>>(new Set());
  const [offerServiceModalOpen, setOfferServiceModalOpen] = useState(false);
  const [sendOfferModalOpen, setSendOfferModalOpen] = useState(false);
  const [selectedPostForOffer, setSelectedPostForOffer] = useState<{ id: string; userId: string; userName: string } | null>(null);
  const [savedSet, setSavedSet] = useState<Set<string>>(new Set());
  const [shareModalPostId, setShareModalPostId] = useState<string | null>(null);
  const [applicationModalOpen, setApplicationModalOpen] = useState(false);
  const [selectedHiringPost, setSelectedHiringPost] = useState<{ id: string; title: string; ownerId: string } | null>(null);
  const [expandedPosts, setExpandedPosts] = useState<Set<string>>(new Set());

  useEffect(() => {
    loadPosts();
    loadCategories();
    if (user) {
      fetchSavedJobs();
    } else {
      setSavedSet(new Set());
    }
  }, [user?.id]);

  useEffect(() => {
    const handleVisibilityChange = () => {
      if (!document.hidden && user && posts.length > 0) {
        const postIds = posts.map((p) => p.id);
        checkAppliedStatus(postIds);
      }
    };

    const handleFocus = () => {
      if (user && posts.length > 0) {
        const postIds = posts.map((p) => p.id);
        checkAppliedStatus(postIds);
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('focus', handleFocus);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', handleFocus);
    };
  }, [user, posts]);

  const fetchSavedJobs = async () => {
    if (!user) return;
    const { data } = await supabase
      .from('saved_posts')
      .select('post_id')
      .eq('user_id', user.id);
    setSavedSet(new Set((data || []).map((r: any) => r.post_id)));
  };

  const handleSaveJob = async (e: React.MouseEvent, postId: string) => {
    e.preventDefault();
    e.stopPropagation();
    if (!user) return;
    const isSaved = savedSet.has(postId);
    if (isSaved) {
      await supabase.from('saved_posts').delete().eq('user_id', user.id).eq('post_id', postId);
      setSavedSet((prev) => { const s = new Set(prev); s.delete(postId); return s; });
    } else {
      await supabase.from('saved_posts').insert({ user_id: user.id, post_id: postId });
      setSavedSet((prev) => new Set(prev).add(postId));
    }
  };

  const checkAppliedStatus = async (postIds: string[]) => {
    if (!user || postIds.length === 0) return;

    try {
      const { data, error } = await supabase
        .from('job_applications')
        .select('post_id')
        .eq('applicant_id', user.id)
        .in('post_id', postIds);

      if (error) { console.error('Error checking applied status:', error); return; }

      setAppliedPosts(new Set((data || []).map((r: any) => r.post_id)));
    } catch (err) {
      console.error('Error in checkAppliedStatus:', err);
    }
  };

  const loadCategories = async () => {
    try {
      const response = await fetch('/api/categories');
      const data = await response.json();
      if (data.categories) {
        setCategories(data.categories);
      }
    } catch (error) {
      console.error('Error loading categories:', error);
    }
  };

  const loadPosts = async () => {
    try {
      const { data: postsData, error } = await supabase.rpc('get_posts_with_score', {
        post_types: ['hiring_post', 'service_request', 'job_seeker_post'],
      });

      if (error) {
        const { data: fallbackData, error: fallbackError } = await supabase
          .from('posts')
          .select(`
            id,
            user_id,
            text,
            post_type,
            job_title,
            profession,
            category,
            city,
            experience_level,
            location,
            availability,
            price_type,
            price_value,
            currency,
            created_at,
            status,
            user:profiles!posts_user_id_fkey(name, email, account_type, avatar_url)
          `)
          .in('post_type', ['hiring_post', 'service_request', 'job_seeker_post'])
          .eq('status', 'published')
          .order('created_at', { ascending: false });

        if (fallbackError) throw fallbackError;

        const postsWithData =
          fallbackData?.map((post: any) => ({
            ...post,
            user: Array.isArray(post.user) ? post.user[0] : post.user,
          })) || [];

        setPosts([...postsWithData, ...DEMO_POSTS]);

        const postIdsToCheck = postsWithData.map((p: any) => p.id);
        if (postIdsToCheck.length > 0) {
          await checkAppliedStatus(postIdsToCheck);
        }

        setLoading(false);
        return;
      }

      const postsWithData =
        postsData?.map((post: any) => ({
          id: post.id,
          user_id: post.user_id,
          text: post.text,
          post_type: post.post_type,
          job_title: post.job_title,
          profession: post.profession,
          category: post.category,
          city: post.city,
          experience_level: post.experience_level,
          location: post.location,
          availability: post.availability,
          price_type: post.price_type,
          price_value: post.price_value,
          currency: post.currency,
          created_at: post.created_at,
          user: post.user_data,
        })) || [];

      setPosts([...postsWithData, ...DEMO_POSTS]);

      const postIdsToCheck = postsWithData.map((p: any) => p.id);
      if (postIdsToCheck.length > 0) {
        await checkAppliedStatus(postIdsToCheck);
      }
    } catch (error: any) {
      console.error('Error loading posts:', error);
      toast.error('Failed to load marketplace posts');
    } finally {
      setLoading(false);
    }
  };

  const getMessageTemplate = (postType: string, postTitle?: string, postId?: string) => {
    switch (postType) {
      case 'hiring_post':
        if (postTitle) {
          const truncatedTitle = postTitle.length > 60 ? postTitle.substring(0, 60) + '...' : postTitle;
          return `Zdravo, prijavljujem se na oglas: "${truncatedTitle}"\n\nMožete li mi dati više detalja?`;
        }
        return t('jobs.templateHiringPost');
      case 'service_request':
        return t('jobs.templateServiceRequest');
      case 'job_seeker_post':
        return t('jobs.templateJobSeekerPost');
      default:
        return '';
    }
  };

  const handleApplyToPost = (postId: string, postTitle?: string, postOwnerId?: string) => {
    if (!user || !profile) {
      toast.error('Morate biti prijavljeni');
      router.push('/login');
      return;
    }
    setSelectedHiringPost({ id: postId, title: postTitle ?? '', ownerId: postOwnerId ?? '' });
    setApplicationModalOpen(true);
  };

  const handleApplicationSuccess = (postId: string) => {
    setAppliedPosts(prev => new Set(prev).add(postId));
  };

  const handleContactUser = async (
    postUserId: string,
    postType?: string,
    useTemplate: boolean = false,
    postTitle?: string,
    postId?: string
  ) => {
    if (!user || !profile) {
      router.push('/login');
      return;
    }

    if (user.id === postUserId) {
      toast.error('You cannot message yourself');
      return;
    }

    setContactingPostId(postUserId);

    try {
      const { threadId, error } = await findOrCreateThread({
        customerId: postUserId,
        proId: user.id,
      });

      if (error) {
        toast.error('Failed to start conversation');
        return;
      }

      if (threadId) {
        const template = useTemplate && postType ? getMessageTemplate(postType, postTitle, postId) : '';
        const url = template
          ? `/messages/${threadId}?template=${encodeURIComponent(template)}`
          : `/messages/${threadId}`;
        router.push(url);
      }
    } catch (err) {
      console.error('Exception in handleContactUser:', err);
      toast.error('An error occurred');
    } finally {
      setContactingPostId(null);
    }
  };

  const handleDeletePost = async () => {
    if (!deleteConfirmPostId) return;

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const response = await fetch(`/api/posts?postId=${deleteConfirmPostId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${session?.access_token ?? ''}`,
        },
      });

      const data = await response.json();

      if (!response.ok) {
        if (response.status === 403) {
          toast.error('You do not have permission to delete this post');
        } else if (response.status === 404) {
          toast.error('Post not found');
        } else {
          toast.error(data.error || 'Failed to delete post');
        }
        setDeleteConfirmPostId(null);
        return;
      }

      toast.success('Post deleted successfully');
      setPosts((prev) => prev.filter((p) => p.id !== deleteConfirmPostId));
      setDeleteConfirmPostId(null);
    } catch (error: any) {
      console.error('Error deleting post:', error);
      toast.error('Failed to delete post');
      setDeleteConfirmPostId(null);
    }
  };

  const resetFilters = () => {
    setCityFilter('');
    setCategoryFilter('');
    setSortOrder('newest');
  };

  const filteredPosts = posts
    .filter((post) => {
      if (activeTab === 'hiring') {
        if (post.post_type !== 'hiring_post') return false;
      } else if (activeTab === 'service-requests') {
        if (post.post_type !== 'service_request') return false;
      } else if (activeTab === 'job-seekers') {
        if (post.post_type !== 'job_seeker_post') return false;
      } else {
        return false;
      }

      if (cityFilter) {
        const postCity = post.city || post.location || '';
        if (!postCity.toLowerCase().includes(cityFilter.toLowerCase())) return false;
      }

      if (categoryFilter && post.category) {
        if (post.category !== categoryFilter) return false;
      }

      return true;
    })
    .sort((a, b) => {
      if (activeTab === 'job-seekers' && sortOrder === 'newest') {
        return 0;
      }
      const dateA = new Date(a.created_at).getTime();
      const dateB = new Date(b.created_at).getTime();
      return sortOrder === 'newest' ? dateB - dateA : dateA - dateB;
    });

  const hiringCount = posts.filter((p) => p.post_type === 'hiring_post').length;
  const serviceRequestCount = posts.filter((p) => p.post_type === 'service_request').length;
  const jobSeekerCount = posts.filter((p) => p.post_type === 'job_seeker_post').length;

  const tabTriggerClass =
  'px-4 py-2.5 text-sm font-medium rounded-xl border border-transparent transition-all duration-200 gap-2 ' +
  'text-muted-foreground hover:text-foreground hover:bg-accent ' +
  'data-[state=active]:bg-orange-500/5 data-[state=active]:text-orange-600 dark:data-[state=active]:text-orange-400 data-[state=active]:border-orange-300 dark:data-[state=active]:border-orange-500/60 data-[state=active]:shadow-sm';

  if (loading) {
    return (
      <div className="bg-gradient-to-br from-slate-50 via-slate-100 to-slate-200 dark:from-[#111827] dark:via-[#0f1419] dark:to-[#111827] py-8 pb-24">
        <div className="max-w-5xl mx-auto px-4 space-y-4">
          {[1, 2, 3].map((i) => (
            <Card key={i} className="bg-card border border-border rounded-2xl shadow-sm">
              <CardHeader>
                <Skeleton className="h-12 w-12 rounded-full" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-20 w-full" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="bg-gradient-to-br from-slate-50 via-slate-100 to-slate-200 dark:from-[#111827] dark:via-[#0f1419] dark:to-[#111827] py-8 pb-24">
      <div className="max-w-5xl mx-auto px-4 space-y-6">
        <div className="flex items-center justify-between mb-2">
          <div>
            <h1 className="text-3xl font-bold text-slate-800 dark:text-white">{t('jobs.marketplaceTitle')}</h1>
            <p className="text-slate-600 dark:text-gray-400 mt-2">{t('jobs.marketplaceSubtitle')}</p>
          </div>

          {profile && (
            <Button
              className="bg-orange-600 hover:bg-orange-500 dark:bg-orange-600 dark:hover:bg-orange-500 text-white shadow-lg transition-colors rounded-xl"
              onClick={() => setShowCreateModal(true)}
            >
              <Plus className="h-4 w-4 mr-2" />
              {t('jobs.createPost')}
            </Button>
          )}
        </div>

        <CreateMarketplacePostModal
          open={showCreateModal}
          onOpenChange={setShowCreateModal}
          onPostCreated={loadPosts}
        />

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <div className="mb-4 -mx-4 md:mx-0">
            <div className="md:hidden overflow-x-auto overflow-y-hidden border-b border-border">
              <TabsList className="flex flex-nowrap w-max px-4 py-2 gap-2 bg-transparent h-auto">
                <TabsTrigger value="hiring" className={`min-w-max whitespace-nowrap shrink-0 ${tabTriggerClass}`}>
                  <Briefcase className="h-4 w-4" />
                  <span>{t('jobs.hiring')}</span>
                  {hiringCount > 0 && <Badge variant="secondary" className="ml-1">{hiringCount}</Badge>}
                </TabsTrigger>

                <TabsTrigger value="service-requests" className={`min-w-max whitespace-nowrap shrink-0 ${tabTriggerClass}`}>
                  <Users className="h-4 w-4" />
                  <span>{t('jobs.services')}</span>
                  {serviceRequestCount > 0 && <Badge variant="secondary" className="ml-1">{serviceRequestCount}</Badge>}
                </TabsTrigger>

                <TabsTrigger value="job-seekers" className={`min-w-max whitespace-nowrap shrink-0 ${tabTriggerClass}`}>
                  <UserCircle className="h-4 w-4" />
                  <span>{t('jobs.seekers')}</span>
                  {jobSeekerCount > 0 && <Badge variant="secondary" className="ml-1">{jobSeekerCount}</Badge>}
                </TabsTrigger>
              </TabsList>
            </div>

            <TabsList className="hidden md:grid w-full px-2 py-2 gap-2 bg-card rounded-2xl grid-cols-3 shadow-sm border border-border">
              <TabsTrigger value="hiring" className={tabTriggerClass}>
                <Briefcase className="h-4 w-4" />
                <span>{t('jobs.hiringPosts')}</span>
                {hiringCount > 0 && <Badge variant="secondary" className="ml-1">{hiringCount}</Badge>}
              </TabsTrigger>

              <TabsTrigger value="service-requests" className={tabTriggerClass}>
                <Users className="h-4 w-4" />
                <span>{t('jobs.serviceRequests')}</span>
                {serviceRequestCount > 0 && <Badge variant="secondary" className="ml-1">{serviceRequestCount}</Badge>}
              </TabsTrigger>

              <TabsTrigger value="job-seekers" className={tabTriggerClass}>
                <UserCircle className="h-4 w-4" />
                <span>{t('jobs.jobSeekers')}</span>
                {jobSeekerCount > 0 && <Badge variant="secondary" className="ml-1">{jobSeekerCount}</Badge>}
              </TabsTrigger>
            </TabsList>
          </div>

          <Card className="mt-4 bg-card text-card-foreground border border-border rounded-2xl shadow-sm">
            <CardContent className="pt-6 pb-5">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div>
                  <label className="text-xs font-medium text-slate-600 dark:text-gray-300 mb-1.5 block">
                    {t('jobs.filterCity')}
                  </label>
                  <CityAutocomplete
                    value={cityFilter}
                    onChange={(city) => setCityFilter(city)}
                    placeholder={t('jobs.filterCityPlaceholder')}
                  />
                </div>

                <div>
                  <label className="text-xs font-medium text-slate-600 dark:text-gray-300 mb-1.5 block">
                    {t('jobs.filterCategory')}
                  </label>
                  <CategoryCombobox
                    value={categoryFilter}
                    onChange={(value) => setCategoryFilter(value)}
                    suggestions={categories}
                    placeholder={t('jobs.filterCategoryPlaceholder')}
                    filterMode={true}
                    allCategoriesLabel={t('jobs.filterCategoryPlaceholder')}
                  />
                </div>

                <div>
                  <label className="text-xs font-medium text-slate-600 dark:text-gray-300 mb-1.5 block">
                    {t('jobs.filterSort')}
                  </label>
                  <Select value={sortOrder} onValueChange={(value: 'newest' | 'oldest') => setSortOrder(value)}>
                    <SelectTrigger className="rounded-xl">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="newest">{t('jobs.sortNewest')}</SelectItem>
                      <SelectItem value="oldest">{t('jobs.sortOldest')}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex items-end">
                  <Button
                    variant="outline"
                    onClick={resetFilters}
                    className="w-full rounded-xl border-slate-300 dark:border-slate-600 text-slate-700 dark:text-gray-300 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
                  >
                    <X className="h-4 w-4 mr-2" />
                    {t('jobs.resetFilters')}
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="mt-6">
            {filteredPosts.length === 0 ? (
              <Card className="bg-card text-card-foreground border border-border rounded-2xl shadow-sm">
                <CardContent className="py-12 text-center">
                  <p className="text-slate-500">{t('jobs.noPosts')}</p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-3">
                {filteredPosts.map((post) => {
                  const isServiceRequest = post.post_type === 'service_request';

                  return (
                    <Card
                      key={post.id}
                      className="bg-card text-card-foreground border border-border rounded-2xl shadow-sm transition-all duration-200 hover:shadow-lg hover:-translate-y-0.5 hover:border-orange-400/40"
                      style={{ touchAction: 'manipulation' }}
                    >
                      <CardContent className={isServiceRequest ? 'p-5' : 'p-5'}>
                        <div className="space-y-3">
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-2">
                                <Avatar
                                  className="h-9 w-9 cursor-pointer ring-2 ring-gray-100"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    router.push(`/profile/${post.user_id}`);
                                  }}
                                >
                                  <AvatarImage src={post.user?.avatar_url} alt={post.user?.name} />
                                  <AvatarFallback className="bg-orange-500 text-white text-sm">
                                    {post.user?.name?.charAt(0).toUpperCase() || '?'}
                                  </AvatarFallback>
                                </Avatar>

                                <div className="flex-1 min-w-0">
                                  <button
                                    className="text-sm font-semibold text-slate-900 dark:text-white hover:text-orange-600 dark:hover:text-orange-400 transition-colors truncate block"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      router.push(`/profile/${post.user_id}`);
                                    }}
                                  >
                                    {post.user?.name || 'Unknown User'}
                                  </button>

                                  <p className="text-xs text-slate-500 dark:text-gray-400">
                                    {formatDistanceToNow(new Date(post.created_at), { addSuffix: true })}
                                  </p>
                                </div>
                              </div>

                              <h3
                                className={`text-slate-900 dark:text-gray-100 leading-tight line-clamp-2 ${
                                  isServiceRequest ? 'font-semibold text-lg mb-0.5' : 'font-semibold text-base md:text-lg mb-0.5'
                                }`}
                              >
                                {post.job_title || post.category || post.text?.substring(0, 60) || t('jobs.untitledPost')}
                              </h3>
                              <div className="flex items-center gap-1.5 mt-0.5">
                                {post.post_type === 'hiring_post' && (
                                  <span className="px-1.5 py-0.5 text-[9px] font-medium uppercase tracking-wider bg-orange-50 text-orange-600 rounded">
                                    {t('jobs.badgeHiring')}
                                  </span>
                                )}
                                {isServiceRequest && (
                                  <span className="px-1.5 py-0.5 text-[9px] font-medium uppercase tracking-wider bg-blue-50 text-blue-600 rounded">
                                    {t('jobs.badgeServiceRequest')}
                                  </span>
                                )}
                                {post.post_type === 'job_seeker_post' && (
                                  <span className="px-1.5 py-0.5 text-[9px] font-medium uppercase tracking-wider bg-green-100 text-green-700 rounded">
                                    {t('jobs.badgeJobSeeker')}
                                  </span>
                                )}
                              </div>
                            </div>

                            <div className="flex items-center gap-2">
                              <button
                                onClick={(e) => { e.stopPropagation(); setShareModalPostId(post.id); }}
                                className="h-7 w-7 flex items-center justify-center rounded-lg hover:bg-accent transition-colors"
                                title={t('share.title')}
                              >
                                <Share2 className="h-4 w-4 text-muted-foreground" />
                              </button>

                              {user && (
                                <button
                                  onClick={(e) => handleSaveJob(e, post.id)}
                                  className="h-7 w-7 flex items-center justify-center rounded-lg hover:bg-accent transition-colors"
                                  title={savedSet.has(post.id) ? t('profile.savedRemove') : t('profile.savedSaveJob')}
                                >
                                  <Bookmark
                                    className={`h-4 w-4 transition-all ${
                                      savedSet.has(post.id) ? 'fill-orange-500 text-orange-500' : 'text-muted-foreground'
                                    }`}
                                  />
                                </button>
                              )}

                              {user?.id === post.user_id && (
                                <DropdownMenu>
                                  <DropdownMenuTrigger asChild>
                                    <Button variant="ghost" size="sm" className="h-7 w-7 p-0 shrink-0 rounded-lg">
                                      <MoreVertical className="h-3.5 w-3.5" />
                                    </Button>
                                  </DropdownMenuTrigger>

                                  <DropdownMenuContent align="end">
                                    <DropdownMenuItem
                                      onClick={() => setDeleteConfirmPostId(post.id)}
                                      className="text-red-600 focus:text-red-600 focus:bg-red-50"
                                    >
                                      <Trash2 className="h-4 w-4 mr-2" />
                                      {t('jobs.deletePost')}
                                    </DropdownMenuItem>
                                  </DropdownMenuContent>
                                </DropdownMenu>
                              )}
                            </div>
                          </div>

                          {/* Hiring post — Option C: icon + label grid */}
                          {post.post_type === 'hiring_post' && (
                            <div className="grid grid-cols-2 gap-x-3 gap-y-1.5 mt-1">
                              {post.category && (
                                <div className="flex items-center gap-1.5 min-w-0">
                                  <Briefcase className="h-3.5 w-3.5 text-orange-500 shrink-0" />
                                  <span className="text-[11px] text-slate-500 dark:text-slate-400 shrink-0">{t('jobs.labelNeeded')}:</span>
                                  <span className="text-[11px] font-semibold text-slate-800 dark:text-gray-100 truncate">{post.category}</span>
                                </div>
                              )}
                              {post.city && (
                                <div className="flex items-center gap-1.5 min-w-0">
                                  <MapPin className="h-3.5 w-3.5 text-orange-500 shrink-0" />
                                  <span className="text-[11px] text-slate-500 dark:text-slate-400 shrink-0">{t('jobs.labelCity')}:</span>
                                  <span className="text-[11px] font-semibold text-slate-800 dark:text-gray-100 truncate">{post.city}</span>
                                </div>
                              )}
                              {post.experience_level && (
                                <div className="flex items-center gap-1.5 min-w-0">
                                  <Star className="h-3.5 w-3.5 text-orange-500 shrink-0" />
                                  <span className="text-[11px] text-slate-500 dark:text-slate-400 shrink-0">{t('jobs.labelLevel')}:</span>
                                  <span className="text-[11px] font-semibold text-slate-800 dark:text-gray-100 truncate">
                                    {EXP_LEVEL_KEYS[post.experience_level] ? t(EXP_LEVEL_KEYS[post.experience_level] as any) : post.experience_level}
                                  </span>
                                </div>
                              )}
                              {post.availability && (
                                <div className="flex items-center gap-1.5 min-w-0">
                                  <Clock className="h-3.5 w-3.5 text-orange-500 shrink-0" />
                                  <span className="text-[11px] text-slate-500 dark:text-slate-400 shrink-0">{t('jobs.labelStart')}:</span>
                                  <span className="text-[11px] font-semibold text-slate-800 dark:text-gray-100 truncate">
                                    {AVAIL_KEYS[post.availability] ? t(AVAIL_KEYS[post.availability] as any) : post.availability}
                                  </span>
                                </div>
                              )}
                            </div>
                          )}

                          {/* Job seeker post — Option C */}
                          {post.post_type === 'job_seeker_post' && (
                            <div className="grid grid-cols-2 gap-x-3 gap-y-1.5 mt-1">
                              {post.category && (
                                <div className="flex items-center gap-1.5 min-w-0">
                                  <Briefcase className="h-3.5 w-3.5 text-green-600 shrink-0" />
                                  <span className="text-[11px] text-slate-500 dark:text-slate-400 shrink-0">{t('jobs.labelNeeded')}:</span>
                                  <span className="text-[11px] font-semibold text-slate-800 dark:text-gray-100 truncate">{post.category}</span>
                                </div>
                              )}
                              {post.city && (
                                <div className="flex items-center gap-1.5 min-w-0">
                                  <MapPin className="h-3.5 w-3.5 text-green-600 shrink-0" />
                                  <span className="text-[11px] text-slate-500 dark:text-slate-400 shrink-0">{t('jobs.labelCity')}:</span>
                                  <span className="text-[11px] font-semibold text-slate-800 dark:text-gray-100 truncate">{post.city}</span>
                                </div>
                              )}
                              {post.experience_level && (
                                <div className="flex items-center gap-1.5 min-w-0">
                                  <Star className="h-3.5 w-3.5 text-green-600 shrink-0" />
                                  <span className="text-[11px] text-slate-500 dark:text-slate-400 shrink-0">{t('jobs.labelLevel')}:</span>
                                  <span className="text-[11px] font-semibold text-slate-800 dark:text-gray-100 truncate">
                                    {EXP_LEVEL_KEYS[post.experience_level] ? t(EXP_LEVEL_KEYS[post.experience_level] as any) : post.experience_level}
                                  </span>
                                </div>
                              )}
                              {post.availability && (
                                <div className="flex items-center gap-1.5 min-w-0">
                                  <Clock className="h-3.5 w-3.5 text-green-600 shrink-0" />
                                  <span className="text-[11px] text-slate-500 dark:text-slate-400 shrink-0">{t('jobs.labelAvail')}:</span>
                                  <span className="text-[11px] font-semibold text-slate-800 dark:text-gray-100 truncate">
                                    {AVAIL_KEYS[post.availability] ? t(AVAIL_KEYS[post.availability] as any) : post.availability}
                                  </span>
                                </div>
                              )}
                              {post.price_value && (
                                <div className="flex items-center gap-1.5 min-w-0 col-span-2">
                                  <Star className="h-3.5 w-3.5 text-green-600 shrink-0" />
                                  <span className="text-[11px] text-slate-500 dark:text-slate-400 shrink-0">{t('jobs.labelSalary')}:</span>
                                  <span className="text-[11px] font-semibold text-slate-800 dark:text-gray-100">
                                    {`${post.currency || 'RSD'} ${post.price_value}${post.price_type === 'hourly' ? t('jobs.pricePerHour') : post.price_type === 'fixed' ? ` ${t('jobs.priceFixed')}` : ''}`}
                                  </span>
                                </div>
                              )}
                            </div>
                          )}

                          {/* Service request — keep simple inline style */}
                          {isServiceRequest && (
                            <div className="flex flex-wrap items-center gap-1.5 text-sm text-slate-600 dark:text-gray-300">
                              {post.category && (
                                <span className="inline-flex items-center gap-1">{post.category}</span>
                              )}
                              {post.city && (
                                <span className="inline-flex items-center gap-1">
                                  {post.category && <span className="text-slate-400">•</span>}
                                  <MapPin className="h-3 w-3" />{post.city}
                                </span>
                              )}
                              {post.availability && (
                                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded text-xs font-medium border border-slate-200 dark:border-slate-700">
                                  {AVAIL_KEYS[post.availability] ? t(AVAIL_KEYS[post.availability] as any) : post.availability}
                                </span>
                              )}
                            </div>
                          )}

                          {isServiceRequest && post.price_value && (
                            <div className="text-base font-bold text-slate-900 dark:text-gray-200">
                              {`${post.currency || 'EUR'} ${post.price_value}${
                                post.price_type === 'hourly' ? t('jobs.pricePerHour') : post.price_type === 'fixed' ? ` ${t('jobs.priceFixed')}` : ''
                              }`}
                            </div>
                          )}

                          {post.text && (
                            <div>
                              <p className={`text-slate-700 dark:text-gray-300 leading-relaxed ${isServiceRequest ? 'text-sm' : 'text-xs md:text-sm'} ${post.text.length > 120 && !expandedPosts.has(post.id) ? 'line-clamp-2' : ''}`}>
                                {post.text}
                              </p>
                              {post.text.length > 120 && (
                                <button
                                  onClick={(e) => { e.stopPropagation(); setExpandedPosts(prev => { const n = new Set(prev); n.has(post.id) ? n.delete(post.id) : n.add(post.id); return n; }); }}
                                  className="text-xs text-orange-600 font-semibold mt-0.5 hover:text-orange-500"
                                >
                                  {expandedPosts.has(post.id) ? t('posts.showLess') : t('posts.readMore')}
                                </button>
                              )}
                            </div>
                          )}

                          {isServiceRequest && <div className="border-t border-slate-200 pt-2 mt-2 -mx-4 px-4" />}

                          <div className={`flex gap-2 ${isServiceRequest ? '' : 'pt-0.5'}`}>
                            {!user && (
                              <Button
                                type="button"
                                size="sm"
                                onClick={() => router.push('/login')}
                                className="bg-orange-600 hover:bg-orange-700 text-white h-9 text-xs md:text-sm flex-1 rounded-xl"
                              >
                                <Send className="h-3.5 w-3.5 mr-1.5" />
                                {t('jobs.signInToContact')}
                              </Button>
                            )}
                            {user && user?.id !== post.user_id && (
                              <>
                                {post.post_type === 'hiring_post' && (
                                  <div className="flex gap-2 w-full">
                                    {appliedPosts.has(post.id) ? (
                                      <Button
                                        type="button"
                                        size="sm"
                                        disabled
                                        className="bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-400 hover:bg-green-100 dark:hover:bg-green-900/40 cursor-not-allowed h-9 text-xs md:text-sm flex-1 border-green-200 dark:border-green-700 rounded-xl"
                                      >
                                        <Send className="h-3.5 w-3.5 mr-1.5" />
                                        {t('jobs.applied')}
                                      </Button>
                                    ) : (
                                      <Button
                                        type="button"
                                        size="sm"
                                        onClick={(e) => {
                                          e.preventDefault();
                                          e.stopPropagation();
                                          handleApplyToPost(post.id, post.job_title || post.text || 'oglas', post.user_id);
                                        }}
                                        className="bg-orange-600 hover:bg-orange-700 text-white h-9 text-xs md:text-sm flex-1 rounded-xl"
                                      >
                                        <Send className="h-3.5 w-3.5 mr-1.5" />
                                        {t('jobs.applyButton')}
                                      </Button>
                                    )}

                                    <Button
                                      type="button"
                                      size="sm"
                                      variant="outline"
                                      onClick={(e) => {
                                        e.preventDefault();
                                        e.stopPropagation();
                                        handleContactUser(post.user_id, post.post_type, false);
                                      }}
                                      disabled={contactingPostId === post.user_id}
                                      className="border-slate-300 dark:border-slate-600 text-slate-700 dark:text-gray-300 hover:bg-slate-50 dark:hover:bg-slate-700 h-9 text-xs md:text-sm flex-1 rounded-xl"
                                    >
                                      <MessageCircle className="h-3.5 w-3.5 mr-1.5" />
                                      {contactingPostId === post.user_id ? t('contact.sending') : t('jobs.sendMessageButton')}
                                    </Button>
                                  </div>
                                )}

                                {post.post_type === 'service_request' && (
                                  <div className="flex gap-2 w-full">
                                    <Button
                                      type="button"
                                      size="sm"
                                      onClick={(e) => {
                                        e.preventDefault();
                                        e.stopPropagation();
                                        setSelectedPostForOffer({
                                          id: post.id,
                                          userId: post.user_id,
                                          userName: post.user?.name || 'Unknown',
                                        });
                                        setOfferServiceModalOpen(true);
                                      }}
                                      className="bg-orange-600 hover:bg-orange-700 text-white h-9 text-sm flex-1 rounded-xl"
                                    >
                                      <Send className="h-4 w-4 mr-1.5" />
                                      {t('jobs.offerServiceButton')}
                                    </Button>

                                    <Button
                                      type="button"
                                      size="sm"
                                      variant="outline"
                                      onClick={(e) => {
                                        e.preventDefault();
                                        e.stopPropagation();
                                        handleContactUser(post.user_id, post.post_type, false);
                                      }}
                                      disabled={contactingPostId === post.user_id}
                                      className="border-slate-300 dark:border-slate-600 text-slate-700 dark:text-gray-300 hover:bg-slate-50 dark:hover:bg-slate-700 h-9 text-sm flex-1 rounded-xl"
                                    >
                                      <MessageCircle className="h-4 w-4 mr-1.5" />
                                      {contactingPostId === post.user_id ? t('contact.sending') : t('jobs.sendMessageButton')}
                                    </Button>
                                  </div>
                                )}

                                {post.post_type === 'job_seeker_post' && (
                                  <div className="flex gap-2">
                                    <Button
                                      type="button"
                                      size="sm"
                                      onClick={(e) => {
                                        e.preventDefault();
                                        e.stopPropagation();
                                        setSelectedPostForOffer({
                                          id: post.id,
                                          userId: post.user_id,
                                          userName: post.user.name,
                                        });
                                        setSendOfferModalOpen(true);
                                      }}
                                      className="bg-orange-600 hover:bg-orange-700 text-white h-9 text-xs md:text-sm w-auto rounded-xl"
                                    >
                                      <Send className="h-3.5 w-3.5 mr-1.5" />
                                      {t('jobs.offerJobButton')}
                                    </Button>

                                    <Button
                                      type="button"
                                      size="sm"
                                      variant="outline"
                                      onClick={(e) => {
                                        e.preventDefault();
                                        e.stopPropagation();
                                        handleContactUser(post.user_id, post.post_type, false);
                                      }}
                                      disabled={contactingPostId === post.user_id}
                                      className="border-slate-300 dark:border-slate-600 text-slate-700 dark:text-gray-300 hover:bg-slate-50 dark:hover:bg-slate-700 h-9 text-xs md:text-sm w-auto rounded-xl"
                                    >
                                      <MessageCircle className="h-3.5 w-3.5 mr-1.5" />
                                      {contactingPostId === post.user_id ? t('contact.sending') : t('jobs.sendMessageButton')}
                                    </Button>
                                  </div>
                                )}
                              </>
                            )}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </div>
        </Tabs>
      </div>

      <AlertDialog open={deleteConfirmPostId !== null} onOpenChange={(open) => !open && setDeleteConfirmPostId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('jobs.deletePost')}</AlertDialogTitle>
            <AlertDialogDescription>{t('jobs.deletePostConfirm')}</AlertDialogDescription>
          </AlertDialogHeader>

          <AlertDialogFooter>
            <AlertDialogCancel>{t('jobs.cancel')}</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeletePost} className="bg-red-600 hover:bg-red-700 focus:ring-red-600">
              {t('jobs.delete')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {selectedPostForOffer && (
        <>
          <OfferServiceModal
            open={offerServiceModalOpen}
            onOpenChange={setOfferServiceModalOpen}
            receiverId={selectedPostForOffer.userId}
            receiverName={selectedPostForOffer.userName}
            postId={selectedPostForOffer.id}
          />

          <SendOfferModal
            open={sendOfferModalOpen}
            onOpenChange={setSendOfferModalOpen}
            receiverId={selectedPostForOffer.userId}
            receiverName={selectedPostForOffer.userName}
            postId={selectedPostForOffer.id}
          />
        </>
      )}

      {shareModalPostId && (
        <SharePostModal
          postId={shareModalPostId}
          open={!!shareModalPostId}
          onOpenChange={(open) => { if (!open) setShareModalPostId(null); }}
        />
      )}

      {selectedHiringPost && (
        <JobApplicationModal
          open={applicationModalOpen}
          onOpenChange={setApplicationModalOpen}
          postId={selectedHiringPost.id}
          postTitle={selectedHiringPost.title}
          postOwnerId={selectedHiringPost.ownerId}
          onSuccess={handleApplicationSuccess}
        />
      )}

      {/* CTA banner for unauthenticated users */}
      {!user && (
        <div className="fixed bottom-0 left-0 right-0 z-50 bg-card border-t border-border px-4 py-3 flex items-center justify-between gap-3 shadow-lg">
          <div className="min-w-0">
            <p className="text-sm font-semibold text-foreground truncate">{t('jobs.ctaBannerTitle')}</p>
            <p className="text-xs text-muted-foreground">{t('jobs.ctaBannerDesc')}</p>
          </div>
          <button
            onClick={() => router.push('/login')}
            className="shrink-0 bg-orange-500 hover:bg-orange-600 text-white text-sm font-semibold px-4 py-2 rounded-xl transition-colors"
          >
            {t('feed.ctaButton')}
          </button>
        </div>
      )}
    </div>
  );
}

export default function JobsMarketplacePage() {
  return <JobsMarketplaceContent />;
}
