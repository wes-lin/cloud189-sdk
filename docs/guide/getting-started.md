# 快速上手

## 安装依赖

::: code-tabs#shell

@tab npm

```bash
npm install cloud189-sdk
```

@tab yarn

```bash
yarn add cloud189-sdk
```

@tab pnpm

```bash
pnpm add cloud189-sdk
```

:::

## 初始化

```javascript
const { CloudClient, FileTokenStore } = require('cloud189-sdk')
// 使用账号密码初始化
const client = new CloudClient({
  username: 'username',
  password: 'password'
})

// 使用缓存文件token初始化
const client = new CloudClient({
  username: 'username',
  password: 'password',
  token: new FileTokenStore('userName.json')
})

// 自定义token存储
const client = new CloudClient({
  username: 'username',
  password: 'password',
  token: {
    async getAccessToken() {
      return 'AccessToken'
    },
    async getRefreshToken() {
      return 'RefreshToken'
    },
    async updateRefreshToken(refreshToken) {
      console.log(refreshToken)
    },
    async updateAccessToken(accessToken) {
      console.log(accessToken)
    },
    async update(token) {
      console.log(token)
    }
  }
})
```

## 使用

```javascript
//获取家庭信息
const { familyInfoResp } = await client.getFamilyList()
//获取容量信息
const info = await client.getUserSizeInfo()
```

## 拓展

自定义拓展其他API, 具体参数使用参考 [got](https://www.npmjs.com/package/got)

```javascript
const res = await client
  .request(
    'https://cloud.189.cn/api/portal/listLatestUploadFiles.action?noCache=0.4415885048418662&pageSize=20&loadType=0&timeStamp=&noCache=1740490387777'
  )
  .json()
```

## API

完整的API引用请参考 [API](../api/)
