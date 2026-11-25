import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import fs from 'fs';
import path from 'path';
import {defineConfig} from 'vite';

function readAppVersions(): { full: string; short: string } {
  try {
    const pkgPath = path.resolve(import.meta.dirname, 'package.json');
    const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
    const parts = String(pkg.version || '2.0.0')
      .trim()
      .split('.')
      .map((p: string) => p.replace(/[^0-9]/g, ''))
      .filter(Boolean);
    const major = parts[0] || '2';
    const minor = parts[1] || '0';
    const patch = parts[2] || '0';
    return {
      full: `${major}.${minor}.${patch}`,
      short: `${major}.${minor}`,
    };
  } catch {
    return { full: '2.0.0', short: '2.0' };
  }
}

export default defineConfig(() => {
  const versions = readAppVersions();
  return {
    base: './',
    define: {
      __APP_VERSION__: JSON.stringify(versions.full),
      __APP_BUILD_TIME__: JSON.stringify(new Date().toISOString().slice(0, 16).replace('T', ' ') + ' UTC'),
    },
    plugins: [
      react(),
      tailwindcss(),
      {
        name: 'inject-app-version-html',
        transformIndexHtml(html) {
          return html
            .replace(/__APP_VERSION_SHORT__/g, versions.short)
            .replace(/__APP_VERSION_FULL__/g, versions.full);
        },
      },
    ],
    resolve: {
      alias: {
        '@': path.resolve(import.meta.dirname, '.'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modify—file watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
