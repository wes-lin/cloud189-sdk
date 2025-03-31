import * as fs from 'node:fs'
import * as promisesFs from 'node:fs/promises'
import path from 'path'
import { MemoryStore } from './memstore'

/**
 * @public
 */
export class FileTokenStore extends MemoryStore {
  filePath: string
  constructor(filePath: string) {
    super()
    this.filePath = filePath
    if (!filePath) {
      throw new Error('Unknown file for read/write token')
    }
    this.ensureTokenDirectory(filePath)

    const dataJson = this.#loadFromFile(filePath)
    if (dataJson) {
      super.update(dataJson)
    }
  }

  private ensureTokenDirectory(filePath: string) {
    const dir = path.dirname(filePath)
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true })
    }
  }

  update(token: { accessToken: string; refreshToken?: string; expiresIn?: number }) {
    super.update(token)
    return this.#saveToFile(this.filePath, this.store)
  }

  #loadFromFile(filePath: string) {
    let data = null
    if (fs.existsSync(filePath)) {
      data = fs.readFileSync(filePath, {
        encoding: 'utf-8'
      })
    }

    if (data) {
      try {
        return JSON.parse(data)
      } catch (e) {
        throw new Error(
          `Could not parse token file ${filePath}. Please ensure it is not corrupted.`
        )
      }
    }
    return null
  }

  #saveToFile(filePath, data) {
    return promisesFs.writeFile(filePath, JSON.stringify(data), {
      encoding: 'utf-8'
    })
  }
}
