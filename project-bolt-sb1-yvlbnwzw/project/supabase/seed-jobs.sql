-- ================================================================
-- GIGZONE JOBS SEED DATA
-- 20 hiring_post + 20 service_request + 25 job_seeker
-- Pokrenuti u Supabase > SQL Editor > New Query > Run
-- ================================================================

BEGIN;
SET session_replication_role = replica;

-- ── HIRING POSTS (20) ──────────────────────────────────────────
INSERT INTO posts (id, user_id, text, post_type, job_title, category, city, status, views_count, created_at, spam_score, rank_penalty, link_count, phone_count, hashtag_count) VALUES

('d1000000-0000-0000-0000-000000000001','b1000000-0000-0000-0000-000000000016','Tražimo iskusnog električara za stalne poslove u Beogradu. Rad na stambenim i poslovnim objektima. Redovan posao, dobra zarada, plaćanje na vreme. Javite se sa kratkim opisom iskustva.','hiring_post','Električar','construction','Beograd','published',345,NOW()-INTERVAL'27 days',0,1.0,0,0,0),

('d1000000-0000-0000-0000-000000000002','b1000000-0000-0000-0000-000000000017','Potreban iskusan kuvar za restoran u centru Novog Sada. Srpska i mediteranska kuhinja. Puna radna nedelja, konkurentna plata + bonusi. Šaljite CV ili opišite iskustvo.','hiring_post','Kuvar','food','Novi Sad','published',512,NOW()-INTERVAL'25 days',0,1.0,0,0,0),

('d1000000-0000-0000-0000-000000000003','b1000000-0000-0000-0000-000000000018','IT firma iz Niša traži junior React developera. Remote rad moguć. Fleksibilno radno vreme, mentorstvo od seniora, dobri uslovi. Potrebno osnovno znanje React i JS.','hiring_post','Junior Developer','it_technology','Niš','published',789,NOW()-INTERVAL'23 days',0,1.0,0,0,0),

('d1000000-0000-0000-0000-000000000004','b1000000-0000-0000-0000-000000000019','Frizerski salon u Beogradu traži frizera/ku sa iskustvom. Dobra klijentela, moderan salon na Vračaru. Procenat od prihoda + fiksni deo. Slobodni termini odmah.','hiring_post','Frizer','beauty','Beograd','published',423,NOW()-INTERVAL'21 days',0,1.0,0,0,0),

('d1000000-0000-0000-0000-000000000005','b1000000-0000-0000-0000-000000000020','Subotica — tražimo vozača sa C kategorijom za međunarodne relacije. Moderni kamioni, redovne rute EU, plaćanje po km + dnevnice. Iskustvo minimum 2 godine.','hiring_post','Vozač C kategorija','transport','Subotica','published',234,NOW()-INTERVAL'19 days',0,1.0,0,0,0),

('d1000000-0000-0000-0000-000000000006','b1000000-0000-0000-0000-000000000021','Građevinska firma traži molera za adaptacije u Kragujevcu i okolini. Stalni posao, plaćanje nedeljno. Treba sopstveni alat. Iskustvo minimum 3 godine.','hiring_post','Maler','construction','Kragujevac','published',178,NOW()-INTERVAL'17 days',0,1.0,0,0,0),

('d1000000-0000-0000-0000-000000000007','b1000000-0000-0000-0000-000000000022','Beograd — tražimo računovođu za vođenje knjiga 5 DOO preduzeća. Part-time ili full-time. Rad od kuće moguć. PDV obveznici, mesečni izveštaji. Odlična saradnja zagarantovana.','hiring_post','Računovođa','finance','Beograd','published',567,NOW()-INTERVAL'15 days',0,1.0,0,0,0),

('d1000000-0000-0000-0000-000000000008','b1000000-0000-0000-0000-000000000023','Novi Sad — potreban grafički dizajner za marketing agenciju. Puno radno vreme, kancelarija na Limanu. Iskustvo u Photoshop, Illustrator, InDesign obavezno. Portfolio obavezan.','hiring_post','Grafički dizajner','marketing','Novi Sad','published',634,NOW()-INTERVAL'13 days',0,1.0,0,0,0),

