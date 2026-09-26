// TypeSafe's Jev as the storefront's decision maker.
//
// Jev is a "System One" model: it doesn't generate a document, it answers typed
// questions (choice / yes-no / score) about a state and returns probabilities.
// That fits the rule "the LLM only picks enums" — but it can't emit the
// Decision's lists (sections, product ids). So the work is split:
//
//   Jev    — every style enum, one choice question each: archetype, palette,
//            fonts, radius, density, card, header, hero, listing, product page…
//            plus one yes/no "would they want this?" per product.
//   rules  — sections and product placement (decideWithRules), with Jev's
//            per-product probabilities added to the rule score.
//
// Style fields are asked *independently* of the archetype, so a shopper can get
// an index store in blush with rounded cards if that's what their persona says;
// that is the point (more variety than the four presets). Zodiac is a real
// style signal here, not just a tie-breaker. A field Jev isn't sure about
// (confidence < MIN_CONFIDENCE) falls back to the archetype's preset.
import { choice, noul, TypeSafeClient, type ChoiceQuestion, type JsonValue, type Questions } from "@typesafe-ai/sdk";
import { ARCHETYPE_PRESETS } from "../../shared/archetypes.ts";
import { applyVibe, namedVibe } from "../../shared/vibes.ts";
import { SHOP_CATEGORIES, type ShopCategory } from "../../shared/catalog.ts";
import { namedArchetype, namedScheme, understandByKeywords, type ChatContext, type ChatTurn, type ChatUpdate } from "../../shared/chat.ts";
import { INFERABLE, observations, type BehaviourSummary, type InferableTrait } from "../../shared/infer.ts";
import type { Decision } from "../../shared/decision.ts";
import { INTERESTS, TRAITS, ZODIAC_ELEMENT, type Interest, type Trait } from "../../shared/personas.ts";
import { decideWithRules } from "./rules.ts";
import type { DecisionInput } from "./types.ts";

const MODEL = process.env.SHOP_TYPESAFE_MODEL ?? "jev-latest";
const MIN_CONFIDENCE = Number(process.env.SHOP_TYPESAFE_MIN_CONFIDENCE ?? 0.4);
// How much a sure "yes" (p = 1) moves a product in the rule ranking, and a sure
// "no" the other way. Category affinity from behaviour weighs 3 per unit there.
const PRODUCT_WEIGHT = 4;

export const typesafeEnabled = () => Boolean(process.env.TYPESAFE_API_KEY?.trim());

let client: TypeSafeClient | undefined;
// Lazy: the constructor throws without a key, and the server imports this module either way.
const getClient = () => (client ??= new TypeSafeClient({ defaultModel: MODEL, timeout: 5000, retry: { maxRetries: 1 } }));

const ask = <const C extends Record<string, string>>(instructions: string, criteria: C) =>
  choice(`${instructions} Weigh the whole persona: MBTI, zodiac sign and its element, traits, interests, plus the stated need and behaviour. Zodiac is a real style signal here.`, criteria);

