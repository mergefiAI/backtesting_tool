import React, {useMemo} from 'react'
import {Menu} from 'antd'
import {useLocation, useNavigate} from 'react-router-dom'
import {routeConfig} from '../router'

/**
 * SidebarMenu：根据 routeConfig 渲染多级菜单
 * - 支持图标+文字
 * - 根据 pathname 高亮与展开
 * - 水平显示
 */
export default function SidebarMenu() {
  const location = useLocation()
  const navigate = useNavigate()

  const buildItems = useMemo(() => {
    const mapNode = (node: any): any => {
      const label = (
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>{node.icon}{node.meta?.title || node.title}</span>
      )

      return {
        key: node.path,
        label,
        children: Array.isArray(node.children) ? node.children.filter((c: any) => !c.meta?.hideInMenu).map(mapNode) : undefined,
      }
    }
    return routeConfig.filter((r: any) => !r.meta?.hideInMenu).map(mapNode)
  }, [])

  const selectedKeys = useMemo(() => {
    return [location.pathname]
  }, [location.pathname])

  /**
   * 菜单点击导航
   */
  const onClick = (info: any) => {
    navigate(info.key)
  }

  return (
    <Menu
      mode="horizontal"
      selectedKeys={selectedKeys}
      items={buildItems}
      onClick={onClick}
      style={{ borderBottom: 'none', background: 'transparent' }}
    />
  )
}