('d1000000-0000-0000-0000-000000000009','b1000000-0000-0000-0000-000000000024','Beograd — privatna ordinacija traži medicinsku sestru za rad u smenama. Iskustvo u ambulanti prednost. Dobri uslovi rada, stalno zaposlenje, prijava na osiguranje.','hiring_post','Medicinska sestra','health','Beograd','published',445,NOW()-INTERVAL'11 days',0,1.0,0,0,0),

('d1000000-0000-0000-0000-000000000010','b1000000-0000-0000-0000-000000000025','Niš — potreban stolar za malu radionicu koja pravi nameštaj po meri. Iskustvo sa CNC masinom prednost. Redovan posao, plaćanje na vreme, dobra atmosfera.','hiring_post','Stolar','construction','Niš','published',312,NOW()-INTERVAL'9 days',0,1.0,0,0,0),

('d1000000-0000-0000-0000-000000000011','b1000000-0000-0000-0000-000000000026','Beograd — tražimo fizioterapeuta za privatnu kliniku na Novom Beogradu. Puno radno vreme, moderna oprema, dobra klijentela. Plata po dogovoru, benefiti.','hiring_post','Fizioterapeut','health','Beograd','published',489,NOW()-INTERVAL'8 days',0,1.0,0,0,0),

('d1000000-0000-0000-0000-000000000012','b1000000-0000-0000-0000-000000000027','Novi Sad — potreban vodoinstalater za servisnu firmu. Obilaznički posao, kombi obezbeđen, alat obezbeđen. Plaćanje po satu + stalni deo. Iskustvo 2+ godine.','hiring_post','Vodoinstalater','construction','Novi Sad','published',223,NOW()-INTERVAL'7 days',0,1.0,0,0,0),

('d1000000-0000-0000-0000-000000000013','b1000000-0000-0000-0000-000000000028','Kragujevac — auto servis traži automehaničara za dijagnostiku i opravke. Moderna dijagnostička oprema, stalni posao, plaćanje po dogovoru. Iskustvo sa VW grupom prednost.','hiring_post','Automehaničar','construction','Kragujevac','published',356,NOW()-INTERVAL'6 days',0,1.0,0,0,0),

('d1000000-0000-0000-0000-000000000014','b1000000-0000-0000-0000-000000000029','Beograd — škola jezika traži profesora engleskog za individualne i grupne časove. Flexible raspored, rad online i uživo. Iskustvo u podučavanju obavezno. Sertifikat prednost.','hiring_post','Profesor engleskog','education','Beograd','published',578,NOW()-INTERVAL'5 days',0,1.0,0,0,0),

('d1000000-0000-0000-0000-000000000015','b1000000-0000-0000-0000-000000000030','Beograd — marketing agencija traži content writera za srpski i engleski jezik. Remote rad. Iskustvo u pisanju blogova, social media postova i email kampanja. Pošalji primere radova.','hiring_post','Content Writer','marketing','Beograd','published',467,NOW()-INTERVAL'4 days',0,1.0,0,0,0),

('d1000000-0000-0000-0000-000000000016','b1000000-0000-0000-0000-000000000016','Beograd — tražimo čistačicu/čistača za poslovni prostor na Savskom vencu. Jutarnja smena 6-10h, ponedeljak-petak. Plaćanje na vreme, prijatan kolektiv. Iskustvo nije obavezno.','hiring_post','Čistač/čistačica','home_services','Beograd','published',198,NOW()-INTERVAL'3 days',0,1.0,0,0,0),

('d1000000-0000-0000-0000-000000000017','b1000000-0000-0000-0000-000000000017','Novi Sad — salon lepote traži kozmetičarku sa iskustvom u tretmanima lica i tela. Moderna oprema, stalna klijentela, plaćanje % od prihoda + fiksni deo.','hiring_post','Kozmetičarka','beauty','Novi Sad','published',334,NOW()-INTERVAL'2 days',0,1.0,0,0,0),

