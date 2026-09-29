import type { Level } from '../levels/types.ts'
import type { Words } from './barTexts.ts'
import { productName } from './products.ts'

export { levelWording } from '../levels/wording.ts'

// How a level names its work, material, and products, for describing its results.
export function levelWords(level: Level): Words {
  const { model } = level
  return {
    unit: level.unit ?? 'robots',
    material: model.supply?.name ?? 'material',
    products: (id) => `${productName(model, id).toLowerCase()}s`,
  }
}
