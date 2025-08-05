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
    // const res2 = await Promise.all([
    //   client.renameFolder({
    //     folderId: res[0].id,
    //     folderName: res[0].name + '0001',
    //     familyId
    //   }),
    //   client.renameFolder({
    //     folderId: res[1].id,
    //     folderName: res[1].name + '0002'
    //   })
    // ])
    // console.log(res2)
    // const res1 = await Promise.all([
    //   client.getListFiles(undefined, 735500198),
    //   client.getListFiles({
    //     folderId: -11
    //   })
    // ])
    // console.log(res1)
    const uploadFamilyFile = (parentFolderId: string, filePath: string, familyId: number) =>
      client.upload(
        {
          parentFolderId,
          filePath,
          familyId
        },
        {
          onProgress: (process) => {
            console.log(
              `familyId: ${familyId}  uploadFamily: ${filePath} ⬆️  transferred: ${process}`
            )
          },
          onComplete(response) {
            console.log(`uploadFamily ${filePath} complete`)
          }
        }
      )
    const uploadPersonFile = (parentFolderId: string, filePath: string) =>
      client.upload(
        {
          parentFolderId,
          filePath
        },
        {
          onProgress: (process) => {
            console.log(`uploadPerson: ${filePath} ⬆️  transferred: ${process}`)
          },
          onComplete(response) {
            console.log(`uploadPerson ${filePath} complete`)
          }
        }
      )
    const res2 = await Promise.all([
      uploadFamilyFile('5146334744064314', '.temp/random_1754376896.txt', 735500198),
      uploadFamilyFile('5146334744064314', '.temp/random_1754376897.txt', 735500198),
      uploadPersonFile('124581206349139194', '.temp/random_1754376896.txt'),
      uploadPersonFile('124581206349139194', '.temp/random_1754376897.txt')
    ])
    console.log(res2)
  } catch (e) {
    console.error(e)
  }
})()