('d1000000-0000-0000-0000-000000000018','b1000000-0000-0000-0000-000000000018','Niš — IT firma traži sistem administratora. Linux, Windows Server, mreže. Puno radno vreme, stabilna firma, dobra plata. Iskustvo minimum 3 godine.','hiring_post','Sistem administrator','it_technology','Niš','published',445,NOW()-INTERVAL'1 day 12 hours',0,1.0,0,0,0),

('d1000000-0000-0000-0000-000000000019','b1000000-0000-0000-0000-000000000019','Beograd — tražimo iskusnog zidara za adaptacije stanova. Stalni posao, ekipa od 4 ljudi, redovni projekti. Plaćanje nedeljno. Radimo na Zvezdari i Vračaru.','hiring_post','Zidar','construction','Beograd','published',267,NOW()-INTERVAL'1 day',0,1.0,0,0,0),

('d1000000-0000-0000-0000-000000000020','b1000000-0000-0000-0000-000000000020','Subotica — tražimo krojačicu/krojača za šivenje po meri. Rad u radionici, puno radno vreme. Iskustvo obavezno, brzina i preciznost cenjeni. Plata po dogovoru.','hiring_post','Krojač/krojačica','beauty','Subotica','published',189,NOW()-INTERVAL'8 hours',0,1.0,0,0,0);

-- ── SERVICE REQUESTS (20) ──────────────────────────────────────
INSERT INTO posts (id, user_id, text, post_type, category, city, status, views_count, created_at, spam_score, rank_penalty, link_count, phone_count, hashtag_count) VALUES

('d2000000-0000-0000-0000-000000000001','b1000000-0000-0000-0000-000000000016','Potreban električar u Beogradu — Zemun. Treba mi zamena razvodne table i instalacija 3 nove utičnice u dnevnoj sobi. Stan 65m². Hitno, javite se s cenom.','service_request','construction','Beograd','published',123,NOW()-INTERVAL'26 days',0,1.0,0,0,0),

('d2000000-0000-0000-0000-000000000002','b1000000-0000-0000-0000-000000000017','Tražim frizera u Novom Sadu koji radi vikendom. Potrebni pramenovi i šišanje. Imam dugu kosu do ramena. Koliko bi koštalo i kada možete?','service_request','beauty','Novi Sad','published',89,NOW()-INTERVAL'24 days',0,1.0,0,0,0),

('d2000000-0000-0000-0000-000000000003','b1000000-0000-0000-0000-000000000018','Potreban web developer u Nišu ili remote. Imam malu pekaru i trebam jednostavan sajt sa online narudžbinama. Budžet oko 500€. Ko može da pomogne?','service_request','it_technology','Niš','published',234,NOW()-INTERVAL'22 days',0,1.0,0,0,0),

('d2000000-0000-0000-0000-000000000004','b1000000-0000-0000-0000-000000000019','Hitno — pukla vodovodna cev u kupatilu, Beograd Zvezdara. Voda curi. Treba mi vodoinstalater što pre moguće danas ili sutra. Plaćam odmah.','service_request','construction','Beograd','published',345,NOW()-INTERVAL'20 days',0,1.0,0,0,0),

('d2000000-0000-0000-0000-000000000005','b1000000-0000-0000-0000-000000000020','Subotica — tražim računovođu za vođenje knjiga moje firme. DOO, nisam PDV obveznik, 10-15 transakcija mesečno. Koliko košta mesečno?','service_request','finance','Subotica','published',167,NOW()-INTERVAL'18 days',0,1.0,0,0,0),

('d2000000-0000-0000-0000-000000000006','b1000000-0000-0000-0000-000000000021','Kragujevac — treba mi maler za gletovanje i farbanje 3 sobe (ukupno 45m²). Soba su prazne. Kada možete i kolika je cena?','service_request','construction','Kragujevac','published',145,NOW()-INTERVAL'16 days',0,1.0,0,0,0),

