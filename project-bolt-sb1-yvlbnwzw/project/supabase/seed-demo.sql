-- ================================================================
-- GIGZONE DEMO SEED DATA
-- Pokrenuti u Supabase > SQL Editor > New Query > Run
-- ================================================================

BEGIN;
SET session_replication_role = replica;

-- ── 1. AUTH USERS (30) ─────────────────────────────────────────
INSERT INTO auth.users (
  id, instance_id, aud, role, email, encrypted_password,
  email_confirmed_at, created_at, updated_at,
  raw_app_meta_data, raw_user_meta_data,
  is_super_admin, confirmation_token, email_change, email_change_token_new, recovery_token
) VALUES
  ('b1000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000000','authenticated','authenticated','marko.jovanovic@demo.gigzone.app',crypt('Demo1234!',gen_salt('bf')),NOW()-INTERVAL'30 days',NOW()-INTERVAL'30 days',NOW()-INTERVAL'30 days','{"provider":"email","providers":["email"]}','{}',false,'','','',''),
  ('b1000000-0000-0000-0000-000000000002','00000000-0000-0000-0000-000000000000','authenticated','authenticated','ana.petrovic@demo.gigzone.app',crypt('Demo1234!',gen_salt('bf')),NOW()-INTERVAL'29 days',NOW()-INTERVAL'29 days',NOW()-INTERVAL'29 days','{"provider":"email","providers":["email"]}','{}',false,'','','',''),
  ('b1000000-0000-0000-0000-000000000003','00000000-0000-0000-0000-000000000000','authenticated','authenticated','nikola.stojanovic@demo.gigzone.app',crypt('Demo1234!',gen_salt('bf')),NOW()-INTERVAL'28 days',NOW()-INTERVAL'28 days',NOW()-INTERVAL'28 days','{"provider":"email","providers":["email"]}','{}',false,'','','',''),
  ('b1000000-0000-0000-0000-000000000004','00000000-0000-0000-0000-000000000000','authenticated','authenticated','jelena.djordjevic@demo.gigzone.app',crypt('Demo1234!',gen_salt('bf')),NOW()-INTERVAL'27 days',NOW()-INTERVAL'27 days',NOW()-INTERVAL'27 days','{"provider":"email","providers":["email"]}','{}',false,'','','',''),
  ('b1000000-0000-0000-0000-000000000005','00000000-0000-0000-0000-000000000000','authenticated','authenticated','stefan.nikolic@demo.gigzone.app',crypt('Demo1234!',gen_salt('bf')),NOW()-INTERVAL'26 days',NOW()-INTERVAL'26 days',NOW()-INTERVAL'26 days','{"provider":"email","providers":["email"]}','{}',false,'','','',''),
  ('b1000000-0000-0000-0000-000000000006','00000000-0000-0000-0000-000000000000','authenticated','authenticated','maja.popovic@demo.gigzone.app',crypt('Demo1234!',gen_salt('bf')),NOW()-INTERVAL'25 days',NOW()-INTERVAL'25 days',NOW()-INTERVAL'25 days','{"provider":"email","providers":["email"]}','{}',false,'','','',''),
  ('b1000000-0000-0000-0000-000000000007','00000000-0000-0000-0000-000000000000','authenticated','authenticated','bojan.lazarevic@demo.gigzone.app',crypt('Demo1234!',gen_salt('bf')),NOW()-INTERVAL'24 days',NOW()-INTERVAL'24 days',NOW()-INTERVAL'24 days','{"provider":"email","providers":["email"]}','{}',false,'','','',''),
  ('b1000000-0000-0000-0000-000000000008','00000000-0000-0000-0000-000000000000','authenticated','authenticated','ivana.pavlovic@demo.gigzone.app',crypt('Demo1234!',gen_salt('bf')),NOW()-INTERVAL'23 days',NOW()-INTERVAL'23 days',NOW()-INTERVAL'23 days','{"provider":"email","providers":["email"]}','{}',false,'','','',''),
  ('b1000000-0000-0000-0000-000000000009','00000000-0000-0000-0000-000000000000','authenticated','authenticated','milan.simic@demo.gigzone.app',crypt('Demo1234!',gen_salt('bf')),NOW()-INTERVAL'22 days',NOW()-INTERVAL'22 days',NOW()-INTERVAL'22 days','{"provider":"email","providers":["email"]}','{}',false,'','','',''),
  ('b1000000-0000-0000-0000-000000000010','00000000-0000-0000-0000-000000000000','authenticated','authenticated','tamara.vasic@demo.gigzone.app',crypt('Demo1234!',gen_salt('bf')),NOW()-INTERVAL'21 days',NOW()-INTERVAL'21 days',NOW()-INTERVAL'21 days','{"provider":"email","providers":["email"]}','{}',false,'','','',''),
  ('b1000000-0000-0000-0000-000000000011','00000000-0000-0000-0000-000000000000','authenticated','authenticated','dragan.markovic@demo.gigzone.app',crypt('Demo1234!',gen_salt('bf')),NOW()-INTERVAL'20 days',NOW()-INTERVAL'20 days',NOW()-INTERVAL'20 days','{"provider":"email","providers":["email"]}','{}',false,'','','',''),
  ('b1000000-0000-0000-0000-000000000012','00000000-0000-0000-0000-000000000000','authenticated','authenticated','sara.ilic@demo.gigzone.app',crypt('Demo1234!',gen_salt('bf')),NOW()-INTERVAL'19 days',NOW()-INTERVAL'19 days',NOW()-INTERVAL'19 days','{"provider":"email","providers":["email"]}','{}',false,'','','',''),
  ('b1000000-0000-0000-0000-000000000013','00000000-0000-0000-0000-000000000000','authenticated','authenticated','vladimir.stankovic@demo.gigzone.app',crypt('Demo1234!',gen_salt('bf')),NOW()-INTERVAL'18 days',NOW()-INTERVAL'18 days',NOW()-INTERVAL'18 days','{"provider":"email","providers":["email"]}','{}',false,'','','',''),
  ('b1000000-0000-0000-0000-000000000014','00000000-0000-0000-0000-000000000000','authenticated','authenticated','nina.djordjevic@demo.gigzone.app',crypt('Demo1234!',gen_salt('bf')),NOW()-INTERVAL'17 days',NOW()-INTERVAL'17 days',NOW()-INTERVAL'17 days','{"provider":"email","providers":["email"]}','{}',false,'','','',''),
  ('b1000000-0000-0000-0000-000000000015','00000000-0000-0000-0000-000000000000','authenticated','authenticated','luka.kovacevic@demo.gigzone.app',crypt('Demo1234!',gen_salt('bf')),NOW()-INTERVAL'16 days',NOW()-INTERVAL'16 days',NOW()-INTERVAL'16 days','{"provider":"email","providers":["email"]}','{}',false,'','','',''),
  ('b1000000-0000-0000-0000-000000000016','00000000-0000-0000-0000-000000000000','authenticated','authenticated','milena.ristic@demo.gigzone.app',crypt('Demo1234!',gen_salt('bf')),NOW()-INTERVAL'15 days',NOW()-INTERVAL'15 days',NOW()-INTERVAL'15 days','{"provider":"email","providers":["email"]}','{}',false,'','','',''),
  ('b1000000-0000-0000-0000-000000000017','00000000-0000-0000-0000-000000000000','authenticated','authenticated','aleksandar.todorovic@demo.gigzone.app',crypt('Demo1234!',gen_salt('bf')),NOW()-INTERVAL'14 days',NOW()-INTERVAL'14 days',NOW()-INTERVAL'14 days','{"provider":"email","providers":["email"]}','{}',false,'','','',''),
  ('b1000000-0000-0000-0000-000000000018','00000000-0000-0000-0000-000000000000','authenticated','authenticated','jovana.filipovic@demo.gigzone.app',crypt('Demo1234!',gen_salt('bf')),NOW()-INTERVAL'13 days',NOW()-INTERVAL'13 days',NOW()-INTERVAL'13 days','{"provider":"email","providers":["email"]}','{}',false,'','','',''),
  ('b1000000-0000-0000-0000-000000000019','00000000-0000-0000-0000-000000000000','authenticated','authenticated','petar.milosevic@demo.gigzone.app',crypt('Demo1234!',gen_salt('bf')),NOW()-INTERVAL'12 days',NOW()-INTERVAL'12 days',NOW()-INTERVAL'12 days','{"provider":"email","providers":["email"]}','{}',false,'','','',''),
  ('b1000000-0000-0000-0000-000000000020','00000000-0000-0000-0000-000000000000','authenticated','authenticated','katarina.djuric@demo.gigzone.app',crypt('Demo1234!',gen_salt('bf')),NOW()-INTERVAL'11 days',NOW()-INTERVAL'11 days',NOW()-INTERVAL'11 days','{"provider":"email","providers":["email"]}','{}',false,'','','',''),
  ('b1000000-0000-0000-0000-000000000021','00000000-0000-0000-0000-000000000000','authenticated','authenticated','vesna.spasic@demo.gigzone.app',crypt('Demo1234!',gen_salt('bf')),NOW()-INTERVAL'10 days',NOW()-INTERVAL'10 days',NOW()-INTERVAL'10 days','{"provider":"email","providers":["email"]}','{}',false,'','','',''),
  ('b1000000-0000-0000-0000-000000000022','00000000-0000-0000-0000-000000000000','authenticated','authenticated','goran.antic@demo.gigzone.app',crypt('Demo1234!',gen_salt('bf')),NOW()-INTERVAL'9 days',NOW()-INTERVAL'9 days',NOW()-INTERVAL'9 days','{"provider":"email","providers":["email"]}','{}',false,'','','',''),
  ('b1000000-0000-0000-0000-000000000023','00000000-0000-0000-0000-000000000000','authenticated','authenticated','natasa.vukovic@demo.gigzone.app',crypt('Demo1234!',gen_salt('bf')),NOW()-INTERVAL'8 days',NOW()-INTERVAL'8 days',NOW()-INTERVAL'8 days','{"provider":"email","providers":["email"]}','{}',false,'','','',''),
  ('b1000000-0000-0000-0000-000000000024','00000000-0000-0000-0000-000000000000','authenticated','authenticated','branko.cvetkovic@demo.gigzone.app',crypt('Demo1234!',gen_salt('bf')),NOW()-INTERVAL'7 days',NOW()-INTERVAL'7 days',NOW()-INTERVAL'7 days','{"provider":"email","providers":["email"]}','{}',false,'','','',''),
  ('b1000000-0000-0000-0000-000000000025','00000000-0000-0000-0000-000000000000','authenticated','authenticated','dijana.ivanovic@demo.gigzone.app',crypt('Demo1234!',gen_salt('bf')),NOW()-INTERVAL'6 days',NOW()-INTERVAL'6 days',NOW()-INTERVAL'6 days','{"provider":"email","providers":["email"]}','{}',false,'','','',''),
  ('b1000000-0000-0000-0000-000000000026','00000000-0000-0000-0000-000000000000','authenticated','authenticated','dejan.bogdanovic@demo.gigzone.app',crypt('Demo1234!',gen_salt('bf')),NOW()-INTERVAL'5 days',NOW()-INTERVAL'5 days',NOW()-INTERVAL'5 days','{"provider":"email","providers":["email"]}','{}',false,'','','',''),
  ('b1000000-0000-0000-0000-000000000027','00000000-0000-0000-0000-000000000000','authenticated','authenticated','snezana.stanojevic@demo.gigzone.app',crypt('Demo1234!',gen_salt('bf')),NOW()-INTERVAL'4 days',NOW()-INTERVAL'4 days',NOW()-INTERVAL'4 days','{"provider":"email","providers":["email"]}','{}',false,'','','',''),
  ('b1000000-0000-0000-0000-000000000028','00000000-0000-0000-0000-000000000000','authenticated','authenticated','zoran.jovic@demo.gigzone.app',crypt('Demo1234!',gen_salt('bf')),NOW()-INTERVAL'3 days',NOW()-INTERVAL'3 days',NOW()-INTERVAL'3 days','{"provider":"email","providers":["email"]}','{}',false,'','','',''),
  ('b1000000-0000-0000-0000-000000000029','00000000-0000-0000-0000-000000000000','authenticated','authenticated','dragana.pesic@demo.gigzone.app',crypt('Demo1234!',gen_salt('bf')),NOW()-INTERVAL'2 days',NOW()-INTERVAL'2 days',NOW()-INTERVAL'2 days','{"provider":"email","providers":["email"]}','{}',false,'','','',''),
  ('b1000000-0000-0000-0000-000000000030','00000000-0000-0000-0000-000000000000','authenticated','authenticated','miroslav.savic@demo.gigzone.app',crypt('Demo1234!',gen_salt('bf')),NOW()-INTERVAL'1 day',NOW()-INTERVAL'1 day',NOW()-INTERVAL'1 day','{"provider":"email","providers":["email"]}','{}',false,'','','','')
