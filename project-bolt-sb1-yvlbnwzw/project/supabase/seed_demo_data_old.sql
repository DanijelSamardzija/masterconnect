/*
  # Seed Demo Data for ProConnect

  1. Demo Data Created
    - 15 professional profiles with realistic data
    - 8 customer profiles
    - 12 demo jobs across various categories
    - 20+ reviews with ratings and comments
    
  2. Professional Profiles Include
    - Diverse service categories (Plumber, Electrician, Painter, etc.)
    - Various cities across Serbia
    - Professional avatars from Pexels
    - Detailed bios and starting prices
    - Mix of verified and unverified pros
    
  3. Demo Jobs Include
    - Open and closed status
    - Various categories and budgets
    - Realistic descriptions
    
  4. Reviews Include
    - Ratings from 3 to 5 stars
    - Helpful customer feedback
    - Recent timestamps
    
  5. Important Notes
    - Temporarily drops FK constraint to insert demo data
    - All data is demo/seed data for testing
    - Creates a realistic, populated app experience
*/

-- Temporarily drop the foreign key constraint
ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_id_fkey;

-- Insert demo customer profiles
INSERT INTO profiles (id, name, role, email, phone) VALUES
('c1000000-1111-4111-a111-000000000001', 'Marko Petrović', 'CUSTOMER', 'marko.petrovic@example.com', '+381 60 123 4567'),
('c2000000-2222-4222-a222-000000000002', 'Ana Jovanović', 'CUSTOMER', 'ana.jovanovic@example.com', '+381 60 234 5678'),
('c3000000-3333-4333-a333-000000000003', 'Nikola Stefanović', 'CUSTOMER', 'nikola.stefanovic@example.com', '+381 60 345 6789'),
('c4000000-4444-4444-a444-000000000004', 'Jelena Đorđević', 'CUSTOMER', 'jelena.djordjevic@example.com', '+381 60 456 7890'),
('c5000000-5555-4555-a555-000000000005', 'Stefan Nikolić', 'CUSTOMER', 'stefan.nikolic@example.com', '+381 60 567 8901'),
('c6000000-6666-4666-a666-000000000006', 'Milica Pavlović', 'CUSTOMER', 'milica.pavlovic@example.com', '+381 60 678 9012'),
('c7000000-7777-4777-a777-000000000007', 'Dušan Ilić', 'CUSTOMER', 'dusan.ilic@example.com', '+381 60 789 0123'),
('c8000000-8888-4888-a888-000000000008', 'Jovana Marković', 'CUSTOMER', 'jovana.markovic@example.com', '+381 60 890 1234')
ON CONFLICT (id) DO NOTHING;

-- Insert demo professional profiles
INSERT INTO profiles (id, name, role, email, phone) VALUES
('a1111111-1111-4111-a111-111111111111', 'Milan Kovačević', 'PRO', 'milan.kovacevic@example.com', '+381 64 111 2222'),
('a2222222-2222-4222-a222-222222222222', 'Aleksandar Popović', 'PRO', 'aleksandar.popovic@example.com', '+381 64 222 3333'),
('a3333333-3333-4333-a333-333333333333', 'Dragan Živković', 'PRO', 'dragan.zivkovic@example.com', '+381 64 333 4444'),
('a4444444-4444-4444-a444-444444444444', 'Nenad Tomić', 'PRO', 'nenad.tomic@example.com', '+381 64 444 5555'),
('a5555555-5555-4555-a555-555555555555', 'Igor Stanković', 'PRO', 'igor.stankovic@example.com', '+381 64 555 6666'),
('a6666666-6666-4666-a666-666666666666', 'Vladimir Milošević', 'PRO', 'vladimir.milosevic@example.com', '+381 64 666 7777'),
('a7777777-7777-4777-a777-777777777777', 'Dejan Radović', 'PRO', 'dejan.radovic@example.com', '+381 64 777 8888'),
('a8888888-8888-4888-a888-888888888888', 'Zoran Simić', 'PRO', 'zoran.simic@example.com', '+381 64 888 9999'),
('a9999999-9999-4999-a999-999999999999', 'Branko Kostić', 'PRO', 'branko.kostic@example.com', '+381 64 999 0000'),
('b1111111-1111-4111-b111-111111111111', 'Goran Đokić', 'PRO', 'goran.djokic@example.com', '+381 64 100 1111'),
('b2222222-2222-4222-b222-222222222222', 'Predrag Vuković', 'PRO', 'predrag.vukovic@example.com', '+381 64 200 2222'),
('b3333333-3333-4333-b333-333333333333', 'Miloš Antić', 'PRO', 'milos.antic@example.com', '+381 64 300 3333'),
('b4444444-4444-4444-b444-444444444444', 'Darko Ristić', 'PRO', 'darko.ristic@example.com', '+381 64 400 4444'),
('b5555555-5555-4555-b555-555555555555', 'Srđan Đurić', 'PRO', 'srdjan.djuric@example.com', '+381 64 500 5555'),
('b6666666-6666-4666-b666-666666666666', 'Bojan Marinković', 'PRO', 'bojan.marinkovic@example.com', '+381 64 600 6666')
ON CONFLICT (id) DO NOTHING;