// Criteria describe who each option suits, so Jev maps persona → option.
// Keys are exactly the Decision enums.
const STYLE = {
  archetype: ask("Which kind of store should this shopper walk into?", {
    editorial: "Magazine spread, maker stories, white space. Slow, sentimental, story-driven keepers: introverted feelers, water signs (巨蟹 天蠍 雙魚), 慢活 念舊 感性, reading, tea, ceramics, coffee, scent.",
    collage: "Stickers, collage, marquee, playful. Curious, impulsive, experience-seekers: extroverted intuitives, fire signs (牡羊 獅子 射手), 好奇 衝動 愛冒險, camping, festivals, photography, plants.",
    index: "Spec tables, numbered ledger, no decoration. Analytical comparers who dislike ads: thinkers (xNTJ, xSTJ), air signs (雙子 天秤 水瓶), 理性 重設計, fountain pens, planners, design.",
    deal: "Countdown, big prices, dense grid. Practical, time-pressed, price-driven: ESxx / xSTJ, earth signs (金牛 處女 摩羯), 務實 比價 愛送禮, a budget, many clicks on discounts, an urgent gift.",
  }),
  palette: ask("Which colour palette?", {
    ink: "Black, white and grey with a blue accent. Precise, minimal, cool: thinkers, air signs (雙子 水瓶), design lovers.",
    sand: "Warm off-white and terracotta. Sunny, generous, warm: fire signs (獅子 射手), hosts, gift givers.",
    sage: "Sage green. Calm, natural, grounded: earth signs (金牛 處女), plant lovers, 慢活.",
    blush: "Pink and plum. Soft, romantic, playful: 天秤 雙魚 巨蟹, feelers, the curious and expressive.",
    night: "Charcoal and amber. Bold, intense, nocturnal: 天蠍 摩羯 牡羊, night owls, deal hunters.",
    oat: "Oatmeal and olive, like old paper. Quiet, nostalgic, literary: 巨蟹 雙魚 金牛, readers, 念舊, tea.",
    retro: "Cream and burnt orange, 70s print. Nostalgic, warm, vintage lovers: 金牛 巨蟹, 念舊.",
    y2k: "Lilac and hot pink, Y2K / K-pop. Trendy, playful, social: 雙子 射手 獅子, extroverts.",
    metal: "Steel and cyan. Futuristic, techy, cool: 水瓶 天蠍, thinkers, night owls.",
  }),
  vibe: ask("Which overall vibe should the store have (on top of its layout)?", {
    none: "Clean and unstyled. No strong aesthetic; lets the products speak.",
    retro: "Retro / vintage: 70s–80s print, grain texture, bold serif, warm cream and orange. Nostalgic, sentimental, slow: 念舊 慢活, earth and water signs (金牛 巨蟹), readers, tea and ceramics people.",
    y2k: "Y2K Korean pop: pastel pink-lilac gradients, bubbly rounded type, glossy pills, sparkle. Trendy, social, playful, impulsive: extroverted feelers (ENFP ESFP), 雙子 射手, festivals, photography.",
    scifi: "Sci-fi metal: dark steel, cyan glow, grid lines, futuristic uppercase type, sharp corners. Analytical, techy, design-minded, night owls: xNTx, 水瓶, 理性 重設計, pens and gadgets.",
  }),
  scheme: ask("Light or dark page?", {
    light: "Light page. Daytime, airy, gentle.",
    dark: "Dark page. Night owls (夜貓子), intense or mysterious temperaments (天蠍 摩羯), bold deal hunting.",
  }),
  fonts: ask("Which typefaces?", {
    modern: "Clean geometric sans. Rational, efficient, practical.",
    editorial: "Magazine serif. Cultured, thoughtful, story-loving.",
    friendly: "Rounded, bubbly type. Extroverted, playful, warm: fire signs.",
    literary: "Hand-brushed Chinese (WenKai). Nostalgic, poetic, handmade: water signs, 念舊, calligraphy and tea people.",
    retro: "Bold 70s display serif. Vintage, warm, nostalgic.",
    y2k: "Wide rounded Y2K display. Trendy, playful, K-pop.",
    scifi: "Futuristic geometric display. Techy, sci-fi, cool.",
  }),
  typeScale: ask("How big should headings be?", {
    compact: "Small, information-first. Analytical or hurried shoppers.",
    normal: "Balanced.",
    display: "Huge, expressive headings. Dramatic, expressive, or story-driven shoppers: 獅子 牡羊, feelers.",
  }),
  headingCase: ask("Headings in Latin uppercase?", {
    none: "Normal case. Soft, personal.",
    uppercase: "UPPERCASE labels. Crisp, systematic, urgent.",
  }),
  radius: ask("Corner shape?", {
    sharp: "Square corners. Rigorous, architectural, serious.",
    soft: "Slightly rounded. Neutral, practical.",
    round: "Clearly rounded. Friendly, gentle: water and earth signs.",
    pill: "Fully round pills. Playful, bouncy, youthful: fire and air signs, extroverts.",
  }),
  density: ask("How dense?", {
    tight: "Packed, lots per screen. Comparers and bargain hunters.",
    normal: "Balanced.",
    airy: "Lots of white space, slow pace. Introverts, 慢活, contemplative.",
  }),
  pageWidth: ask("Page width?", {
    narrow: "Narrow column, like a book. Readers, intimate.",
    normal: "Standard.",
    wide: "Full width. Browsers who want to see everything at once.",
  }),
  hoverEffect: ask("How should things react under the pointer?", {
    none: "No motion. Calm, no-nonsense.",
    lift: "Cards lift. Tactile, energetic.",
    scale: "Cards grow. Playful, eager.",
    zoom: "Photo slowly zooms. Visual, lingering.",
  }),
  elevation: ask("Shadows?", {
    flat: "Flat, print-like.",
    soft: "Soft shadows, objects float. Tactile, friendly.",
  }),
  cardVariant: ask("Product card style?", {
    standard: "Quiet photo + name + price.",
    sticker: "Tilted sticker cards. Playful, collage, impulsive.",
    deal: "Big price, discount percent, add-to-cart. Price-driven, practical.",
  }),
  imageRatio: ask("Product photo shape?", {
    portrait: "Tall, editorial.",
    square: "Square, even grid.",
    landscape: "Wide, cinematic scenes. Adventurers, photographers.",
  }),
  cardHover: ask("Card hover behaviour?", {
    none: "Nothing.",
    second_image: "Reveal a second photo. Curious about details.",
    zoom: "Zoom the photo.",
  }),
  cardInfo: ask("Where does the product text sit?", {
    stacked: "Under the photo.",
    row: "One line, name left, price right. Scanners, comparers.",
    overlay: "On top of the photo. Image-first, bold.",
  }),
  cardFrame: ask("Card frame?", {
    bare: "No frame, photo on the page.",
    card: "Framed tile with background.",
  }),
  header: ask("Header style?", {
    centered: "Centered serif masthead, like a magazine.",
    bubbly: "Big playful rounded logo.",
    bar: "Thin functional bar with search.",
    utility: "Utility bar: search, cart, deals up front.",
  }),
  announcement: ask("Announcement strip?", {
    none: "None.",
    free_shipping: "Free shipping threshold. Practical.",
    flash_sale: "Flash sale. Deal hunters.",
    new_arrivals: "New arrivals. Novelty seekers.",
    maker_week: "Maker week. Handmade, story lovers.",
  }),
  heroVariant: ask("Opening (hero) block?", {
    spread: "One huge photo spread with a maker story.",
    collage: "Four products collaged like a scrapbook.",
    ledger: "Numbered text index, no photos. Analytical.",
    flash: "Countdown with three deals.",
    minimal: "One product, lots of space. Quiet, refined.",
  }),
  headline: ask("Opening headline theme?", {
    slow_living: "Slow living.",
    made_by_hand: "Made by hand.",
    new_this_week: "New this week.",
    for_you: "Picked for you.",
    gift_season: "Gifts.",
    deals_now: "Deals right now.",
    last_chance: "Last chance, low stock.",
    the_index: "The index / catalogue.",
    weekend_adventure: "Weekend adventure.",
  }),
  listingLayout: ask("Category page layout?", {
    grid: "Even grid.",
    carousel: "Swipeable rows.",
    editorial: "Magazine layout, few big items.",
    table: "Spec table.",
    bento: "Mosaic of mixed tile sizes.",
    dense: "Packed price grid.",
  }),
  filters: ask("Filters on the category page?", {
    sidebar: "Full sidebar of filters. Comparers.",
    topbar: "Quick chips on top.",
    none: "No filters, just browse.",
  }),
  gallery: ask("Product page photos?", {
    stack: "Tall stacked photos to scroll through.",
    carousel: "Swipeable carousel.",
    grid: "Photo grid, see everything at once.",
  }),
  productInfo: ask("Product page emphasis?", {
    story: "The maker's story.",
    specs: "Specs and comparison.",
    buybox: "Price, stock and buy button up front.",
  }),
} satisfies Questions;

