"""提示词相关路由"""
import uuid

from fastapi import APIRouter, Depends
from sqlmodel import Session

from app.api.schemas import PaginatedResponse, ApiResponse, PromptTemplateQuery, PromptTemplateCreateRequest, \
    PromptTemplateUpdateRequest
from app.database import get_session_dep
from app.models.models import PromptTemplate
from app.utils.timestamp_utils import TimestampUtils
from cfg import logger

router = APIRouter()


@router.get("/prompt-templates", response_model=PaginatedResponse)
async def get_prompt_templates(
        query: PromptTemplateQuery = Depends(),
        db: Session = Depends(get_session_dep)
) -> PaginatedResponse:
    """获取策略列表"""
    try:
        # 构建查询条件
        db_query = db.query(PromptTemplate)
        
        if query.status:
            db_query = db_query.filter(PromptTemplate.status == query.status)
        if query.keyword:
            keyword_filter = f"%{query.keyword}%"
            db_query = db_query.filter(
                (PromptTemplate.content.like(keyword_filter)) |
                (PromptTemplate.description.like(keyword_filter))
            )
        
        # 计算总数
        total = db_query.count()
        
        # 分页查询
        templates = db_query.order_by(PromptTemplate.created_at.desc()).offset(
            (query.page - 1) * query.page_size
        ).limit(query.page_size).all()
        
        # 转换为字典格式
        data = [{
            "prompt_id": str(t.prompt_id),
            "content": t.content,
            "description": t.description,
            "status": t.status.value,
            "tags": t.tags,
            "created_at": TimestampUtils.to_utc_iso(t.created_at),
            "updated_at": TimestampUtils.to_utc_iso(t.updated_at)
        } for t in templates]
        
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
        logger.error(f"获取策略列表失败: {str(e)}")
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


@router.post("/prompt-templates", response_model=ApiResponse)
async def create_prompt_template(
        request: PromptTemplateCreateRequest,
        db: Session = Depends(get_session_dep)
) -> ApiResponse:
    """创建策略"""
    try:
        # 生成唯一的prompt_id
        template = PromptTemplate(
            prompt_id=str(uuid.uuid4()),
            content=request.content,
            description=request.description,
            tags=request.tags,
            status=request.status
        )
        db.add(template)
        db.commit()
        db.refresh(template)
        
        return ApiResponse(
            code=200,
            msg="success",
            data={
                "prompt_id": str(template.prompt_id),
                "content": template.content,
                "description": template.description,
                "status": template.status.value,
                "tags": template.tags,
                "created_at": TimestampUtils.to_utc_iso(template.created_at),
                "updated_at": TimestampUtils.to_utc_iso(template.updated_at)
            }
        )
    except Exception as e:
        db.rollback()
        logger.error(f"创建策略失败: {str(e)}")
        return ApiResponse(
            code=500,
            msg=str(e),
            data=None
        )


@router.get("/prompt-templates/{prompt_id}", response_model=ApiResponse)
async def get_prompt_template(
        prompt_id: str,
        db: Session = Depends(get_session_dep)
) -> ApiResponse:
    """获取单个策略"""
    try:
        template = db.query(PromptTemplate).filter(
            PromptTemplate.prompt_id == prompt_id
        ).first()
        
        if not template:
            return ApiResponse(code=404, msg="策略不存在", data=None)
        
        return ApiResponse(
            code=200,
            msg="success",
            data={
                "prompt_id": str(template.prompt_id),
                "content": template.content,
                "description": template.description,
                "status": template.status.value,
                "tags": template.tags,
                "created_at": TimestampUtils.to_utc_iso(template.created_at),
                "updated_at": TimestampUtils.to_utc_iso(template.updated_at)
            }
        )
    except Exception as e:
        logger.error(f"获取策略失败: {str(e)}")
        return ApiResponse(
            code=500,
            msg=str(e),
            data=None
        )


@router.put("/prompt-templates/{prompt_id}", response_model=ApiResponse)
async def update_prompt_template(
        prompt_id: str,
        request: PromptTemplateUpdateRequest,
        db: Session = Depends(get_session_dep)
) -> ApiResponse:
    """更新策略"""
    try:
        template = db.query(PromptTemplate).filter(
            PromptTemplate.prompt_id == prompt_id
        ).first()
        
        if not template:
            return ApiResponse(code=404, msg="策略不存在", data=None)
        
        # 更新字段
        if request.content is not None:
            template.content = request.content
        if request.description is not None:
            template.description = request.description
        if request.tags is not None:
            template.tags = request.tags
        if request.status is not None:
            template.status = request.status
        
        template.updated_at = TimestampUtils.now_utc_naive()
        db.commit()
        db.refresh(template)
        
        return ApiResponse(
            code=200,
            msg="success",
            data={
                "prompt_id": str(template.prompt_id),
                "content": template.content,
                "description": template.description,
                "status": template.status.value,
                "tags": template.tags,
                "created_at": TimestampUtils.to_utc_iso(template.created_at),
                "updated_at": TimestampUtils.to_utc_iso(template.updated_at)
            }
        )
    except Exception as e:
        db.rollback()
        logger.error(f"更新策略失败: {str(e)}")
        return ApiResponse(
            code=500,
            msg=str(e),
            data=None
        )


@router.delete("/prompt-templates/{prompt_id}", response_model=ApiResponse)
async def delete_prompt_template(
        prompt_id: str,
        db: Session = Depends(get_session_dep)
) -> ApiResponse:
    """删除策略"""
    try:
        template = db.query(PromptTemplate).filter(
            PromptTemplate.prompt_id == prompt_id
        ).first()
        
        if not template:
            return ApiResponse(code=404, msg="策略不存在", data=None)
        
        # 物理删除
        db.delete(template)
        db.commit()
        
        return ApiResponse(
            code=200,
            msg="success",
            data={"message": "策略已删除"}
        )
    except Exception as e:
        db.rollback()
        logger.error(f"删除策略失败: {str(e)}")
        return ApiResponse(
            code=500,
            msg=str(e),
            data=None
        )
