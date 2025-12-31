import axios from 'axios'
import {message} from 'antd'

// 添加类型检查以避免 TS2339 错误
interface ImportMetaEnv {
  readonly VITE_API_BASE_URL: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}

const apiBase = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000'

export const api = axios.create({
  baseURL: apiBase,
  timeout: 600000 // 5分钟超时，适应大数据量导入
})

/**
 * 注册 Axios 拦截器：统一错误处理与重试策略（简单示例）
 */
export function setupInterceptors() {
  api.interceptors.request.use((config) => {
    ;(config as any)._retryCount = (config as any)._retryCount || 0
    return config
  })
  api.interceptors.response.use(
    (res) => res, // 保留完整的响应结构，不做任何处理
    async (err) => {
      const cfg = err?.config || {}
      const method = (cfg?.method || '').toUpperCase()
      const retriable = !err?.response && method === 'GET' && ((cfg as any)._retryCount || 0) < 1
      if (retriable) {
        ;(cfg as any)._retryCount = ((cfg as any)._retryCount || 0) + 1
        try {
          return await api.request(cfg)
        } catch (e) {
          // fallthrough to error提示
        }
      }
      const msg = err?.response?.data?.msg || err.message
      if (err?.code !== 'ERR_CANCELED') {
        message.destroy('api-error')
        message.error({ content: msg || '请求失败', key: 'api-error', duration: 2 })
      }
      return Promise.reject(err)
    }
  )
}

setupInterceptors()