('d2000000-0000-0000-0000-000000000007','b1000000-0000-0000-0000-000000000022','Beograd — tražim fizioterapeuta za kućne posete. Imam 70-godišnjeg oca koji se teško kreće posle operacije kuka. Treba rehabilitacija 2-3x nedeljno.','service_request','health','Beograd','published',198,NOW()-INTERVAL'14 days',0,1.0,0,0,0),

('d2000000-0000-0000-0000-000000000008','b1000000-0000-0000-0000-000000000023','Novi Sad — potreban grafički dizajner za logo i vizit karte moje firme. Firma se bavi uslugama čišćenja. Treba profesionalan ali jednostavan dizajn. Budžet 150€.','service_request','marketing','Novi Sad','published',212,NOW()-INTERVAL'12 days',0,1.0,0,0,0),

('d2000000-0000-0000-0000-000000000009','b1000000-0000-0000-0000-000000000024','Beograd — tražim stolara za kuhinjski nameštaj po meri. Kuhinja L oblika, 4 linearna metra. Nema mi poseban budžet, zanima me procena. Ko ima slobodnog termina?','service_request','construction','Beograd','published',289,NOW()-INTERVAL'10 days',0,1.0,0,0,0),

('d2000000-0000-0000-0000-000000000010','b1000000-0000-0000-0000-000000000025','Niš — treba mi prevod dokumentacije sa srpskog na engleski. Radi se o ugovoru o radu i dva sertifikata. Hitno, treba do petka. Koliko košta?','service_request','legal','Niš','published',134,NOW()-INTERVAL'8 days',0,1.0,0,0,0),

('d2000000-0000-0000-0000-000000000011','b1000000-0000-0000-0000-000000000026','Beograd Novi Beograd — auto ne pali jutrom, vjerovatno akumulator ili alternator. Treba mi automehaničar koji može doći do auta ili da proveri u servisu. Šta koštaaa?','service_request','construction','Beograd','published',167,NOW()-INTERVAL'7 days',0,1.0,0,0,0),

('d2000000-0000-0000-0000-000000000012','b1000000-0000-0000-0000-000000000027','Novi Sad — tražim psihologa ili psihoterapeuta za online sesije. Imam anksioznost i povremene panic atake. Zanima me CBT terapija. Koliko košta sesija?','service_request','health','Novi Sad','published',245,NOW()-INTERVAL'6 days',0,1.0,0,0,0),

('d2000000-0000-0000-0000-000000000013','b1000000-0000-0000-0000-000000000028','Kragujevac — treba mi zidar za rušenje nenosivog zida između kuhinje i dnevne sobe, i popravku. Stan 55m². Kada možete i okvirna cena?','service_request','construction','Kragujevac','published',178,NOW()-INTERVAL'5 days',0,1.0,0,0,0),

('d2000000-0000-0000-0000-000000000014','b1000000-0000-0000-0000-000000000029','Beograd — dete 8 godina treba instruktora matematike. Treći razred, ima teškoće. Treba 2x nedeljno po sat. Ko ima iskustvo sa decom ovog uzrasta?','service_request','education','Beograd','published',312,NOW()-INTERVAL'4 days',0,1.0,0,0,0),

('d2000000-0000-0000-0000-000000000015','b1000000-0000-0000-0000-000000000030','Beograd — treba mi majstor za ugradnju klima uređaja. Imam 2 klime za ugradnju, Gorenje 12000 BTU. Stan na 3. spratu. Cena montaže?','service_request','home_services','Beograd','published',223,NOW()-INTERVAL'3 days',0,1.0,0,0,0),

('d2000000-0000-0000-0000-000000000016','b1000000-0000-0000-0000-000000000016','Beograd Voždovac — trebam čišćenje stana 52m² pre useljenja. Prethodni stanari su ostavili dosta prljavštine. Dubinsko čišćenje. Koliko košta i kada možete?','service_request','home_services','Beograd','published',145,NOW()-INTERVAL'2 days 12 hours',0,1.0,0,0,0),