type StyleKey = keyof typeof STYLE;
type Answers = { [K in StyleKey]: (typeof STYLE)[K] extends ChoiceQuestion<infer C> ? keyof C & string : never };

function renderState(i: DecisionInput): { [key: string]: JsonValue } {
  const { persona, ...prefs } = i.user.prefs;
  const byId = new Map(i.products.map((p) => [p.id, p]));
  const names = (ids: string[]) => ids.map((id) => byId.get(id)).filter(Boolean).map((p) => `${p!.name}(${p!.category})`);
  return {
    persona: { ...persona, zodiac_element: persona.zodiac ? ZODIAC_ELEMENT[persona.zodiac] : null },
    need: prefs.need || null,
    budget: prefs.budget,
    preferred_categories: prefs.categories,
    behaviour: { ...i.profile, affinity: { ...i.profile.affinity } },
    recently_engaged: names(i.recentIds),
    cart: names(i.cartIds),
  };
}

export async function decideWithTypeSafe(input: DecisionInput): Promise<Decision> {
  const { prefs } = input.user;
  const inStock = input.products.filter((p) => p.stock > 0);

  const questions: Questions = { ...STYLE };
  // Fixed by the shopper → don't ask.
  if (prefs.archetype !== "auto") delete questions.archetype;
  if (prefs.scheme !== "auto") delete questions.scheme;
  if (prefs.vibe && prefs.vibe !== "auto") delete questions.vibe;
  for (const p of inStock) {
    questions[`want_${p.id}`] = noul({
      question: "Would this shopper want to see this product near the top of the shop?",
      product: { name: p.name, maker: p.maker, category: p.category, price: p.price, tags: p.tags },
    });
  }

  const res = await getClient().systemOne({ state: renderState(input), questions });
  const a = res.answers;

  // Confident answers only; otherwise the archetype preset decides that field.
  const pick = <K extends StyleKey>(k: K): Answers[K] | undefined => {
    const r = a[k];
    return r?.type === "choice" && r.confidence >= MIN_CONFIDENCE ? (r.choice as Answers[K]) : undefined;
  };

  const archetype = prefs.archetype !== "auto" ? prefs.archetype : pick("archetype");
  const productBoost = new Map<string, number>();
  for (const p of inStock) {
    const r = a[`want_${p.id}`];
    if (r?.type === "noul") productBoost.set(p.id, (r.noul - 0.5) * PRODUCT_WEIGHT);
  }

  // Rules build the page (sections, products, badges, signals) around Jev's
  // archetype and hero; then Jev's style answers go on top.
  const base = decideWithRules(input, { archetype, heroVariant: pick("heroVariant"), productBoost });
  const preset = ARCHETYPE_PRESETS[base.archetype];
  const or = <T>(v: T | undefined, fallback: T) => v ?? fallback;
  const gift = /禮|送/.test(prefs.need);

  return {
    ...base,
    // A vibe pins palette / fonts / shape (shared/vibes.ts); the rest stays Jev's.
    theme: applyVibe({
      vibe: prefs.vibe && prefs.vibe !== "auto" ? prefs.vibe : or(pick("vibe"), base.theme.vibe),
      palette: or(pick("palette"), preset.theme.palette),
      // The shopper's explicit scheme was already applied by the rules.
      scheme: prefs.scheme !== "auto" ? prefs.scheme : or(pick("scheme"), base.theme.scheme),
      fonts: or(pick("fonts"), preset.theme.fonts),
      typeScale: or(pick("typeScale"), preset.theme.typeScale),
      headingCase: or(pick("headingCase"), preset.theme.headingCase),
      radius: or(pick("radius"), preset.theme.radius),
      density: or(pick("density"), preset.theme.density),
      pageWidth: or(pick("pageWidth"), preset.theme.pageWidth),
      hoverEffect: or(pick("hoverEffect"), preset.theme.hoverEffect),
      elevation: or(pick("elevation"), preset.theme.elevation),
    }, prefs.scheme),
    card: {
      ...base.card,
      variant: or(pick("cardVariant"), preset.card.variant),
      imageRatio: or(pick("imageRatio"), preset.card.imageRatio),
      hover: or(pick("cardHover"), preset.card.hover),
      info: or(pick("cardInfo"), preset.card.info),
      frame: or(pick("cardFrame"), preset.card.frame),
    },
    header: {
      variant: or(pick("header"), preset.header.variant),
      announcement: or(pick("announcement"), preset.header.announcement),
    },
    hero: {
      ...base.hero,
      // A stated gift need always opens on gifts (same rule as the rule engine).
      headline: gift ? "gift_season" : or(pick("headline"), preset.hero.headline),
    },
    listing: { layout: or(pick("listingLayout"), preset.listing.layout), filters: or(pick("filters"), preset.listing.filters) },
    product: { gallery: or(pick("gallery"), preset.product.gallery), info: or(pick("productInfo"), preset.product.info) },
  };
}

