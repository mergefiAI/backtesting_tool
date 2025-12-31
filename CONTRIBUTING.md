# 贡献指南 (Contributing Guide)

> 🎉 首先，感谢你愿意为 AI交易策略回测系统 贡献力量！

无论你是想修复一个拼写错误，还是计划实现一个重要功能，我们都非常欢迎。本指南将帮助你了解如何参与这个项目。

---

## 📋 目录

- [行为准则](#行为准则)
- [我能做什么贡献？](#我能做什么贡献)
- [开始之前](#开始之前)
- [开发环境搭建](#开发环境搭建)
- [贡献流程](#贡献流程)
- [代码规范](#代码规范)
- [测试要求](#测试要求)
- [提交信息规范](#提交信息规范)
- [PR审核流程](#pr审核流程)
- [社区资源](#社区资源)
- [获取帮助](#获取帮助)

---

## 📜 行为准则

本项目遵循 [Code of Conduct](CODE_OF_CONDUCT.md)。参与本项目即表示你同意遵守其中的规定。我们致力于营造一个友好、包容、专业的社区环境。

**核心原则：**
- 🤝 尊重所有参与者
- 💬 使用友好和包容性语言
- 🎯 专注于对项目最有利的事情
- ❤️ 对新手保持耐心和同理心

---

## 🎯 我能做什么贡献？

### 🌟 非代码贡献（新手友好）

不需要编程经验也可以做出有价值的贡献！

#### 📚 文档改进
- 修正拼写、语法错误
- 完善API文档和使用说明
- 编写教程和最佳实践指南
- 翻译文档（英文、日文等）
- 改进代码注释

**寻找文档任务**: 查看标签 [`documentation`](../../labels/documentation)

#### 🐛 测试与反馈
- 报告Bug（请提供详细复现步骤）
- 测试新功能并提供反馈
- 在不同操作系统测试（Windows/Linux/macOS）
- 改进现有测试用例
- 验证数据质量

**寻找测试任务**: 查看标签 [`needs-testing`](../../labels/needs-testing)

#### 💬 社区支持
- 在 [GitHub Issues](../../issues) 回答用户问题
- 在 [Telegram群组](链接) 帮助其他用户
- 整理常见问题FAQ
- 分享使用案例和回测策略

### 💻 代码贡献

#### 初级任务（标签：`good-first-issue`）
适合新手的任务，通常涉及：
- 修复已明确的Bug
- 添加单元测试
- 改进代码注释
- 重构小模块代码
- 修复代码格式问题

**开始你的第一个贡献**: [Good First Issues](../../labels/good-first-issue)

#### 中级任务（标签：`help-wanted`）
需要一定经验的任务：
- 实现新的回测指标
- 优化回测性能
- 添加新的数据源适配
- 改进错误处理和日志
- 增强前端交互体验

**查看中级任务**: [Help Wanted](../../labels/help-wanted)

---

## 🚦 开始之前

### 1. 搜索现有内容

避免重复工作：
- 搜索 [Issues](../../issues) 和 [Pull Requests](../../pulls)
- 查看 [Discussions](../../discussions) 中的讨论
- 阅读 [FAQ](docs/FAQ.md)

### 2. 声明你的工作

找到想处理的Issue后：
```markdown
我想处理这个Issue，预计X天内提交PR。如果有相关资料或建议，请告知，谢谢！
```

这样可以避免多人重复工作。

### 3. 需要新建Issue吗？

如果你发现了Bug或有新想法，但没有对应的Issue：

**Bug报告**: 使用 [Bug Report模板](../../issues/new?template=bug_report.md)  
**功能建议**: 使用 [Feature Request模板](../../issues/new?template=feature_request.md)  
**提问**: 使用 [Question模板](../../issues/new?template=question.md)

---

## 🛠️ 开发环境搭建

### 系统要求

- **操作系统**: Windows 10+, macOS 10.15+, Linux (Ubuntu 20.04+)
- **Python**: 3.12 或更高版本
- **Node.js**: 18 或更高版本
- **pnpm**: 8 或更高版本
- **Git**: 2.30 或更高版本

### 快速开始

#### 1. Fork并克隆仓库

```bash
# Fork 仓库到你的GitHub账号（点击页面右上角的 Fork 按钮）

# 克隆你的Fork
git clone https://github.com/YOUR_USERNAME/backtesting_tool.git
cd backtesting_tool

# 添加上游仓库
git remote add upstream https://github.com/MergeFi/backtesting_tool.git
```

#### 2. 后端环境配置

```bash
# 创建虚拟环境
python -m venv venv

# 激活虚拟环境
# Windows:
venv\Scripts\activate
# macOS/Linux:
source venv/bin/activate

# 安装依赖
pip install -r requirements.txt
```

#### 3. 配置文件设置

```bash
# 复制环境配置模板
cp cfg/.env.sqlite .env

# (可选) 编辑配置文件
# vim .env
```
注意：项目默认使用 SQLite 数据库 (`backtesting_dev.db`)，无需额外安装数据库服务。

#### 4. 前端环境配置

```bash
cd frontend
pnpm install
```

#### 5. 运行开发服务器

**后端 (Terminal 1):**
```bash
# 直接启动
python main.py

# 或使用脚本 (Linux/Mac)
./start.sh
```
后端服务将在 `http://localhost:8000` 启动，API 文档位于 `http://localhost:8000/docs`。

**前端 (Terminal 2):**
```bash
cd frontend
pnpm dev
```
前端页面将在 `http://localhost:5173` 启动。

---

## 🔄 贡献流程

### 完整工作流程

```
1. 创建分支 → 2. 编写代码 → 3. 测试验证 → 4. 提交代码 → 5. 创建PR → 6. Code Review → 7. 合并
```

### Step 1: 同步上游代码

```bash
# 拉取上游最新代码
git fetch upstream
git checkout main
git merge upstream/main

# 推送到你的Fork
git push origin main
```

### Step 2: 创建功能分支

```bash
# 分支命名规范
git checkout -b <type>/<brief-description>

# 示例
git checkout -b feature/add-sharpe-ratio        # 新功能
git checkout -b bugfix/fix-data-parsing         # Bug修复
git checkout -b docs/update-installation-guide  # 文档
```

### Step 3: 编写代码

遵循我们的 [代码规范](#代码规范)，编写清晰、可维护的代码。

### Step 4: 编写测试

**所有代码必须包含测试！**

```bash
# 运行后端测试
pytest tests/
```

### Step 5: 代码格式化与检查

```bash
# Python 代码格式化 (建议手动运行或配置编辑器自动保存时运行)
black .
isort .

# 前端代码检查 (如有)
# cd frontend && pnpm lint
```

### Step 6: 提交代码

遵循 [提交信息规范](#提交信息规范)。

### Step 7: 推送到远程并创建 PR

```bash
git push origin feature/add-sharpe-ratio
```
然后在 GitHub 上创建 Pull Request。

---

## 📐 代码规范

### Python代码规范

遵循 [PEP 8](https://peps.python.org/pep-0008/) 标准。

**关键规范**:
- 行长度：遵循 black 默认配置
- 命名：
  - 函数/变量：`snake_case`
  - 类：`PascalCase`
  - 常量：`UPPER_SNAKE_CASE`
- 类型提示：尽可能使用 Type Hints
- 文档字符串：使用 Google 风格

### TypeScript/React 代码规范

- 使用 Functional Components 和 Hooks
- 避免使用 `any` 类型
- 组件名使用 PascalCase (如 `TradeHistory.tsx`)
- 文件名保持一致
- 使用 `pnpm` 管理依赖

**组件示例**:
```tsx
import React, { useState, useEffect } from 'react';
import { Card } from 'antd';

interface Props {
  title: string;
}

export const MyComponent: React.FC<Props> = ({ title }) => {
  const [data, setData] = useState<string | null>(null);

  useEffect(() => {
    // fetch logic
  }, []);

  return <Card title={title}>{data}</Card>;
};
```

---

## 🧪 测试要求

### 后端测试

使用 `pytest` 进行测试。

```bash
# 运行所有测试
pytest

# 运行特定测试文件
pytest tests/services/test_market_data_service.py

# 生成覆盖率报告
pytest --cov=app tests/
```

### 前端测试

目前前端自动化测试正在建设中。请确保手动验证 UI 变更，并在 PR 中附上截图。

---

## 📝 提交信息规范

遵循 [Conventional Commits](https://www.conventionalcommits.org/)：

### 格式

```
<type>(<scope>): <subject>

<body>

<footer>
```

### Type类型

- `feat`: 新功能
- `fix`: Bug修复
- `docs`: 仅文档变更
- `style`: 代码格式（不影响代码运行）
- `refactor`: 重构（既不是新功能也不是Bug修复）
- `perf`: 性能优化
- `test`: 添加或修改测试
- `chore`: 构建过程或辅助工具变动

### 示例

```bash
feat(backtest): add Sharpe ratio calculation
fix(api): resolve CORS issue in local dev
docs(readme): update installation steps
```

---

## 👀 PR审核流程

1. **自动化检查**: CI/CD (如有) 会运行测试。
2. **人工审核**: 维护者会检查代码质量、功能完整性和测试覆盖。
3. **反馈**: 请根据审核意见进行修改。
4. **合并**: 审核通过后，代码将被合并到主分支。

---

## 🎓 社区资源

- **GitHub仓库**: [https://github.com/MergeFi/backtesting_tool](链接)
- **文档**: 查看 `docs/` 目录下的文档

---

## 🆘 获取帮助

**技术问题**
1. 搜索 [Issues](../../issues)
2. 查看项目文档
3. 创建新的 [GitHub Issue](../../issues/new)

**导师制度**
如果你是第一次贡献开源项目，可以在PR中评论：`@mentor 请求导师指导`，我们会分配维护者协助你。

---

## 🏆 贡献者激励

我们重视每一位贡献者的付出！长期活跃贡献者将获得社区权益和礼品。

---

## 📄 许可证

本项目采用 [Apache 2.0 License](LICENSE)。

---

## 🙏 致谢

感谢所有贡献者！你们的每一个PR、每一条Issue、每一次讨论都让这个项目变得更好。

---

**再次感谢你的贡献！一起让量化交易回测变得零门槛！** 🚀
