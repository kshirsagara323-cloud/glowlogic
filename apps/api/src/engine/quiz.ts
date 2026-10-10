import type { QuizOption, QuizQuestion, SectionId, TraitCode, Undertone } from './types.js';

type Signals = Partial<Record<TraitCode, number>>;
const o = (id: string, label: string, signals?: Signals): QuizOption => (signals ? { id, label, signals } : { id, label });
const vote = (id: string, label: string, votes?: Partial<Record<Undertone, number>>): QuizOption =>
  votes ? { id, label, votes } : { id, label };

export const TRAIT_LABELS: Record<TraitCode, string> = {
  acne: 'Acne', blackheads: 'Blackheads', whiteheads: 'Whiteheads', dryness: 'Dryness',
  dehydration: 'Dehydration', oiliness: 'Oiliness', redness: 'Redness', uneven_tone: 'Uneven tone',
  dark_spots: 'Dark spots', hyperpigmentation: 'Hyperpigmentation', dullness: 'Dullness',
  texture: 'Texture', visible_pores: 'Visible pores', fine_lines: 'Fine lines',
  under_eye: 'Under-eye concerns', sensitivity: 'Sensitivity',
};

export const SECTIONS: { id: SectionId; title: string; description: string }[] = [
  { id: 'oil_hydration', title: 'Oil and hydration', description: 'How your skin behaves through the day. Skip anything you are unsure about.' },
  { id: 'sensitivity', title: 'Sensitivity and redness', description: 'How your skin reacts to products and conditions.' },
  { id: 'breakouts', title: 'Breakouts, pores and texture', description: 'What you notice on the surface.' },
  { id: 'tone_marks', title: 'Marks, glow and fine lines', description: 'Colour, brightness and lines.' },
  { id: 'color', title: 'Skin tone and undertone', description: 'Approximate only. Daylight helps, and you can correct the result afterwards.' },
  { id: 'safety_habits', title: 'Safety and habits', description: 'Helps us keep guidance safe and relevant. All optional.' },
];

const DEPTH_LABELS = ['Very fair', 'Fair', 'Light', 'Light-medium', 'Medium', 'Medium-tan', 'Tan', 'Brown', 'Deep brown', 'Very deep'];