('d2000000-0000-0000-0000-000000000017','b1000000-0000-0000-0000-000000000017','Novi Sad — treba mi kuvar za privatnu proslavu, 20 osoba. Subota za 2 nedelje. Srpska kuhinja, roštilj i hladna kuhinja. Koliko košta po osobi?','service_request','food','Novi Sad','published',267,NOW()-INTERVAL'2 days',0,1.0,0,0,0),

('d2000000-0000-0000-0000-000000000018','b1000000-0000-0000-0000-000000000018','Niš — pukao mi bojler, treba zamena. Stari bojler 80L, treba isti ili sličan. Može li neko doći da pogleda i da ponudu za zamenu sa ugradnjom?','service_request','home_services','Niš','published',189,NOW()-INTERVAL'1 day 12 hours',0,1.0,0,0,0),

('d2000000-0000-0000-0000-000000000019','b1000000-0000-0000-0000-000000000019','Beograd — tražim advokata za razvod braka. Sporazumni razvod, nema dece, nema nepokretnosti. Koliko košta cela procedura i koliko traje?','service_request','legal','Beograd','published',334,NOW()-INTERVAL'1 day',0,1.0,0,0,0),

('d2000000-0000-0000-0000-000000000020','b1000000-0000-0000-0000-000000000020','Subotica — treba mi instruktor vožnje za nekoliko dodatnih časova. Imam položenu dozvolu ali nisam vežbala 2 godine pa mi treba obnavljanje. Ko može?','service_request','education','Subotica','published',156,NOW()-INTERVAL'10 hours',0,1.0,0,0,0);

-- ── JOB SEEKERS (25) ───────────────────────────────────────────
INSERT INTO posts (id, user_id, text, post_type, job_title, category, city, status, views_count, created_at, spam_score, rank_penalty, link_count, phone_count, hashtag_count) VALUES

('d3000000-0000-0000-0000-000000000001','b1000000-0000-0000-0000-000000000001','Licencirani električar, 10 godina iskustva — tražim nove projekte ili stalne klijente u Beogradu. Radim instalacije, solarne panele, video nadzor. Dostupan odmah.','job_seeker','Električar','construction','Beograd','published',234,NOW()-INTERVAL'28 days',0,1.0,0,0,0),

('d3000000-0000-0000-0000-000000000002','b1000000-0000-0000-0000-000000000002','Frizerka sa 8 godina iskustva traži posao u salonu u Novom Sadu ili okolini. Specijalizovana za balayage i keratinske tretmane. Imam sopstvene klijente. Kontaktirajte me.','job_seeker','Frizerka','beauty','Novi Sad','published',189,NOW()-INTERVAL'26 days',0,1.0,0,0,0),

('d3000000-0000-0000-0000-000000000003','b1000000-0000-0000-0000-000000000003','Full-stack developer traži freelance projekte ili remote posao. React, Next.js, Node.js, PostgreSQL. 6 godina iskustva, portfolio dostupan na zahtev.','job_seeker','Full-stack Developer','it_technology','Beograd','published',567,NOW()-INTERVAL'24 days',0,1.0,0,0,0),

('d3000000-0000-0000-0000-000000000004','b1000000-0000-0000-0000-000000000004','Ovlašćena računovođa traži nove klijente. Vođenje knjiga, PDV, godišnji izveštaji. Radim sa 20+ firmi, reference dostupne. Beograd i remote.','job_seeker','Računovođa','finance','Beograd','published',312,NOW()-INTERVAL'22 days',0,1.0,0,0,0),

('d3000000-0000-0000-0000-000000000005','b1000000-0000-0000-0000-000000000005','Vodoinstalater sa 12 godina iskustva traži posao u Kragujevcu. Radim grejanje, kupatila, hitne intervencije. Vlastiti alat i kombi. Slobodan odmah.','job_seeker','Vodoinstalater','construction','Kragujevac','published',145,NOW()-INTERVAL'20 days',0,1.0,0,0,0),

('d3000000-0000-0000-0000-000000000006','b1000000-0000-0000-0000-000000000006','Klinički psiholog i psihoterapeut — primam nove klijente u Novom Sadu i online. CBT terapija, anksioznost, depresija, burnout. Prva sesija uvodni razgovor.','job_seeker','Psiholog/psihoterapeut','health','Novi Sad','published',423,NOW()-INTERVAL'18 days',0,1.0,0,0,0),