// ---- chat: what the shopper just said → ChatUpdate ---------------------------
//
// Jev reads; it can't reply (the frontend answers from copy.ts, or Claude does
// when ANTHROPIC_API_KEY is set). Budget, MBTI and zodiac are literal in the
// text, so the keyword reader takes those; Jev takes everything that needs judgement.

const YES = 0.7;

// Jev reads the bare Chinese labels poorly (「累、想放鬆」→ 慢活 0.33); with a
// gloss it's 0.92. Same for categories: name what's in them.
const TRAIT_GLOSS: Record<Trait, string> = {
  內向: "introverted, prefers quiet", 外向: "extroverted, social", 感性: "sentimental, emotional", 理性: "rational, analytical",
  慢活: "slow-living: wants to relax, unwind, take it slow", 衝動: "impulsive", 好奇: "curious: wants something new or surprising",
  務實: "practical: cares about usefulness and durability", 比價: "price-conscious: compares prices, wants cheap or discounted",
  念舊: "nostalgic, likes vintage", 愛冒險: "adventurous, outdoorsy", 夜貓子: "a night owl: up or shopping late at night",
  重設計: "design-minded, cares about aesthetics", 愛送禮: "a gift giver",
};
const INTEREST_GLOSS: Record<Interest, string> = {
  閱讀: "reading", 手沖咖啡: "pour-over coffee", 茶: "tea", 陶藝: "ceramics", 香氛: "scent, candles", 植物: "plants",
  露營: "camping", 攝影: "photography", 音樂祭: "music festivals", 鋼筆: "fountain pens", 手帳: "planners, journaling",
  設計: "design", 烹飪: "cooking", 通勤: "commuting", 送禮: "giving gifts",
};
const CATEGORY_GLOSS: Record<ShopCategory, string> = {
  table: "tableware: cups, plates, boards, carafes", brew: "coffee & tea: beans, tea leaves, brewing gear",
  scent: "scent & care: candles, essential oils, hand cream", paper: "paper goods: notebooks, fountain pens, postcards",
  home: "home: vases, plants, lamps, textiles", carry: "everyday carry: bags, card holders, glasses, insulated bottles",
};

