import React, {createContext, ReactNode, useCallback, useContext, useState} from 'react';

// 详情类型定义
export type DetailType = 'local-decision' | 'trade' | 'account' | 'snapshot' | 'prompt-template' | 'task-create' | 'kline-related';

// 抽屉状态接口
interface DrawerState {
  visible: boolean;
  type: DetailType | null;
  id: string | null;
  data?: any;
}

// 抽屉操作接口
interface DrawerActions {
  openDrawer: (type: DetailType, id?: string | any, data?: any) => void;
  closeDrawer: () => void;
}

// 创建上下文
interface DrawerContextType {
  state: DrawerState;
  actions: DrawerActions;
}

const DrawerContext = createContext<DrawerContextType | undefined>(undefined);

// 上下文提供者Props接口
interface DrawerProviderProps {
  children: ReactNode;
}

// 上下文提供者组件
export const DrawerProvider: React.FC<DrawerProviderProps> = ({ children }) => {
  const [state, setState] = useState<DrawerState>({
    visible: false,
    type: null,
    id: null,
    data: null,
  });

  // 打开抽屉
  const openDrawer = useCallback((type: DetailType, id?: string, data?: any) => {
    // 兼容旧的调用方式：如果第二个参数是对象且没有id，则认为是data
    // 但根据TaskManager的调用：openDrawer('task-create', { onSuccess: load })
    // 这里的第二个参数实际上是data，而id应该是undefined
    // 所以我们需要判断id的类型
    
    let actualId = id;
    let actualData = data;
    
    if (typeof id === 'object' && id !== null) {
        actualData = id;
        actualId = undefined;
    }

    console.log('📖 [DrawerContext] 打开抽屉:', { type, id: actualId, data: actualData });
    
    setState({
      visible: true,
      type,
      id: actualId || null,
      data: actualData,
    });
    
    console.log('✅ [DrawerContext] 抽屉状态已更新:', {
      visible: true,
      type,
      id: actualId,
      data: actualData
    });
  }, []);

  // 关闭抽屉
  const closeDrawer = useCallback(() => {
    console.log('🔒 [DrawerContext] 关闭抽屉');
    setState({
      visible: false,
      type: null,
      id: null,
      data: null,
    });
    console.log('✅ [DrawerContext] 抽屉已关闭');
  }, []);

  const value = {
    state,
    actions: {
      openDrawer,
      closeDrawer,
    },
  };

  return (
    <DrawerContext.Provider value={value}>
      {children}
    </DrawerContext.Provider>
  );
};

// 自定义Hook，方便使用抽屉上下文
export const useDrawer = () => {
  const context = useContext(DrawerContext);
  if (context === undefined) {
    throw new Error('useDrawer must be used within a DrawerProvider');
  }
  return context;
};
