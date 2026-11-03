-- =====================================================================
-- OurBeckett: launch communities
-- These are real starting content for launch (not mock data). They are
-- marked official and have no student owner; staff moderate them via the
-- dashboard. Students can create their own communities in the app.
-- =====================================================================

insert into public.communities (slug, name, description, category, icon, is_official)
values
  ('computer-science', 'Computer Science Students', 'Code, coursework, hackathons and internships for CS students at Leeds Beckett.', 'Course', '💻', true),
  ('business-students', 'Business Students', 'Leeds Business School chat: modules, placements, networking and side hustles.', 'Course', '📈', true),
  ('freshers-2026', 'Freshers 2026', 'New to Leeds Beckett? Meet your fellow freshers, find flatmates and plan Freshers Week.', 'Freshers', '🎉', true),
  ('accommodation-housing', 'Accommodation and Housing', 'Looking for a room, a housemate or advice on landlords? Start here.', 'Housing', '🏠', true),
  ('gym-fitness', 'Gym and Fitness', 'Gym buddies, Carnegie sport, running routes and fitness tips.', 'Sport', '💪', true),
  ('gaming', 'Gaming', 'Find a squad, talk releases and organise LAN nights.', 'Gaming', '🎮', true),
  ('nightlife-leeds', 'Nightlife in Leeds', 'Where is going out tonight? Club nights, gigs and pre-drinks.', 'Nightlife', '🌙', true),
  ('student-deals', 'Student Deals', 'Discounts, freebies and the best student deals around Leeds.', 'Deals', '🏷️', true),
  ('study-groups', 'Study Groups', 'Find people to revise with, share notes and beat deadlines together.', 'General', '📚', true),
  ('headingley-campus', 'Headingley Campus', 'Everything happening at Headingley: food, sport, buses and events.', 'General', '🌳', true),
  ('city-campus', 'City Campus', 'Life at City Campus: study spots, food and what is on in town.', 'General', '🏙️', true)
on conflict (slug) do nothing;