export async function understandWithTypeSafe(ctx: ChatContext, history: ChatTurn[], text: string): Promise<ChatUpdate> {
  const questions: Questions = {
    need: noul("Does the latest message state a concrete shopping need (something to find, buy or give)?"),
    scheme: choice("Does the shopper ask for a lighter or darker page?", {
      keep: "No, or not mentioned.", light: "Wants it lighter / brighter.", dark: "Wants it darker, or says it's too bright / it's late at night.",
    }),
    archetype: choice("Does the latest message ask for a different way of shopping than the current store?", {
      keep: "No clear request; keep the current store.",
      editorial: "Wants to slow down, read stories, browse beautiful things.",
      collage: "Wants fun, surprises, something new and playful.",
      index: "Wants to compare specs, details and facts.",
      deal: "Wants the cheapest, deals, quick and practical.",
    }),
  };
  for (const t of TRAITS) questions[`trait_${t}`] = noul(`Does the latest message suggest the shopper is ${TRAIT_GLOSS[t]}?`);
  for (const i of INTERESTS) questions[`interest_${i}`] = noul(`Does the latest message show an interest in ${INTEREST_GLOSS[i]}?`);
  for (const c of SHOP_CATEGORIES) questions[`cat_${c}`] = noul(`Is the latest message asking for products in this category: ${CATEGORY_GLOSS[c]}?`);

  const res = await getClient().systemOne({
    state: {
      latest_message: text,
      conversation: history.slice(-6).map((t) => `${t.role}: ${t.text}`),
      current_store: ctx.archetype,
      shopper: { ...ctx.prefs, persona: { ...ctx.prefs.persona } },
      recently_engaged: ctx.recent,
      cart: ctx.cart,
    },
    questions,
  });
  const a = res.answers;
  const yes = (k: string) => { const r = a[k]; return r?.type === "noul" && r.noul >= YES; };
  const sure = (k: string) => { const r = a[k]; return r?.type === "choice" && r.confidence >= 0.6 ? r.choice : "keep"; };
  const kw = understandByKeywords(text);
  return {
    traitsAdd: TRAITS.filter((t) => yes(`trait_${t}`)),
    interestsAdd: INTERESTS.filter((i) => yes(`interest_${i}`)),
    categories: SHOP_CATEGORIES.filter((c) => yes(`cat_${c}`)),
    budget: kw.budget,
    need: yes("need") ? text.slice(0, 60) : "",
    // A look asked for by name ("雜誌風一點") is taken literally; Jev judges the rest.
    scheme: namedScheme(text) ?? (sure("scheme") as ChatUpdate["scheme"]),
    archetype: namedArchetype(text) ?? (sure("archetype") as ChatUpdate["archetype"]),
    vibe: namedVibe(text) ?? "keep",
    mbti: kw.mbti,
    zodiac: kw.zodiac,
  };
}

