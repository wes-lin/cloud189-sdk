import { viteBundler } from '@vuepress/bundler-vite'
import mixTheme from 'vuepress-theme-mix'
import { defineUserConfig } from 'vuepress'

export default defineUserConfig({
  bundler: viteBundler(),
  theme: mixTheme({})
})
