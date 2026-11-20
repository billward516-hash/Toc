import react from '@vitejs/plugin-react'
import { defineConfig, type Plugin } from 'vite'

// The Play Store edition (`--mode play`, see src/edition.ts) drops the screens and the Firebase code it
// never shows. Bundlers still make a chunk of any module a dynamic import names, even in a branch that can
// never run, so those modules are swapped for an empty stand-in, and none of their code is in the build.
const LEFT_OUT = /(?:^|\/)(?:HostClass\.tsx|TrainerGuide\.tsx|MyFactory\.tsx|firebase\.ts)$/
const STAND_IN = '\0play-edition-stand-in'

function playEdition(): Plugin {
  return {
    name: 'play-edition',
    enforce: 'pre',
    apply: (_config, env) => env.mode === 'play',
    resolveId(source) {
      return source.startsWith('.') && LEFT_OUT.test(source) ? STAND_IN : null
    },
    load(id) {
      return id === STAND_IN ? 'const left = () => null\nexport { left as HostClass, left as TrainerGuide, left as MyFactory, left as firebaseBackend }\n' : null
    },
  }
}

export default defineConfig({
  // Relative asset paths, so the same build works at a domain root or under /Toc/.
  base: './',
  plugins: [playEdition(), react()],
})
