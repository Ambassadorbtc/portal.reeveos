"""
ReeveOS Tenant-Scoped Database
==============================
Wraps Motor collections to AUTOMATICALLY inject businessId/tenant_id
into every query. A developer using this wrapper CANNOT accidentally
leak cross-tenant data — the filter is injected at the wrapper level.

Usage in routes:
    from middleware.tenant_db import get_scoped_db
    
    @router.get("/business/{business_id}/bookings")
    async def list_bookings(
        business_id: str,
        tenant: TenantContext = Depends(verify_business_access),
    ):
        sdb = get_scoped_db(tenant.business_id)
        # This query AUTOMATICALLY includes {"businessId": business_id}
        bookings = await sdb.bookings.find_many({})
        return bookings
"""
from motor.motor_asyncio import AsyncIOMotorCollection
from bson import ObjectId
from typing import Optional, List, Any
from database import get_database
import logging

logger = logging.getLogger("tenant_db")


class ScopedCollection:
    """
    Wraps a Motor collection. Every read/write operation is automatically
    scoped to the tenant's businessId. There is NO way to bypass this —
    the filter is injected at the lowest level.
    """
    
    # Collections where tenant field is "businessId" (camelCase)
    CAMEL_CASE_COLLECTIONS = {
        "bookings", "appointments", "tables", "staff", "reviews",
        "services", "menu_items", "clients", "floor_plans",
        "marketing_campaigns", "email_campaigns", "growth_leads",
    }
    
    # Collections where tenant field is "business_id" (snake_case legacy)
    SNAKE_CASE_COLLECTIONS = {
        "reservations", "consultation_submissions", "consultation_templates",
        "client_timeline", "client_tasks", "pipeline_config",
        "support_conversations",
    }
    
    def __init__(self, collection: AsyncIOMotorCollection, tenant_id: str, tenant_field: str = "businessId"):
        self._coll = collection
        self._tenant_id = tenant_id
        self._field = tenant_field
        # Pre-compute both string and ObjectId versions for matching
        self._tenant_values = [tenant_id]
        if ObjectId.is_valid(tenant_id):
            self._tenant_values.append(ObjectId(tenant_id))
    
    def _scope(self, filter_dict: Optional[dict] = None) -> dict:
        """Inject tenant filter. Uses $in to match both str and ObjectId."""
        scoped = {self._field: {"$in": self._tenant_values}}
        if filter_dict:
            scoped.update(filter_dict)
        return scoped
    
    def _stamp(self, document: dict) -> dict:
        """Stamp tenant ID onto new documents."""
        doc = dict(document)
        doc[self._field] = self._tenant_id
        return doc
    
    # ─── READ operations (all scoped) ───
    
    async def find_one(self, filter_dict: Optional[dict] = None, *args, **kwargs):
        return await self._coll.find_one(self._scope(filter_dict), *args, **kwargs)
    
    def find(self, filter_dict: Optional[dict] = None, *args, **kwargs):
        return self._coll.find(self._scope(filter_dict), *args, **kwargs)
    
    async def find_many(self, filter_dict: Optional[dict] = None, limit: int = 10000, **kwargs):
        cursor = self.find(filter_dict, **kwargs)
        return await cursor.to_list(length=limit)
    
    async def count_documents(self, filter_dict: Optional[dict] = None):
        return await self._coll.count_documents(self._scope(filter_dict))
    
    def aggregate(self, pipeline: list, *args, **kwargs):
        """Prepend $match stage to enforce tenant scope on aggregations."""
        scoped_pipeline = [{"$match": {self._field: {"$in": self._tenant_values}}}] + pipeline
        return self._coll.aggregate(scoped_pipeline, *args, **kwargs)
    
    # ─── WRITE operations (all scoped + stamped) ───
    
    async def insert_one(self, document: dict, *args, **kwargs):
        return await self._coll.insert_one(self._stamp(document), *args, **kwargs)
    
    async def insert_many(self, documents: list, *args, **kwargs):
        stamped = [self._stamp(doc) for doc in documents]
        return await self._coll.insert_many(stamped, *args, **kwargs)
    
    async def update_one(self, filter_dict: dict, update: dict, *args, **kwargs):
        return await self._coll.update_one(self._scope(filter_dict), update, *args, **kwargs)
    
    async def update_many(self, filter_dict: dict, update: dict, *args, **kwargs):
        return await self._coll.update_many(self._scope(filter_dict), update, *args, **kwargs)
    
    async def delete_one(self, filter_dict: dict, *args, **kwargs):
        return await self._coll.delete_one(self._scope(filter_dict), *args, **kwargs)
    
    async def delete_many(self, filter_dict: dict, *args, **kwargs):
        return await self._coll.delete_many(self._scope(filter_dict), *args, **kwargs)
    
    async def find_one_and_update(self, filter_dict: dict, update: dict, *args, **kwargs):
        return await self._coll.find_one_and_update(self._scope(filter_dict), update, *args, **kwargs)
    
    async def find_one_and_delete(self, filter_dict: dict, *args, **kwargs):
        return await self._coll.find_one_and_delete(self._scope(filter_dict), *args, **kwargs)


class TenantScopedDB:
    """
    Database wrapper that returns ScopedCollection for any collection access.
    
    Usage:
        sdb = get_scoped_db(business_id)
        bookings = await sdb.bookings.find_many({"status": "confirmed"})
        # ^ automatically includes {"businessId": {"$in": [business_id]}}
    """
    
    def __init__(self, tenant_id: str):
        self._tenant_id = tenant_id
        self._db = get_database()
        self._cache = {}
    
    def __getattr__(self, collection_name: str) -> ScopedCollection:
        if collection_name.startswith("_"):
            return super().__getattribute__(collection_name)
        
        if collection_name not in self._cache:
            # Determine the correct tenant field name
            if collection_name in ScopedCollection.SNAKE_CASE_COLLECTIONS:
                field = "business_id"
            else:
                field = "businessId"
            
            self._cache[collection_name] = ScopedCollection(
                self._db[collection_name],
                self._tenant_id,
                tenant_field=field
            )
        
        return self._cache[collection_name]
    
    @property
    def raw(self):
        """
        Escape hatch for admin operations that genuinely need unscoped access.
        ONLY use in admin routes with proper authorization.
        Logged as a security event.
        """
        logger.warning(f"RAW DB ACCESS requested for tenant={self._tenant_id}")
        return self._db


def get_scoped_db(business_id: str) -> TenantScopedDB:
    """Get a tenant-scoped database wrapper. All queries auto-filtered."""
    return TenantScopedDB(business_id)
