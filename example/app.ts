import { CloudClient, FileTokenStore, logger } from '../src/index'
import batchTaskTest from './batchTask'
import fileTest from './file'

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
    const userSingRes = await client.userSign()
    console.log(userSingRes)
    const info = await Promise.all([client.getUserSizeInfo(), client.getUserSizeInfo()])
    console.log(info)
    const { familyInfoResp } = await client.getFamilyList()
    const { familyId } = familyInfoResp[0]
    console.log(familyInfoResp)
    // const familyUserSingRes = await Promise.all([client.familyUserSign(familyId)])
    // console.log(familyUserSingRes)
    const { personFolderId, personFolderName, familyFolderId, familyParentFolderId } =
      await fileTest(client, {
        familyId
      })
    await delay(10000)
    const taskRes = await batchTaskTest(client, {
      familyId,
      personFolderId,
      personFolderName,
      familyFolderId,
      familyParentFolderId
    })
    console.log(taskRes)
  } catch (e) {
    console.error(e)
  }
})()