ON CONFLICT (id) DO NOTHING;

-- ── 2. PROFILES (30) ───────────────────────────────────────────
INSERT INTO profiles (id, name, email, account_type, city, category, bio, skills, show_phone, show_email, avatar_url, created_at) VALUES
  ('b1000000-0000-0000-0000-000000000001','Marko Jovanović','marko.jovanovic@demo.gigzone.app','professional','Beograd','Elektricar','Licencirani elektricar sa 10 godina iskustva u stambenim i poslovnim objektima. Radim brzo, čisto i pouzdano.','["Elektro instalacije","Solarna energija","Video nadzor","Alarm sistemi"]',false,false,'https://i.pravatar.cc/300?u=demo1',NOW()-INTERVAL'30 days'),
  ('b1000000-0000-0000-0000-000000000002','Ana Petrović','ana.petrovic@demo.gigzone.app','professional','Novi Sad','Frizer','Kreativna frizerka sa 8 godina iskustva. Specijalizovana za balayage, keratinske tretmane i moderne frizure.','["Balayage","Keratin tretman","Pramenovi","Venčane frizure"]',false,false,'https://i.pravatar.cc/300?u=demo2',NOW()-INTERVAL'29 days'),
  ('b1000000-0000-0000-0000-000000000003','Nikola Stojanović','nikola.stojanovic@demo.gigzone.app','professional','Beograd','IT','Full-stack developer sa 6 godina iskustva. React, Node.js, PostgreSQL. Radim web aplikacije i e-commerce projekte.','["React","Next.js","Node.js","PostgreSQL","SEO"]',false,false,'https://i.pravatar.cc/300?u=demo3',NOW()-INTERVAL'28 days'),
  ('b1000000-0000-0000-0000-000000000004','Jelena Đorđević','jelena.djordjevic@demo.gigzone.app','professional','Beograd','Računovodstvo','Ovlašćeni računovođa sa 12 godina prakse. Vođenje knjiga, PDV, godišnji izveštaji i poresko savetovanje.','["PDV","Godišnji izveštaj","Platni promet","Poresko savetovanje"]',false,false,'https://i.pravatar.cc/300?u=demo4',NOW()-INTERVAL'27 days'),
  ('b1000000-0000-0000-0000-000000000005','Stefan Nikolić','stefan.nikolic@demo.gigzone.app','professional','Kragujevac','Vodoinstalater','Iskusan vodoinstalater, dostupan za hitne intervencije. Radim grejanje, kupatila i kompletne vodo-instalacije.','["Centralno grejanje","Podno grejanje","Kupatila","Hitne intervencije"]',false,false,'https://i.pravatar.cc/300?u=demo5',NOW()-INTERVAL'26 days'),
  ('b1000000-0000-0000-0000-000000000006','Maja Popović','maja.popovic@demo.gigzone.app','professional','Novi Sad','Psiholog','Klinički psiholog i psihoterapeut sa 7 godina iskustva. Individualna i grupna terapija, online sesije dostupne.','["Kognitivno-bihejvioralna terapija","Anksioznost","Depresija","Online terapija"]',false,false,'https://i.pravatar.cc/300?u=demo6',NOW()-INTERVAL'25 days'),
  ('b1000000-0000-0000-0000-000000000007','Bojan Lazarević','bojan.lazarevic@demo.gigzone.app','professional','Niš','Stolar','Stolar sa 15 godina iskustva. Izrada nameštaja po meri — kuhinje, garderobe, dečije sobe. Radim u celoj Srbiji.','["Kuhinje po meri","Garderobe","Dečije sobe","Restauracija nameštaja"]',false,false,'https://i.pravatar.cc/300?u=demo7',NOW()-INTERVAL'24 days'),
  ('b1000000-0000-0000-0000-000000000008','Ivana Pavlović','ivana.pavlovic@demo.gigzone.app','professional','Beograd','Prevodilac','Sudski tumač i prevodilac za engleski, nemački i francuski. Poslovni, pravni i tehnički prevodi.','["Engleski","Nemački","Francuski","Sudski prevod","Lokalizacija"]',false,false,'https://i.pravatar.cc/300?u=demo8',NOW()-INTERVAL'23 days'),
  ('b1000000-0000-0000-0000-000000000009','Milan Simić','milan.simic@demo.gigzone.app','professional','Subotica','Automehaničar','Majstor za vozila svih marki sa fokusom na VW i BMW grupu. Dijagnostika, servis, mehanički radovi.','["Dijagnostika","Motor","Menjač","Kočioni sistem","Klimatizacija"]',false,false,'https://i.pravatar.cc/300?u=demo9',NOW()-INTERVAL'22 days'),
  ('b1000000-0000-0000-0000-000000000010','Tamara Vasić','tamara.vasic@demo.gigzone.app','professional','Beograd','Fizioterapija','Diplomirani fizioterapeut sa 9 godina prakse. Sportska rehabilitacija, manuelna terapija, kućne posete.','["Manuelna terapija","Sportska rehabilitacija","Kućne posete","Masaža"]',false,false,'https://i.pravatar.cc/300?u=demo10',NOW()-INTERVAL'21 days'),
  ('b1000000-0000-0000-0000-000000000011','Dragan Marković','dragan.markovic@demo.gigzone.app','professional','Kragujevac','Zidar','Iskusan zidar i rukovodioc građevinskih radova. Adaptacije, rekonstrukcije, novogradnja. 20 godina iskustva.','["Zidanje","Malterisanje","Armiranobetonski radovi","Adaptacije","Fasade"]',false,false,'https://i.pravatar.cc/300?u=demo11',NOW()-INTERVAL'20 days'),
  ('b1000000-0000-0000-0000-000000000012','Sara Ilić','sara.ilic@demo.gigzone.app','professional','Beograd','Dizajn','Grafička dizajnerka i brand strateg sa 5 godina iskustva. Logotipi, vizualni identitet, socijalne mreže.','["Logotipi","Brand identitet","Social media dizajn","Packaging","UI/UX"]',false,false,'https://i.pravatar.cc/300?u=demo12',NOW()-INTERVAL'19 days'),
  ('b1000000-0000-0000-0000-000000000013','Vladimir Stanković','vladimir.stankovic@demo.gigzone.app','professional','Novi Sad','Ugostiteljstvo','Iskusni kuvar sa 11 godina u restoranima i caterinzima. Specijalizovan za srpsku i mediteransku kuhinju.','["Srpska kuhinja","Mediteranska kuhinja","Catering","Privatne proslave","Hladna kuhinja"]',false,false,'https://i.pravatar.cc/300?u=demo13',NOW()-INTERVAL'18 days'),
  ('b1000000-0000-0000-0000-000000000014','Nina Đorđević','nina.djordjevic@demo.gigzone.app','professional','Niš','Medicina','Medicinska sestra sa 14 godina iskustva. Kućne posete, nega starih i hroničnih bolesnika, davanje injekcija.','["Kućna nega","Nega starih","Injekcije","Previjanje","Monitoring"]',false,false,'https://i.pravatar.cc/300?u=demo14',NOW()-INTERVAL'17 days'),
  ('b1000000-0000-0000-0000-000000000015','Luka Kovačević','luka.kovacevic@demo.gigzone.app','professional','Beograd','Soboslikar','Majstor moler sa 13 godina iskustva. Sve vrste gletovanja i farbanja, dekorativne tehnike, venecijaner.','["Gletovanje","Farbanje","Venecijaner","Mikročement","Dekorativne tehnike"]',false,false,'https://i.pravatar.cc/300?u=demo15',NOW()-INTERVAL'16 days'),
  ('b1000000-0000-0000-0000-000000000016','Milena Ristić','milena.ristic@demo.gigzone.app','customer','Beograd',NULL,NULL,'[]',false,false,'https://i.pravatar.cc/300?u=demo16',NOW()-INTERVAL'15 days'),
  ('b1000000-0000-0000-0000-000000000017','Aleksandar Todorović','aleksandar.todorovic@demo.gigzone.app','customer','Novi Sad',NULL,NULL,'[]',false,false,'https://i.pravatar.cc/300?u=demo17',NOW()-INTERVAL'14 days'),
  ('b1000000-0000-0000-0000-000000000018','Jovana Filipović','jovana.filipovic@demo.gigzone.app','customer','Niš',NULL,NULL,'[]',false,false,'https://i.pravatar.cc/300?u=demo18',NOW()-INTERVAL'13 days'),
  ('b1000000-0000-0000-0000-000000000019','Petar Milošević','petar.milosevic@demo.gigzone.app','customer','Beograd',NULL,NULL,'[]',false,false,'https://i.pravatar.cc/300?u=demo19',NOW()-INTERVAL'12 days'),
  ('b1000000-0000-0000-0000-000000000020','Katarina Đurić','katarina.djuric@demo.gigzone.app','customer','Subotica',NULL,NULL,'[]',false,false,'https://i.pravatar.cc/300?u=demo20',NOW()-INTERVAL'11 days'),
  ('b1000000-0000-0000-0000-000000000021','Vesna Spasić','vesna.spasic@demo.gigzone.app','customer','Kragujevac',NULL,NULL,'[]',false,false,'https://i.pravatar.cc/300?u=demo21',NOW()-INTERVAL'10 days'),
  ('b1000000-0000-0000-0000-000000000022','Goran Antić','goran.antic@demo.gigzone.app','customer','Beograd',NULL,NULL,'[]',false,false,'https://i.pravatar.cc/300?u=demo22',NOW()-INTERVAL'9 days'),
  ('b1000000-0000-0000-0000-000000000023','Nataša Vuković','natasa.vukovic@demo.gigzone.app','customer','Novi Sad',NULL,NULL,'[]',false,false,'https://i.pravatar.cc/300?u=demo23',NOW()-INTERVAL'8 days'),
  ('b1000000-0000-0000-0000-000000000024','Branko Cvetković','branko.cvetkovic@demo.gigzone.app','customer','Beograd',NULL,NULL,'[]',false,false,'https://i.pravatar.cc/300?u=demo24',NOW()-INTERVAL'7 days'),
  ('b1000000-0000-0000-0000-000000000025','Dijana Ivanović','dijana.ivanovic@demo.gigzone.app','customer','Niš',NULL,NULL,'[]',false,false,'https://i.pravatar.cc/300?u=demo25',NOW()-INTERVAL'6 days'),
  ('b1000000-0000-0000-0000-000000000026','Dejan Bogdanović','dejan.bogdanovic@demo.gigzone.app','customer','Beograd',NULL,NULL,'[]',false,false,'https://i.pravatar.cc/300?u=demo26',NOW()-INTERVAL'5 days'),
  ('b1000000-0000-0000-0000-000000000027','Snežana Stanojević','snezana.stanojevic@demo.gigzone.app','customer','Novi Sad',NULL,NULL,'[]',false,false,'https://i.pravatar.cc/300?u=demo27',NOW()-INTERVAL'4 days'),
  ('b1000000-0000-0000-0000-000000000028','Zoran Jović','zoran.jovic@demo.gigzone.app','customer','Kragujevac',NULL,NULL,'[]',false,false,'https://i.pravatar.cc/300?u=demo28',NOW()-INTERVAL'3 days'),
  ('b1000000-0000-0000-0000-000000000029','Dragana Pešić','dragana.pesic@demo.gigzone.app','customer','Beograd',NULL,NULL,'[]',false,false,'https://i.pravatar.cc/300?u=demo29',NOW()-INTERVAL'2 days'),
  ('b1000000-0000-0000-0000-000000000030','Miroslav Savić','miroslav.savic@demo.gigzone.app','customer','Beograd',NULL,NULL,'[]',false,false,'https://i.pravatar.cc/300?u=demo30',NOW()-INTERVAL'1 day')
