"""API路由模块"""
from fastapi import APIRouter

from . import trade, decision, task, prompt, account, market, data_import, ai_config

router = APIRouter()

# 注册所有路由
router.include_router(trade.router, prefix="/api", tags=["trade"])
router.include_router(decision.router, prefix="/api", tags=["decision"])
router.include_router(task.router, prefix="/api", tags=["task"])
router.include_router(prompt.router, prefix="/api", tags=["prompt"])
router.include_router(account.router, prefix="/api", tags=["account"])
router.include_router(market.router, prefix="/api", tags=["market"])
router.include_router(data_import.router, prefix="", tags=["data-import"])
router.include_router(ai_config.router, prefix="/api", tags=["ai-config"])
