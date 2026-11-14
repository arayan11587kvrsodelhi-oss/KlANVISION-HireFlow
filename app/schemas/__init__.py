"""HireFlow schemas package initialization.

Each module is imported explicitly so a missing module is a visible error
instead of a silent wildcard-import failure.
"""

from app.schemas import common  # noqa: F401
from app.schemas import user  # noqa: F401
from app.schemas import company  # noqa: F401
from app.schemas import job  # noqa: F401
from app.schemas import application  # noqa: F401
from app.schemas import resume  # noqa: F401
from app.schemas import candidate  # noqa: F401
from app.schemas import admin  # noqa: F401