ON CONFLICT (id) DO NOTHING;

-- ── 3. POSTS (100 social_post za feed) ─────────────────────────
INSERT INTO posts (id, user_id, text, post_type, status, views_count, created_at, spam_score, rank_penalty, link_count, phone_count, hashtag_count) VALUES

-- Marko (elektricar) - 7 postova
('c2000000-0000-0000-0000-000000000001','b1000000-0000-0000-0000-000000000001','Završio sam danas instalaciju solarnih panela na kući u Voždovcu 🌞 Štednja na struji i do 70% mesečno. Ako vas zanima solarna energija, slobodno pišite — dajem besplatnu procenu.','social_post','published',1243,NOW()-INTERVAL'29 days 14 hours',0,1.0,0,0,0),
('c2000000-0000-0000-0000-000000000002','b1000000-0000-0000-0000-000000000001','Stručni savet: nikad ne štedite na osiguračima i prekostrujnoj zaštiti. Video sam previše požara koji su nastali zbog loše elektrike. Bezbednost nije kompromis! ⚡','social_post','published',876,NOW()-INTERVAL'25 days 8 hours',0,1.0,0,0,0),
('c2000000-0000-0000-0000-000000000003','b1000000-0000-0000-0000-000000000001','Pre nego što platite servis — proverite da li je samo iskočio osigurač 😄 Najozbiljno, to je prva stvar koju radim kad dođem na teren. Uštedite 3000 dinara za nešto bolje!','social_post','published',2140,NOW()-INTERVAL'20 days 11 hours',0,1.0,0,0,0),
('c2000000-0000-0000-0000-000000000004','b1000000-0000-0000-0000-000000000001','Tražim mlađeg električara za moj tim u Beogradu. Naučiću ga svemu što znam. Posao postoji, klijenti čekaju. DM za detalje.','social_post','published',567,NOW()-INTERVAL'15 days 6 hours',0,1.0,0,0,0),
('c2000000-0000-0000-0000-000000000005','b1000000-0000-0000-0000-000000000001','Danas sam postavio video nadzor sa 8 kamera za skladište u Zemunu. Vlasnik je konačno miran 😄 Ako trebate sistem za objekat — tu sam.','social_post','published',934,NOW()-INTERVAL'10 days 16 hours',0,1.0,0,0,0),
('c2000000-0000-0000-0000-000000000006','b1000000-0000-0000-0000-000000000001','10 godina radim ovaj posao i svaki put kada vidim zadovoljnog klijenta — vredi svakog sata. Hvala svima koji su mi ukazali poverenje! 🙏','social_post','published',1567,NOW()-INTERVAL'5 days 9 hours',0,1.0,0,0,0),
('c2000000-0000-0000-0000-000000000007','b1000000-0000-0000-0000-000000000001','Novi projekat — kompletna elektro instalacija kuće 180m² u Mladenovcu. Počinjemo u ponedeljak! Biću odsutan par nedelja 💪','social_post','published',423,NOW()-INTERVAL'1 day 3 hours',0,1.0,0,0,0),

-- Ana (frizer) - 7 postova
('c2000000-0000-0000-0000-000000000008','b1000000-0000-0000-0000-000000000002','Nova tehnika balayage je stigla u naš salon u Novom Sadu! Ove jeseni su boje kao sunčani zalazak 🍂 Ko se prijavljuje za transformaciju?','social_post','published',1876,NOW()-INTERVAL'28 days 10 hours',0,1.0,0,0,0),
('c2000000-0000-0000-0000-000000000009','b1000000-0000-0000-0000-000000000002','Stručni savet: hidratacija kose je ključ svega. Redovni tretmani, kvalitetni proizvodi i strpljenje. Ne mora biti skupo — dobar balzam i redovno šišanje čine čuda! ✂️','social_post','published',2345,NOW()-INTERVAL'24 days 13 hours',0,1.0,0,0,0),
('c2000000-0000-0000-0000-000000000010','b1000000-0000-0000-0000-000000000002','Ponosna na ovu transformaciju — klijentkinja je imala kosu do struka, htela je moderan bob. Sada sjaji od samopouzdanja! Svaka frizura je priča 💇‍♀️','social_post','published',3210,NOW()-INTERVAL'18 days 7 hours',0,1.0,0,0,0),
('c2000000-0000-0000-0000-000000000011','b1000000-0000-0000-0000-000000000002','Rezervišite termin za praznike na vreme! Decembar se puni jako brzo. Slobodnih mesta ima samo vikendom u prvoj polovini meseca. 📅','social_post','published',1123,NOW()-INTERVAL'12 days 11 hours',0,1.0,0,0,0),
('c2000000-0000-0000-0000-000000000012','b1000000-0000-0000-0000-000000000002','Mit: kratka kosa je "muška". Stvarnost: kratka kosa je sloboda, samopouzdanje i elegancija. Ako razmišljate o promeni — uradite to! 💪','social_post','published',4567,NOW()-INTERVAL'7 days 14 hours',0,1.0,0,0,0),
('c2000000-0000-0000-0000-000000000013','b1000000-0000-0000-0000-000000000002','8 godina radim i svaki dan učim nešto novo. Upravo sam završila kurs u Milanu — nove tehnike dolaze u salon! Hvala svim klijentima na poverenju 🙏','social_post','published',1890,NOW()-INTERVAL'3 days 8 hours',0,1.0,0,0,0),
('c2000000-0000-0000-0000-000000000014','b1000000-0000-0000-0000-000000000002','Subotom radim i do 20h — za sve koji ne mogu radnim danom. Zakazivanje isključivo porukama. 📱','social_post','published',756,NOW()-INTERVAL'12 hours',0,1.0,0,0,0),

