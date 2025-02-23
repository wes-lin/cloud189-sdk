import { defineUserConfig } from 'vuepress'
import { viteBundler } from '@vuepress/bundler-vite'
import { defaultTheme } from '@vuepress/theme-default'

export default defineUserConfig({
  bundler: viteBundler(),
  theme: defaultTheme({
    navbar: [
      {
        text: '指南',
        link: '/guide/'
      },
      {
        text: 'API',
        link: '/api/'
      },
      {
        text: 'Github',
        link: 'https://github.com/wes-lin/cloud189-sdk.git'
      }
    ],
    sidebar: {
      '/guide/': [
        {
          text: '指南',
          collapsible: false,
          children: ['introduction', 'getting-started']
        }
      ]
    }
  }),
  lang: 'zh-CN',
  title: '天翼云SDK',
  description: '基于node.js的第三方天翼云盘SDK'
})
