# cloud189-sdk

[![NPM](https://nodei.co/npm/cloud189-sdk.png?downloads=true&downloadRank=true&stars=true)](https://nodei.co/npm/cloud189-sdk/)

> 基于node.js的天翼网盘sdk

<div align="center">
  <a href="https://www.npmjs.org/package/cloud189-sdk">
    <img src="https://img.shields.io/npm/v/cloud189-sdk.svg">
  </a>
  <a href="https://packagephobia.com/result?p=cloud189-sdk">
    <img src="https://packagephobia.com/badge?p=cloud189-sdk">
  </a>
  <a href="https://npmcharts.com/compare/cloud189-sdk?minimal=true">
    <img src="http://img.shields.io/npm/dm/cloud189-sdk.svg">
  </a>
  <a href="https://coveralls.io/github/wes-lin/cloud189-sdk">
    <img src="https://coveralls.io/repos/github/wes-lin/cloud189-sdk/badge.svg?branch=dev">
  </a>
  <a href="LICENSE">
    <img src="https://img.shields.io/badge/License-MIT-yellow.svg">
  </a>
</div>

## 使用方法

1. 安装依赖

```sh
npm install cloud189-sdk
```

2. 初始化

```js
const { CloudClient } = require('cloud189-sdk')
// 使用账号密码初始化
const client = new CloudClient({
  username: 'username',
  password: 'password'
})
```

3. 使用

```js
const info = await client.getUserSizeInfo()
console.log(info)
```

## [API 文档](https://cloud.189.whaledev.cn/)

## Star History

[![Star History Chart](https://api.star-history.com/svg?repos=wes-lin/cloud189-sdk&type=Date)](https://www.star-history.com/#wes-lin/cloud189-sdk&Date)