-- Nikola (IT) - 7 postova
('c2000000-0000-0000-0000-000000000015','b1000000-0000-0000-0000-000000000003','Još jedan web sajt objavljen 🚀 E-commerce za pekaru iz Novog Sada — online narudžbine, dostava, praćenje porudžbine. Ako treba digitalizacija — tu sam!','social_post','published',1456,NOW()-INTERVAL'27 days 9 hours',0,1.0,0,0,0),
('c2000000-0000-0000-0000-000000000016','b1000000-0000-0000-0000-000000000003','Čest mit: skup sajt = dobar sajt. Nije tačno. Važna je strategija, brzina učitavanja i korisničko iskustvo. Pišite mi za besplatnu analizu vašeg sajta.','social_post','published',2789,NOW()-INTERVAL'22 days 15 hours',0,1.0,0,0,0),
('c2000000-0000-0000-0000-000000000017','b1000000-0000-0000-0000-000000000003','Radim remote već 6 godina. Produktivnost mi se utrostručila otkad ne gubim 2 sata dnevno u prevozu. Za sve koji razmišljaju o freelance-u — preporucujem svim srcem! 💻','social_post','published',5678,NOW()-INTERVAL'17 days 12 hours',0,1.0,0,0,0),
('c2000000-0000-0000-0000-000000000018','b1000000-0000-0000-0000-000000000003','Google treba da zna da vaš sajt postoji. SEO nije opcija, to je osnova. Radim sa firmama koje su sa nulte pozicije dosle na prvu stranu Googla u 3 meseca.','social_post','published',3456,NOW()-INTERVAL'11 days 10 hours',0,1.0,0,0,0),
('c2000000-0000-0000-0000-000000000019','b1000000-0000-0000-0000-000000000003','Zaradio sam prvu platu kao developer sa 22 godine. Danas vodim sopstvenu firmu. Ako imate ideju za aplikaciju ili sajt — razgovarajmo! 🙂','social_post','published',7890,NOW()-INTERVAL'6 days 8 hours',0,1.0,0,0,0),
('c2000000-0000-0000-0000-000000000020','b1000000-0000-0000-0000-000000000003','AI alati su promenili moj workflow za 40%. Koristim ih svaki dan, ali kreativnost i logika ostaju moje. Mašina je alat, ne zamena.','social_post','published',4321,NOW()-INTERVAL'2 days 14 hours',0,1.0,0,0,0),
('c2000000-0000-0000-0000-000000000021','b1000000-0000-0000-0000-000000000003','Besplatni savet za male firme: Google My Business profil + 10 recenzija = vidljivost kakvu niste ni sanjali. Besplatno, efikasno, odmah.','social_post','published',2134,NOW()-INTERVAL'5 hours',0,1.0,0,0,0),

-- Jelena (računovođa) - 6 postova
('c2000000-0000-0000-0000-000000000022','b1000000-0000-0000-0000-000000000004','Podsetnik: rok za PDV prijavu je sutra! Ko još nije predao — pohitajte. Zovite me ako trebate pomoć, radim i vikendom u periodima rokova 📊','social_post','published',1234,NOW()-INTERVAL'26 days 8 hours',0,1.0,0,0,0),
('c2000000-0000-0000-0000-000000000023','b1000000-0000-0000-0000-000000000004','Godišnji izveštaj nije stresno ako se cela godina vodi uredna evidencija. Zato sam uvek za mesečne izveštaje — mali posao mesečno, nula stresa u januaru.','social_post','published',1876,NOW()-INTERVAL'20 days 11 hours',0,1.0,0,0,0),
('c2000000-0000-0000-0000-000000000024','b1000000-0000-0000-0000-000000000004','Najčešća greška preduzetnika: mešanje poslovnih i privatnih računa. Napravite poseban račun za firmu danas — uštedite nerve, novac i vreme. Obavezno!','social_post','published',3456,NOW()-INTERVAL'14 days 9 hours',0,1.0,0,0,0),
('c2000000-0000-0000-0000-000000000025','b1000000-0000-0000-0000-000000000004','Primila 3 nova klijenta ove nedelje zahvaljujući preporukama starih. Ovo je razlog zašto radim savesno svaki mesec 😊 Hvala na poverenju!','social_post','published',987,NOW()-INTERVAL'9 days 13 hours',0,1.0,0,0,0),
('c2000000-0000-0000-0000-000000000026','b1000000-0000-0000-0000-000000000004','Paušalno oporezivanje vs. stvarni troškovi — koji sistem vam više odgovara? Zavisi od delatnosti. Pišite, analiziram besplatno za nove klijente.','social_post','published',2345,NOW()-INTERVAL'4 days 10 hours',0,1.0,0,0,0),
('c2000000-0000-0000-0000-000000000027','b1000000-0000-0000-0000-000000000004','Nova poreska reforma dolazi u oktobru. Pratite objave i pripremite se na vreme. Ako trebate savetovanje — slobodno pišite 📋','social_post','published',1567,NOW()-INTERVAL'18 hours',0,1.0,0,0,0),

-- Stefan (vodoinstalater) - 6 postova
('c2000000-0000-0000-0000-000000000028','b1000000-0000-0000-0000-000000000005','Primer zašto ne treba čekati: mala curenja postaju poplave. Pozvao me klijent — pod potpuno uništen jer je ignorisao kap vode mesecima. Cena: 10x skuplja popravka.','social_post','published',2678,NOW()-INTERVAL'25 days 7 hours',0,1.0,0,0,0),
('c2000000-0000-0000-0000-000000000029','b1000000-0000-0000-0000-000000000005','Postavio sam novi sistem filtriranja vode za porodicu u Kragujevcu. Sada piju čistu vodu iz slavine umesto flaširane 💧 Povrat investicije za 8 meseci.','social_post','published',1890,NOW()-INTERVAL'19 days 12 hours',0,1.0,0,0,0),
('c2000000-0000-0000-0000-000000000030','b1000000-0000-0000-0000-000000000005','Podno grejanje vs. radijatori — najčešće pitanje. Podno je udobnije i efikasnije, ali skuplja ugradnja. Za novu gradnju — podno. Za adaptaciju — radijatori.','social_post','published',4123,NOW()-INTERVAL'13 days 8 hours',0,1.0,0,0,0),
('c2000000-0000-0000-0000-000000000031','b1000000-0000-0000-0000-000000000005','Hitne intervencije — uvek dostupan u Kragujevcu i okolini. Znam da se cevi ne biraju kada puknu 😅 Pozovite, dolazim u roku od sat vremena.','social_post','published',876,NOW()-INTERVAL'7 days 15 hours',0,1.0,0,0,0),
('c2000000-0000-0000-0000-000000000032','b1000000-0000-0000-0000-000000000005','Upravo završio kompletno kupatilo u Čačku — od rušenja do poslednje pločice. Klijent oduševljen! 💪 Radimo i van Kragujevca za veće projekte.','social_post','published',1345,NOW()-INTERVAL'2 days 11 hours',0,1.0,0,0,0),
('c2000000-0000-0000-0000-000000000033','b1000000-0000-0000-0000-000000000005','Zima se bliži — proverte grejanje na vreme! Ne čekajte prve hladne noći. Servis kotla, provera instalacija, punjenje sistema. Zakazujte odmah.','social_post','published',2134,NOW()-INTERVAL'6 hours',0,1.0,0,0,0),

-- Maja (psiholog) - 6 postova
('c2000000-0000-0000-0000-000000000034','b1000000-0000-0000-0000-000000000006','Anksioznost je danas najčešći razlog dolaska na terapiju. Dobra vest: uz pravu podršku, u potpunosti se može prevazići. Nije slabost tražiti pomoć — to je hrabrost.','social_post','published',5678,NOW()-INTERVAL'24 days 9 hours',0,1.0,0,0,0),
('c2000000-0000-0000-0000-000000000035','b1000000-0000-0000-0000-000000000006','Online terapija funkcioniše jednako efikasno kao i u ordinaciji — potvrđuju to brojna istraživanja. Udobnost vašeg doma + stručna podrška. Prijavite se za prvu sesiju.','social_post','published',3456,NOW()-INTERVAL'18 days 14 hours',0,1.0,0,0,0),
('c2000000-0000-0000-0000-000000000036','b1000000-0000-0000-0000-000000000006','Sagorevanje (burnout) nije lenost. To je fiziološka i psihološka reakcija na dugotrajni stres. Ako se osećate iscrpljeno — vaše telo šalje signal. Slušajte ga.','social_post','published',8934,NOW()-INTERVAL'12 days 11 hours',0,1.0,0,0,0),
('c2000000-0000-0000-0000-000000000037','b1000000-0000-0000-0000-000000000006','Jedno od najmoćnijih pitanja koje možete sebi postaviti: "Da li bih ovo rekao svom prijatelju?" Budite sebi prijatelj. Samokritikovanjem ne idete napred.','social_post','published',12456,NOW()-INTERVAL'6 days 8 hours',0,1.0,0,0,0),
('c2000000-0000-0000-0000-000000000038','b1000000-0000-0000-0000-000000000006','Roditelji me često pitaju kako da razgovaraju sa tinejdžerima o problemima. Odgovor: slušajte više nego što pričate. Oni to osete i otvaraju se.','social_post','published',6789,NOW()-INTERVAL'2 days 13 hours',0,1.0,0,0,0),
('c2000000-0000-0000-0000-000000000039','b1000000-0000-0000-0000-000000000006','Slobodnih termina ima ponedeljkom i sredom od 18h. Online i u Novom Sadu. Prva sesija je uvodni razgovor bez obaveza. 🌱','social_post','published',2345,NOW()-INTERVAL'4 hours',0,1.0,0,0,0),

-- Bojan (stolar) - 6 postova
('c2000000-0000-0000-0000-000000000040','b1000000-0000-0000-0000-000000000007','Završena kuhinja po meri za klijenta iz Niša 🪵 Svaki centimetar iskorišćen. Ako imate nestan prostor — to je naš specijal!','social_post','published',2134,NOW()-INTERVAL'23 days 10 hours',0,1.0,0,0,0),
('c2000000-0000-0000-0000-000000000041','b1000000-0000-0000-0000-000000000007','IKEA nameštaj vs. nameštaj po meri — nije isti kvalitet ni upotreba prostora. Za male stanove, nameštaj po meri je investicija koja se isplati. 📐','social_post','published',3456,NOW()-INTERVAL'17 days 15 hours',0,1.0,0,0,0),
('c2000000-0000-0000-0000-000000000042','b1000000-0000-0000-0000-000000000007','Masivno drvo vs. iverica — razlika u ceni je 30-50%, ali razlika u trajnosti je 30+ godina. Za nameštaj koji se prenosi generacijama — bira se masivno.','social_post','published',4567,NOW()-INTERVAL'11 days 8 hours',0,1.0,0,0,0),
('c2000000-0000-0000-0000-000000000043','b1000000-0000-0000-0000-000000000007','Garderoba u hodniku koja koristi svaki centimetar od poda do plafona. Klijent iz Beograda dobio je 3x više prostora za odlaganje. Geometrija je moćna stvar 😄','social_post','published',1890,NOW()-INTERVAL'5 days 12 hours',0,1.0,0,0,0),
('c2000000-0000-0000-0000-000000000044','b1000000-0000-0000-0000-000000000007','15 godina radim ovaj zanat i nikad mi nije bilo dosadno. Svaki projekat je jedinstven izazov. Ovo je moja strast, ne samo posao. 🪵','social_post','published',2678,NOW()-INTERVAL'1 day 9 hours',0,1.0,0,0,0),
('c2000000-0000-0000-0000-000000000045','b1000000-0000-0000-0000-000000000007','Dečija soba finalizovana! Kreveta na sprat sa prostorom za učenje ispod. Deca su oduševljena, roditelji još više 😄 Tag me ako vaša deca vole ovu ideju!','social_post','published',5678,NOW()-INTERVAL'3 hours',0,1.0,0,0,0),

