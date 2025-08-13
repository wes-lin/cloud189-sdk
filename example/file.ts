import { CloudClient } from '../src'
import fs from 'fs'
import path from 'path'
import crypto from 'crypto'

const createFolderTest = async (client: CloudClient, params: { familyId: string }) => {
  const res = await Promise.all([
    client.createFolder({
      parentFolderId: '',
      folderName: '新建文件夹',
      familyId: params.familyId
    }),
    client.createFolder({
      parentFolderId: '-11',
      folderName: '新建文件夹'
    })
  ])
  return res
}

const renameFolderTest = async (
  client: CloudClient,
  params: {
    personFolderId: string
    personFolderName: string
    personParentFolderId: string
    familyFolderName: string
    familyFolderId: string
    familyParentFolderId: string
    familyId: string
  }
) => {
  const res = await Promise.all([
    client.renameFolder({
      folderId: params.familyFolderId,
      folderName: params.familyFolderName + crypto.randomUUID(),
      familyId: params.familyId
    }),
    client.renameFolder({
      folderId: params.personFolderId,
      folderName: params.personFolderName + crypto.randomUUID()
    })
  ])
  return res
}

const uploadFileTest = async (
  client: CloudClient,
  params: { filePath: string; personFolderId: string; familyFolderId: string; familyId: string }
) => {
  const uploadFamilyFile = (parentFolderId: string, filePath: string, familyId: string) =>
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
  const tempdDir = params.filePath
  const files = fs.readdirSync(tempdDir)
  const txtFiles = files.filter((file) => path.extname(file).toLowerCase() === '.txt')
  const uploadTasks = txtFiles.map((file, index) => {
    if (index > 1) {
      return uploadPersonFile(params.personFolderId, path.join(tempdDir, file))
    } else {
      return uploadFamilyFile(params.familyFolderId, path.join(tempdDir, file), params.familyId)
    }
  })

  return await Promise.all(uploadTasks)
}

const listFilesTest = async (
  client: CloudClient,
  params: {
    personFolderId: string
    familyFolderId: string
    familyId: string
  }
) => {
  return await Promise.all([
    client.getListFiles(
      {
        folderId: params.familyFolderId
      },
      params.familyId
    ),
    client.getListFiles({
      folderId: params.personFolderId
    })
  ])
}

const getFileDownloadUrlTest = async (
  client: CloudClient,
  params: {
    personFileId: string
    familyFileId: string
    familyId: string
  }
) => {
  return await Promise.all([
    client.getFileDownloadUrl({
      fileId: params.personFileId
    }),
    client.getFileDownloadUrl({
      fileId: params.familyFileId,
      familyId: params.familyId
    })
  ])
}

export default async (client: CloudClient, params: { familyId: string }) => {
  const { familyId } = params
  console.log('======= createFolderTest start=======')
  const createFolderRes = await createFolderTest(client, {
    familyId
  })
  const familyFolderName = createFolderRes[0].name
  const familyFolderId = createFolderRes[0].id
  const familyParentFolderId = createFolderRes[0].parentId
  const personFolderName = createFolderRes[0].name
  const personFolderId = createFolderRes[1].id
  const personParentFolderId = createFolderRes[1].parentId
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
  console.log('======= createFolderTest end=======')

  console.log('======= uploadFileTest start=======')
  const uploadRes = await uploadFileTest(client, {
    filePath: '.temp',
    familyId,
    familyFolderId,
    personFolderId
  })
  console.log(uploadRes)
  console.log('======= uploadFileTest end=======')

  console.log('======= listFilesTest start=======')
  const listFileRes = await listFilesTest(client, {
    familyId,
    familyFolderId,
    personFolderId
  })
  console.log(listFileRes)
  console.log('======= listFilesTest end=======')

  console.log('======= getFileDownloadUrlTest start=======')
  const familyFileId = listFileRes[0].fileListAO.fileList[0].id
  const personFileId = listFileRes[1].fileListAO.fileList[0].id
  const downloadUrlRes = await getFileDownloadUrlTest(client, {
    familyFileId,
    personFileId,
    familyId
  })
  console.log(downloadUrlRes)
  console.log('======= getFileDownloadUrlTest end=======')
  return {
    familyFolderId,
    familyFolderName,
    familyParentFolderId,
    familyFileId,
    personFolderId,
    personFolderName,
    personFileId,
    personParentFolderId
  }
}
