/**
 * Aritmética monetária em ETH sem ponto flutuante.
 * Valores entram e saem como string decimal; internamente usamos BigInt em wei (10^-18).
 */
const DECIMALS = 18
const SCALE = 10n ** BigInt(DECIMALS)
const DECIMAL_RE = /^\d+(\.\d{1,18})?$/

export function isEthAmount(value: unknown): value is string {
  return typeof value === 'string' && DECIMAL_RE.test(value.trim())
}

export function toWei(value: string): bigint {
  const v = value.trim()
  if (!DECIMAL_RE.test(v)) throw new Error(`Valor ETH inválido: "${value}"`)
  const [int, frac = ''] = v.split('.')
  return BigInt(int) * SCALE + BigInt(frac.padEnd(DECIMALS, '0'))
}

/** Converte wei para string decimal com no mínimo `minDecimals` casas. */
export function fromWei(wei: bigint, minDecimals = 2): string {
  const negative = wei < 0n
  const abs = negative ? -wei : wei
  const int = abs / SCALE
  let frac = (abs % SCALE).toString().padStart(DECIMALS, '0').replace(/0+$/, '')
  if (frac.length < minDecimals) frac = frac.padEnd(minDecimals, '0')
  return `${negative ? '-' : ''}${int}${frac ? `.${frac}` : ''}`
}

export const addEth = (...values: string[]) => fromWei(values.reduce((acc, v) => acc + toWei(v), 0n))
export const mulEth = (value: string, quantity: number) => {
  if (!Number.isInteger(quantity) || quantity < 0) throw new Error('Quantidade deve ser inteira e não negativa')
  return fromWei(toWei(value) * BigInt(quantity))
}
export const compareEth = (a: string, b: string) => {
  const x = toWei(a)
  const y = toWei(b)
  return x === y ? 0 : x < y ? -1 : 1
}
/** Percentual em pontos-base (1% = 100 bps), arredondando para baixo em wei. */
export const percentOf = (value: string, percent: number) => fromWei((toWei(value) * BigInt(Math.round(percent * 100))) / 10_000n)

/** Formatação para exibição (pt-BR usa vírgula apenas em textos de faixa de preço). */
export function formatEth(value: string, opts: { decimals?: number } = {}) {
  const { decimals } = opts
  if (decimals === undefined) return value
  const [int, frac = ''] = value.split('.')
  return `${int}.${frac.padEnd(decimals, '0').slice(0, decimals)}`
}
export const formatEthBr = (value: string) => formatEth(value, { decimals: 2 }).replace('.', ',')
