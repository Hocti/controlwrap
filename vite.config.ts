import { defineConfig } from 'vite';
import basicSsl from '@vitejs/plugin-basic-ssl';
import dts from 'vite-plugin-dts';
import repo from "./package.json" assert { type: 'json' };

const compiled = (new Date()).toUTCString().replace(/GMT/g, "UTC");
const banner = `/*!
 * ${repo.name} - v${repo.version}
 * By ${repo.author}
 * Compiled ${compiled}
 *
 * ${repo.name} is licensed under the MIT license.
 * http://www.opensource.org/licenses/mit-license
 */`;

export default defineConfig(({ command }) => {
  if (command === 'build') {
    return {
      plugins: [
        dts({
          include: ['src/**/*.ts'],
          rollupTypes: true
        })
      ],
      build: {
        lib: {
          entry: 'src/index.ts',
          name: 'Controlwrap',
          formats: ['es', 'iife'],
          fileName: (format) => (format === 'es' ? repo.module : repo.unpkg).replace(/^\.\/dist\//, '')
        },
        rollupOptions: {
          external: ['gamepad_standardizer'],
          output: {
            banner: () => banner,
            globals: {
              gamepad_standardizer: 'GamepadStandardizer'
            }
          }
        },
        sourcemap: true,
        emptyOutDir: true
      }
    };
  }

  return {
    root: 'demo',
    server: { https: true, port: 5175 },
    plugins: [basicSsl()],
    optimizeDeps: {
      exclude: ['gamepad_standardizer', 'controlwrap']
    }
  };
});
