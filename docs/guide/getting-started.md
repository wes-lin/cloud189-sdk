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

``` javascript
const { CloudClient } = require("cloud189-sdk");
// 使用密码初始化
const client = new CloudClient({
    username: 'username',
    password: 'password'
});
// 使用cookie初始化
const client = new CloudClient({
    username: 'username',
    password: 'password'
});

```
