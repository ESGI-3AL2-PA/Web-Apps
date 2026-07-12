"""
SATAN QL — Translator

Convertit l'AST produit par parser.py en opération MongoDB sérialisable
en JSON, telle que côté Node :

    {
      "op": "find" | "insertOne" | "updateMany" | "deleteMany",
      "collection": "<nom>",
      "filter":     {...}        # find / update / delete
      "projection": {...},       # find seulement, optionnel
      "sort":       [[f, 1|-1]], # find seulement, optionnel
      "limit":      <int>,       # find seulement, optionnel
      "skip":       <int>,       # find seulement, optionnel
      "document":   {...},       # insertOne seulement
      "update":     {"$set": {...}}  # updateMany seulement
    }

L'API publique est `translate(ast)`.
"""

import re
from typing import Any, Dict


def translate(ast: Dict[str, Any]) -> Dict[str, Any]:
    """Point d'entrée : dispatch selon le type de statement."""
    t = ast["type"]
    if t == "find":
        return _translate_find(ast)
    if t == "count":
        return _translate_count(ast)
    if t == "insert":
        return _translate_insert(ast)
    if t == "update":
        return _translate_update(ast)
    if t == "delete":
        return _translate_delete(ast)
    raise ValueError(f"Type de statement inconnu : {t!r}")


# ---------------------------------------------------------------------------
# Statements
# ---------------------------------------------------------------------------
def _translate_find(ast: Dict[str, Any]) -> Dict[str, Any]:
    out: Dict[str, Any] = {
        "op": "find",
        "collection": ast["collection"],
        "filter": _translate_where(ast.get("where")),
    }
    if "select" in ast:
        out["projection"] = {field: 1 for field in ast["select"]}
    if "order" in ast:
        out["sort"] = [
            [item["field"], 1 if item["direction"] == "asc" else -1]
            for item in ast["order"]
        ]
    if "limit" in ast:
        out["limit"] = ast["limit"]
    if "skip" in ast:
        out["skip"] = ast["skip"]
    return out


def _translate_count(ast: Dict[str, Any]) -> Dict[str, Any]:
    return {
        "op": "countDocuments",
        "collection": ast["collection"],
        "filter": _translate_where(ast.get("where")),
    }


def _translate_insert(ast: Dict[str, Any]) -> Dict[str, Any]:
    document = {a["field"]: a["value"] for a in ast["values"]}
    return {
        "op": "insertOne",
        "collection": ast["collection"],
        "document": document,
    }


def _translate_update(ast: Dict[str, Any]) -> Dict[str, Any]:
    update_doc = {a["field"]: a["value"] for a in ast["values"]}
    return {
        "op": "updateMany",
        "collection": ast["collection"],
        "filter": _translate_where(ast.get("where")),
        "update": {"$set": update_doc},
    }


def _translate_delete(ast: Dict[str, Any]) -> Dict[str, Any]:
    return {
        "op": "deleteMany",
        "collection": ast["collection"],
        "filter": _translate_where(ast.get("where")),
    }


# ---------------------------------------------------------------------------
# Filtres WHERE
# ---------------------------------------------------------------------------
def _translate_where(node):
    """Convertit un nœud d'expression en sous-document MongoDB.

    Renvoie un dict vide si node est None (ex : DELETE FROM foo sans WHERE).
    """
    if node is None:
        return {}

    op = node["op"]

    # Combinateurs logiques
    if op == "and":
        return {"$and": [_translate_where(node["left"]), _translate_where(node["right"])]}
    if op == "or":
        return {"$or": [_translate_where(node["left"]), _translate_where(node["right"])]}
    if op == "not":
        # MongoDB n'a pas d'opérateur racine $not ; $nor sur un seul élément
        # est équivalent et fonctionne avec n'importe quel sous-doc.
        return {"$nor": [_translate_where(node["expr"])]}

    # Comparaisons
    if op == "eq":
        return {node["field"]: node["value"]}
    if op in ("ne", "lt", "gt", "lte", "gte"):
        return {node["field"]: {f"${op}": node["value"]}}

    if op in ("like", "ilike"):
        # Wildcards SATAN QL : * = "n'importe quels caractères", ? = un caractère
        # On échappe le reste pour éviter qu'un . ou un ( soient interprétés
        # comme du regex. ILIKE = LIKE insensible à la casse ($options: "i").
        regex = (
            "^"
            + re.escape(node["value"]).replace(r"\*", ".*").replace(r"\?", ".")
            + "$"
        )
        spec = {"$regex": regex}
        if op == "ilike":
            spec["$options"] = "i"
        return {node["field"]: spec}

    if op == "contains":
        # Sous-chaîne littérale, insensible à la casse : on échappe entièrement
        # la valeur (pas de wildcard) et on ne l'ancre pas.
        return {node["field"]: {"$regex": re.escape(node["value"]), "$options": "i"}}

    if op == "in":
        return {node["field"]: {"$in": node["value"]}}

    if op == "exists":
        return {node["field"]: {"$exists": True}}

    raise ValueError(f"Opérateur d'expression inconnu : {op!r}")
