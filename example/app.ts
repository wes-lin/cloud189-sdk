import { CloudClient, FileTokenStore, logger } from '../src/index'
import { createBatchTaskTest } from './batchTask'
import {
  createFolderTest,
  getFileDownloadUrlTest,
  listFilesTest,
  renameFolderTest,
  uploadFileTest
} from './file'

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
    // const familyUserSingRes = await Promise.all([
    //   client.familyUserSign(familyId)
    //   // client.familyUserSign(735500198)
    // ])
    // console.log(familyUserSingRes)
    const res = await createFolderTest(client, {
      familyId
    })
    const familyFolderName = res[0].name
    const familyFolderId = res[0].id
    const familyParentFolderId = res[0].parentId
    const personFolderName = res[0].name
    const personFolderId = res[1].id
    const personParentFolderId = res[1].parentId
    const renameFolderRes = await renameFolderTest(client, {
      familyId,
      familyFolderId,
      familyParentFolderId,
      personFolderId,
      personFolderName,
      personParentFolderId,
      familyFolderName
    })
    console.log(renameFolderRes)

    const uploadRes = await uploadFileTest(client, {
      filePath: '.temp',
      familyId,
      familyFolderId,
      personFolderId
    })
    console.log(uploadRes)

    const listFileRes = await listFilesTest(client, {
      familyId,
      familyFolderId,
      personFolderId
    })
    console.log(listFileRes)
    const familyFileId = listFileRes[0].fileListAO.fileList[0].id
    const personFileId = listFileRes[1].fileListAO.fileList[0].id
    const downloadUrlRes = await getFileDownloadUrlTest(client, {
      familyFileId,
      personFileId,
      familyId
    })
    console.log(downloadUrlRes)
    await delay(10000)
    const taskRes = await createBatchTaskTest(client, {
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
