import React, {useMemo} from 'react'
import {Breadcrumb} from 'antd'
import {useNavigate} from 'react-router-dom'
import {routeConfig} from '../router'

export interface BreadcrumbsProps {
  pathname: string
}

/**
 * Breadcrumbs：根据当前路径自动生成面包屑
 * - 来源 routeConfig 的层级结构
 * - 支持点击跳转到对应层级
 */
export default function Breadcrumbs(props: BreadcrumbsProps) {
  const { pathname } = props
  const navigate = useNavigate()

  const matched = useMemo(() => {
    const res: Array<{ title: string, path: string }> = []

    const dfs = (nodes: any[], parents: any[] = []) => {
      for (const n of nodes) {
        const chain = [...parents, n]
        if (n.path === pathname) {
          res.push(...chain.map((c) => ({ title: c.meta?.title || c.title, path: c.path })))
          return true
        }
        if (Array.isArray(n.children) && dfs(n.children, chain)) {
          return true
        }
      }
      return false
    }
    dfs(routeConfig)
    return res
  }, [pathname])

  /**
   * 面包屑点击跳转
   */
  const onClick = (path: string, index: number) => {
    // 最末级不跳转
    if (index === matched.length - 1) return
    navigate(path)
  }

  const breadcrumbItems = useMemo(() => {
    return matched.map((m, idx) => ({
      key: m.path,
      title: m.title,
      onClick: () => onClick(m.path, idx)
    }))
  }, [matched, onClick])

  return (
    <Breadcrumb style={{ marginBottom: 12 }} items={breadcrumbItems} />
  )
}

