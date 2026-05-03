/**
 * Phase 37c — auto-generate the "Goods sold" line that gets pre-filled into
 * the trading-permit and CoA application form summary cards.
 *
 * We don't have a `category` column on products (and don't want one for this
 * phase), so we infer buckets from product names using a small keyword map.
 * For an empty catalogue we fall back to a generic line — never an empty
 * string, because that would leave the form summary card half-blank.
 */

const FALLBACK_DESCRIPTION = 'Groceries, snacks, cold drinks, and household items'

interface Bucket {
  label: string
  /** Lowercase substrings that indicate this bucket. Order doesn't matter. */
  keywords: string[]
}

/**
 * Buckets in the order they should appear in the final phrase. We surface a
 * bucket only when at least one product name matches — keeps the line honest
 * for a shop that, say, doesn't sell tobacco.
 */
const BUCKETS: Bucket[] = [
  {
    label: 'Bread and dairy',
    keywords: ['bread', 'milk', 'cheese', 'butter', 'maas', 'yoghurt', 'yogurt'],
  },
  {
    label: 'Snacks and confectionery',
    keywords: [
      'chips', 'crisps', 'simba', 'lays', 'biscuit', 'cookie', 'sweet', 'chocolate',
      'candy', 'gum', 'lollipop', 'niknak', 'doritos',
    ],
  },
  {
    label: 'Cold drinks',
    keywords: [
      'coke', 'cola', 'fanta', 'sprite', 'pepsi', 'juice', 'water', 'drink',
      'soft drink', 'cooldrink', 'energy drink', 'redbull', 'monster',
    ],
  },
  {
    label: 'Tobacco',
    keywords: ['cigarette', 'tobacco', 'rothmans', 'marlboro', 'stuyvesant'],
  },
  {
    label: 'Cleaning and household',
    keywords: [
      'soap', 'washing', 'detergent', 'bleach', 'cleaner', 'sponge', 'tissue',
      'toilet paper', 'paper towel', 'sanitiser', 'sanitizer',
    ],
  },
  {
    label: 'Toiletries',
    keywords: [
      'toothpaste', 'toothbrush', 'shampoo', 'conditioner', 'lotion', 'deodorant',
      'roll-on', 'roll on',
    ],
  },
  {
    label: 'Tinned and dry groceries',
    keywords: [
      'rice', 'mealie', 'maize', 'flour', 'sugar', 'salt', 'pasta', 'noodles',
      'tin', 'canned', 'beans', 'pilchards', 'tomato sauce',
    ],
  },
  {
    label: 'Airtime and prepaid',
    keywords: ['airtime', 'mtn', 'vodacom', 'cell c', 'telkom', 'prepaid electricity'],
  },
]

/**
 * Build a comma-separated, sentence-cased description of what the shop sells.
 *
 * - Empty product list → fallback
 * - No keyword matches → fallback (we don't want to expose raw product names
 *   on a government form — too noisy and many include weights/units)
 * - Otherwise: join matched bucket labels with commas, replacing the final
 *   comma with " and " so it reads naturally on the form.
 */
export function generateGoodsDescription(productNames: string[]): string {
  if (!productNames || productNames.length === 0) return FALLBACK_DESCRIPTION

  const lowered = productNames.map((n) => n.toLowerCase())
  const matchedLabels: string[] = []

  for (const bucket of BUCKETS) {
    const hits = lowered.some((name) =>
      bucket.keywords.some((kw) => name.includes(kw)),
    )
    if (hits) matchedLabels.push(bucket.label)
  }

  if (matchedLabels.length === 0) return FALLBACK_DESCRIPTION
  if (matchedLabels.length === 1) return matchedLabels[0]
  if (matchedLabels.length === 2) return `${matchedLabels[0]} and ${matchedLabels[1]}`
  const head = matchedLabels.slice(0, -1).join(', ')
  return `${head}, and ${matchedLabels[matchedLabels.length - 1]}`
}
