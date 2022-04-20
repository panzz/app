// import fs from 'fs'
import { defineConfig } from 'vite'
import reactRefresh from '@vitejs/plugin-react-refresh'
import metaversefilePlugin from 'metaversefile/plugins/rollup.js'

// console.debug('localhost.key:%o', fs.readFileSync('./certs/localhost.key'));
// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    metaversefilePlugin(),
    reactRefresh(),
  ],
  optimizeDeps:{
    entries: [
      'src/*.js',
      'src/*.jsx',
      'avatars/*.js',
      'avatars/vrarmik/*.js',
      'src/components/*.js', 
      'src/components/*.jsx', 
      'src/tabs/*.jsx',
      '*.js'
    ],
  },
  server: {
    fs: {
      strict: true,
    },
  },
})
