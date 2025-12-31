import React from 'react'
import {AppRouter} from './router'
import {ConfigProvider} from './components/ConfigContext'
import DrawerWithProvider from './components/DetailDrawer'

/**
 * 顶层应用组件：包含导航与路由渲染
 */
export default function App() {
  return (
    <ConfigProvider>
      <DrawerWithProvider>
        <AppRouter />
      </DrawerWithProvider>
    </ConfigProvider>
  )
}
