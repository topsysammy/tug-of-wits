-- Seed: Naija Trivia starter set (24 questions). Add more with scripts/import-questions.mjs.
insert into public.questions (id, category, difficulty, text, options, correct_index) values
  ('naija-001', 'naija-trivia', 'easy', 'What is the capital of Nigeria?', '["Lagos","Abuja","Port Harcourt","Enugu"]'::jsonb, 1),
  ('naija-002', 'naija-trivia', 'easy', 'Nigeria’s currency is the…', '["Cedi","Naira","Rand","Shilling"]'::jsonb, 1),
  ('naija-003', 'naija-trivia', 'easy', 'How many states does Nigeria have?', '["30","34","36","37"]'::jsonb, 2),
  ('naija-004', 'naija-trivia', 'easy', 'Which river meets the Niger at Lokoja?', '["Benue","Ogun","Cross","Kaduna"]'::jsonb, 0),
  ('naija-005', 'naija-trivia', 'easy', 'Which state is known as the Centre of Excellence?', '["Lagos","Oyo","Kano","Rivers"]'::jsonb, 0),
  ('naija-006', 'naija-trivia', 'easy', 'In what year did Nigeria gain independence?', '["1957","1960","1963","1966"]'::jsonb, 1),
  ('naija-007', 'naija-trivia', 'easy', 'What colours are on the Nigerian flag?', '["Green and white","Green and yellow","Red and green","Blue and white"]'::jsonb, 0),
  ('naija-008', 'naija-trivia', 'easy', 'Who was Nigeria’s first President?', '["Tafawa Balewa","Obafemi Awolowo","Nnamdi Azikiwe","Ahmadu Bello"]'::jsonb, 2),
  ('naija-009', 'naija-trivia', 'easy', 'Jollof is mostly cooked with which grain?', '["Beans","Rice","Millet","Maize"]'::jsonb, 1),
  ('naija-010', 'naija-trivia', 'medium', 'What is the highest point in Nigeria?', '["Zuma Rock","Olumo Rock","Aso Rock","Chappal Waddi"]'::jsonb, 3),
  ('naija-011', 'naija-trivia', 'medium', 'Olumo Rock is in which city?', '["Ibadan","Abeokuta","Oshogbo","Akure"]'::jsonb, 1),
  ('naija-012', 'naija-trivia', 'medium', 'What is the nickname of Nigeria’s men’s football team?', '["Black Stars","Super Eagles","Indomitable Lions","Flying Eagles"]'::jsonb, 1),
  ('naija-013', 'naija-trivia', 'medium', 'Nigeria won Olympic football gold in which year?', '["1992","1996","2000","2008"]'::jsonb, 1),
  ('naija-014', 'naija-trivia', 'medium', 'Who wrote “Things Fall Apart”?', '["Wole Soyinka","Chinua Achebe","Chimamanda Adichie","Ben Okri"]'::jsonb, 1),
  ('naija-015', 'naija-trivia', 'medium', 'Which Nigerian won the Nobel Prize in Literature in 1986?', '["Wole Soyinka","Chinua Achebe","Cyprian Ekwensi","Buchi Emecheta"]'::jsonb, 0),
  ('naija-016', 'naija-trivia', 'medium', 'Before Abuja, which city was Nigeria’s capital?', '["Kaduna","Ibadan","Lagos","Calabar"]'::jsonb, 2),
  ('naija-017', 'naija-trivia', 'medium', 'Eba is made from which of these?', '["Yam","Garri","Plantain","Rice"]'::jsonb, 1),
  ('naija-018', 'naija-trivia', 'medium', 'Port Harcourt is the capital of which state?', '["Rivers","Delta","Bayelsa","Akwa Ibom"]'::jsonb, 0),
  ('naija-019', 'naija-trivia', 'hard', 'Calabar is the capital of which state?', '["Akwa Ibom","Cross River","Ebonyi","Abia"]'::jsonb, 1),
  ('naija-020', 'naija-trivia', 'hard', 'Nigeria’s motto is “Unity and Faith, Peace and…”', '["Prosperity","Progress","Freedom","Strength"]'::jsonb, 1),
  ('naija-021', 'naija-trivia', 'hard', 'The Osun-Osogbo festival takes place in which state?', '["Ogun","Ekiti","Osun","Ondo"]'::jsonb, 2),
  ('naija-022', 'naija-trivia', 'hard', 'Which of these is a Nigerian soup made with melon seeds?', '["Egusi","Banga","Afang","Ewedu"]'::jsonb, 0),
  ('naija-023', 'naija-trivia', 'hard', 'Kano is famous for which centuries-old dye pits?', '["Kofar Mata","Kurmi","Gidan Rumfa","Dala"]'::jsonb, 0),
  ('naija-024', 'naija-trivia', 'hard', 'Which body of water does Lagos sit on?', '["Lake Chad","Bight of Benin","Gulf of Aden","Lake Kainji"]'::jsonb, 1)
on conflict (id) do update set
  text = excluded.text, options = excluded.options, correct_index = excluded.correct_index,
  difficulty = excluded.difficulty, category = excluded.category;
