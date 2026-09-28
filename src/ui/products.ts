import type { FactoryModel } from '../engine/model.ts'

// Each product's color on the floor and in the legend, in the order the level lists its products.
const COLORS = ['#ff8a3d', '#2ec5e6', '#8a5cf6', '#ff6fb5']

export function productColor(model: FactoryModel, id: string): string {
  const i = model.products?.findIndex((p) => p.id === id) ?? 0
  return COLORS[Math.max(0, i) % COLORS.length]
}

export function productName(model: FactoryModel, id: string): string {
  return model.products?.find((p) => p.id === id)?.name ?? id
}
