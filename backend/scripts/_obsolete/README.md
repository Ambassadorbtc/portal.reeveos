# Obsolete Scripts — DO NOT RUN

These scripts were one-off fixes from early development. They use:
- passlib (broken in this environment — use direct bcrypt)
- Legacy role names ("owner", "admin" instead of "business_owner", "super_admin")
- Hardcoded passwords

Running any of these will **re-poison the database**.

All functionality is now handled by `fix_everything.py` which is the 
single source of truth for account management and data cleanup.