export const QUESTIONS: QuizQuestion[] = [
  // ---- Oil and hydration ----
  {
    id: 'shine_midday', section: 'oil_hydration', short: 'Shine by midday', type: 'single', weight: 1,
    prompt: 'By midday, with no products on, how shiny does your skin look?',
    options: [
      o('none', 'Not shiny', { oiliness: 0 }),
      o('tzone_slight', 'Slightly shiny on forehead and nose', { oiliness: 0.35 }),
      o('tzone_clear', 'Clearly shiny on forehead and nose', { oiliness: 0.7 }),
      o('all_over', 'Shiny all over', { oiliness: 1 }),
    ],
  },
  {
    id: 'after_cleanse', section: 'oil_hydration', short: 'Feel after washing', type: 'single', weight: 1,
    prompt: 'About 30 minutes after washing, with no moisturiser, how does your skin feel?',
    options: [
      o('tight', 'Tight or uncomfortable', { dryness: 1, dehydration: 0.7 }),
      o('slightly_tight', 'Slightly tight', { dryness: 0.5, dehydration: 0.5 }),
      o('comfortable', 'Comfortable', { dryness: 0, dehydration: 0, oiliness: 0.15 }),
      o('oily_soon', 'Already getting oily', { dryness: 0, oiliness: 0.8 }),
    ],
  },
  {
    id: 'flaking', section: 'oil_hydration', short: 'Flaking or rough patches', type: 'single', weight: 0.8,
    prompt: 'Do you get flaky or rough patches?',
    options: [
      o('never', 'Never', { dryness: 0, texture: 0 }),
      o('sometimes', 'Sometimes', { dryness: 0.5, texture: 0.3 }),
      o('often', 'Often', { dryness: 1, texture: 0.6 }),
    ],
  },
  {
    id: 'oily_but_tight', section: 'oil_hydration', short: 'Shiny but tight', type: 'single', weight: 0.8,
    prompt: 'Does your skin ever look shiny but still feel tight or rough?',
    hint: 'Skin can be oily and short of water at the same time.',
    options: [
      o('no', 'No', { dehydration: 0 }),
      o('sometimes', 'Sometimes', { dehydration: 0.5 }),
      o('often', 'Often', { dehydration: 1 }),
    ],
  },
  // ---- Sensitivity and redness ----
  {
    id: 'product_sting', section: 'sensitivity', short: 'Stinging or burning', type: 'single', weight: 1,
    prompt: 'How often do products sting, burn or make your skin red?',
    options: [
      o('never', 'Never', { sensitivity: 0 }),
      o('rarely', 'Rarely', { sensitivity: 0.25 }),
      o('sometimes', 'Sometimes', { sensitivity: 0.6 }),
      o('often', 'Often', { sensitivity: 1 }),
    ],
  },
  {
    id: 'flushing', section: 'sensitivity', short: 'Flushing easily', type: 'single', weight: 0.8,
    prompt: 'Does your face flush or turn red easily (heat, spicy food, emotions)?',
    options: [
      o('never', 'Never', { redness: 0, sensitivity: 0 }),
      o('sometimes', 'Sometimes', { redness: 0.5, sensitivity: 0.3 }),
      o('often', 'Often', { redness: 1, sensitivity: 0.6 }),
    ],
  },
  {
    id: 'lasting_redness', section: 'sensitivity', short: 'Lasting redness', type: 'single', weight: 0.8,
    prompt: 'Do you have redness that stays for days?',
    options: [
      o('no', 'No', { redness: 0 }),
      o('mild', 'Mild, in small areas', { redness: 0.5 }),
      o('noticeable', 'Noticeable', { redness: 1 }),
    ],
  },
  {
    id: 'fragrance_reaction', section: 'sensitivity', short: 'Reaction to fragrance', type: 'single', weight: 0.6,
    prompt: 'Have fragranced products or certain ingredients ever caused a reaction?',
    options: [
      o('no', 'No', { sensitivity: 0 }),
      o('unsure', 'Not sure', { sensitivity: 0.3 }),
      o('yes', 'Yes', { sensitivity: 0.8 }),
    ],
  },
  // ---- Breakouts, pores, texture ----
  {
    id: 'breakout_frequency', section: 'breakouts', short: 'Breakout frequency', type: 'single', weight: 1,
    prompt: 'How often do you get pimples or breakouts?',
    options: [
      o('rarely', 'Rarely or never', { acne: 0 }),
      o('few_month', 'A few per month', { acne: 0.35 }),
      o('weekly', 'Most weeks', { acne: 0.7 }),
      o('constant', 'Almost always some', { acne: 1 }),
    ],
  },
  {
    id: 'breakout_types', section: 'breakouts', short: 'Types of bumps', type: 'multi', weight: 0.8,
    prompt: 'What kinds of bumps do you notice? Choose all that apply.',
    options: [
      o('blackheads', 'Blackheads (dark dots)', { blackheads: 1 }),
      o('whiteheads', 'Whiteheads (small white bumps)', { whiteheads: 1 }),
      o('inflamed', 'Red, tender pimples', { acne: 0.8 }),
      o('deep', 'Deep, painful lumps', { acne: 1 }),
      o('none', 'None of these', { blackheads: 0, whiteheads: 0, acne: 0 }),
    ],
  },
  {
    id: 'pore_visibility', section: 'breakouts', short: 'Pore visibility', type: 'single', weight: 0.8,
    prompt: 'How visible are your pores?',
    options: [
      o('barely', 'Barely visible', { visible_pores: 0 }),
      o('nose', 'Visible on the nose', { visible_pores: 0.35 }),
      o('cheeks_nose', 'Visible on nose and cheeks', { visible_pores: 0.7 }),
      o('everywhere', 'Visible across most of my face', { visible_pores: 1 }),
    ],
  },
  {
    id: 'surface_texture', section: 'breakouts', short: 'Surface texture', type: 'single', weight: 0.8,
    prompt: 'When you run a hand over your skin, does it feel bumpy or uneven?',
    options: [
      o('smooth', 'Smooth', { texture: 0 }),
      o('slightly', 'Slightly uneven', { texture: 0.5 }),
      o('noticeably', 'Noticeably bumpy', { texture: 1 }),
    ],
  },
  // ---- Marks, glow, lines ----
  {
    id: 'dark_marks', section: 'tone_marks', short: 'Dark marks', type: 'single', weight: 1,
    prompt: 'Do you have dark marks left after pimples, or sun spots?',
    options: [
      o('none', 'None', { dark_spots: 0, uneven_tone: 0, hyperpigmentation: 0 }),
      o('few_light', 'A few, fairly light', { dark_spots: 0.3, uneven_tone: 0.2, hyperpigmentation: 0.2 }),
      o('several', 'Several', { dark_spots: 0.7, uneven_tone: 0.5, hyperpigmentation: 0.6 }),
      o('many_dark', 'Many, or quite dark', { dark_spots: 1, uneven_tone: 0.8, hyperpigmentation: 0.9 }),
    ],
  },
  {
    id: 'uneven_patches', section: 'tone_marks', short: 'Uneven colour or patches', type: 'single', weight: 0.8,
    prompt: 'Do you have darker patches (for example upper lip, cheeks, forehead) or uneven skin colour?',
    options: [
      o('no', 'No', { uneven_tone: 0, hyperpigmentation: 0 }),
      o('slight', 'Slightly', { uneven_tone: 0.5, hyperpigmentation: 0.5 }),
      o('clear', 'Clearly', { uneven_tone: 1, hyperpigmentation: 1 }),
    ],
  },
  {
    id: 'dullness', section: 'tone_marks', short: 'Dull look', type: 'single', weight: 0.8,
    prompt: 'Does your skin look dull or tired, even when you are rested?',
    options: [
      o('rarely', 'Rarely', { dullness: 0 }),
      o('sometimes', 'Sometimes', { dullness: 0.5 }),
      o('often', 'Often', { dullness: 1 }),
    ],
  },
  {
    id: 'under_eye', section: 'tone_marks', short: 'Under-eye area', type: 'single', weight: 1,
    prompt: 'What do you notice under your eyes?',
    options: [
      o('nothing', 'Nothing in particular', { under_eye: 0 }),
      o('dark', 'Dark circles', { under_eye: 0.6 }),
      o('puffy', 'Puffiness', { under_eye: 0.6 }),
      o('both', 'Both', { under_eye: 1 }),
    ],
  },
  {
    id: 'fine_lines', section: 'tone_marks', short: 'Fine lines', type: 'single', weight: 1,
    prompt: 'Do you notice fine lines?',
    options: [
      o('none', 'No', { fine_lines: 0 }),
      o('expression', 'A few when I smile or frown', { fine_lines: 0.4 }),
      o('at_rest', 'Visible even at rest', { fine_lines: 1 }),
    ],
  },
  // ---- Tone and undertone (handled by tone.ts, not trait scoring) ----
  {
    id: 'skin_depth', section: 'color', short: 'Skin depth', type: 'single', weight: 0,
    prompt: 'Which best describes the depth of your skin in natural daylight?',
    hint: 'Pick the closest one. Screens show colours differently, so treat this as approximate.',
    options: DEPTH_LABELS.map((label, i) => ({ id: `d${i + 1}`, label: `${i + 1}. ${label}`, depthBin: i + 1 })),
  },
  {
    id: 'undertone_veins', section: 'color', short: 'Wrist veins', type: 'single', weight: 0,
    prompt: 'In daylight, what colour do the veins on the inside of your wrist look?',
    hint: 'A popular rule of thumb, not a proven test. Skip it if unsure.',
    options: [
      vote('blue_purple', 'Blue or purple', { cool: 1 }),
      vote('green', 'Green or olive-green', { warm: 1 }),
      vote('mixed', 'A mix, or both', { neutral: 1 }),
      vote('unsure', 'Not sure'),
    ],
  },
  {
    id: 'undertone_jewellery', section: 'color', short: 'Jewellery metal', type: 'single', weight: 0,
    prompt: 'Which metal tends to look better against your skin?',
    hint: 'Another rule of thumb. Skip it if unsure.',
    options: [
      vote('silver', 'Silver', { cool: 1 }),
      vote('gold', 'Gold', { warm: 1 }),
      vote('both', 'Both look fine', { neutral: 1 }),
      vote('unsure', 'Not sure'),
    ],
  },
  {
    id: 'undertone_cast', section: 'color', short: 'Colour cast', type: 'single', weight: 0,
    prompt: 'In daylight, does your skin have a subtle colour cast?',
    options: [
      vote('pink', 'Pink or rosy', { cool: 1 }),
      vote('golden', 'Golden, yellow or peachy', { warm: 1 }),
      vote('olive', 'Slightly green or grey-olive', { olive: 1 }),
      vote('neutral', 'Neither stands out', { neutral: 1 }),
      vote('unsure', 'Not sure'),
    ],
  },
  // ---- Safety and habits (not scored) ----
  {
    id: 'red_flags', section: 'safety_habits', short: 'Skin changes', type: 'multi', weight: 0,
    prompt: 'Have you noticed any of these? Choose all that apply.',
    hint: 'GlowLogic cannot diagnose anything. This only helps us point you to the right help.',
    options: [
      { id: 'changing_mole', label: 'A mole or spot that has changed in size, shape or colour, or that bleeds' },
      { id: 'non_healing', label: 'A sore or patch that has not healed in a few weeks' },
      { id: 'painful_rash', label: 'A painful, blistering or fast-spreading rash, or skin symptoms with a fever' },
      { id: 'severe_reaction', label: 'A recent severe reaction, such as swelling of the face or lips, or trouble breathing' },
      { id: 'none', label: 'None of these' },
    ],
  },
  {
    id: 'pregnancy', section: 'safety_habits', short: 'Pregnancy or breastfeeding', type: 'single', weight: 0,
    prompt: 'Are you pregnant, trying to conceive, or breastfeeding?',
    hint: 'Some skincare ingredients are usually avoided in these situations, so we can keep guidance safer.',
    options: [
      { id: 'yes', label: 'Yes' },
      { id: 'no', label: 'No' },
      { id: 'prefer_not', label: 'Prefer not to say' },
    ],
  },
  {
    id: 'current_products', section: 'safety_habits', short: 'Current products', type: 'multi', weight: 0,
    prompt: 'Which of these do you currently use? Choose all that apply.',
    options: [
      { id: 'cleanser', label: 'Cleanser' },
      { id: 'moisturizer', label: 'Moisturiser' },
      { id: 'sunscreen', label: 'Sunscreen' },
      { id: 'vitamin_c', label: 'Vitamin C serum' },
      { id: 'retinoid', label: 'Retinol or other retinoid' },
      { id: 'exfoliating_acid', label: 'Exfoliating acids (AHA, BHA or PHA)' },
      { id: 'benzoyl_peroxide', label: 'Benzoyl peroxide' },
      { id: 'none', label: 'Nothing, or only water' },
    ],
  },
  {
    id: 'sunscreen_habit', section: 'safety_habits', short: 'Sunscreen habit', type: 'single', weight: 0,
    prompt: 'How often do you wear sunscreen?',
    options: [
      { id: 'daily', label: 'Daily' },
      { id: 'sometimes', label: 'Sometimes' },
      { id: 'rarely', label: 'Rarely' },
      { id: 'never', label: 'Never' },
    ],
  },
  {
    id: 'restrictions', section: 'safety_habits', short: 'Allergies or ingredients to avoid', type: 'text', weight: 0,
    prompt: 'Any allergies, or ingredients you avoid? (optional)',
    hint: 'For example: "fragrance, peanut oil". Up to 200 characters.',
    options: [],
  },
];

export const QUESTION_BY_ID = new Map(QUESTIONS.map((q) => [q.id, q]));
