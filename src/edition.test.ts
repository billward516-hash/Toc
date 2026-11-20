import { describe, expect, it } from 'vitest'
import capacitorConfig from '../capacitor.config.ts?raw'
import strings from '../android/app/src/main/res/values/strings.xml?raw'
import { GAME_NAME } from './edition.ts'

// The Android app's name is set outside the game's code, so check it says what the Play edition shows.
describe('the Play edition name', () => {
  it('is the same in the app config and on the phone', () => {
    expect(capacitorConfig).toContain("appName: 'Factory Fun'")
    expect(strings).toContain('<string name="app_name">Factory Fun</string>')
    expect(strings).toContain('<string name="title_activity_main">Factory Fun</string>')
  })

  it('leaves the web edition called TOC Factory', () => {
    expect(GAME_NAME).toBe('TOC Factory')
  })
})