('d3000000-0000-0000-0000-000000000007','b1000000-0000-0000-0000-000000000007','Stolar sa 15 godina iskustva traži projekte u Srbiji. Izrada nameštaja po meri — kuhinje, garderobe, dečije sobe. Dolazim na celu teritoriju Srbije.','job_seeker','Stolar','construction','Niš','published',198,NOW()-INTERVAL'16 days',0,1.0,0,0,0),

('d3000000-0000-0000-0000-000000000008','b1000000-0000-0000-0000-000000000008','Sudski tumač i prevodilac — engleski, nemački, francuski. Tražim nove poslovne klijente. Dostava prevoda i za 24h. Beograd i online.','job_seeker','Prevodilac','legal','Beograd','published',267,NOW()-INTERVAL'14 days',0,1.0,0,0,0),

('d3000000-0000-0000-0000-000000000009','b1000000-0000-0000-0000-000000000009','Automehaničar specijalizovan za VW i BMW grupu traži posao u Subotici. 14 godina iskustva, dijagnostika, servis, mehanički radovi. Imam sertifikate.','job_seeker','Automehaničar','construction','Subotica','published',178,NOW()-INTERVAL'12 days',0,1.0,0,0,0),

('d3000000-0000-0000-0000-000000000010','b1000000-0000-0000-0000-000000000010','Diplomirani fizioterapeut — kućne posete i rad u ordinaciji u Beogradu. Sportska rehabilitacija, manuelna terapija. 9 godina iskustva. Slobodni termini dostupni.','job_seeker','Fizioterapeut','health','Beograd','published',334,NOW()-INTERVAL'10 days',0,1.0,0,0,0),

('d3000000-0000-0000-0000-000000000011','b1000000-0000-0000-0000-000000000011','Iskusan zidar i rukovodilac radova traži angažman u Kragujevcu i okolini. Adaptacije, rekonstrukcije, novogradnja. 20 godina iskustva. Mogu da vodim ekipu.','job_seeker','Zidar','construction','Kragujevac','published',156,NOW()-INTERVAL'9 days',0,1.0,0,0,0),

('d3000000-0000-0000-0000-000000000012','b1000000-0000-0000-0000-000000000012','Grafička dizajnerka traži freelance projekte ili posao u agenciji. Logotipi, brand identitet, social media. 5 godina iskustva, portfolio dostupan.','job_seeker','Grafička dizajnerka','marketing','Beograd','published',445,NOW()-INTERVAL'8 days',0,1.0,0,0,0),

('d3000000-0000-0000-0000-000000000013','b1000000-0000-0000-0000-000000000013','Iskusan kuvar traži posao u restoranu ili catering firmi u Novom Sadu. 11 godina iskustva, srpska i mediteranska kuhinja. Reference dostupne.','job_seeker','Kuvar','food','Novi Sad','published',212,NOW()-INTERVAL'7 days',0,1.0,0,0,0),

('d3000000-0000-0000-0000-000000000014','b1000000-0000-0000-0000-000000000014','Medicinska sestra sa 14 godina iskustva traži posao u Nišu. Kućna nega, nega starih i hroničnih bolesnika. Imam vozačku dozvolu B kategorije.','job_seeker','Medicinska sestra','health','Niš','published',289,NOW()-INTERVAL'6 days',0,1.0,0,0,0),

('d3000000-0000-0000-0000-000000000015','b1000000-0000-0000-0000-000000000015','Majstor maler traži posao u Beogradu i okolini. 13 godina iskustva, gletovanje, farbanje, venecijaner, mikročement. Pažljiv i uredan rad.','job_seeker','Maler','construction','Beograd','published',167,NOW()-INTERVAL'5 days',0,1.0,0,0,0),

