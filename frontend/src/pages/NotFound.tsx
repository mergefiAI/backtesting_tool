import React from 'react'

/**
 * 404 页面组件：当路由未匹配时显示提示
 */
export default function NotFound() {
  return (
    <div style={{ padding: 24 }}>
      <h2>页面不存在</h2>
      <p>请检查地址或通过导航菜单进入功能页面。</p>
    </div>
  )
}
