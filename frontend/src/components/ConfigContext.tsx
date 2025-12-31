import React, {createContext, ReactNode, useContext, useState} from 'react'

/**
 * 配置抽屉上下文类型
 */
interface ConfigContextType {
  visible: boolean
  showConfig: () => void
  hideConfig: () => void
  toggleConfig: () => void
}

/**
 * 配置抽屉上下文
 */
const ConfigContext = createContext<ConfigContextType | undefined>(undefined)

/**
 * 配置抽屉提供者组件Props
 */
interface ConfigProviderProps {
  children: ReactNode
}

/**
 * 配置抽屉提供者组件
 * 提供全局配置抽屉状态管理
 */
export function ConfigProvider({ children }: ConfigProviderProps) {
  const [visible, setVisible] = useState(false)

  const showConfig = () => setVisible(true)
  const hideConfig = () => setVisible(false)
  const toggleConfig = () => setVisible(prev => !prev)

  const value = {
    visible,
    showConfig,
    hideConfig,
    toggleConfig
  }

  return (
    <ConfigContext.Provider value={value}>
      {children}
    </ConfigContext.Provider>
  )
}

/**
 * 使用配置抽屉上下文的Hook
 */
export function useConfig() {
  const context = useContext(ConfigContext)
  if (context === undefined) {
    throw new Error('useConfig must be used within a ConfigProvider')
  }
  return context
}