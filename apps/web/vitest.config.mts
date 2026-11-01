import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
export default defineConfig({
  plugins: [react()],
  resolve: { tsconfigPaths: true },
  test: {
    environment: 'jsdom',
    // config/site.ts validates on import, and Vitest doesn't read .env.local.
    env: {
      NEXT_PUBLIC_WHATSAPP_GROUP_URL: 'https://chat.whatsapp.com/TESTINVITE',
      NEXT_PUBLIC_WHATSAPP_DIRECT_URL: 'https://wa.me/254700000000',
      NEXT_PUBLIC_COMMUNITY_STATUS: 'founding',
    },
  },
});