-- Ivana (prevodilac) - 5 postova
('c2000000-0000-0000-0000-000000000046','b1000000-0000-0000-0000-000000000008','Prevod nije samo zamena reči — to je prenos značenja, tona i kulture. Loš prevod može koštati posao. Uložite u kvalitet.','social_post','published',2345,NOW()-INTERVAL'22 days 11 hours',0,1.0,0,0,0),
('c2000000-0000-0000-0000-000000000047','b1000000-0000-0000-0000-000000000008','AI prevodi su korisni za osnovno razumevanje, ali za poslovne dokumente, ugovore i prezentacije — uvek angažujte profesionalca. Razlika je ogromna.','social_post','published',4567,NOW()-INTERVAL'16 days 14 hours',0,1.0,0,0,0),
('c2000000-0000-0000-0000-000000000048','b1000000-0000-0000-0000-000000000008','Sudski prevodi gotovi za 24h po potrebi. Diplomatske apostile, ugovori, diplome, lična dokumenta. Kontaktirajte me za hitne rokove.','social_post','published',1234,NOW()-INTERVAL'10 days 9 hours',0,1.0,0,0,0),
('c2000000-0000-0000-0000-000000000049','b1000000-0000-0000-0000-000000000008','Radim sa firmama koje izlaze na nemačko tržište već 5 godina. Razumem poslovnu kulturu, ne samo jezik. To je ključna razlika.','social_post','published',1890,NOW()-INTERVAL'5 days 10 hours',0,1.0,0,0,0),
('c2000000-0000-0000-0000-000000000050','b1000000-0000-0000-0000-000000000008','Nova specijalizacija: medicinski prevodi. Medicinska dokumentacija, otpusne liste, istorija bolesti. Preciznost je ovde apsolutni prioritet.','social_post','published',876,NOW()-INTERVAL'1 day 6 hours',0,1.0,0,0,0),

-- Milan (automehaničar) - 5 postova
('c2000000-0000-0000-0000-000000000051','b1000000-0000-0000-0000-000000000009','Letnja guma vs. zimska — nije samo o snegu. Zimske gume imaju bolje prianjanje i na mokrom asfaltu ispod 7°C. Promenite na vreme, ne čekajte mraz.','social_post','published',6789,NOW()-INTERVAL'21 days 8 hours',0,1.0,0,0,0),
('c2000000-0000-0000-0000-000000000052','b1000000-0000-0000-0000-000000000009','BMW N20 motor — znate li da ima problem sa lancem razvodnog mehanizma posle 80.000km? Uvek proveravajte pri kupovini polovnog BMW-a. Mogu da proverim za vas.','social_post','published',8901,NOW()-INTERVAL'15 days 13 hours',0,1.0,0,0,0),
('c2000000-0000-0000-0000-000000000053','b1000000-0000-0000-0000-000000000009','Promena ulja nije samo formalnost — to je produžetak životnog veka motora. Svaka 10.000km ili jednom godišnje. Minimalna investicija, maksimalna zaštita.','social_post','published',4321,NOW()-INTERVAL'9 days 11 hours',0,1.0,0,0,0),
('c2000000-0000-0000-0000-000000000054','b1000000-0000-0000-0000-000000000009','Kupujete polovno vozilo? Uvek uradite dijagnostiku pre kupovine. Koštaće vas 3000 dinara ali vam može uštedeti 300.000. 🔧','social_post','published',12345,NOW()-INTERVAL'4 days 9 hours',0,1.0,0,0,0),
('c2000000-0000-0000-0000-000000000055','b1000000-0000-0000-0000-000000000009','Upravo završio generalnu reviziju VW Golf 7 — nova kvačila, kočioni sistem, gume, ulje, filter. Auto kao nov za 1/5 cene novog. Dovedi pa vidi razliku! 🚗','social_post','published',2345,NOW()-INTERVAL'8 hours',0,1.0,0,0,0),

-- Tamara (fizioterapeut) - 5 postova
('c2000000-0000-0000-0000-000000000056','b1000000-0000-0000-0000-000000000010','Bol u leđima je epidemija 21. veka — posebno kod onih koji sede 8+ sati dnevno. Pravilno sedenje + 5 minuta vežbi svaka 2 sata = ogromna razlika.','social_post','published',9876,NOW()-INTERVAL'20 days 10 hours',0,1.0,0,0,0),
('c2000000-0000-0000-0000-000000000057','b1000000-0000-0000-0000-000000000010','Posle operacije kolena, rehabilitacija je jednako važna kao i sama operacija. Videla sam previše pacijenata koji su preskočili fizioterapiju i zažalili.','social_post','published',5432,NOW()-INTERVAL'14 days 15 hours',0,1.0,0,0,0),
('c2000000-0000-0000-0000-000000000058','b1000000-0000-0000-0000-000000000010','Kućne posete — Beograd i okolina. Za pacijente koji ne mogu doći u ordinaciju: povređeni, stariji, postoperativni. Dostupna sam u jutarnjim satima.','social_post','published',1234,NOW()-INTERVAL'8 days 8 hours',0,1.0,0,0,0),
('c2000000-0000-0000-0000-000000000059','b1000000-0000-0000-0000-000000000010','Masaža nije luksuz — to je medicina. Redovne masaže smanjuju nivo kortizola, poboljšavaju cirkulaciju i spavamo bolje. Svakih 3-4 nedelje je idealno.','social_post','published',7654,NOW()-INTERVAL'3 days 12 hours',0,1.0,0,0,0),
('c2000000-0000-0000-0000-000000000060','b1000000-0000-0000-0000-000000000010','Sportaši — ne čekajte povredu da krenete na fizioterapiju! Preventivna terapija = manje povreda, bolje performanse. Radim sa amaterima i profesionalcima.','social_post','published',2345,NOW()-INTERVAL'7 hours',0,1.0,0,0,0),

-- Dragan (zidar) - 5 postova
('c2000000-0000-0000-0000-000000000061','b1000000-0000-0000-0000-000000000011','Termoizolacija fasade nije trošak — to je investicija. Za 5-7 godina se vrati kroz uštedu na grejanju. Naš tim radi 20+ fasada godišnje.','social_post','published',3456,NOW()-INTERVAL'19 days 9 hours',0,1.0,0,0,0),
('c2000000-0000-0000-0000-000000000062','b1000000-0000-0000-0000-000000000011','Adaptacija stana — red radova je ključan. Najpre rušenje, pa instalacije, pa zidovi, pa gletovanje i na kraju parket. Greška u redosledu = dupli troškovi.','social_post','published',4567,NOW()-INTERVAL'13 days 14 hours',0,1.0,0,0,0),
('c2000000-0000-0000-0000-000000000063','b1000000-0000-0000-0000-000000000011','Završen projekt — stambena zgrada u Kragujevcu, 12 stanova. 8 meseci rada, ekipa od 6 ljudi. Ponosan kao sin! 🏗️','social_post','published',2134,NOW()-INTERVAL'7 days 10 hours',0,1.0,0,0,0),
('c2000000-0000-0000-0000-000000000064','b1000000-0000-0000-0000-000000000011','Savet za adaptaciju: uvek tražite 3 ponude i proverite reference. Najjeftinija ponuda skoro nikad nije najisplativija na kraju.','social_post','published',5678,NOW()-INTERVAL'2 days 7 hours',0,1.0,0,0,0),
('c2000000-0000-0000-0000-000000000065','b1000000-0000-0000-0000-000000000011','20 godina u građevini. Vidio sam svašta. Najgora greška: graditi bez projekta. Uvek platite arhitektu — to vam uštedi 10x više na kraju.','social_post','published',6789,NOW()-INTERVAL'5 hours',0,1.0,0,0,0),

-- Sara (grafički dizajner) - 5 postova
('c2000000-0000-0000-0000-000000000066','b1000000-0000-0000-0000-000000000012','Logotip nije samo slika — to je obećanje vaše firme. Svaka linija, boja i font nosi poruku. Dobro dizajnirani logotip živi decenijama.','social_post','published',4567,NOW()-INTERVAL'18 days 11 hours',0,1.0,0,0,0),
('c2000000-0000-0000-0000-000000000067','b1000000-0000-0000-0000-000000000012','Urađen rebrand za restoran u Beogradu — novi logo, meni, ambijent i social media. Za 3 meseca povećali su broj gostiju za 40%. Dizajn prodaje! 🎨','social_post','published',8901,NOW()-INTERVAL'12 days 8 hours',0,1.0,0,0,0),
('c2000000-0000-0000-0000-000000000068','b1000000-0000-0000-0000-000000000012','Canva nije dizajn. Canva je alat za uređivanje, ne za kreiranje identiteta. Za ozbiljan brand — angažujte dizajnera. Razlika se vidi.','social_post','published',6789,NOW()-INTERVAL'6 days 13 hours',0,1.0,0,0,0),
('c2000000-0000-0000-0000-000000000069','b1000000-0000-0000-0000-000000000012','Boje nisu slučajne — plava gradi poverenje, narandžasta aktivira akciju, zelena asocira na rast. Svaka marka ima svoju paletu iz razloga.','social_post','published',10234,NOW()-INTERVAL'1 day 11 hours',0,1.0,0,0,0),
('c2000000-0000-0000-0000-000000000070','b1000000-0000-0000-0000-000000000012','Portfolio se puni 🎨 Novih projekata ima — brend za startup iz Novog Sada, pakovanje za domaće kolačiće i vizit karte za advokatsku kancelariju.','social_post','published',2345,NOW()-INTERVAL'2 hours',0,1.0,0,0,0),

