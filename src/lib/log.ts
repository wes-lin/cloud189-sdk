import chalk from 'chalk'
import { Chalk } from 'chalk'
import fs from 'fs'
import path from 'path'

type WritableStream = NodeJS.WritableStream

let printer: ((message: string) => void) | null = null

export interface Fields {
  [index: string]: any
}

export type LogLevel = 'info' | 'warn' | 'debug' | 'notice' | 'error'

export const PADDING = 2

interface LoggerOptions {
  consoleOutput?: boolean
  fileOutput?: boolean
  filePath?: string
  maxFileSize?: number
  maxFiles?: number
}

export class Logger {
  private fileStream: fs.WriteStream | null = null
  private currentFileSize = 0
  private fileIndex = 0
  private readonly options: Required<LoggerOptions>

  constructor(
    protected readonly stream: WritableStream,
    options: LoggerOptions = {}
  ) {
    this.options = {
      consoleOutput: true,
      fileOutput: false,
      filePath: path.join(process.cwd(), 'logs', 'app.log'),
      maxFileSize: 1024 * 1024 * 10, // 10MB
      maxFiles: 5,
      ...options
    }

    if (this.options.fileOutput) {
      this.ensureLogDirectory()
      this.createFileStream()
    }
  }

  messageTransformer: (message: string, level: LogLevel) => string = (it) => it

  get isDebugEnabled() {
    return process.env.CLOUD189_VERBOSE == '1'
  }

  private ensureLogDirectory() {
    const dir = path.dirname(this.options.filePath)
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true })
    }
  }

  private createFileStream() {
    this.fileStream = fs.createWriteStream(this.options.filePath, { flags: 'a' })
    this.currentFileSize = fs.existsSync(this.options.filePath)
      ? fs.statSync(this.options.filePath).size
      : 0
  }

  private rotateLogFile() {
    if (!this.fileStream || !this.options.fileOutput) return

    // Close current stream
    this.fileStream.end()

    // Rotate files
    const basePath = this.options.filePath
    const ext = path.extname(basePath)
    const baseName = path.basename(basePath, ext)

    // Delete oldest file if we've reached max files
    const oldestFile = `${baseName}.${this.options.maxFiles}${ext}`
    if (fs.existsSync(oldestFile)) {
      fs.unlinkSync(oldestFile)
    }

    // Rename existing files
    for (let i = this.options.maxFiles - 1; i >= 1; i--) {
      const oldFile = `${baseName}.${i}${ext}`
      const newFile = `${baseName}.${i + 1}${ext}`
      if (fs.existsSync(oldFile)) {
        fs.renameSync(oldFile, newFile)
      }
    }

    // Rename current file to .1
    fs.renameSync(basePath, `${baseName}.1${ext}`)

    // Create new file stream
    this.createFileStream()
    this.fileIndex = 0
    this.currentFileSize = 0
  }

  private writeToFile(message: string) {
    if (!this.fileStream || !this.options.fileOutput) return

    const data = `${new Date().toISOString()} ${message}\n`
    this.currentFileSize += Buffer.byteLength(data)

    if (this.currentFileSize > this.options.maxFileSize) {
      this.rotateLogFile()
      this.fileStream.write(data)
    } else {
      this.fileStream.write(data)
    }
  }

  info(messageOrFields: Fields | null | string, message?: string) {
    this.doLog(message, messageOrFields, 'info')
  }

  error(messageOrFields: Fields | null | string, message?: string) {
    this.doLog(message, messageOrFields, 'error')
  }

  warn(messageOrFields: Fields | null | string, message?: string): void {
    this.doLog(message, messageOrFields, 'warn')
  }

  debug(messageOrFields: Fields | null | string, message?: string) {
    if (this.isDebugEnabled) {
      this.doLog(message, messageOrFields, 'debug')
    }
  }

  notice(messageOrFields: Fields | null | string, message?: string) {
    this.doLog(message, messageOrFields, 'notice')
  }

  private doLog(
    message: string | undefined | Error,
    messageOrFields: Fields | null | string,
    level: LogLevel
  ) {
    if (message === undefined) {
      this._doLog(messageOrFields as string, null, level)
    } else {
      this._doLog(message, messageOrFields as Fields | null, level)
    }
  }

  private _doLog(message: string | Error, fields: Fields | null, level: LogLevel) {
    // noinspection SuspiciousInstanceOfGuard
    if (message instanceof Error) {
      message = message.stack || message.toString()
    } else {
      message = message.toString()
    }

    const levelIndicator = this.getLevelIndicator(level)
    const color = LEVEL_TO_COLOR[level] || chalk.white
    this.stream.write(`${' '.repeat(PADDING)}${color(levelIndicator)} `)
    const formattedMessage = `${' '.repeat(PADDING)}${color(levelIndicator)} ${Logger.createMessage(
      this.messageTransformer(message, level),
      fields,
      level,
      color,
      PADDING + 2 /* level indicator and space */
    )}\n`

    if (this.options.consoleOutput) {
      this.stream.write(formattedMessage)
    }

    if (this.options.fileOutput) {
      this.writeToFile(formattedMessage.trim())
    }
  }

  private getLevelIndicator(level: LogLevel): string {
    switch (level) {
      case 'error':
        return '⨯'
      case 'warn':
        return '⚠'
      case 'notice':
        return 'ℹ'
      default:
        return '•'
    }
  }

  static createMessage(
    message: string,
    fields: Fields | null,
    level: LogLevel,
    color: (it: string) => string,
    messagePadding = 0
  ): string {
    if (fields == null) {
      return message
    }

    const fieldPadding = ' '.repeat(Math.max(2, 16 - message.length))
    let text = (level === 'error' ? color(message) : message) + fieldPadding
    const fieldNames = Object.keys(fields)
    let counter = 0
    for (const name of fieldNames) {
      let fieldValue = fields[name]
      let valuePadding: string | null = null
      // Remove unnecessary line breaks
      if (fieldValue != null && typeof fieldValue === 'string' && fieldValue.includes('\n')) {
        valuePadding = ' '.repeat(messagePadding + message.length + fieldPadding.length + 2)
        fieldValue = fieldValue.replace(/\n\s*\n/g, `\n${valuePadding}`)
      } else if (Array.isArray(fieldValue)) {
        fieldValue = JSON.stringify(fieldValue)
      }

      text += `${color(name)}=${fieldValue}`
      if (++counter !== fieldNames.length) {
        if (valuePadding == null) {
          text += ' '
        } else {
          text += '\n' + valuePadding
        }
      }
    }
    return text
  }

  log(message: string): void {
    const formattedMessage = `${message}\n`

    if (printer == null) {
      if (this.options.consoleOutput) {
        this.stream.write(formattedMessage)
      }
    } else {
      printer(message)
    }

    if (this.options.fileOutput) {
      this.writeToFile(message)
    }
  }

  close(): void {
    if (this.fileStream) {
      this.fileStream.end()
    }
  }
}

const LEVEL_TO_COLOR: { [index: string]: Chalk } = {
  info: chalk.blue,
  warn: chalk.yellow,
  error: chalk.red,
  debug: chalk.white,
  notice: chalk.green
}

export const log = new Logger(process.stdout)
