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
const { CloudClient } = require('cloud189-sdk')
// 使用密码初始化
const client = new CloudClient({
  username: 'username',
  password: 'password'
})
/**
 * 使用cookie初始化，建议传入username password参数
 * 便于自动登陆获取sessionKey和accessToken
 * /
const cookies = [
  'JSESSIONID=*******; Path=/; HttpOnly; hostOnly=true; aAge=2ms; cAge=20ms',
  'COOKIE_LOGIN_USER=*******; Domain=cloud.189.cn; Path=/; HttpOnly; hostOnly=false; aAge=2ms; cAge=19ms'
]
const cookieJar = new CookieJar()
cookies.forEach((cookie) => cookieJar.setCookieSync(cookie, 'https://cloud.189.cn'))
const client = new CloudClient({
  cookie: cookieJar
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
