// 无时区时间处理工具

/**
 * 格式化时间为无时区字符串（直接使用时间字符串中的数值，不进行时区转换）
 * @param input 时间字符串或Date对象
 * @returns 格式化后的无时区时间字符串，格式：YYYY-MM-DD HH:MM:SS
 */
export function formatNoTimezone(input: string | Date): string {
  if (!input) return ''
  
  // 如果是字符串，直接提取时间数值，不进行时区转换
  if (typeof input === 'string') {
    // 处理 YYYY-MM-DD HH:MM:SS 格式
    const match = input.match(/^(\d{4})-(\d{2})-(\d{2})\s+(\d{2}):(\d{2}):(\d{2})$/)
    if (match) {
      return `${match[1]}-${match[2]}-${match[3]} ${match[4]}:${match[5]}:${match[6]}`
    }
    
    // 处理 YYYY-MM-DDTHH:MM:SS 格式
    const isoMatch = input.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})/)
    if (isoMatch) {
      return `${isoMatch[1]}-${isoMatch[2]}-${isoMatch[3]} ${isoMatch[4]}:${isoMatch[5]}:${isoMatch[6]}`
    }
  }
  
  // 确保字符串被解析为UTC时间
  const date = typeof input === 'string' ? new Date(`${input.replace(' ', 'T')}Z`) : input
  const year = date.getUTCFullYear()
  const month = String(date.getUTCMonth() + 1).padStart(2, '0')
  const day = String(date.getUTCDate()).padStart(2, '0')
  const hours = String(date.getUTCHours()).padStart(2, '0')
  const minutes = String(date.getUTCMinutes()).padStart(2, '0')
  const seconds = String(date.getUTCSeconds()).padStart(2, '0')
  return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`
}

/**
 * 格式化时间为无时区的ISO格式
 * @param input 时间字符串或Date对象
 * @returns 无时区的ISO格式字符串，格式：YYYY-MM-DDTHH:MM:SS
 */
export function formatNoTimezoneISO(input: string | Date): string {
  if (!input) return ''
  // 确保字符串被解析为UTC时间
  const date = typeof input === 'string' ? new Date(`${input.replace(' ', 'T')}Z`) : input
  // 确保使用UTC时间并移除时区信息
  const year = date.getUTCFullYear()
  const month = String(date.getUTCMonth() + 1).padStart(2, '0')
  const day = String(date.getUTCDate()).padStart(2, '0')
  const hours = String(date.getUTCHours()).padStart(2, '0')
  const minutes = String(date.getUTCMinutes()).padStart(2, '0')
  const seconds = String(date.getUTCSeconds()).padStart(2, '0')
  return `${year}-${month}-${day}T${hours}:${minutes}:${seconds}`
}

/**
 * 格式化UTC时间为字符串（兼容旧代码，实际返回无时区时间）
 * @param input 时间字符串或Date对象
 * @returns 格式化后的无时区时间字符串，格式：YYYY-MM-DD HH:MM:SS
 */
export function formatUTC(input: string | Date): string {
  // 保持函数名不变，但内部使用无时区处理
  return formatNoTimezone(input)
}

/**
 * 格式化UTC时间为完整ISO格式（兼容旧代码，实际返回无时区ISO格式）
 * @param input 时间字符串或Date对象
 * @returns 无时区的ISO格式字符串，格式：YYYY-MM-DDTHH:MM:SS
 */
export function formatUTCFull(input: string | Date): string {
  // 保持函数名不变，但内部使用无时区处理
  return formatNoTimezoneISO(input)
}

/**
 * 将日期对象转换为时间戳（毫秒）
 * @param date Date对象
 * @returns 时间戳（毫秒）
 */
export function getTimestamp(date: Date): number {
  return date.getTime()
}

/**
 * 将日期对象转换为UTC时间戳（兼容旧代码）
 * @param date Date对象
 * @returns UTC时间戳（毫秒）
 */
export function getUTCTimestamp(date: Date): number {
  return getTimestamp(date)
}

/**
 * 从时间戳创建Date对象
 * @param timestamp 时间戳（毫秒）
 * @returns Date对象
 */
export function fromTimestamp(timestamp: number): Date {
  return new Date(timestamp)
}

/**
 * 从UTC时间戳创建Date对象（兼容旧代码）
 * @param timestamp UTC时间戳（毫秒）
 * @returns Date对象
 */
export function fromUTCTimestamp(timestamp: number): Date {
  return fromTimestamp(timestamp)
}

/**
 * 获取当前时间
 * @returns 当前时间的Date对象
 */
export function getCurrent(): Date {
  return new Date()
}

/**
 * 获取当前UTC时间（兼容旧代码）
 * @returns 当前UTC时间的Date对象
 */
export function getCurrentUTC(): Date {
  return getCurrent()
}

/**
 * 获取当前时间字符串（无时区）
 * @returns 当前时间字符串，格式：YYYY-MM-DD HH:MM:SS
 */
export function getCurrentString(): string {
  return formatNoTimezone(new Date())
}

/**
 * 获取当前UTC时间字符串（兼容旧代码，实际返回无时区时间）
 * @returns 当前UTC时间字符串，格式：YYYY-MM-DD HH:MM:SS
 */
export function getCurrentUTCString(): string {
  return getCurrentString()
}

/**
 * 将无时区字符串解析为Date对象
 * @param input 无时区时间字符串，格式：YYYY-MM-DD HH:MM:SS 或 YYYY-MM-DDTHH:MM:SS
 * @returns Date对象
 */
export function parseNoTimezone(input: string): Date {
  if (!input) return new Date()
  // 确保字符串格式正确，添加T分隔符（如果需要）
  const normalized = input.replace(' ', 'T')
  // 解析为UTC时间
  return new Date(`${normalized}Z`)
}
