"""Entry point backend FastAPI untuk Vercel (Python serverless).

Vercel menjalankan variabel `app` di folder `api/` sebagai handler ASGI.
Modul backend asli ada di `backend/`, jadi kita tambahkan ke sys.path lalu
impor `server:app` apa adanya tanpa mengubah kode backend.
"""

import os
import sys
from pathlib import Path

AKAR = Path(__file__).resolve().parent.parent
BACKEND = AKAR / "backend"
if str(BACKEND) not in sys.path:
    sys.path.insert(0, str(BACKEND))

# Vercel tidak menyediakan .env; semua lewat Environment Variables.
os.environ.setdefault("DB_NAME", "bengkel")

from server import app  # noqa: E402  (harus setelah sys.path diatur)

__all__ = ["app"]
