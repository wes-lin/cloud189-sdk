import { CloudClient } from '../src'
import fs from 'fs'
import path from 'path'
import crypto from 'crypto'

export const createFolderTest = async (client: CloudClient, params: { familyId: string }) => {
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

export const renameFolderTest = async (
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

export const uploadFileTest = async (
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

export const listFilesTest = async (
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

export const getFileDownloadUrlTest = async (
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
