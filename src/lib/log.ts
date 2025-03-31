import fs from 'fs'
import path from 'path'

type WritableStream = NodeJS.WritableStream

let printer: ((message: string) => void) | null = null

export interface Fields {
  [index: string]: any
}

export type LogLevel = 'info' | 'warn' | 'debug' | 'notice' | 'error'

const LEVEL_LABELS: Record<LogLevel, string> = {
  info: '[INFO]',
  warn: '[WARN]',
  error: '[ERROR]',
  debug: '[DEBUG]',
  notice: '[NOTICE]'
}

export interface LoggerOptions {
  consoleOutput?: boolean
  fileOutput?: boolean
  filePath?: string
  maxFileSize?: number
  maxFiles?: number
  isDebugEnabled?: boolean
}

export class Logger {
  private fileStream: fs.WriteStream | null = null
  private currentFileSize = 0
  private readonly options: Required<LoggerOptions>
  private readonly logDirectory: string
  private readonly baseLogPath: string
  private readonly logFileExt: string
  private readonly baseLogName: string

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
      isDebugEnabled: false,
      ...options
    }

    this.logDirectory = path.dirname(this.options.filePath)
    this.baseLogPath = this.options.filePath
    this.logFileExt = path.extname(this.baseLogPath)
    this.baseLogName = path.basename(this.baseLogPath, this.logFileExt)

    if (this.options.fileOutput) {
      this.ensureLogDirectory()
      this.createFileStream()
    }
  }

  messageTransformer: (message: string, level: LogLevel) => string = (it) => it

  private ensureLogDirectory() {
    if (!fs.existsSync(this.logDirectory)) {
      fs.mkdirSync(this.logDirectory, { recursive: true })
    }
  }

  private createFileStream() {
    this.fileStream = fs.createWriteStream(this.baseLogPath, { flags: 'a' })
    this.currentFileSize = fs.existsSync(this.baseLogPath) ? fs.statSync(this.baseLogPath).size : 0
  }

  private rotateLogFile() {
    if (!this.fileStream || !this.options.fileOutput) return

    this.fileStream.end()

    // Delete oldest file if we've reached max files
    const oldestFile = path.join(
      this.logDirectory,
      `${this.baseLogName}.${this.options.maxFiles}${this.logFileExt}`
    )
    if (fs.existsSync(oldestFile)) {
      fs.unlinkSync(oldestFile)
    }

    // Rename existing files
    for (let i = this.options.maxFiles - 1; i >= 1; i--) {
      const oldFile = path.join(this.logDirectory, `${this.baseLogName}.${i}${this.logFileExt}`)
      const newFile = path.join(this.logDirectory, `${this.baseLogName}.${i + 1}${this.logFileExt}`)
      if (fs.existsSync(oldFile)) {
        fs.renameSync(oldFile, newFile)
      }
    }

    // Rename current file to .1
    fs.renameSync(
      this.baseLogPath,
      path.join(this.logDirectory, `${this.baseLogName}.1${this.logFileExt}`)
    )

    // Create new file stream
    this.createFileStream()
    this.currentFileSize = 0
  }

  private writeToFile(message: string) {
    if (!this.fileStream || !this.options.fileOutput) return

    const data = `${message}\n`
    this.currentFileSize += Buffer.byteLength(data)

    if (this.currentFileSize > this.options.maxFileSize) {
      this.rotateLogFile()
    }

    this.fileStream.write(data)
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
    if (this.options.isDebugEnabled) {
      this.doLog(message, messageOrFields, 'debug')
    }
  }

  notice(messageOrFields: Fields | null | string, message?: string) {
    this.doLog(message, messageOrFields, 'notice')
  }

  private getTimestamp(): string {
    return new Date()
      .toLocaleString('zh-CN', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
      })
      .replace(/\//g, '-')
  }

  private doLog(
    message: string | undefined | Error,
    messageOrFields: Fields | null | string,
    level: LogLevel
  ) {
    const msg = message === undefined ? (messageOrFields as string) : message
    const fields = message === undefined ? null : (messageOrFields as Fields | null)
    this._doLog(msg, fields, level)
  }

  private _doLog(message: string | Error, fields: Fields | null, level: LogLevel) {
    const messageStr =
      message instanceof Error ? message.stack || message.toString() : message.toString()
    const timestamp = this.getTimestamp()
    const levelLabel = LEVEL_LABELS[level]
    const formattedMessage = `[${timestamp}] ${levelLabel} ${Logger.createMessage(
      this.messageTransformer(messageStr, level),
      fields
    )}\n`

    if (this.options.consoleOutput) {
      this.stream.write(formattedMessage)
    }

    if (this.options.fileOutput) {
      this.writeToFile(formattedMessage.trim())
    }
  }

  static createMessage(message: string, fields: Fields | null): string {
    if (!fields) {
      return message
    }

    const fieldPadding = ' '.repeat(Math.max(2, 16 - message.length))
    let text = message + fieldPadding

    const fieldNames = Object.keys(fields)
    for (const name of fieldNames) {
      let value = fields[name]
      if (value instanceof Error) {
        value = value.stack || value.toString()
      } else if (Array.isArray(value)) {
        value = JSON.stringify(value)
      }
      text += `${name}=${value} `
    }

    return text.trim()
  }

  log(message: string): void {
    const formattedMessage = `${message}\n`

    if (printer) {
      printer(message)
    } else if (this.options.consoleOutput) {
      this.stream.write(formattedMessage)
    }

    if (this.options.fileOutput) {
      this.writeToFile(message)
    }
  }

  close(): void {
    if (this.fileStream) {
      this.fileStream.end()
      this.fileStream = null
    }
  }

  static fromConfig(options: LoggerOptions): Logger {
    return new Logger(process.stdout, options)
  }
}
