import { Store } from './store'

export class MemoryStore extends Store {
  store = {
    accessToken: '',
    refreshToken: ''
  }

  constructor() {
    super()
  }

  override getAccessToken() {
    return Promise.resolve(this.store.accessToken)
  }

  override updateAccessToken(accessToken: string) {
    this.store.accessToken = accessToken
    return Promise.resolve()
  }

  override updateRefreshToken(refreshToken: string): Promise<void> {
    this.store.refreshToken = refreshToken
    return Promise.resolve()
  }

  override getRefreshToken() {
    return Promise.resolve(this.store.refreshToken)
  }

  override update(token: { accessToken: string; refreshToken: string }) {
    this.store = {
      accessToken: token.accessToken,
      refreshToken: token.refreshToken
    }
  }
}
