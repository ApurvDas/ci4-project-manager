import type {
  Category,
  Comment,
  Recipe,
  ShoppingListItem,
  Tag,
  UserSummary,
} from "@/lib/types";
import { hueFromString } from "../lib/placeholder";

/*
 * Mock dataset for Phase 2. Shapes match src/lib/types so pages built against
 * this swap cleanly onto Prisma in Phase 4. Kept compact: a handful of source
 * recipes expanded into a browsable catalog.
 */

export const categories: Category[] = [
  { id: "c1", name: "Breakfast", slug: "breakfast" },
  { id: "c2", name: "Mains", slug: "mains" },
  { id: "c3", name: "Salads", slug: "salads" },
  { id: "c4", name: "Soups", slug: "soups" },
  { id: "c5", name: "Desserts", slug: "desserts" },
  { id: "c6", name: "Baking", slug: "baking" },
  { id: "c7", name: "Drinks", slug: "drinks" },
  { id: "c8", name: "Sides", slug: "sides" },
];

export const tags: Tag[] = [
  { id: "t1", name: "Vegetarian", slug: "vegetarian", group: "Diet" },
  { id: "t2", name: "Vegan", slug: "vegan", group: "Diet" },
  { id: "t3", name: "Gluten-Free", slug: "gluten-free", group: "Diet" },
  { id: "t4", name: "Dairy-Free", slug: "dairy-free", group: "Diet" },
  { id: "t5", name: "High-Protein", slug: "high-protein", group: "Diet" },
  { id: "t6", name: "Breakfast", slug: "meal-breakfast", group: "Meal Type" },
  { id: "t7", name: "Lunch", slug: "meal-lunch", group: "Meal Type" },
  { id: "t8", name: "Dinner", slug: "meal-dinner", group: "Meal Type" },
  { id: "t9", name: "Snack", slug: "meal-snack", group: "Meal Type" },
  { id: "t10", name: "Dessert", slug: "meal-dessert", group: "Meal Type" },
  { id: "t11", name: "Italian", slug: "italian", group: "Cuisine" },
  { id: "t12", name: "Mexican", slug: "mexican", group: "Cuisine" },
  { id: "t13", name: "Japanese", slug: "japanese", group: "Cuisine" },
  { id: "t14", name: "Indian", slug: "indian", group: "Cuisine" },
  { id: "t15", name: "Mediterranean", slug: "mediterranean", group: "Cuisine" },
  { id: "t16", name: "American", slug: "american", group: "Cuisine" },
];

const tagBySlug = Object.fromEntries(tags.map((t) => [t.slug, t]));
const catBySlug = Object.fromEntries(categories.map((c) => [c.slug, c]));

export const users: UserSummary[] = [
  {
    id: "u1",
    name: "Mara Okonkwo",
    username: "mara",
    image: null,
    bio: "Weeknight cooking, big flavors, minimal fuss.",
  },
  {
    id: "u2",
    name: "Tomás Rivera",
    username: "tomas",
    image: null,
    bio: "Baker by night. Sourdough evangelist.",
  },
  {
    id: "u3",
    name: "Aiko Tanaka",
    username: "aiko",
    image: null,
    bio: "Japanese home cooking and tidy little bento.",
  },
  {
    id: "u4",
    name: "Priya Nair",
    username: "priya",
    image: null,
    bio: "Spice-forward, mostly plants.",
  },
];

const userById = Object.fromEntries(users.map((u) => [u.id, u]));

/** The signed-in demo user for Phase 2 (before real auth exists). */
export const currentUser = users[0];

interface RecipeSeed {
  title: string;
  authorId: string;
  category: string;
  tags: string[];
  description: string;
  servings: number;
  prep: number;
  cook: number;
  difficulty: Recipe["difficulty"];
  ingredients: [string, number, string | null, string | null][];
  steps: string[];
  avgRating: number;
  ratingCount: number;
  commentCount: number;
  daysAgo: number;
}

