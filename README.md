# cloud189-sdk

##  安装依赖
```bash
npm i cloud189-sdk
```
或者
```bash
yarn add cloud189-sdk
```
## 测试代码
``` javascript
const { CloudClient } = require("cloud189-sdk");

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
(async () => {
  const client = new CloudClient(
    'your username',
    'your password'
  );
  await client.login();
  const t1 = await client.userSign();
  console.log(t1);
  await delay(5000);
  const t2 = await client.taskSign();
  console.log(t2);
  await delay(5000);
  const t3 = await client.taskPhoto();
  console.log(t3);
  await delay(5000);
  const t4 = await client.taskKJ();
  await delay(5000);
  console.log(t4);
  const { familyInfoResp } = await client.getFamilyList();
  console.log(familyInfoResp);
  if (familyInfoResp) {
    for (let index = 0; index < familyInfoResp.length; index += 1) {
      const { familyId } = familyInfoResp[index];
      try {
        const res = await client.familyUserSign(familyId);
        console.log(res);
      } catch (e) {
        console.error(e);
      }
    }
  }
  const info = await client.getUserSizeInfo();
  console.log(info);
})();
```
