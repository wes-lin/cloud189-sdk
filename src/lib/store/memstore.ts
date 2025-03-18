import { Store } from './store'

/**
 * @public
 */
export class MemoryStore extends Store {
  store = {
    accessToken: '',
    refreshToken: '',
    expiresIn: 0
  }

  constructor() {
    super()
  }

  get(): { accessToken: string; refreshToken: string; expiresIn: number } {
    return this.store
  }

  update(token: { accessToken: string; refreshToken?: string; expiresIn?: number }) {
    this.store = {
      accessToken: token.accessToken,
      refreshToken: token.refreshToken ?? this.store.refreshToken,
      expiresIn: token.expiresIn ?? this.store.expiresIn
    }
  }
}