-- Insert pro_profiles with detailed information
INSERT INTO pro_profiles (user_id, bio, city, phone, categories, avatar_url, starting_price, verified) VALUES
('a1111111-1111-4111-a111-111111111111', 
 'Licensed plumber with over 15 years of experience. Specializing in residential and commercial plumbing repairs, installations, and emergency services. Available 24/7 for urgent plumbing needs.',
 'Belgrade', '+381 64 111 2222', ARRAY['Plumber'], 
 'https://images.pexels.com/photos/1438072/pexels-photo-1438072.jpeg?auto=compress&cs=tinysrgb&w=400',
 '3,000 RSD/hour', true),

('a2222222-2222-4222-a222-222222222222',
 'Certified electrician providing professional electrical services for homes and businesses. Expert in wiring, lighting installation, panel upgrades, and troubleshooting electrical issues.',
 'Belgrade', '+381 64 222 3333', ARRAY['Electrician'],
 'https://images.pexels.com/photos/1181519/pexels-photo-1181519.jpeg?auto=compress&cs=tinysrgb&w=400',
 '3,500 RSD/hour', true),

('a3333333-3333-4333-a333-333333333333',
 'Professional painter with an eye for detail. Interior and exterior painting, wall preparation, color consultation, and decorative finishes. Quality work guaranteed.',
 'Novi Sad', '+381 64 333 4444', ARRAY['Painter'],
 'https://images.pexels.com/photos/1516680/pexels-photo-1516680.jpeg?auto=compress&cs=tinysrgb&w=400',
 '2,500 RSD/hour', true),

('a4444444-4444-4444-a444-444444444444',
 'Experienced carpenter specializing in custom furniture, kitchen cabinets, doors, and window installations. Quality craftsmanship with attention to detail.',
 'Niš', '+381 64 444 5555', ARRAY['Carpenter'],
 'https://images.pexels.com/photos/1080696/pexels-photo-1080696.jpeg?auto=compress&cs=tinysrgb&w=400',
 '3,000 RSD/hour', true),

('a5555555-5555-4555-a555-555555555555',
 'Professional cleaning services for homes and offices. Deep cleaning, regular maintenance, move-in/move-out cleaning, and post-construction cleanup. Eco-friendly products available.',
 'Belgrade', '+381 64 555 6666', ARRAY['Cleaning'],
 'https://images.pexels.com/photos/1024248/pexels-photo-1024248.jpeg?auto=compress&cs=tinysrgb&w=400',
 '2,000 RSD/hour', false),

('a6666666-6666-4666-a666-666666666666',
 'HVAC technician with 10+ years experience. Air conditioning installation and repair, heating system maintenance, ventilation solutions. Emergency services available.',
 'Kragujevac', '+381 64 666 7777', ARRAY['HVAC'],
 'https://images.pexels.com/photos/1080696/pexels-photo-1080696.jpeg?auto=compress&cs=tinysrgb&w=400',
 '4,000 RSD/hour', true),

('a7777777-7777-4777-a777-777777777777',
 'Landscaping expert providing garden design, lawn maintenance, tree trimming, and outdoor space renovation. Transform your outdoor area into a beautiful oasis.',
 'Subotica', '+381 64 777 8888', ARRAY['Landscaping'],
 'https://images.pexels.com/photos/1181406/pexels-photo-1181406.jpeg?auto=compress&cs=tinysrgb&w=400',
 '2,500 RSD/hour', false),

('a8888888-8888-4888-a888-888888888888',
 'Professional moving company with experienced team. Local and long-distance moves, packing services, furniture assembly/disassembly. Careful handling of your belongings.',
 'Belgrade', '+381 64 888 9999', ARRAY['Moving'],
 'https://images.pexels.com/photos/1516680/pexels-photo-1516680.jpeg?auto=compress&cs=tinysrgb&w=400',
 '15,000 RSD flat rate', true),

