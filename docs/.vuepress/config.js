import { defineUserConfig } from 'vuepress'
import { viteBundler } from '@vuepress/bundler-vite'
import { defaultTheme } from '@vuepress/theme-default'

export default defineUserConfig({
  bundler: viteBundler(),
  theme: defaultTheme({
    logo: '/images/favicon.png',
    repo: 'https://github.com/wes-lin/cloud189-sdk.git',
    navbar: [
      {
        text: '指南',
        children: ['/guide/introduction', '/guide/getting-started']
      },
      {
        text: 'API',
        link: '/api/'
      }
    ],
    sidebar: {
      '/guide/': [
        {
          text: '指南',
          collapsible: false,
          children: ['/guide/introduction', '/guide/getting-started']
        }
      ]
    },
    contributors: false
  }),
  lang: 'zh-CN',
  title: 'cloud189-sdk',
  description: '基于node.js的第三方天翼云盘SDK',
  head: [['link', { rel: 'icon', href: '/images/favicon.png' }]]
})
