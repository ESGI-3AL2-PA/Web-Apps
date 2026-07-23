"""
SATAN QL — Exécuteur

Exécute une opération traduite (dict, cf. translator.py) contre une base
MongoDB vivante via pymongo et renvoie un résultat sérialisable en JSON. C'est
ici que la requête touche réellement la base — le côté Node ne parle jamais à
Mongo, il ne fait que piloter ce worker.
"""

import os
from typing import Any, Dict

# Plafond côté serveur sur les opérations de lecture : un filtre pathologique /
# coûteux (ex. un gros scan `$regex`) ne doit pas monopoliser mongod ni bloquer
# indéfiniment l'unique worker — au-delà de ce budget Mongo avorte l'opération et
# on renvoie une erreur. Lectures seulement : find/count acceptent maxTimeMS ; les
# écritures indexées par id sont peu coûteuses. 0 désactive le plafond.
_MAX_TIME_MS = int(os.environ.get("SATAN_MAX_TIME_MS", "5000"))


def _map_id(doc: dict) -> dict:
    """Renomme le `_id` de Mongo en `id` métier (aligné sur les repositories de l'api)."""
    if "_id" in doc:
        doc = dict(doc)
        doc["id"] = doc.pop("_id")
    return doc


def execute(db, op: Dict[str, Any]) -> Any:
    """Aiguille une opération traduite vers `db` (une Database pymongo)."""
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
