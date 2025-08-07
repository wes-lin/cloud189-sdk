import { Response } from 'got'
import { logger } from '../log'

export const logHook = (response: Response, _retryWithMergedOptions) => {
  logger.debug(`url: ${response.requestUrl}, response: ${response.body})}`)
  return response
}
