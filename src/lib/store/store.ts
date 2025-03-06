/**
 * @public
 */
export class Store {
  constructor() {}

  getAccessToken(): Promise<string | undefined>

  getAccessToken(): unknown {
    throw new Error('getAccessToken is not implemented')
  }

  getRefreshToken(): Promise<string | undefined>

  getRefreshToken(): unknown {
    throw new Error('getRefreshToken is not implemented')
  }

  updateRefreshToken(refreshToken: string): Promise<void> {
    throw new Error('updateRefreshToken is not implemented')
  }

  updateAccessToken(accessToken: string): Promise<void> {
    throw new Error('updateAccessToken is not implemented')
  }

  update(token: { accessToken: string; refreshToken: string })

  update(token: { accessToken: string; refreshToken: string }): Promise<void> {
    throw new Error('update is not implemented')
  }
}
