"""Maintenance / Store Closed mode router.
- Toggle on/off via store_config.maintenance_mode.enabled
- Configurable: title, message, return_date, return_time, background_image_url
- Buyer sees lock screen ketika enabled; seller tetap bisa akses /#/seller
"""
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from typing import Optional
from .__init__ import now_iso

router = APIRouter(prefix="/maintenance", tags=["maintenance"])


class MaintenanceConfig(BaseModel):
    enabled: Optional[bool] = None
    title: Optional[str] = None
    message: Optional[str] = None
    return_date: Optional[str] = None  # ISO date YYYY-MM-DD
    return_time: Optional[str] = None  # HH:MM
    background_image_url: Optional[str] = None
    show_contact_wa: Optional[bool] = None
    return_button_text: Optional[str] = None


def get_default_maintenance():
    return {
        "enabled": False,
        "title": "Maaf, Ciltarasa libur dulu ya 🧡",
        "message": "Kami sedang libur sebentar untuk recharge & siapkan menu fresh untuk kamu. Kami akan kembali pada {return_date} pukul {return_time}. Terima kasih atas pengertiannya!",
        "return_date": "",
        "return_time": "08:00",
        "background_image_url": "",
        "show_contact_wa": True,
        "return_button_text": "Hubungi Seller via WhatsApp",
    }


def setup(api_router, db, require_seller, manager):
    """Register maintenance endpoints into the main api_router.
    `manager` is the WebSocket manager from server.py untuk broadcast perubahan.
    """

    @api_router.get("/maintenance")
    async def get_maintenance_status():
        """Public endpoint — buyer mengecek apakah store sedang tutup."""
        cfg = await db.store_config.find_one({"_id": "main"}) or {}
        mc = cfg.get("maintenance_mode") or get_default_maintenance()
        # Pastikan semua keys lengkap (backfill on-the-fly)
        defaults = get_default_maintenance()
        for k, v in defaults.items():
            if k not in mc:
                mc[k] = v
        return mc

    @api_router.put("/maintenance")
    async def update_maintenance(update: MaintenanceConfig, _auth: bool = Depends(require_seller)):
        """Seller-only: toggle dan edit maintenance config."""
        cfg = await db.store_config.find_one({"_id": "main"}) or {}
        current = cfg.get("maintenance_mode") or get_default_maintenance()
        upd = {k: v for k, v in update.model_dump().items() if v is not None}
        merged = {**current, **upd}
        await db.store_config.update_one(
            {"_id": "main"},
            {"$set": {"maintenance_mode": merged, "updated_at": now_iso()}},
            upsert=True,
        )
        # Broadcast ke connected clients (real-time refresh buyer)
        try:
            await manager.broadcast({"type": "maintenance_updated", "data": merged})
        except Exception:
            pass
        return merged
