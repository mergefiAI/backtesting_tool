import React from 'react';
import {DrawerProvider, useDrawer} from './DrawerContext';
import DetailDrawer from './DetailDrawer';

// 自动显示的抽屉组件，监听全局状态
const AutoDetailDrawer: React.FC = () => {
  const { state, actions } = useDrawer();
  
  return (
    <DetailDrawer
      visible={state.visible}
      type={state.type}
      id={state.id}
      data={state.data}
      onClose={actions.closeDrawer}
    />
  );
};

// 组合了Provider和Drawer的完整组件
const DrawerWithProvider: React.FC<{children: React.ReactNode}> = ({ children }) => {
  return (
    <DrawerProvider>
      {children}
      <AutoDetailDrawer />
    </DrawerProvider>
  );
};

// 导出所有需要的内容
export { useDrawer };
export default DrawerWithProvider;