-- Vladimir (kuvar) - 4 posta
('c2000000-0000-0000-0000-000000000071','b1000000-0000-0000-0000-000000000013','Dobar kuvar ne traži složene sastojke. Dobar kuvar zna kako da od jednostavnih namirnica napravi nešto posebno. Moje pravilo: svežina uvek pobedi. 🍽️','social_post','published',5432,NOW()-INTERVAL'17 days 10 hours',0,1.0,0,0,0),
('c2000000-0000-0000-0000-000000000072','b1000000-0000-0000-0000-000000000013','Organizujem privatne večere za do 20 osoba u Novom Sadu. Meni po vašem izboru, servis uključen. Savršeno za proslave, godišnjice i poslovne večere.','social_post','published',3456,NOW()-INTERVAL'11 days 7 hours',0,1.0,0,0,0),
('c2000000-0000-0000-0000-000000000073','b1000000-0000-0000-0000-000000000013','Srpska kuhinja je bogatija nego što mnogi misle. Paprikaš, punjene paprike, sarma, gibanica — ovo su jela koja osvajaju i strance i meštane. Ponosim se tim!','social_post','published',7890,NOW()-INTERVAL'5 days 9 hours',0,1.0,0,0,0),
('c2000000-0000-0000-0000-000000000074','b1000000-0000-0000-0000-000000000013','Sledeći vikend radim catering za svadbu od 150 osoba. Ekipa od 4 kuvara, 6 konobara. Ako trebate catering — pitajte me za slobodne termine 🍾','social_post','published',2134,NOW()-INTERVAL'1 day 4 hours',0,1.0,0,0,0),

-- Nina (medicinska sestra) - 4 posta
('c2000000-0000-0000-0000-000000000075','b1000000-0000-0000-0000-000000000014','Kućna nega starih nije luksuz — to je dostojanstvo. Svaka osoba zaslužuje pažnju i brigu. Radim ovo sa srcem, ne samo kao posao.','social_post','published',4567,NOW()-INTERVAL'16 days 12 hours',0,1.0,0,0,0),
('c2000000-0000-0000-0000-000000000076','b1000000-0000-0000-0000-000000000014','Dostupna za kućne posete u Nišu i okolini — jutro i večer. Davanje injekcija, previjanje, monitoring pritiska i šećera. Pozovite.','social_post','published',1234,NOW()-INTERVAL'10 days 8 hours',0,1.0,0,0,0),
('c2000000-0000-0000-0000-000000000077','b1000000-0000-0000-0000-000000000014','14 godina u medicini. Naučila sam da pacijent koji je sabran i informisan se oporavlja brže. Uvek objašnjavam sve — i deci i starijima.','social_post','published',2890,NOW()-INTERVAL'4 days 11 hours',0,1.0,0,0,0),
('c2000000-0000-0000-0000-000000000078','b1000000-0000-0000-0000-000000000014','Pritisak i šećer — merite redovno! Preventiva je jeftinija od lečenja. Kućni aparati su jeftini, a mogu da spasu život.','social_post','published',8765,NOW()-INTERVAL'9 hours',0,1.0,0,0,0),

-- Luka (moler) - 4 posta
('c2000000-0000-0000-0000-000000000079','b1000000-0000-0000-0000-000000000015','Venecijaner nije za svakoga — ali ko ga izabere, nikad ne žali. Jedinstven izgled, trajnost decenijama. Radim ga u Beogradu i okolini.','social_post','published',3456,NOW()-INTERVAL'15 days 9 hours',0,1.0,0,0,0),
('c2000000-0000-0000-0000-000000000080','b1000000-0000-0000-0000-000000000015','Gletovanje je temelj svega. Loše gletovano = vidljive neravnine kroz boju. Uvek radim fino gletovanje u 3 sloja. Nema kompromisa.','social_post','published',4321,NOW()-INTERVAL'9 days 13 hours',0,1.0,0,0,0),
('c2000000-0000-0000-0000-000000000081','b1000000-0000-0000-0000-000000000015','Završen stan na Banovom brdu — mikročement u kuhinji i kupatilu, boja zidova po izboru klijentkinje. Rezultat 10/10 🎨','social_post','published',2134,NOW()-INTERVAL'3 days 10 hours',0,1.0,0,0,0),
('c2000000-0000-0000-0000-000000000082','b1000000-0000-0000-0000-000000000015','13 godina kistom u ruci. Svaki zid je platno, svaki klijent priča. Zovite me za besplatan predmer i predračun.','social_post','published',1567,NOW()-INTERVAL'4 hours',0,1.0,0,0,0),

-- KLIJENTI (postovi 83-100) - kratki, životni postovi
('c2000000-0000-0000-0000-000000000083','b1000000-0000-0000-0000-000000000016','Konačno pronašla odličnog molera kroz GigZone! Radovi gotovi za vikend. Preporučujem svima. ⭐⭐⭐⭐⭐','social_post','published',567,NOW()-INTERVAL'14 days 8 hours',0,1.0,0,0,0),
('c2000000-0000-0000-0000-000000000084','b1000000-0000-0000-0000-000000000017','Renovirao kupatilo — nije bilo jeftino ali je bilo vredno. Uzeo majstora sa preporukama i nema žaljenja. Svet razlika!','social_post','published',789,NOW()-INTERVAL'12 days 11 hours',0,1.0,0,0,0),
('c2000000-0000-0000-0000-000000000085','b1000000-0000-0000-0000-000000000018','Tražila sam fizioterapeuta mesecima. Konačno sam se lečila od ishiasa — 6 sesija i bol nestao. Ulaganje u zdravlje = ulaganje u sebe.','social_post','published',1234,NOW()-INTERVAL'11 days 9 hours',0,1.0,0,0,0),
('c2000000-0000-0000-0000-000000000086','b1000000-0000-0000-0000-000000000019','Popravka klima aparata gotova za 2 sata. Brzo, efikasno, povoljno. Ovako treba da izgleda servis. 👏','social_post','published',456,NOW()-INTERVAL'10 days 14 hours',0,1.0,0,0,0),
('c2000000-0000-0000-0000-000000000087','b1000000-0000-0000-0000-000000000020','Zahvalna računovođi koja mi je pomogla da shvatim kako da vodim knjige za svoju malu firmu. Sad mi je sve jasno!','social_post','published',890,NOW()-INTERVAL'9 days 10 hours',0,1.0,0,0,0),
('c2000000-0000-0000-0000-000000000088','b1000000-0000-0000-0000-000000000021','Briga o zdravlju nije trošak. Upravo sam uložila u redovne fizioterapije i prvi put u 5 godina nemam bolove u leđima. 🙌','social_post','published',2345,NOW()-INTERVAL'8 days 13 hours',0,1.0,0,0,0),
('c2000000-0000-0000-0000-000000000089','b1000000-0000-0000-0000-000000000022','Kuhinja po meri > kuhinja iz prodavnice. Skuplja je, ali svaki centimetar je iskorišćen. Nikad nisam žalio!','social_post','published',3456,NOW()-INTERVAL'7 days 9 hours',0,1.0,0,0,0),
('c2000000-0000-0000-0000-000000000090','b1000000-0000-0000-0000-000000000023','Konačno imamo sajt! Malo smo se bojali digitalnog sveta ali IT stručnjak je sve objasnio i vodio nas kroz proces. 5 zvezdica!','social_post','published',567,NOW()-INTERVAL'6 days 10 hours',0,1.0,0,0,0),
('c2000000-0000-0000-0000-000000000091','b1000000-0000-0000-0000-000000000024','Auto servis koji je konačno pošten. Rekli su mi tačno šta treba, bez nepotrebnih troškova. Takvi servisi su retki! 🚗','social_post','published',1234,NOW()-INTERVAL'5 days 8 hours',0,1.0,0,0,0),
('c2000000-0000-0000-0000-000000000092','b1000000-0000-0000-0000-000000000025','Prevod medicinske dokumentacije za Nemačku za 24 sata — nisam verovala da je moguće. Kvalitet odličan, rok ispoštovan!','social_post','published',456,NOW()-INTERVAL'4 days 14 hours',0,1.0,0,0,0),
('c2000000-0000-0000-0000-000000000093','b1000000-0000-0000-0000-000000000026','Instalacija solarnih panela — za 6 meseci struja bukvalno besplatna. Investicija se isplatila brže nego što sam mislio! ☀️','social_post','published',5678,NOW()-INTERVAL'3 days 11 hours',0,1.0,0,0,0),
('c2000000-0000-0000-0000-000000000094','b1000000-0000-0000-0000-000000000027','Terapija je promenila moj život. Stigma postoji ali ne treba da te spreči. Ako vam treba pomoć — potražite je. 💙','social_post','published',8901,NOW()-INTERVAL'2 days 8 hours',0,1.0,0,0,0),
('c2000000-0000-0000-0000-000000000095','b1000000-0000-0000-0000-000000000028','Grejanje instalirano pre zime — jedina mudra odluka. Ne čekajte oktobar, radite u septembru kad su svi slobodni i cene niže.','social_post','published',2134,NOW()-INTERVAL'1 day 13 hours',0,1.0,0,0,0),
('c2000000-0000-0000-0000-000000000096','b1000000-0000-0000-0000-000000000029','Brend identitet za moju malu firmu — logo, boje, vizit karte. Izgledamo ozbiljno i profesionalno za 1% cene velikih agencija 🙌','social_post','published',3456,NOW()-INTERVAL'18 hours',0,1.0,0,0,0),
('c2000000-0000-0000-0000-000000000097','b1000000-0000-0000-0000-000000000030','Catering za 50 osoba — sve savršeno. Hrana topla, servis brz, gosti oduševljeni. Organizacija svadbe je bila uspešna zahvaljujući dobrom timu!','social_post','published',1567,NOW()-INTERVAL'10 hours',0,1.0,0,0,0),