('d3000000-0000-0000-0000-000000000016','b1000000-0000-0000-0000-000000000016','Diplomirani ekonomista sa 5 godina iskustva u marketingu traži posao u Beogradu. Radila sam u banci i startup kompaniji. Tečan engleski i nemački.','job_seeker','Marketing menadžer','marketing','Beograd','published',378,NOW()-INTERVAL'4 days 12 hours',0,1.0,0,0,0),

('d3000000-0000-0000-0000-000000000017','b1000000-0000-0000-0000-000000000017','Kozmetičarka sa 7 godina iskustva traži posao u salonu u Novom Sadu. Tretmani lica, body tretmani, manikir, pedikir. Imam sopstvenu opremu.','job_seeker','Kozmetičarka','beauty','Novi Sad','published',234,NOW()-INTERVAL'4 days',0,1.0,0,0,0),

('d3000000-0000-0000-0000-000000000018','b1000000-0000-0000-0000-000000000018','IT tehničar sa 4 godine iskustva traži posao u Nišu. Linux i Windows administracija, mreže, cloud. Imam CCNA sertifikat. Dostupan odmah.','job_seeker','IT tehničar','it_technology','Niš','published',445,NOW()-INTERVAL'3 days 12 hours',0,1.0,0,0,0),

('d3000000-0000-0000-0000-000000000019','b1000000-0000-0000-0000-000000000019','Elektroinžinjer traži projekte ili stalni posao u Beogradu. PLC programiranje, automatizacija, elektro projekti. 7 godina iskustva u industriji.','job_seeker','Elektroinžinjer','construction','Beograd','published',312,NOW()-INTERVAL'3 days',0,1.0,0,0,0),

('d3000000-0000-0000-0000-000000000020','b1000000-0000-0000-0000-000000000020','Krojačica sa 20 godina iskustva traži posao ili narudžbine u Subotici. Šivenje po meri, alteracije, uniformne. Brza i precizna, radim i za firme.','job_seeker','Krojačica','beauty','Subotica','published',145,NOW()-INTERVAL'2 days 12 hours',0,1.0,0,0,0),

('d3000000-0000-0000-0000-000000000021','b1000000-0000-0000-0000-000000000021','Profesor matematike i fizike nudi instrukcije u Kragujevcu. 10 godina iskustva sa osnovcima i srednjoškolcima. Priprema za prijemne ispite. Online i uživo.','job_seeker','Profesor/instruktor','education','Kragujevac','published',267,NOW()-INTERVAL'2 days',0,1.0,0,0,0),

('d3000000-0000-0000-0000-000000000022','b1000000-0000-0000-0000-000000000022','Vozač sa CE kategorijom traži posao u transportnoj firmi. 8 godina iskustva na međunarodnim relacijama. Čist kažnjenički dosije, ADR sertifikat.','job_seeker','Vozač CE','transport','Beograd','published',189,NOW()-INTERVAL'1 day 12 hours',0,1.0,0,0,0),

('d3000000-0000-0000-0000-000000000023','b1000000-0000-0000-0000-000000000023','Nutricionista i dijetetičar sa 6 godina iskustva traži nove klijente u Novom Sadu i online. Izrada individualnih planova ishrane, konsultacije.','job_seeker','Nutricionista','health','Novi Sad','published',356,NOW()-INTERVAL'1 day',0,1.0,0,0,0),

('d3000000-0000-0000-0000-000000000024','b1000000-0000-0000-0000-000000000024','Advokat sa 8 godina prakse traži klijente u Beogradu. Porodično pravo, privredno pravo, ugovori. Besplatna inicijalna konsultacija.','job_seeker','Advokat','legal','Beograd','published',423,NOW()-INTERVAL'12 hours',0,1.0,0,0,0),

('d3000000-0000-0000-0000-000000000025','b1000000-0000-0000-0000-000000000025','Arhitekta i dizajner enterijera traži projekte u Nišu i okolini. Stanovi, kuće, poslovni prostori. Portfolio dostupan na zahtev. 9 godina iskustva.','job_seeker','Arhitekta','real_estate','Niš','published',312,NOW()-INTERVAL'6 hours',0,1.0,0,0,0);

COMMIT;
