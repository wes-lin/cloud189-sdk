const { CloudClient } = require('../dist')

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms))
;(async () => {
  const client = new CloudClient({
    username: process.env.TY_USER_NAME,
    password: process.env.TY_PASSWORD,
    accessToken: 'aa679cbcc7914bc4bbef58744c08db80'
  })
  try {
    const t1 = await client.userSign()
    console.log(t1)
    const info = await client.getUserSizeInfo()
    console.log(info)
    const { familyInfoResp } = await client.getFamilyList()
    console.log(familyInfoResp)
    const res = await client.familyUserSign(735500198)
    console.log(res)
  } catch (e) {
    console.error(e)
  }
})()
