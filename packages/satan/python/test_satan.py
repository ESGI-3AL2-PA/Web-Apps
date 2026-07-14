"""
SATAN QL — Tests unitaires côté Python (parse + translate).

Sans dépendance de test externe : `python3 python/test_satan.py` sort en code 0
si tout passe, 1 sinon. Vérifie les 4 opérations CRUD et les principaux
opérateurs WHERE.
"""

import os
import sys

_HERE = os.path.dirname(os.path.abspath(__file__))
if _HERE not in sys.path:
    sys.path.insert(0, _HERE)

from parser import parse  # noqa: E402
from translator import translate  # noqa: E402


def compile_query(q: str):
    return translate(parse(q))


CASES = [
    # -- FIND --------------------------------------------------------------
    (
        'FIND users WHERE role = "admin" AND name LIKE "Jo*" LIMIT 10 ORDER BY createdAt DESC',
        {
            "op": "find",
            "collection": "users",
            "filter": {"$and": [{"role": "admin"}, {"name": {"$regex": "^Jo.*$"}}]},
            "limit": 10,
            "sort": [["createdAt", -1]],
        },
    ),
    (
        "FIND users WHERE profile.address.city = \"Paris\" SELECT id, name, email",
        {
            "op": "find",
            "collection": "users",
            "filter": {"profile.address.city": "Paris"},
            "projection": {"id": 1, "name": 1, "email": 1},
        },
    ),
    (
        'FIND users WHERE role IN ("admin", "superAdmin") AND email EXISTS',
        {
            "op": "find",
            "collection": "users",
            "filter": {
                "$and": [
                    {"role": {"$in": ["admin", "superAdmin"]}},
                    {"email": {"$exists": True}},
                ]
            },
        },
    ),
    (
        "FIND users WHERE age >= 18 AND NOT (role = \"user\") ORDER BY name ASC, createdAt DESC SKIP 20 LIMIT 50",
        {
            "op": "find",
            "collection": "users",
            "filter": {"$and": [{"age": {"$gte": 18}}, {"$nor": [{"role": "user"}]}]},
            "sort": [["name", 1], ["createdAt", -1]],
            "skip": 20,
            "limit": 50,
        },
    ),
    ("FIND users", {"op": "find", "collection": "users", "filter": {}}),
    # -- COUNT -------------------------------------------------------------
    (
        'COUNT listings WHERE status = "active" AND districtId = "d1"',
        {
            "op": "countDocuments",
            "collection": "listings",
            "filter": {"$and": [{"status": "active"}, {"districtId": "d1"}]},
        },
    ),
    ("COUNT users", {"op": "countDocuments", "collection": "users", "filter": {}}),
    # -- ILIKE / CONTAINS --------------------------------------------------
    (
        'FIND tags WHERE name ILIKE "Baby*"',
        {
            "op": "find",
            "collection": "tags",
            "filter": {"name": {"$regex": "^Baby.*$", "$options": "i"}},
        },
    ),
    (
        'FIND users WHERE firstName CONTAINS "a.b"',
        {
            "op": "find",
            "collection": "users",
            "filter": {"firstName": {"$regex": r"a\.b", "$options": "i"}},
        },
    ),
    (
        'FIND listings WHERE tags IEQ "a.b"',
        {
            "op": "find",
            "collection": "listings",
            "filter": {"tags": {"$regex": r"^a\.b$", "$options": "i"}},
        },
    ),
    # A wildcard in an IEQ value stays literal (no ReDoS / no match-all).
    (
        'FIND listings WHERE tags IEQ "*"',
        {
            "op": "find",
            "collection": "listings",
            "filter": {"tags": {"$regex": r"^\*$", "$options": "i"}},
        },
    ),
    # -- string unescaping: UTF-8 preserved, only quote()'s escapes decoded -----
    (
        'FIND users WHERE firstName = "café\\n"',
        {
            "op": "find",
            "collection": "users",
            "filter": {"firstName": "café\n"},
        },
    ),
    # -- INSERT ------------------------------------------------------------
    (
        'INSERT INTO users SET name = "John", email = "john@ex.com", age = 30',
        {
            "op": "insertOne",
            "collection": "users",
            "document": {"name": "John", "email": "john@ex.com", "age": 30},
        },
    ),
    # -- UPDATE ------------------------------------------------------------
    (
        "UPDATE products SET price = 89.99 WHERE id = 5",
        {
            "op": "updateMany",
            "collection": "products",
            "filter": {"id": 5},
            "update": {"$set": {"price": 89.99}},
        },
    ),
    (
        'UPDATE users SET active = false',
        {
            "op": "updateMany",
            "collection": "users",
            "filter": {},
            "update": {"$set": {"active": False}},
        },
    ),
    # -- DELETE ------------------------------------------------------------
    (
        'DELETE FROM users WHERE role = "guest"',
        {"op": "deleteMany", "collection": "users", "filter": {"role": "guest"}},
    ),
    (
        "DELETE FROM sessions",
        {"op": "deleteMany", "collection": "sessions", "filter": {}},
    ),
]


def main() -> int:
    failures = 0
    for query, expected in CASES:
        got = compile_query(query)
        if got != expected:
            failures += 1
            print(f"FAIL: {query}")
            print(f"  expected: {expected}")
            print(f"  got:      {got}")
        else:
            print(f"ok: {query}")

    # Une requête invalide doit lever.
    try:
        compile_query("FIND")
        failures += 1
        print("FAIL: 'FIND' aurait dû lever une SyntaxError")
    except SyntaxError:
        print("ok: 'FIND' lève bien SyntaxError")

    if failures:
        print(f"\n{failures} test(s) échoué(s)")
        return 1
    print(f"\nTous les tests passent ({len(CASES) + 1})")
    return 0


if __name__ == "__main__":
    sys.exit(main())
