import { CloudClient } from '../src'

export const createBatchTaskTest = async (
  client: CloudClient,
  params: {
    personFolderId: string
    personFolderName: string
    familyFolderId: string
    familyParentFolderId: string
    familyId: string
  }
) => {
  const { personFolderId, personFolderName, familyId, familyFolderId, familyParentFolderId } =
    params
  const newFolderRes = await client.createFolder({
    folderName: '测试移动目录',
    parentFolderId: '-11'
  })
  const newnParentFolderId = newFolderRes.id
  const res1 = await client.createBatchTask({
    type: 'MOVE',
    taskInfos: [
      {
        fileId: personFolderId,
        fileName: personFolderName,
        isFolder: 1
      }
    ],
    targetFolderId: newnParentFolderId
  })
  const res2 = await client.createBatchTask({
    type: 'DELETE',
    taskInfos: [
      {
        fileId: personFolderId,
        isFolder: 1
      }
    ]
  })
  const res3 = await client.createBatchTask({
    type: 'DELETE',
    taskInfos: [
      {
        fileId: familyFolderId,
        isFolder: 1,
        srcParentId: familyParentFolderId
      }
    ],
    familyId
  })
  return [res1, res2, res3]
}
