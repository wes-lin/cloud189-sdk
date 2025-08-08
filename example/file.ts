import { CloudClient } from '../src'

export const createFolderTest = async (client: CloudClient, params: { familyId: number }) => {
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
    familyId: number
  }
) => {
  const res = await Promise.all([
    client.renameFolder({
      folderId: params.familyFolderId,
      folderName: params.familyFolderName + '0001',
      familyId: params.familyId
    }),
    client.renameFolder({
      folderId: params.personFolderId,
      folderName: params.personFolderName + '0002'
    })
  ])
  return res
}
