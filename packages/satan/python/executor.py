"""
SATAN QL — Executor

Runs a translated op dict (see translator.py) against a live MongoDB via pymongo
and returns a JSON-serialisable result. This is where the query actually hits
the database — the Node side never touches Mongo, it only drives the worker.
"""

import os
from typing import Any, Dict

# Server-side cap on read ops so a pathological/expensive filter (e.g. a heavy
# `$regex` scan) can't pin mongod or block the single worker indefinitely — Mongo
# aborts the op past this budget and we return an error. Reads only: find/count
# accept maxTimeMS; the id-keyed writes are cheap. 0 disables it.
_MAX_TIME_MS = int(os.environ.get("SATAN_MAX_TIME_MS", "5000"))


def _map_id(doc: dict) -> dict:
    """Rename Mongo's `_id` to the domain `id` (matches the api repositories)."""
    if "_id" in doc:
        doc = dict(doc)
        doc["id"] = doc.pop("_id")
    return doc


def execute(db, op: Dict[str, Any]) -> Any:
    """Dispatch a translated op against `db` (a pymongo Database)."""
    kind = op["op"]
    collection = db[op["collection"]]

    if kind == "find":
        cursor = collection.find(op.get("filter") or {}, op.get("projection"))
        if _MAX_TIME_MS:
            cursor = cursor.max_time_ms(_MAX_TIME_MS)
        if op.get("sort"):
            cursor = cursor.sort([(field, direction) for field, direction in op["sort"]])
        if op.get("skip"):
            cursor = cursor.skip(op["skip"])
        if op.get("limit"):
            cursor = cursor.limit(op["limit"])
        return [_map_id(doc) for doc in cursor]

    if kind == "countDocuments":
        kwargs = {"maxTimeMS": _MAX_TIME_MS} if _MAX_TIME_MS else {}
        return {"count": collection.count_documents(op.get("filter") or {}, **kwargs)}

    if kind == "insertOne":
        result = collection.insert_one(op["document"])
        return {"insertedId": result.inserted_id}

    if kind == "updateMany":
        result = collection.update_many(op.get("filter") or {}, op["update"])
        return {"matchedCount": result.matched_count, "modifiedCount": result.modified_count}

    if kind == "deleteMany":
        result = collection.delete_many(op.get("filter") or {})
        return {"deletedCount": result.deleted_count}

    raise ValueError(f"Opération inconnue : {kind!r}")
