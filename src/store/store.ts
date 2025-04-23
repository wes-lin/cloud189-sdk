/**
 * @public
 */
export abstract class Store {
  constructor() {}

  abstract get():
    | { accessToken: string; refreshToken: string; expiresIn: number }
    | Promise<{ accessToken: string; refreshToken: string; expiresIn: number }>

  abstract update(token: {
    accessToken: string
    refreshToken?: string
    expiresIn?: number
  }): void | Promise<void>
}