-- Ekstra postovi - dnevni sadržaj
('c2000000-0000-0000-0000-000000000098','b1000000-0000-0000-0000-000000000001','Jutarnji savet: uvek proverite datum isteka na vatrогасном aparatu. Mali detalj, velika sigurnost! 🔴','social_post','published',876,NOW()-INTERVAL'3 hours',0,1.0,0,0,0),
('c2000000-0000-0000-0000-000000000099','b1000000-0000-0000-0000-000000000006','Nedeljni podsetnik: 5 minuta meditacije ujutru menja ceo dan. Počnite malim koracima. 🌿','social_post','published',4321,NOW()-INTERVAL'1 hour',0,1.0,0,0,0),
('c2000000-0000-0000-0000-000000000100','b1000000-0000-0000-0000-000000000012','Novi projekat stigao u inbox — rebrand za startup. Kreativnost jutrom je nenadmašiva. Kafa i Figma = savršen par ☕🎨','social_post','published',2134,NOW()-INTERVAL'30 minutes',0,1.0,0,0,0)

ON CONFLICT (id) DO NOTHING;

-- ── 4. POST MEDIA (slike za 30 postova) ────────────────────────
INSERT INTO post_media (id, post_id, type, url, "order") VALUES
  (gen_random_uuid(),'c2000000-0000-0000-0000-000000000001','image','https://picsum.photos/seed/solar1/800/600',0),
  (gen_random_uuid(),'c2000000-0000-0000-0000-000000000003','image','https://picsum.photos/seed/electric2/800/600',0),
  (gen_random_uuid(),'c2000000-0000-0000-0000-000000000008','image','https://picsum.photos/seed/hair1/800/600',0),
  (gen_random_uuid(),'c2000000-0000-0000-0000-000000000010','image','https://picsum.photos/seed/hair2/800/600',0),
  (gen_random_uuid(),'c2000000-0000-0000-0000-000000000012','image','https://picsum.photos/seed/hair3/800/600',0),
  (gen_random_uuid(),'c2000000-0000-0000-0000-000000000015','image','https://picsum.photos/seed/code1/800/600',0),
  (gen_random_uuid(),'c2000000-0000-0000-0000-000000000019','image','https://picsum.photos/seed/laptop1/800/600',0),
  (gen_random_uuid(),'c2000000-0000-0000-0000-000000000028','image','https://picsum.photos/seed/plumb1/800/600',0),
  (gen_random_uuid(),'c2000000-0000-0000-0000-000000000029','image','https://picsum.photos/seed/water1/800/600',0),
  (gen_random_uuid(),'c2000000-0000-0000-0000-000000000032','image','https://picsum.photos/seed/bathroom1/800/600',0),
  (gen_random_uuid(),'c2000000-0000-0000-0000-000000000036','image','https://picsum.photos/seed/mind1/800/600',0),
  (gen_random_uuid(),'c2000000-0000-0000-0000-000000000040','image','https://picsum.photos/seed/wood1/800/600',0),
  (gen_random_uuid(),'c2000000-0000-0000-0000-000000000041','image','https://picsum.photos/seed/kitchen1/800/600',0),
  (gen_random_uuid(),'c2000000-0000-0000-0000-000000000043','image','https://picsum.photos/seed/wardrobe1/800/600',0),
  (gen_random_uuid(),'c2000000-0000-0000-0000-000000000045','image','https://picsum.photos/seed/kids1/800/600',0),
  (gen_random_uuid(),'c2000000-0000-0000-0000-000000000051','image','https://picsum.photos/seed/tire1/800/600',0),
  (gen_random_uuid(),'c2000000-0000-0000-0000-000000000054','image','https://picsum.photos/seed/car1/800/600',0),
  (gen_random_uuid(),'c2000000-0000-0000-0000-000000000055','image','https://picsum.photos/seed/garage1/800/600',0),
  (gen_random_uuid(),'c2000000-0000-0000-0000-000000000061','image','https://picsum.photos/seed/construct1/800/600',0),
  (gen_random_uuid(),'c2000000-0000-0000-0000-000000000063','image','https://picsum.photos/seed/building1/800/600',0),
  (gen_random_uuid(),'c2000000-0000-0000-0000-000000000066','image','https://picsum.photos/seed/design1/800/600',0),
  (gen_random_uuid(),'c2000000-0000-0000-0000-000000000067','image','https://picsum.photos/seed/brand1/800/600',0),
  (gen_random_uuid(),'c2000000-0000-0000-0000-000000000069','image','https://picsum.photos/seed/colors1/800/600',0),
  (gen_random_uuid(),'c2000000-0000-0000-0000-000000000071','image','https://picsum.photos/seed/food1/800/600',0),
  (gen_random_uuid(),'c2000000-0000-0000-0000-000000000073','image','https://picsum.photos/seed/food2/800/600',0),
  (gen_random_uuid(),'c2000000-0000-0000-0000-000000000079','image','https://picsum.photos/seed/paint1/800/600',0),
  (gen_random_uuid(),'c2000000-0000-0000-0000-000000000081','image','https://picsum.photos/seed/room1/800/600',0),
  (gen_random_uuid(),'c2000000-0000-0000-0000-000000000093','image','https://picsum.photos/seed/solar2/800/600',0),
  (gen_random_uuid(),'c2000000-0000-0000-0000-000000000094','image','https://picsum.photos/seed/therapy1/800/600',0),
  (gen_random_uuid(),'c2000000-0000-0000-0000-000000000100','image','https://picsum.photos/seed/coffee1/800/600',0)
ON CONFLICT DO NOTHING;