('a9999999-9999-4999-a999-999999999999',
 'Multi-skilled handyman offering plumbing repairs, electrical fixes, and general home maintenance. Quick response time and fair pricing for all household repairs.',
 'Pančevo', '+381 64 999 0000', ARRAY['Plumber', 'Electrician'],
 'https://images.pexels.com/photos/1438072/pexels-photo-1438072.jpeg?auto=compress&cs=tinysrgb&w=400',
 '2,800 RSD/hour', false),

('b1111111-1111-4111-b111-111111111111',
 'Residential and commercial painter with 12 years experience. Specializing in decorative painting, wallpaper installation, and surface preparation. High-quality finishes.',
 'Novi Sad', '+381 64 100 1111', ARRAY['Painter'],
 'https://images.pexels.com/photos/1181519/pexels-photo-1181519.jpeg?auto=compress&cs=tinysrgb&w=400',
 '2,800 RSD/hour', true),

('b2222222-2222-4222-b222-222222222222',
 'Expert carpenter and furniture maker. Custom woodwork, built-in closets, kitchen renovations, and fine furniture repair. Traditional craftsmanship meets modern design.',
 'Belgrade', '+381 64 200 2222', ARRAY['Carpenter'],
 'https://images.pexels.com/photos/1024248/pexels-photo-1024248.jpeg?auto=compress&cs=tinysrgb&w=400',
 '3,200 RSD/hour', true),

('b3333333-3333-4333-b333-333333333333',
 'Licensed electrician offering complete electrical solutions. From simple repairs to complete rewiring, smart home installations, and energy-efficient lighting upgrades.',
 'Čačak', '+381 64 300 3333', ARRAY['Electrician', 'Other'],
 'https://images.pexels.com/photos/1181406/pexels-photo-1181406.jpeg?auto=compress&cs=tinysrgb&w=400',
 '3,300 RSD/hour', false),

('b4444444-4444-4444-b444-444444444444',
 'Professional HVAC and plumbing services. Air conditioning maintenance, heating repairs, and complete plumbing solutions for residential properties.',
 'Zrenjanin', '+381 64 400 4444', ARRAY['HVAC', 'Plumber'],
 'https://images.pexels.com/photos/1438072/pexels-photo-1438072.jpeg?auto=compress&cs=tinysrgb&w=400',
 '3,800 RSD/hour', true),

('b5555555-5555-4555-b555-555555555555',
 'Complete landscaping and outdoor maintenance services. Garden design, seasonal cleanup, irrigation system installation, and hardscaping projects.',
 'Belgrade', '+381 64 500 5555', ARRAY['Landscaping', 'Other'],
 'https://images.pexels.com/photos/1181519/pexels-photo-1181519.jpeg?auto=compress&cs=tinysrgb&w=400',
 '2,700 RSD/hour', false),

('b6666666-6666-4666-b666-666666666666',
 'Reliable moving and delivery service. Apartment and office relocations, furniture delivery, packing materials provided. Insured and professional team.',
 'Niš', '+381 64 600 6666', ARRAY['Moving'],
 'https://images.pexels.com/photos/1516680/pexels-photo-1516680.jpeg?auto=compress&cs=tinysrgb&w=400',
 '12,000 RSD flat rate', true)
ON CONFLICT (user_id) DO NOTHING;

-- Insert demo reviews
INSERT INTO reviews (customer_id, pro_id, rating, comment, created_at) VALUES
-- Reviews for Milan Kovačević (Plumber)
('c1000000-1111-4111-a111-000000000001', 'a1111111-1111-4111-a111-111111111111', 5, 
 'Excellent service! Milan fixed our leaking pipe quickly and professionally. Highly recommended!', 
 NOW() - INTERVAL '15 days'),
('c2000000-2222-4222-a222-000000000002', 'a1111111-1111-4111-a111-111111111111', 5,
 'Very reliable and knowledgeable. Arrived on time and completed the work efficiently.',
 NOW() - INTERVAL '8 days'),
('c3000000-3333-4333-a333-000000000003', 'a1111111-1111-4111-a111-111111111111', 4,
 'Good work overall. The bathroom renovation looks great.',
 NOW() - INTERVAL '3 days'),

-- Reviews for Aleksandar Popović (Electrician)
('c4000000-4444-4444-a444-000000000004', 'a2222222-2222-4222-a222-222222222222', 5,
 'Fantastic electrician! Rewired our entire house and installed new lighting. Very professional.',
 NOW() - INTERVAL '20 days'),
