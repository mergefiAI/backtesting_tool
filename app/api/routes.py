"""
API路由定义
"""
from fastapi import APIRouter

from .routes import router as routes_router

router = APIRouter()

# 注册所有路由
router.include_router(routes_router)
