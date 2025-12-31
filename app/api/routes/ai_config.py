"""AI配置相关路由"""
import uuid

from fastapi import APIRouter, Depends
from sqlmodel import Session

from app.api.schemas import PaginatedResponse, ApiResponse, AIConfigQuery, AIConfigCreateRequest, AIConfigUpdateRequest
from app.database import get_session_dep
from app.models.models import AIConfig
from app.utils.timestamp_utils import TimestampUtils
from cfg import logger

router = APIRouter()


@router.get("/ai-configs", response_model=PaginatedResponse)
async def get_ai_configs(
        query: AIConfigQuery = Depends(),
        db: Session = Depends(get_session_dep)
) -> PaginatedResponse:
    """获取AI配置列表"""
    try:
        # 构建查询条件
        db_query = db.query(AIConfig)
        
        if query.keyword:
            keyword_filter = f"%{query.keyword}%"
            db_query = db_query.filter(
                (AIConfig.name.like(keyword_filter))
            )
        
        # 计算总数
        total = db_query.count()
        
        # 分页查询
        configs = db_query.order_by(AIConfig.created_at.desc()).offset(
            (query.page - 1) * query.page_size
        ).limit(query.page_size).all()
        
        # 转换为字典格式
        data = [{
            "config_id": str(c.config_id),
            "name": c.name,
            "local_ai_base_url": c.local_ai_base_url,
            "local_ai_api_key": c.local_ai_api_key,
            "local_ai_model_name": c.local_ai_model_name,
            "created_at": TimestampUtils.to_utc_iso(c.created_at),
            "updated_at": TimestampUtils.to_utc_iso(c.updated_at)
        } for c in configs]
        
        return PaginatedResponse(
            code=200,
            msg="success",
            data={
                "items": data,
                "page": query.page,
                "page_size": query.page_size,
                "total": total,
                "total_pages": (total + query.page_size - 1) // query.page_size
            }
        )
    except Exception as e:
        logger.error(f"获取AI配置列表失败: {str(e)}")
        return PaginatedResponse(
            code=500,
            msg=str(e),
            data={
                "items": [],
                "page": query.page,
                "page_size": query.page_size,
                "total": 0,
                "total_pages": 0
            }
        )


@router.post("/ai-configs", response_model=ApiResponse)
async def create_ai_config(
        request: AIConfigCreateRequest,
        db: Session = Depends(get_session_dep)
) -> ApiResponse:
    """创建AI配置"""
    try:
        # 生成唯一的config_id
        config = AIConfig(
            config_id=str(uuid.uuid4()),
            name=request.name,
            local_ai_base_url=request.local_ai_base_url,
            local_ai_api_key=request.local_ai_api_key,
            local_ai_model_name=request.local_ai_model_name
        )
        db.add(config)
        db.commit()
        db.refresh(config)
        
        return ApiResponse(
            code=200,
            msg="success",
            data={
                "config_id": str(config.config_id),
                "name": config.name,
                "local_ai_base_url": config.local_ai_base_url,
                "local_ai_api_key": config.local_ai_api_key,
                "local_ai_model_name": config.local_ai_model_name,
                "created_at": TimestampUtils.to_utc_iso(config.created_at),
                "updated_at": TimestampUtils.to_utc_iso(config.updated_at)
            }
        )
    except Exception as e:
        db.rollback()
        logger.error(f"创建AI配置失败: {str(e)}")
        return ApiResponse(
            code=500,
            msg=str(e),
            data=None
        )


@router.get("/ai-configs/{config_id}", response_model=ApiResponse)
async def get_ai_config(
        config_id: str,
        db: Session = Depends(get_session_dep)
) -> ApiResponse:
    """获取单个AI配置"""
    try:
        config = db.query(AIConfig).filter(
            AIConfig.config_id == config_id
        ).first()
        
        if not config:
            return ApiResponse(code=404, msg="AI配置不存在", data=None)
        
        return ApiResponse(
            code=200,
            msg="success",
            data={
                "config_id": str(config.config_id),
                "name": config.name,
                "local_ai_base_url": config.local_ai_base_url,
                "local_ai_api_key": config.local_ai_api_key,
                "local_ai_model_name": config.local_ai_model_name,
                "created_at": TimestampUtils.to_utc_iso(config.created_at),
                "updated_at": TimestampUtils.to_utc_iso(config.updated_at)
            }
        )
    except Exception as e:
        logger.error(f"获取AI配置失败: {str(e)}")
        return ApiResponse(
            code=500,
            msg=str(e),
            data=None
        )


@router.put("/ai-configs/{config_id}", response_model=ApiResponse)
async def update_ai_config(
        config_id: str,
        request: AIConfigUpdateRequest,
        db: Session = Depends(get_session_dep)
) -> ApiResponse:
    """更新AI配置"""
    try:
        config = db.query(AIConfig).filter(
            AIConfig.config_id == config_id
        ).first()
        
        if not config:
            return ApiResponse(code=404, msg="AI配置不存在", data=None)
        
        # 更新字段
        if request.name is not None:
            config.name = request.name
        if request.local_ai_base_url is not None:
            config.local_ai_base_url = request.local_ai_base_url
        if request.local_ai_api_key is not None:
            config.local_ai_api_key = request.local_ai_api_key
        if request.local_ai_model_name is not None:
            config.local_ai_model_name = request.local_ai_model_name
        
        config.updated_at = TimestampUtils.now_utc_naive()
        db.commit()
        db.refresh(config)
        
        return ApiResponse(
            code=200,
            msg="success",
            data={
                "config_id": str(config.config_id),
                "name": config.name,
                "local_ai_base_url": config.local_ai_base_url,
                "local_ai_api_key": config.local_ai_api_key,
                "local_ai_model_name": config.local_ai_model_name,
                "created_at": TimestampUtils.to_utc_iso(config.created_at),
                "updated_at": TimestampUtils.to_utc_iso(config.updated_at)
            }
        )
    except Exception as e:
        db.rollback()
        logger.error(f"更新AI配置失败: {str(e)}")
        return ApiResponse(
            code=500,
            msg=str(e),
            data=None
        )


@router.delete("/ai-configs/{config_id}", response_model=ApiResponse)
async def delete_ai_config(
        config_id: str,
        db: Session = Depends(get_session_dep)
) -> ApiResponse:
    """删除AI配置"""
    try:
        config = db.query(AIConfig).filter(
            AIConfig.config_id == config_id
        ).first()
        
        if not config:
            return ApiResponse(code=404, msg="AI配置不存在", data=None)
        
        # 物理删除
        db.delete(config)
        db.commit()
        
        return ApiResponse(
            code=200,
            msg="success",
            data={"message": "AI配置已删除"}
        )
    except Exception as e:
        db.rollback()
        logger.error(f"删除AI配置失败: {str(e)}")
        return ApiResponse(
            code=500,
            msg=str(e),
            data=None
        )