-- ── 5. REACTIONS (lajkovi) ──────────────────────────────────────
-- Svaki post dobija lajkove od više korisnika
INSERT INTO post_reactions (post_id, user_id, emoji, reaction_type, created_at)
SELECT p.post_id::uuid, p.user_id::uuid, '❤️', 'like', NOW() - (random() * INTERVAL '20 days')
FROM (VALUES
  ('c2000000-0000-0000-0000-000000000001','b1000000-0000-0000-0000-000000000016'),
  ('c2000000-0000-0000-0000-000000000001','b1000000-0000-0000-0000-000000000017'),
  ('c2000000-0000-0000-0000-000000000001','b1000000-0000-0000-0000-000000000018'),
  ('c2000000-0000-0000-0000-000000000001','b1000000-0000-0000-0000-000000000019'),
  ('c2000000-0000-0000-0000-000000000001','b1000000-0000-0000-0000-000000000020'),
  ('c2000000-0000-0000-0000-000000000003','b1000000-0000-0000-0000-000000000016'),
  ('c2000000-0000-0000-0000-000000000003','b1000000-0000-0000-0000-000000000021'),
  ('c2000000-0000-0000-0000-000000000003','b1000000-0000-0000-0000-000000000022'),
  ('c2000000-0000-0000-0000-000000000003','b1000000-0000-0000-0000-000000000023'),
  ('c2000000-0000-0000-0000-000000000003','b1000000-0000-0000-0000-000000000024'),
  ('c2000000-0000-0000-0000-000000000003','b1000000-0000-0000-0000-000000000025'),
  ('c2000000-0000-0000-0000-000000000003','b1000000-0000-0000-0000-000000000002'),
  ('c2000000-0000-0000-0000-000000000008','b1000000-0000-0000-0000-000000000016'),
  ('c2000000-0000-0000-0000-000000000008','b1000000-0000-0000-0000-000000000017'),
  ('c2000000-0000-0000-0000-000000000008','b1000000-0000-0000-0000-000000000018'),
  ('c2000000-0000-0000-0000-000000000008','b1000000-0000-0000-0000-000000000019'),
  ('c2000000-0000-0000-0000-000000000008','b1000000-0000-0000-0000-000000000020'),
  ('c2000000-0000-0000-0000-000000000008','b1000000-0000-0000-0000-000000000021'),
  ('c2000000-0000-0000-0000-000000000010','b1000000-0000-0000-0000-000000000016'),
  ('c2000000-0000-0000-0000-000000000010','b1000000-0000-0000-0000-000000000017'),
  ('c2000000-0000-0000-0000-000000000010','b1000000-0000-0000-0000-000000000018'),
  ('c2000000-0000-0000-0000-000000000010','b1000000-0000-0000-0000-000000000019'),
  ('c2000000-0000-0000-0000-000000000010','b1000000-0000-0000-0000-000000000020'),
  ('c2000000-0000-0000-0000-000000000010','b1000000-0000-0000-0000-000000000021'),
  ('c2000000-0000-0000-0000-000000000010','b1000000-0000-0000-0000-000000000022'),
  ('c2000000-0000-0000-0000-000000000010','b1000000-0000-0000-0000-000000000001'),
  ('c2000000-0000-0000-0000-000000000012','b1000000-0000-0000-0000-000000000016'),
  ('c2000000-0000-0000-0000-000000000012','b1000000-0000-0000-0000-000000000017'),
  ('c2000000-0000-0000-0000-000000000012','b1000000-0000-0000-0000-000000000018'),
  ('c2000000-0000-0000-0000-000000000012','b1000000-0000-0000-0000-000000000019'),
  ('c2000000-0000-0000-0000-000000000012','b1000000-0000-0000-0000-000000000020'),
  ('c2000000-0000-0000-0000-000000000012','b1000000-0000-0000-0000-000000000021'),
  ('c2000000-0000-0000-0000-000000000012','b1000000-0000-0000-0000-000000000022'),
  ('c2000000-0000-0000-0000-000000000012','b1000000-0000-0000-0000-000000000023'),
  ('c2000000-0000-0000-0000-000000000012','b1000000-0000-0000-0000-000000000024'),
  ('c2000000-0000-0000-0000-000000000017','b1000000-0000-0000-0000-000000000016'),
  ('c2000000-0000-0000-0000-000000000017','b1000000-0000-0000-0000-000000000017'),
  ('c2000000-0000-0000-0000-000000000017','b1000000-0000-0000-0000-000000000018'),
  ('c2000000-0000-0000-0000-000000000017','b1000000-0000-0000-0000-000000000019'),
  ('c2000000-0000-0000-0000-000000000017','b1000000-0000-0000-0000-000000000020'),
  ('c2000000-0000-0000-0000-000000000017','b1000000-0000-0000-0000-000000000021'),
  ('c2000000-0000-0000-0000-000000000017','b1000000-0000-0000-0000-000000000022'),
  ('c2000000-0000-0000-0000-000000000036','b1000000-0000-0000-0000-000000000016'),
  ('c2000000-0000-0000-0000-000000000036','b1000000-0000-0000-0000-000000000017'),
  ('c2000000-0000-0000-0000-000000000036','b1000000-0000-0000-0000-000000000018'),
  ('c2000000-0000-0000-0000-000000000036','b1000000-0000-0000-0000-000000000019'),
  ('c2000000-0000-0000-0000-000000000036','b1000000-0000-0000-0000-000000000020'),
  ('c2000000-0000-0000-0000-000000000036','b1000000-0000-0000-0000-000000000021'),
  ('c2000000-0000-0000-0000-000000000036','b1000000-0000-0000-0000-000000000022'),
  ('c2000000-0000-0000-0000-000000000036','b1000000-0000-0000-0000-000000000023'),
  ('c2000000-0000-0000-0000-000000000036','b1000000-0000-0000-0000-000000000024'),
  ('c2000000-0000-0000-0000-000000000036','b1000000-0000-0000-0000-000000000025'),
  ('c2000000-0000-0000-0000-000000000037','b1000000-0000-0000-0000-000000000016'),
  ('c2000000-0000-0000-0000-000000000037','b1000000-0000-0000-0000-000000000017'),
  ('c2000000-0000-0000-0000-000000000037','b1000000-0000-0000-0000-000000000018'),
  ('c2000000-0000-0000-0000-000000000037','b1000000-0000-0000-0000-000000000019'),
  ('c2000000-0000-0000-0000-000000000037','b1000000-0000-0000-0000-000000000020'),
  ('c2000000-0000-0000-0000-000000000037','b1000000-0000-0000-0000-000000000021'),
  ('c2000000-0000-0000-0000-000000000037','b1000000-0000-0000-0000-000000000022'),
  ('c2000000-0000-0000-0000-000000000037','b1000000-0000-0000-0000-000000000023'),
  ('c2000000-0000-0000-0000-000000000037','b1000000-0000-0000-0000-000000000024'),
  ('c2000000-0000-0000-0000-000000000037','b1000000-0000-0000-0000-000000000025'),
  ('c2000000-0000-0000-0000-000000000054','b1000000-0000-0000-0000-000000000016'),
  ('c2000000-0000-0000-0000-000000000054','b1000000-0000-0000-0000-000000000017'),
  ('c2000000-0000-0000-0000-000000000054','b1000000-0000-0000-0000-000000000018'),
  ('c2000000-0000-0000-0000-000000000054','b1000000-0000-0000-0000-000000000019'),
  ('c2000000-0000-0000-0000-000000000054','b1000000-0000-0000-0000-000000000020'),
  ('c2000000-0000-0000-0000-000000000054','b1000000-0000-0000-0000-000000000021'),
  ('c2000000-0000-0000-0000-000000000054','b1000000-0000-0000-0000-000000000022'),
  ('c2000000-0000-0000-0000-000000000067','b1000000-0000-0000-0000-000000000016'),
  ('c2000000-0000-0000-0000-000000000067','b1000000-0000-0000-0000-000000000017'),
  ('c2000000-0000-0000-0000-000000000067','b1000000-0000-0000-0000-000000000018'),
  ('c2000000-0000-0000-0000-000000000067','b1000000-0000-0000-0000-000000000019'),
  ('c2000000-0000-0000-0000-000000000067','b1000000-0000-0000-0000-000000000020'),
  ('c2000000-0000-0000-0000-000000000069','b1000000-0000-0000-0000-000000000016'),
  ('c2000000-0000-0000-0000-000000000069','b1000000-0000-0000-0000-000000000017'),
  ('c2000000-0000-0000-0000-000000000069','b1000000-0000-0000-0000-000000000018'),
  ('c2000000-0000-0000-0000-000000000069','b1000000-0000-0000-0000-000000000019'),
  ('c2000000-0000-0000-0000-000000000069','b1000000-0000-0000-0000-000000000020'),
  ('c2000000-0000-0000-0000-000000000069','b1000000-0000-0000-0000-000000000021'),
  ('c2000000-0000-0000-0000-000000000069','b1000000-0000-0000-0000-000000000022'),
  ('c2000000-0000-0000-0000-000000000069','b1000000-0000-0000-0000-000000000023'),
  ('c2000000-0000-0000-0000-000000000094','b1000000-0000-0000-0000-000000000016'),
  ('c2000000-0000-0000-0000-000000000094','b1000000-0000-0000-0000-000000000017'),
  ('c2000000-0000-0000-0000-000000000094','b1000000-0000-0000-0000-000000000018'),
  ('c2000000-0000-0000-0000-000000000094','b1000000-0000-0000-0000-000000000019'),
  ('c2000000-0000-0000-0000-000000000094','b1000000-0000-0000-0000-000000000020'),
  ('c2000000-0000-0000-0000-000000000094','b1000000-0000-0000-0000-000000000021'),
  ('c2000000-0000-0000-0000-000000000094','b1000000-0000-0000-0000-000000000022'),
  ('c2000000-0000-0000-0000-000000000094','b1000000-0000-0000-0000-000000000023'),
  ('c2000000-0000-0000-0000-000000000094','b1000000-0000-0000-0000-000000000024'),
  ('c2000000-0000-0000-0000-000000000094','b1000000-0000-0000-0000-000000000025')
) AS p(post_id, user_id)
ON CONFLICT (post_id, user_id) DO NOTHING;

-- ── 6. FOLLOWERS ───────────────────────────────────────────────
INSERT INTO followers (follower_id, following_id, created_at)
VALUES
  ('b1000000-0000-0000-0000-000000000016','b1000000-0000-0000-0000-000000000001',NOW()-INTERVAL'20 days'),
  ('b1000000-0000-0000-0000-000000000016','b1000000-0000-0000-0000-000000000002',NOW()-INTERVAL'19 days'),
  ('b1000000-0000-0000-0000-000000000016','b1000000-0000-0000-0000-000000000006',NOW()-INTERVAL'18 days'),
  ('b1000000-0000-0000-0000-000000000017','b1000000-0000-0000-0000-000000000003',NOW()-INTERVAL'17 days'),
  ('b1000000-0000-0000-0000-000000000017','b1000000-0000-0000-0000-000000000005',NOW()-INTERVAL'16 days'),
  ('b1000000-0000-0000-0000-000000000017','b1000000-0000-0000-0000-000000000012',NOW()-INTERVAL'15 days'),
  ('b1000000-0000-0000-0000-000000000018','b1000000-0000-0000-0000-000000000010',NOW()-INTERVAL'14 days'),
  ('b1000000-0000-0000-0000-000000000018','b1000000-0000-0000-0000-000000000014',NOW()-INTERVAL'13 days'),
  ('b1000000-0000-0000-0000-000000000019','b1000000-0000-0000-0000-000000000001',NOW()-INTERVAL'12 days'),
  ('b1000000-0000-0000-0000-000000000019','b1000000-0000-0000-0000-000000000009',NOW()-INTERVAL'11 days'),
  ('b1000000-0000-0000-0000-000000000020','b1000000-0000-0000-0000-000000000004',NOW()-INTERVAL'10 days'),
  ('b1000000-0000-0000-0000-000000000021','b1000000-0000-0000-0000-000000000011',NOW()-INTERVAL'9 days'),
  ('b1000000-0000-0000-0000-000000000022','b1000000-0000-0000-0000-000000000007',NOW()-INTERVAL'8 days'),
  ('b1000000-0000-0000-0000-000000000023','b1000000-0000-0000-0000-000000000002',NOW()-INTERVAL'7 days'),
  ('b1000000-0000-0000-0000-000000000023','b1000000-0000-0000-0000-000000000013',NOW()-INTERVAL'6 days'),
  ('b1000000-0000-0000-0000-000000000024','b1000000-0000-0000-0000-000000000001',NOW()-INTERVAL'5 days'),
  ('b1000000-0000-0000-0000-000000000025','b1000000-0000-0000-0000-000000000006',NOW()-INTERVAL'4 days'),
  ('b1000000-0000-0000-0000-000000000026','b1000000-0000-0000-0000-000000000003',NOW()-INTERVAL'3 days'),
  ('b1000000-0000-0000-0000-000000000027','b1000000-0000-0000-0000-000000000002',NOW()-INTERVAL'2 days'),
  ('b1000000-0000-0000-0000-000000000028','b1000000-0000-0000-0000-000000000005',NOW()-INTERVAL'1 day'),
  ('b1000000-0000-0000-0000-000000000029','b1000000-0000-0000-0000-000000000012',NOW()-INTERVAL'12 hours'),
  ('b1000000-0000-0000-0000-000000000030','b1000000-0000-0000-0000-000000000015',NOW()-INTERVAL'6 hours'),
  ('b1000000-0000-0000-0000-000000000001','b1000000-0000-0000-0000-000000000003',NOW()-INTERVAL'25 days'),
  ('b1000000-0000-0000-0000-000000000002','b1000000-0000-0000-0000-000000000006',NOW()-INTERVAL'24 days'),
  ('b1000000-0000-0000-0000-000000000003','b1000000-0000-0000-0000-000000000012',NOW()-INTERVAL'23 days'),
  ('b1000000-0000-0000-0000-000000000005','b1000000-0000-0000-0000-000000000001',NOW()-INTERVAL'22 days'),
  ('b1000000-0000-0000-0000-000000000007','b1000000-0000-0000-0000-000000000011',NOW()-INTERVAL'21 days'),
  ('b1000000-0000-0000-0000-000000000010','b1000000-0000-0000-0000-000000000006',NOW()-INTERVAL'18 days')
ON CONFLICT DO NOTHING;

-- ── RESET ───────────────────────────────────────────────────────
SET session_replication_role = DEFAULT;
COMMIT;

-- Potvrda
SELECT 'Auth users' AS tabela, COUNT(*) FROM auth.users WHERE email LIKE '%demo.gigzone.app%'
UNION ALL
SELECT 'Profiles', COUNT(*) FROM profiles WHERE email LIKE '%demo.gigzone.app%'
UNION ALL
SELECT 'Posts', COUNT(*) FROM posts WHERE user_id::text LIKE 'b1000000%'
UNION ALL
SELECT 'Reactions', COUNT(*) FROM post_reactions WHERE user_id::text LIKE 'b1000000%'
UNION ALL
SELECT 'Followers', COUNT(*) FROM followers WHERE follower_id::text LIKE 'b1000000%';