// ---- behaviour → traits ---------------------------------------------------------
// One yes/no per trait browsing can show (shared/infer.ts INFERABLE), with the
// same glosses as chat. The caller applies thresholds and the shopper's own
// statements / rejections (applyInferred).
// What each trait looks like in clicks. Spelling out yes/no evidence cut Jev's
// bias sharply (重設計 for a gift browser: 0.53 → 0.23; 比價 for an all-on-sale
// browser: 0.53 → 0.68).
const TRAIT_EVIDENCE: Record<InferableTrait, { true: string; false: string }> = {
  慢活: { true: "Browses slowly and calmly; drawn to calming, relaxing, handmade things.", false: "Fast-paced or task-driven browsing." },
  衝動: { true: "Adds things to the cart soon after first seeing them; quick decisions.", false: "Looks around a lot before adding anything, or adds nothing." },
  好奇: { true: "Wanders across many different categories and new things.", false: "Stays within one or two categories." },
  務實: { true: "Focuses on everyday, practical, durable items.", false: "Focuses on decorative, premium or giftable items." },
  比價: { true: "Mostly looks at or buys discounted / on-sale items, or sticks to cheap ones.", false: "Pays little attention to discounts; views full-price items." },
  念舊: { true: "Drawn to handmade, traditional, crafted items.", false: "Drawn to modern, new or mass-made items." },
  愛冒險: { true: "Looks at outdoor, travel and everyday-carry gear.", false: "Looks at home, table and indoor things." },
  夜貓子: { true: "Shopping late at night (23:00–04:00).", false: "Shopping during the day or evening." },
  重設計: { true: "Gravitates to premium or minimalist design pieces, or well above-median prices, not driven by discounts.", false: "Browsing is driven by other things: price, gifts, practicality, relaxing." },
  愛送禮: { true: "Mostly engages with giftable items, or several items for other people.", false: "Mostly buys for themself." },
};

export async function inferTraitsWithTypeSafe(summary: BehaviourSummary): Promise<Partial<Record<Trait, number>>> {
  const questions: Questions = {};
  for (const t of INFERABLE) {
    questions[t] = noul(`Is this shopper ${TRAIT_GLOSS[t]}, judging from their browsing?`, TRAIT_EVIDENCE[t]);
  }
  const res = await getClient().systemOne({ state: { shopper_behaviour: observations(summary) }, questions });
  const out: Partial<Record<Trait, number>> = {};
  for (const t of INFERABLE) {
    const r = res.answers[t];
    if (r?.type === "noul") out[t] = r.noul;
  }
  return out;
}
