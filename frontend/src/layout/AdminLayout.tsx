import React, {useEffect, useMemo, useState} from 'react'
import {Layout, Space, theme, Typography} from 'antd'

import {Outlet, useLocation, useNavigate} from 'react-router-dom'
import SidebarMenu from '../components/SidebarMenu'
import Breadcrumbs from '../components/Breadcrumbs'
import logo from '../assets/images/logo_blue.png'
import '../styles/layout.css'

const { Header, Content } = Layout

/**
 * AdminLayout：后台管理系统主布局
 * - 顶部固定导航
 * - 右侧内容区包含面包屑与页面内容
 */
export default function AdminLayout() {
  const { token } = theme.useToken()
  const location = useLocation()
  const navigate = useNavigate()

  const [dark, setDark] = useState<boolean>(false)

  /**
   * 初始化主题状态（持久化）
   */
  useEffect(() => {
    try {
      const darkVal = localStorage.getItem('admin_theme_dark')
      setDark(darkVal === '1')
    } catch {}
  }, [])

  /**
   * 持久化主题设置
   */
  useEffect(() => {
    try {
      localStorage.setItem('admin_theme_dark', dark ? '1' : '0')
    } catch {}
  }, [dark])

  const headerStyle = useMemo(() => ({
    background: dark ? '#001529' : token.colorBgContainer,
    borderBottom: `1px solid ${token.colorBorder}`,
    padding: '0 24px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
  }), [dark, token])

  return (
    <Layout className="admin-layout-root">
      <Header style={headerStyle} className="admin-layout-header">
        <Space size="middle" align="center" style={{ display: 'flex', alignItems: 'center', height: '100%' }}>
          <div 
            style={{ display: 'flex', alignItems: 'center', cursor: 'pointer', paddingRight: '24px' }} 
            onClick={() => navigate('/')}
          >
            <img src={logo} alt="Logo" style={{ height: 32, marginRight: 12 }} />
            <Typography.Text strong style={{ color: dark ? '#fff' : '#1f1f1f', fontSize: '18px' }}>
              AI交易策略后台
            </Typography.Text>
          </div>
          <div style={{ flex: 1 }}>
            <SidebarMenu />
          </div>
        </Space>
      </Header>
      <Content className="admin-layout-content">
        <Breadcrumbs pathname={location.pathname} />
        <div className="admin-page-container">
          <Outlet />
        </div>
      </Content>
    </Layout>
  )
}
