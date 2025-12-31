# 使用 Docker Hub 官方 Node.js 基础镜像（通过国内镜像加速器拉取）
FROM node:20-alpine

WORKDIR /app

# 配置国内 npm 镜像源
RUN npm config set registry https://registry.npmmirror.com

# 复制依赖文件
COPY package.json ./

# 安装前端依赖
RUN npm install

# 复制应用代码
COPY . .

# 暴露端口
EXPOSE 5173

# 启动命令（开发模式）
CMD ["npm", "run", "dev"]