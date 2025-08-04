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
    const familyId = 735500198
    const res = await Promise.all([
      client.createFolder({
        parentFolderId: '5146334744064314',
        folderName: '新建文件夹',
        familyId
      }),
      client.createFolder({
        parentFolderId: '-11',
        folderName: '新建文件夹'
      })
    ])
    console.log(res)
    const res2 = await Promise.all([
      client.renameFolder({
        folderId: res[0].id,
        folderName: res[0].name + '0001',
        familyId
      }),
      client.renameFolder({
        folderId: res[1].id,
        folderName: res[1].name + '0002'
      })
    ])
    console.log(res2)
    // const res1 = await Promise.all([
    //   client.getListFiles(undefined, 735500198),
    //   client.getListFiles({
    //     folderId: -11
    //   })
    // ])
    // console.log(res1)
    // const res2 = await Promise.all([
    //   client.upload({
    //     parentFolderId: '423161205149947211',
    //     filePath: '.temp/random_1753972005.txt',
    //     familyId: 735500198
    //   }),
    // client.upload({
    //   parentFolderId: '423161205149947211',
    //   filePath: '.temp/random_1753972071.txt',
    //   familyId: 735500198
    // }),
    // client.upload({
    //   parentFolderId: '325551204724717311',
    //   filePath: '.temp/random_1753972005.txt'
    // })
    // client.upload({
    //   parentFolderId: '223771204727864020',
    //   filePath: '.temp/random_1753972071.txt',
    //   familyId: 0
    // })
    // ])
    // console.log(res2)
  } catch (e) {
    console.error(e)
  }
})()
