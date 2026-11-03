# Local datastore reliability

The demo uses a **single-process JSON datastore**, not a transactional database. Its new ordered operation queue coordinates reads and writes inside one Node process. Atomic replacement uses uniquely named exclusive temporary files, flushes file data, renames on the same filesystem, and attempts to sync the parent directory. Failed transactions do not persist mutations, and queue failures do not permanently block later operations.

These safeguards reduce stale reads and accidental loss from interrupted writes. They do **not** provide multi-process locks, concurrent-host safety, tenant isolation, authentication, a backup strategy, or guaranteed durability on all filesystems. Never put live personally identifying records into this public-source synthetic demo. Before a real pilot, migrate to SQLite or a transactional server database and implement authenticated roles.