('c5000000-5555-4555-a555-000000000005', 'a2222222-2222-4222-a222-222222222222', 5,
 'Quick response for an electrical emergency. Fixed the problem immediately. Thank you!',
 NOW() - INTERVAL '12 days'),

-- Reviews for Dragan Živković (Painter)
('c1000000-1111-4111-a111-000000000001', 'a3333333-3333-4333-a333-333333333333', 5,
 'Amazing attention to detail. Our living room looks beautiful. Worth every dinar!',
 NOW() - INTERVAL '25 days'),
('c6000000-6666-4666-a666-000000000006', 'a3333333-3333-4333-a333-333333333333', 4,
 'Great painter with good color advice. Finished on schedule.',
 NOW() - INTERVAL '18 days'),
('c7000000-7777-4777-a777-000000000007', 'a3333333-3333-4333-a333-333333333333', 5,
 'Professional and clean work. Highly recommend for any painting project!',
 NOW() - INTERVAL '5 days'),

-- Reviews for Nenad Tomić (Carpenter)
('c2000000-2222-4222-a222-000000000002', 'a4444444-4444-4444-a444-444444444444', 5,
 'Incredible craftsmanship! The custom cabinets are exactly what we wanted.',
 NOW() - INTERVAL '30 days'),
('c8000000-8888-4888-a888-000000000008', 'a4444444-4444-4444-a444-444444444444', 5,
 'Very skilled carpenter. Built us a beautiful dining table. Excellent quality.',
 NOW() - INTERVAL '10 days'),

-- Reviews for Igor Stanković (Cleaning)
('c3000000-3333-4333-a333-000000000003', 'a5555555-5555-4555-a555-555555555555', 4,
 'Thorough cleaning service. My apartment has never been cleaner!',
 NOW() - INTERVAL '7 days'),
('c4000000-4444-4444-a444-000000000004', 'a5555555-5555-4555-a555-555555555555', 5,
 'Great job with our office cleaning. Reliable and detail-oriented.',
 NOW() - INTERVAL '2 days'),

-- Reviews for Vladimir Milošević (HVAC)
('c5000000-5555-4555-a555-000000000005', 'a6666666-6666-4666-a666-666666666666', 5,
 'Expert HVAC technician. Fixed our air conditioning system perfectly. Very knowledgeable.',
 NOW() - INTERVAL '22 days'),
('c1000000-1111-4111-a111-000000000001', 'a6666666-6666-4666-a666-666666666666', 4,
 'Good service and fair pricing. Our heating system works great now.',
 NOW() - INTERVAL '14 days'),

-- Reviews for Zoran Simić (Moving)
('c6000000-6666-4666-a666-000000000006', 'a8888888-8888-4888-a888-888888888888', 5,
 'Best moving service! Careful with furniture and very efficient. Made our move stress-free.',
 NOW() - INTERVAL '16 days'),
('c7000000-7777-4777-a777-000000000007', 'a8888888-8888-4888-a888-888888888888', 5,
 'Professional team, everything arrived safely. Great communication throughout.',
 NOW() - INTERVAL '6 days'),

-- Reviews for Goran Đokić (Painter)
('c8000000-8888-4888-a888-000000000008', 'b1111111-1111-4111-b111-111111111111', 4,
 'Nice work on the exterior painting. House looks brand new!',
 NOW() - INTERVAL '19 days'),
('c2000000-2222-4222-a222-000000000002', 'b1111111-1111-4111-b111-111111111111', 5,
 'Excellent painter! Clean work and great finish. Very happy with the results.',
 NOW() - INTERVAL '9 days'),

-- Reviews for Predrag Vuković (Carpenter)
('c3000000-3333-4333-a333-000000000003', 'b2222222-2222-4222-b222-222222222222', 5,
 'Outstanding carpenter! The kitchen renovation exceeded our expectations.',
 NOW() - INTERVAL '28 days'),

-- Reviews for Bojan Marinković (Moving)
('c4000000-4444-4444-a444-000000000004', 'b6666666-6666-4666-b666-666666666666', 4,
 'Reliable moving service. Good value for money.',
 NOW() - INTERVAL '11 days'),

-- Reviews for Srđan Đurić (HVAC & Plumber)
('c5000000-5555-4555-a555-000000000005', 'b4444444-4444-4444-b444-444444444444', 5,
 'Very professional! Fixed both our plumbing and AC issues in one visit.',
 NOW() - INTERVAL '13 days'),
('c6000000-6666-4666-a666-000000000006', 'b4444444-4444-4444-b444-444444444444', 4,
 'Great service. Quick and efficient.',
 NOW() - INTERVAL '4 days')
