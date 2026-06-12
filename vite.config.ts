import { defineConfig } from 'vite';
import dts from 'vite-plugin-dts';
import { resolve } from 'path';

export default defineConfig({
    build: {
        lib: {
            entry: resolve(__dirname, 'src/index.ts'),
            name: 'z18n',
            formats: ['es', 'cjs'],
            fileName: (format) => `index.${format === 'es' ? 'mjs' : 'cjs'}`,
        },
        rollupOptions: {
            output: {
                globals: {},
                exports: 'named',
            },
        },
        sourcemap: true,
    },
    plugins: [
        dts({
            insertTypesEntry: true,
            rollupTypes: true,
        }),
    ],
    resolve: {
        alias: {
            '@': resolve(__dirname, 'src'),
        },
    },
});