const seeds: RecipeSeed[] = [
  {
    title: "Miso Butter Mushroom Toast",
    authorId: "u3",
    category: "breakfast",
    tags: ["vegetarian", "meal-breakfast", "japanese"],
    description:
      "Umami-heavy mushrooms folded through miso butter, piled on charred sourdough.",
    servings: 2,
    prep: 10,
    cook: 12,
    difficulty: "EASY",
    ingredients: [
      ["mixed mushrooms", 300, "g", "torn"],
      ["white miso", 1, "tbsp", null],
      ["butter", 2, "tbsp", "softened"],
      ["sourdough", 2, "slices", "thick-cut"],
      ["chives", 2, "tbsp", "sliced"],
    ],
    steps: [
      "Mash the miso into the softened butter.",
      "Sear mushrooms in a hot dry pan until golden, 6–8 min.",
      "Lower heat, add miso butter, toss to coat.",
      "Toast sourdough, pile on mushrooms, finish with chives.",
    ],
    avgRating: 4.7,
    ratingCount: 34,
    commentCount: 5,
    daysAgo: 2,
  },
  {
    title: "Charred Corn & Black Bean Tacos",
    authorId: "u1",
    category: "mains",
    tags: ["vegan", "gluten-free", "meal-dinner", "mexican"],
    description:
      "Blistered corn, smoky black beans, and a bright lime crema you'd never guess is dairy-free.",
    servings: 4,
    prep: 15,
    cook: 15,
    difficulty: "EASY",
    ingredients: [
      ["corn kernels", 3, "cups", "fresh or frozen"],
      ["black beans", 1, "can", "drained"],
      ["corn tortillas", 8, null, null],
      ["lime", 2, null, "juiced"],
      ["cashew cream", 0.5, "cup", null],
      ["smoked paprika", 1, "tsp", null],
    ],
    steps: [
      "Char corn in a dry cast-iron pan until spotty.",
      "Warm beans with smoked paprika and a pinch of salt.",
      "Whisk lime juice into cashew cream.",
      "Fill warm tortillas; drizzle with lime crema.",
    ],
    avgRating: 4.9,
    ratingCount: 61,
    commentCount: 9,
    daysAgo: 1,
  },
  {
    title: "Weeknight Red Lentil Dal",
    authorId: "u4",
    category: "mains",
    tags: ["vegan", "gluten-free", "high-protein", "meal-dinner", "indian"],
    description:
      "A 30-minute dal that tastes like it simmered all afternoon. Freezer-friendly.",
    servings: 4,
    prep: 10,
    cook: 25,
    difficulty: "EASY",
    ingredients: [
      ["red lentils", 1.5, "cups", "rinsed"],
      ["onion", 1, null, "diced"],
      ["garlic", 3, "cloves", "minced"],
      ["ginger", 1, "tbsp", "grated"],
      ["coconut milk", 1, "can", null],
      ["garam masala", 2, "tsp", null],
      ["spinach", 2, "cups", null],
    ],
    steps: [
      "Sweat onion, garlic, and ginger until soft.",
      "Add garam masala; bloom 30 seconds.",
      "Add lentils, coconut milk, and 2 cups water; simmer 20 min.",
      "Stir through spinach until wilted; season.",
    ],
    avgRating: 4.8,
    ratingCount: 88,
    commentCount: 12,
    daysAgo: 4,
  },
  {
    title: "Slow-Roasted Tomato Orzo",
    authorId: "u1",
    category: "mains",
    tags: ["vegetarian", "meal-dinner", "italian", "mediterranean"],
    description:
      "Jammy roasted tomatoes stirred through creamy orzo with torn basil.",
    servings: 4,
    prep: 10,
    cook: 40,
    difficulty: "MEDIUM",
    ingredients: [
      ["cherry tomatoes", 500, "g", null],
      ["orzo", 1.5, "cups", null],
      ["garlic", 4, "cloves", null],
      ["olive oil", 3, "tbsp", null],
      ["parmesan", 0.5, "cup", "grated"],
      ["basil", 1, "handful", "torn"],
    ],
    steps: [
      "Roast tomatoes and garlic in olive oil at 200°C for 35 min.",
      "Cook orzo until al dente; reserve a little pasta water.",
      "Crush roasted tomatoes; fold through orzo with parmesan.",
      "Loosen with pasta water; finish with basil.",
    ],
    avgRating: 4.6,
    ratingCount: 42,
    commentCount: 4,
    daysAgo: 6,
  },
  {
    title: "Crunchy Sesame Slaw",
    authorId: "u3",
    category: "salads",
    tags: ["vegan", "dairy-free", "meal-lunch", "japanese"],
    description: "Cabbage, carrot, and toasted sesame in a snappy rice-vinegar dressing.",
    servings: 6,
    prep: 20,
    cook: 0,
    difficulty: "EASY",
    ingredients: [
      ["napa cabbage", 0.5, "head", "shredded"],
      ["carrot", 2, null, "julienned"],
      ["rice vinegar", 3, "tbsp", null],
      ["sesame oil", 1, "tbsp", null],
      ["sesame seeds", 2, "tbsp", "toasted"],
    ],
    steps: [
      "Toss cabbage and carrot in a large bowl.",
      "Whisk vinegar and sesame oil with a pinch of sugar.",
      "Dress the slaw; rest 10 minutes.",
      "Top with toasted sesame before serving.",
    ],
    avgRating: 4.5,
    ratingCount: 27,
    commentCount: 2,
    daysAgo: 9,
  },
  {
    title: "Roasted Cauliflower & Chickpea Bowl",
    authorId: "u4",
    category: "mains",
    tags: ["vegan", "gluten-free", "high-protein", "meal-lunch", "mediterranean"],
    description: "Spiced cauliflower and crispy chickpeas over lemony grains.",
    servings: 4,
    prep: 15,
    cook: 30,
    difficulty: "EASY",
    ingredients: [
      ["cauliflower", 1, "head", "florets"],
      ["chickpeas", 1, "can", "drained"],
      ["cumin", 2, "tsp", null],
      ["tahini", 3, "tbsp", null],
      ["lemon", 1, null, "juiced"],
      ["couscous", 1.5, "cups", null],
    ],
    steps: [
      "Toss cauliflower and chickpeas with cumin and oil; roast 25 min.",
      "Cook couscous; fluff with lemon juice.",
      "Whisk tahini with water and lemon to a drizzle.",
      "Build bowls; drizzle with tahini sauce.",
    ],
    avgRating: 4.7,
    ratingCount: 53,
    commentCount: 7,
    daysAgo: 11,
  },
  {
    title: "Silky Roasted Carrot Soup",
    authorId: "u1",
    category: "soups",
    tags: ["vegan", "gluten-free", "dairy-free", "meal-lunch"],
    description: "Roasted carrots blended with ginger and coconut into a velvet bowl.",
    servings: 4,
    prep: 10,
    cook: 35,
    difficulty: "EASY",
    ingredients: [
      ["carrots", 800, "g", "chopped"],
      ["onion", 1, null, null],
      ["ginger", 1, "tbsp", "grated"],
      ["coconut milk", 0.5, "can", null],
      ["vegetable stock", 3, "cups", null],
    ],
    steps: [
      "Roast carrots and onion until caramelized, 30 min.",
      "Simmer with stock and ginger 10 min.",
      "Blend smooth; stir in coconut milk.",
      "Season and swirl to serve.",
    ],
    avgRating: 4.4,
    ratingCount: 19,
    commentCount: 1,
    daysAgo: 14,
  },
  {
    title: "Brown Butter Chocolate Chip Cookies",
    authorId: "u2",
    category: "desserts",
    tags: ["vegetarian", "meal-dessert", "american"],
    description: "Nutty brown butter, crisp edges, molten centers. The house standard.",
    servings: 24,
    prep: 20,
    cook: 12,
    difficulty: "MEDIUM",
    ingredients: [
      ["butter", 1, "cup", "browned"],
      ["brown sugar", 1, "cup", null],
      ["flour", 2.25, "cups", null],
      ["eggs", 2, null, null],
      ["dark chocolate", 300, "g", "chopped"],
      ["flaky salt", 1, "tsp", null],
    ],
    steps: [
      "Brown the butter; cool slightly.",
      "Whisk with sugars, then eggs.",
      "Fold in flour and chocolate.",
      "Chill 1 hr; bake at 180°C for 11–12 min; salt while warm.",
    ],
    avgRating: 4.9,
    ratingCount: 140,
    commentCount: 21,
    daysAgo: 3,
  },
  {
    title: "No-Knead Country Loaf",
    authorId: "u2",
    category: "baking",
    tags: ["vegan", "meal-snack"],
    description: "A blistered, open-crumb loaf from four ingredients and patience.",
    servings: 12,
    prep: 20,
    cook: 45,
    difficulty: "HARD",
    ingredients: [
      ["bread flour", 500, "g", null],
      ["water", 375, "ml", "lukewarm"],
      ["salt", 10, "g", null],
      ["instant yeast", 1, "g", null],
    ],
    steps: [
      "Mix everything to a shaggy dough; cover.",
      "Rest 12–18 hrs until bubbly.",
      "Shape; proof 1 hr.",
      "Bake in a preheated Dutch oven at 240°C, 30 min covered, 15 uncovered.",
    ],
    avgRating: 4.8,
    ratingCount: 76,
    commentCount: 15,
    daysAgo: 7,
  },
  {
    title: "Iced Matcha Oat Latte",
    authorId: "u3",
    category: "drinks",
    tags: ["vegan", "dairy-free", "meal-snack", "japanese"],
    description: "Bright ceremonial matcha over oat milk and ice. Two minutes flat.",
    servings: 1,
    prep: 5,
    cook: 0,
    difficulty: "EASY",
    ingredients: [
      ["matcha", 1, "tsp", "sifted"],
      ["hot water", 60, "ml", null],
      ["oat milk", 200, "ml", null],
      ["maple syrup", 1, "tsp", null],
    ],
    steps: [
      "Whisk matcha with hot water until frothy.",
      "Fill a glass with ice and oat milk.",
      "Stir in maple syrup.",
      "Pour matcha over the top.",
    ],
    avgRating: 4.3,
    ratingCount: 22,
    commentCount: 3,
    daysAgo: 5,
  },
  {
    title: "Herby Smashed Potatoes",
    authorId: "u1",
    category: "sides",
    tags: ["vegetarian", "gluten-free", "meal-dinner"],
    description: "Boiled, smashed, and roasted till shattering-crisp, showered in herbs.",
    servings: 4,
    prep: 10,
    cook: 40,
    difficulty: "EASY",
    ingredients: [
      ["baby potatoes", 800, "g", null],
      ["olive oil", 4, "tbsp", null],
      ["rosemary", 2, "sprigs", "chopped"],
      ["parmesan", 0.25, "cup", "grated"],
    ],
    steps: [
      "Boil potatoes until fork-tender.",
      "Smash on an oiled tray.",
      "Drizzle with oil and rosemary; roast 30 min at 220°C.",
      "Shower with parmesan.",
    ],
    avgRating: 4.6,
    ratingCount: 38,
    commentCount: 4,
    daysAgo: 13,
  },
  {
    title: "Shakshuka for Two",
    authorId: "u4",
    category: "breakfast",
    tags: ["vegetarian", "gluten-free", "meal-breakfast", "mediterranean"],
    description: "Eggs poached in a smoky pepper-tomato sauce. Bread mandatory.",
    servings: 2,
    prep: 10,
    cook: 20,
    difficulty: "EASY",
    ingredients: [
      ["red pepper", 1, null, "sliced"],
      ["tomatoes", 1, "can", "crushed"],
      ["eggs", 4, null, null],
      ["cumin", 1, "tsp", null],
      ["feta", 60, "g", "crumbled"],
    ],
    steps: [
      "Soften pepper; add cumin.",
      "Pour in tomatoes; simmer 8 min.",
      "Make wells; crack in eggs; cover until set.",
      "Scatter feta; serve from the pan.",
    ],
    avgRating: 4.7,
    ratingCount: 49,
    commentCount: 6,
    daysAgo: 8,
  },
];

