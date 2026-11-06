import type { SecretQuestion } from '@shared/types.ts';

/**
 * Phase 1 fixed question list (Naija Trivia). In phase 2 these move to the Postgres
 * `questions` table and only the Edge Function ever sees `correctIndex`.
 */
type Row = [text: string, options: [string, string, string, string], correctIndex: number];

const ROWS: Row[] = [
  ['What is the capital of Nigeria?', ['Lagos', 'Abuja', 'Port Harcourt', 'Enugu'], 1],
  ['Nigeria’s currency is the…', ['Cedi', 'Naira', 'Rand', 'Shilling'], 1],
  ['How many states does Nigeria have?', ['30', '34', '36', '37'], 2],
  ['Which river meets the Niger at Lokoja?', ['Benue', 'Ogun', 'Cross', 'Kaduna'], 0],
  ['Which state is known as the Centre of Excellence?', ['Lagos', 'Oyo', 'Kano', 'Rivers'], 0],
  ['In what year did Nigeria gain independence?', ['1957', '1960', '1963', '1966'], 1],
  ['What colours are on the Nigerian flag?', ['Green and white', 'Green and yellow', 'Red and green', 'Blue and white'], 0],
  ['Who was Nigeria’s first President?', ['Tafawa Balewa', 'Obafemi Awolowo', 'Nnamdi Azikiwe', 'Ahmadu Bello'], 2],
  ['Jollof is mostly cooked with which grain?', ['Beans', 'Rice', 'Millet', 'Maize'], 1],
  ['What is the highest point in Nigeria?', ['Zuma Rock', 'Olumo Rock', 'Aso Rock', 'Chappal Waddi'], 3],
  ['Olumo Rock is in which city?', ['Ibadan', 'Abeokuta', 'Oshogbo', 'Akure'], 1],
  ['What is the nickname of Nigeria’s men’s football team?', ['Black Stars', 'Super Eagles', 'Indomitable Lions', 'Flying Eagles'], 1],
  ['Nigeria won Olympic football gold in which year?', ['1992', '1996', '2000', '2008'], 1],
  ['Who wrote “Things Fall Apart”?', ['Wole Soyinka', 'Chinua Achebe', 'Chimamanda Adichie', 'Ben Okri'], 1],
  ['Which Nigerian won the Nobel Prize in Literature in 1986?', ['Wole Soyinka', 'Chinua Achebe', 'Cyprian Ekwensi', 'Buchi Emecheta'], 0],
  ['Before Abuja, which city was Nigeria’s capital?', ['Kaduna', 'Ibadan', 'Lagos', 'Calabar'], 2],
  ['Eba is made from which of these?', ['Yam', 'Garri', 'Plantain', 'Rice'], 1],
  ['Port Harcourt is the capital of which state?', ['Rivers', 'Delta', 'Bayelsa', 'Akwa Ibom'], 0],
  ['Calabar is the capital of which state?', ['Akwa Ibom', 'Cross River', 'Ebonyi', 'Abia'], 1],
  ['Nigeria’s motto is “Unity and Faith, Peace and…”', ['Prosperity', 'Progress', 'Freedom', 'Strength'], 1],
  ['The Osun-Osogbo festival takes place in which state?', ['Ogun', 'Ekiti', 'Osun', 'Ondo'], 2],
  ['Which of these is a Nigerian soup made with melon seeds?', ['Egusi', 'Banga', 'Afang', 'Ewedu'], 0],
  ['Kano is famous for which centuries-old dye pits?', ['Kofar Mata', 'Kurmi', 'Gidan Rumfa', 'Dala'], 0],
  ['Which body of water does Lagos sit on?', ['Lake Chad', 'Bight of Benin', 'Gulf of Aden', 'Lake Kainji'], 1],
];

export const LOCAL_QUESTIONS: SecretQuestion[] = ROWS.map(([text, options, correctIndex], i) => ({
  id: `local-naija-${i + 1}`,
  text,
  options,
  correctIndex,
  category: 'naija-trivia',
  difficulty: 'easy',
}));
