const { CloudClient, FileTokenStore, logger } = require('../dist')

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms))
;(async () => {
  logger.configure({
    isDebugEnabled: true,
    fileOutput: true
  })
  const client = new CloudClient({
    username: process.env.TY_USER_NAME,
    password: process.env.TY_PASSWORD,
    token: new FileTokenStore(`.token/${process.env.TY_USER_NAME}.json`)
  })
  try {
    // const t1 = await client.userSign()
    // console.log(t1)
    const info = await Promise.all([
      client.getUserSizeInfo(),
      client.getUserSizeInfo(),
      client.getUserSizeInfo(),
      client.getUserSizeInfo()
    ])
    console.log(info)
    // const { familyInfoResp } = await client.getFamilyList()
    // console.log(familyInfoResp)
    const res = await await Promise.all([
      client.familyUserSign(735500198),
      client.familyUserSign(735500198)
    ])
    console.log(res)
  } catch (e) {
    console.error(e)
  }
})()