function slugify(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

// Slugs that ship with a curated photo in public/images/recipes/<slug>.jpg
// (Unsplash-licensed stock). Anything not listed falls back to the generated
// gradient placeholder, so a photo-less recipe never shows a broken image.
const slugsWithPhoto = new Set([
  "miso-butter-mushroom-toast",
  "charred-corn-black-bean-tacos",
  "weeknight-red-lentil-dal",
  "slow-roasted-tomato-orzo",
  "crunchy-sesame-slaw",
  "roasted-cauliflower-chickpea-bowl",
  "silky-roasted-carrot-soup",
  "brown-butter-chocolate-chip-cookies",
  "no-knead-country-loaf",
  "iced-matcha-oat-latte",
  "herby-smashed-potatoes",
  "shakshuka-for-two",
]);

export const recipes: Recipe[] = seeds.map((s, i) => {
  const slug = slugify(s.title);
  return {
    id: `r${i + 1}`,
    slug,
    title: s.title,
    description: s.description,
    author: userById[s.authorId],
    servings: s.servings,
    prepTimeMins: s.prep,
    cookTimeMins: s.cook,
    difficulty: s.difficulty,
    imageUrl: slugsWithPhoto.has(slug) ? `/images/recipes/${slug}.jpg` : null,
    imageHue: hueFromString(slug),
    category: catBySlug[s.category],
    tags: s.tags.map((t) => tagBySlug[t]).filter(Boolean),
    ingredients: s.ingredients.map(([name, quantity, unit, notes], j) => ({
      id: `r${i + 1}-i${j}`,
      name,
      quantity,
      unit,
      notes,
    })),
    steps: s.steps.map((instruction, j) => ({
      stepNumber: j + 1,
      instruction,
    })),
    avgRating: s.avgRating,
    ratingCount: s.ratingCount,
    commentCount: s.commentCount,
    createdAt: new Date(
      Date.now() - s.daysAgo * 24 * 60 * 60 * 1000,
    ).toISOString(),
  };
});

export const commentsByRecipeSlug: Record<string, Comment[]> = {
  "charred-corn-black-bean-tacos": [
    {
      id: "cm1",
      author: userById.u3,
      body: "The lime crema is unreal. Made a double batch.",
      createdAt: new Date(Date.now() - 20 * 3600 * 1000).toISOString(),
    },
    {
      id: "cm2",
      author: userById.u2,
      body: "Charring the corn in cast iron is the move.",
      createdAt: new Date(Date.now() - 5 * 3600 * 1000).toISOString(),
    },
  ],
  "brown-butter-chocolate-chip-cookies": [
    {
      id: "cm3",
      author: userById.u1,
      body: "Chilling the dough overnight was worth the wait.",
      createdAt: new Date(Date.now() - 40 * 3600 * 1000).toISOString(),
    },
  ],
};

/** Demo shopping list for the current user (Phase 2). */
export const shoppingList: ShoppingListItem[] = [
  {
    id: "sl1",
    name: "red lentils",
    quantity: 1.5,
    unit: "cups",
    checked: false,
    recipeSlug: "weeknight-red-lentil-dal",
    recipeTitle: "Weeknight Red Lentil Dal",
  },
  {
    id: "sl2",
    name: "coconut milk",
    quantity: 1,
    unit: "can",
    checked: false,
    recipeSlug: "weeknight-red-lentil-dal",
    recipeTitle: "Weeknight Red Lentil Dal",
  },
  {
    id: "sl3",
    name: "corn tortillas",
    quantity: 8,
    unit: null,
    checked: true,
    recipeSlug: "charred-corn-black-bean-tacos",
    recipeTitle: "Charred Corn & Black Bean Tacos",
  },
];

/** Who the current user follows (Phase 2). */
export const followingIds = new Set<string>(["u3", "u4"]);
