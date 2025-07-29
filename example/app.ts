import { CloudClient, FileTokenStore, logger } from '../src/index'

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
      client.getUserSizeInfo()
      // client.getUserSizeInfo(),
      // client.getUserSizeInfo(),
      // client.getUserSizeInfo()
    ])
    console.log(info)
    const { familyInfoResp } = await client.getFamilyList()
    console.log(familyInfoResp)
    // const res = await await Promise.all([
    //   client.familyUserSign(735500198),
    //   client.familyUserSign(735500198)
    // ])

    // const res = await client
    //   .createFamilyFolder({
    //     parentId: 5146334744064314,
    //     folderName: '新建文件夹1',
    //     familyId: 735500198
    //   })
    //   .json()
    // console.log(res)
    const res1 = await client.getFamilyListFiles({
      familyId: 735500198
    })
    console.log(res1)

    const res2 = await Promise.all([
      client.upload({
        parentFolderId: 1,
        fileName: '1',
        fileSize: 0,
        sliceSize: 0
      }),
      client.upload({
        parentFolderId: 1,
        fileName: '2',
        fileSize: 0,
        sliceSize: 0
      })
    ])
    console.log(res2)
  } catch (e) {
    console.error(e)
  }
})()
