import type { Category, Edition, Network, Nft, Review, Wallet } from '@/api/contracts'
import { CATEGORIES } from '@/api/contracts'
import { mulEth, percentOf } from '@/lib/money'

/** PRNG determinístico (mulberry32) para fixtures reproduzíveis. */
export function seeded(seed: number) {
  let a = seed >>> 0
  return () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

type Art = 'emerald-ape' | 'sage-nomad' | 'neon-vessel' | 'golden-beat'
const ART: Record<Art, string> = {
  'emerald-ape': '/img/art/emerald-ape.webp',
  'sage-nomad': '/img/art/sage-nomad.webp',
  'neon-vessel': '/img/art/neon-vessel.webp',
  'golden-beat': '/img/art/golden-beat.webp',
}

/** Os nove NFTs exibidos no Figma, com as artes SVG originais do pacote como cartão secundário. */
const FIGMA: { name: string; price: string; oldPrice?: string; category: Category; network: Network; art: Art; svg: string; rare?: boolean }[] = [
  { name: 'Emerald Ape #042', price: '1.19', category: 'Arte digital', network: 'Ethereum', art: 'emerald-ape', svg: 'emerald-ape' },
  { name: 'Sage Nomad #009', price: '1.69', category: 'Fotografia', network: 'Polygon', art: 'sage-nomad', svg: 'sage-nomad' },
  { name: 'Neon Vessel #552', price: '1.99', oldPrice: '2.29', category: 'Música', network: 'Solana', art: 'neon-vessel', svg: 'neon-vessel', rare: true },
  { name: 'Cosmic Bloom #118', price: '1.29', category: 'Arte 3D', network: 'Ethereum', art: 'sage-nomad', svg: 'cosmic-bloom' },
  { name: 'Violet Nomad #314', price: '1.39', category: 'Generativa', network: 'Polygon', art: 'sage-nomad', svg: 'violet-nomad' },
  { name: 'Ivory Baron #088', price: '1.79', category: 'Colecionáveis', network: 'Ethereum', art: 'neon-vessel', svg: 'ivory-baron' },
  { name: 'Golden Beat #207', price: '0.99', category: 'Jogos', network: 'Solana', art: 'golden-beat', svg: 'golden-beat' },
  { name: 'Golden Frequency #071', price: '0.59', category: 'Assinaturas', network: 'Ethereum', art: 'golden-beat', svg: 'golden-frequency' },
  { name: 'Golden Signal #160', price: '0.39', category: 'Utilidade', network: 'Polygon', art: 'golden-beat', svg: 'golden-signal' },
]

const ADJ = ['Amber', 'Copper', 'Velvet', 'Lunar', 'Rustic', 'Crimson', 'Silent', 'Hollow', 'Jade', 'Obsidian', 'Saffron', 'Cobalt']
const NOUN = ['Monk', 'Drifter', 'Oracle', 'Pilot', 'Warden', 'Echo', 'Harbor', 'Sentinel', 'Mirage', 'Voyager', 'Herald', 'Relic']
const CREATORS = ['Nova Sato', 'Lia Moraes', 'Kenji Arcos', 'Dara Quinn', 'Rui Valença']
const ARTS: Art[] = ['emerald-ape', 'sage-nomad', 'neon-vessel', 'golden-beat']
const SVGS = ['emerald-ape', 'sage-nomad', 'neon-vessel', 'cosmic-bloom', 'violet-nomad', 'ivory-baron', 'golden-beat', 'golden-frequency', 'golden-signal']
const ATTRS: Record<Art, string[]> = {
  'emerald-ape': ['Óculos', 'Esmeralda', 'Jaqueta college'],
  'sage-nomad': ['Chapéu bucket', 'Moletom', 'Sereno'],
  'neon-vessel': ['Blazer', 'Gola alta', 'Brinco'],
  'golden-beat': ['Fones', 'Pelagem dourada', 'Jaqueta bomber'],
}

function editionsFor(price: string, rand: () => number, soldOut = false): Edition[] {
  const avail = (supply: number) => (soldOut ? 0 : Math.max(1, Math.round(supply * (0.2 + rand() * 0.6))))
  return [
    { id: '1-1', label: '1/1', price: mulEth(price, 6), supply: 1, available: soldOut ? 0 : rand() > 0.5 ? 1 : 0 },
    { id: '1-10', label: '1/10', price: mulEth(price, 2), supply: 10, available: avail(10) },
    { id: '1-50', label: '1/50', price, supply: 50, available: avail(50) },
    { id: 'open', label: 'ABERTA', price: percentOf(price, 50), supply: 500, available: soldOut ? 0 : 500 },
  ]
}

export function buildNfts(): Nft[] {
  const rand = seeded(42)
  const base = new Date('2026-09-30T12:00:00Z').getTime()
  const list: Nft[] = []
  const push = (i: number, d: { name: string; price: string; oldPrice?: string; category: Category; network: Network; art: Art; svg: string; rare?: boolean; soldOut?: boolean }) => {
    const num = d.name.split('#')[1]
    const editions = editionsFor(d.price, rand, d.soldOut)
    const creator = CREATORS[i % CREATORS.length]
    list.push({
      id: String(i + 1),
      name: d.name,
      tokenId: `#${num.padStart(4, '0')}`,
      category: d.category,
      collection: i < 9 ? 'Kurio Editions' : `Kurio ${d.category}`,
      network: d.network,
      creator,
      description: `${d.name} é uma obra digital finalizada à mão da coleção Kurio Editions. Cada atributo fica armazenado nos metadados do token e é verificado na ${d.network}. A propriedade inclui a arte em alta resolução, lançamentos exclusivos para colecionadores e um registro permanente de procedência. ${creator} recebe 5% de direitos autorais nas vendas secundárias.`,
      attributes: [...ATTRS[d.art].slice(0, 2), d.rare ? 'Raro' : 'Comum'],
      image: ART[d.art],
      gallery: [ART[d.art], `/img/${d.svg}.svg`],
      price: d.price,
      oldPrice: d.oldPrice,
      defaultEditionId: '1-50',
      editions,
      available: editions.reduce((a, e) => a + e.available, 0),
      rare: !!d.rare,
      isNew: i % 4 === 0 || i < 3,
      trending: Math.round(rand() * 1000),
      listedAt: new Date(base - i * 36e5 * 7).toISOString(),
      rating: 4 + Math.round(rand() * 10) / 10,
      reviewsCount: 3 + Math.round(rand() * 30),
      contract: `0x${(0x7a42 + i).toString(16)}…${(0x19e8 + i * 7).toString(16)}`,
      version: 1,
    })
  }
  FIGMA.forEach((d, i) => push(i, d))
  for (let i = 9; i < 36; i++) {
    const name = `${ADJ[i % ADJ.length]} ${NOUN[(i * 5) % NOUN.length]} #${String(100 + i * 13).padStart(3, '0')}`
    const cents = 15 + Math.floor(rand() * 340)
    const price = `${Math.floor(cents / 100)}.${String(cents % 100).padStart(2, '0')}`
    const art = ARTS[i % ARTS.length]
    push(i, {
      name,
      price,
      category: CATEGORIES[i % CATEGORIES.length],
      network: (['Ethereum', 'Polygon', 'Solana'] as Network[])[(i * 7) % 3],
      art,
      svg: SVGS[i % SVGS.length],
      rare: i % 11 === 0,
      // Uma peça esgotada para os cenários de indisponibilidade.
      soldOut: i === 13,
    })
  }
  return list
}

export const HERO_IDS = ['1', '6', '7']
export const FEATURED_ID = '2'

export function reviewsFor(nftId: string, count: number): Review[] {
  const rand = seeded(Number(nftId) * 97)
  const authors = ['marina.eth', 'colecionador_42', 'pixelpunk', 'ana.k', 'joao.sol', 'artlover', 'kenji.poly']
  const texts = [
    'Arte impecável e a procedência está toda documentada.',
    'Chegou na carteira em segundos. Ótima experiência.',
    'Os detalhes em alta resolução são incríveis.',
    'Comunidade muito ativa, vale a pena acompanhar o criador.',
    'Uma das melhores peças da coleção.',
  ]
  return Array.from({ length: Math.min(count, 6) }, (_, i) => ({
    id: `${nftId}-r${i}`,
    author: authors[Math.floor(rand() * authors.length)],
    rating: 4 + Math.round(rand()),
    text: texts[Math.floor(rand() * texts.length)],
    date: new Date(Date.UTC(2026, 8, 1 + i * 3)).toISOString(),
  }))
}

export const COUPONS: Record<string, { percentOff: number; expiresAt: string }> = {
  KURIO10: { percentOff: 10, expiresAt: '2099-12-31T23:59:59Z' },
  LANCAMENTO5: { percentOff: 5, expiresAt: '2099-12-31T23:59:59Z' },
  VERAO2025: { percentOff: 15, expiresAt: '2025-03-20T23:59:59Z' },
}

export const NETWORK_FEES: Record<Network, string> = {
  Ethereum: '0.016',
  Polygon: '0.002',
  Solana: '0.001',
}

export interface UserRecord {
  id: string
  email: string
  username: string
  displayName: string
  ensName?: string
  walletNickname?: string
  avatarUrl?: string | null
  salt: string
  passwordHash: string
}

/** Senha de ambos: "senha123" (somente PBKDF2-SHA256 é armazenado). */
export const SEED_USERS: UserRecord[] = [
  {
    id: 'u-ana',
    email: 'ana@kurio.test',
    username: 'ana.colecionadora',
    displayName: 'Ana Kurio',
    ensName: 'ana',
    walletNickname: 'Cofre principal',
    avatarUrl: null,
    salt: 'a7f3c1e2b9d04f6a',
    passwordHash: 'd9f6e5094a71e26000925ca4034c26aad443333d400bfb658e637f69d3f9ca3f',
  },
  {
    id: 'u-bruno',
    email: 'bruno@kurio.test',
    username: 'bruno.nft',
    displayName: 'Bruno Lima',
    avatarUrl: null,
    salt: '5e8b2d71c4a9f036',
    passwordHash: 'f7675211867e4a556eb6015129760eb1edfbbce9c94837f31dd060d67b68eb96',
  },
]

export const SEED_WALLETS: Record<string, Wallet[]> = {
  'u-ana': [
    {
      id: 'w-ana-1',
      label: 'Cofre principal',
      provider: 'MetaMask',
      network: 'Ethereum',
      address: '0xA91F3c2B7d4E5f6a7B8c9D0e1F2a3B4c5D6eE82C',
      ensName: 'ana.eth',
      role: 'primary',
      createdAt: '2026-08-01T10:00:00Z',
    },
  ],
  'u-bruno': [],
}
