import { defineConfig } from 'vitest/config'
import vue from '@vitejs/plugin-vue'
import vueJsx from '@vitejs/plugin-vue-jsx'
import frappeui from 'frappe-ui/vite'
import path from 'path'

// One config, same resolution the app build uses. The frappe-ui Vite plugin resolves frappe-ui's
// unbundled source + its `~icons/*` virtual imports, so real frappe-ui components mount in tests with
// no shims. Component data is mocked at the network layer with MSW (frappe-ui's own test convention).
export default defineConfig({
  plugins: [frappeui({ lucideIcons: true }), vue(), vueJsx()],
  resolve: {
    alias: { '@': path.resolve(__dirname, 'src') },
  },
  test: {
    globals: true,
    environment: 'happy-dom',
    root: __dirname,
    setupFiles: ['./tests/setup.js', './tests/component/_setup.js'],
    include: ['tests/**/*.test.js', 'src/**/*.test.js'],
    server: { deps: { inline: ['frappe-ui'] } },
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov', 'json-summary'],
      reportsDirectory: './coverage',
      include: [
        'src/utils/fieldTransforms.js',
        'src/utils/scriptHelpers.js',
        'src/utils/expressions.js',
        'src/utils/renderFieldLayoutDialog.js',
        // TATVA: our tested pure logic + components — measured so the report reflects our work
        'src/tatva/**',
      ],
    },
  },
})