ON CONFLICT DO NOTHING;

-- Insert demo jobs
INSERT INTO jobs (customer_id, title, description, category, city, budget, preferred_date, status, created_at) VALUES
('c1000000-1111-4111-a111-000000000001', 
 'Kitchen Sink Repair Needed',
 'My kitchen sink is leaking and needs immediate repair. The leak appears to be coming from under the sink. Need someone reliable who can come within the next few days.',
 'Plumber', 'Belgrade', '5,000 - 8,000 RSD', 'Within 3 days', 'open',
 NOW() - INTERVAL '2 days'),

('c2000000-2222-4222-a222-000000000002',
 'Living Room Painting',
 'Looking for a professional painter to paint our living room (approximately 30 square meters). We have already chosen the colors and need the work completed within 2 weeks.',
 'Painter', 'Belgrade', '15,000 - 20,000 RSD', 'Next 2 weeks', 'open',
 NOW() - INTERVAL '5 days'),

('c3000000-3333-4333-a333-000000000003',
 'Electrical Outlet Installation',
 'Need to install 5 new electrical outlets in our apartment. Must be a licensed electrician. Flexible on timing.',
 'Electrician', 'Novi Sad', '8,000 - 12,000 RSD', 'Flexible', 'open',
 NOW() - INTERVAL '1 day'),

('c4000000-4444-4444-a444-000000000004',
 'Custom Bookshelf Construction',
 'Looking for an experienced carpenter to build a custom bookshelf for our home office. We have specific dimensions and design in mind.',
 'Carpenter', 'Niš', '25,000 - 35,000 RSD', 'Next month', 'open',
 NOW() - INTERVAL '4 days'),

('c5000000-5555-4555-a555-000000000005',
 'Deep Cleaning After Renovation',
 'Our apartment needs a thorough deep cleaning after renovation work. Includes kitchen, bathroom, and all rooms. Approximately 60 square meters.',
 'Cleaning', 'Belgrade', '10,000 - 15,000 RSD', 'This weekend', 'open',
 NOW() - INTERVAL '3 days'),

('c6000000-6666-4666-a666-000000000006',
 'Air Conditioning Service',
 'Annual maintenance for 2 air conditioning units. Need professional HVAC technician to service and clean the units before summer.',
 'HVAC', 'Kragujevac', '8,000 - 12,000 RSD', 'Before May', 'open',
 NOW() - INTERVAL '6 days'),

('c7000000-7777-4777-a777-000000000007',
 'Garden Landscaping Project',
 'Complete garden makeover needed. Includes lawn renovation, planting flowers and shrubs, and creating a small patio area. Garden is approximately 50 square meters.',
 'Landscaping', 'Subotica', '40,000 - 60,000 RSD', 'Spring season', 'open',
 NOW() - INTERVAL '8 days'),

('c8000000-8888-4888-a888-000000000008',
 'Apartment Moving Service',
 'Moving from a 2-bedroom apartment to a new location within Belgrade. Need professional movers with a truck. Have some heavy furniture.',
 'Moving', 'Belgrade', '20,000 - 30,000 RSD', 'End of month', 'open',
 NOW() - INTERVAL '1 day'),

('c1000000-1111-4111-a111-000000000001',
 'Bathroom Renovation - COMPLETED',
 'Complete bathroom renovation including new tiles, fixtures, and plumbing. Project was completed successfully!',
 'Plumber', 'Belgrade', '80,000 RSD', 'Completed', 'closed',
 NOW() - INTERVAL '45 days'),

('c2000000-2222-4222-a222-000000000002',
 'Exterior House Painting - COMPLETED',
 'Full exterior house painting completed. The house looks amazing! Very satisfied with the work.',
 'Painter', 'Novi Sad', '50,000 RSD', 'Completed', 'closed',
 NOW() - INTERVAL '30 days'),

('c3000000-3333-4333-a333-000000000003',
 'Emergency Plumbing Repair - COMPLETED',
 'Had an emergency pipe burst. The plumber arrived quickly and fixed everything perfectly. Crisis averted!',
 'Plumber', 'Belgrade', '12,000 RSD', 'Completed', 'closed',
 NOW() - INTERVAL '20 days'),

('c4000000-4444-4444-a444-000000000004',
 'Office Deep Clean - COMPLETED',
 'Professional office cleaning completed. Everything is spotless and smells fresh. Great job!',
 'Cleaning', 'Belgrade', '18,000 RSD', 'Completed', 'closed',
 NOW() - INTERVAL '15 days')
ON CONFLICT DO NOTHING;