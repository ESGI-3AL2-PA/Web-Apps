"""
SATAN QL — Worker

Boucle ndjson stdin/stdout. Node écrit une ligne JSON {"id", "query"} par
requête ; on parse → traduit → EXÉCUTE contre MongoDB (pymongo) et on répond une
ligne JSON {"id", "ok", "result"|"error"|"trace"}. Le process reste vivant tant
que stdin est ouvert (Node le maintient).

Connexion Mongo : lue depuis l'environnement (MONGODB_URL / MONGODB_DB), que
Node transmet au subprocess. Node ne touche jamais Mongo lui-même.
"""

import json
import os
import sys
import traceback
from datetime import date, datetime

# Permet à `from lexer import ...` etc. de fonctionner quand le worker est
# lancé via `python /chemin/vers/worker.py` plutôt que comme module.
_HERE = os.path.dirname(os.path.abspath(__file__))
if _HERE not in sys.path:
    sys.path.insert(0, _HERE)

from bson import ObjectId  # noqa: E402
from pymongo import MongoClient  # noqa: E402

from executor import execute  # noqa: E402
from parser import build_parser, parse  # noqa: E402
from translator import translate  # noqa: E402


def _json_default(o):
    """Repli de sérialisation JSON au mieux (cette app stocke des ids en chaîne + dates ISO)."""
    if isinstance(o, ObjectId):
        return str(o)
    if isinstance(o, (datetime, date)):
        return o.isoformat()
    raise TypeError(f"Non sérialisable en JSON : {type(o).__name__}")


def _connect_db():
    url = os.environ.get("MONGODB_URL", "mongodb://root:root@localhost:27017")
    name = os.environ.get("MONGODB_DB", "db")
    # Échoue vite si Mongo est injoignable, plutôt que de bloquer la requête 30s.
    return MongoClient(url, serverSelectionTimeoutMS=5000)[name]


def _process_line(db, line: str) -> dict:
    """Traite une ligne JSON. Retourne toujours un dict de réponse."""
    req_id = None
    try:
        req = json.loads(line)
        req_id = req.get("id")
        query = req.get("query", "")
        if not isinstance(query, str):
            raise ValueError("Le champ 'query' doit être une chaîne")
        ast = parse(query)
        op = translate(ast)
        result = execute(db, op)
        return {"id": req_id, "ok": True, "result": result}
    except Exception as exc:  # noqa: BLE001 — on renvoie tout au client
        return {
            "id": req_id,
            "ok": False,
            "error": str(exc),
            "trace": traceback.format_exc(),
        }


def main() -> None:
    # Pré-charge le parser pour amortir le coût LALR sur la 1ʳᵉ requête.
    build_parser()
    db = _connect_db()

    for raw_line in sys.stdin:
        line = raw_line.strip()
        if not line:
            continue
        response = _process_line(db, line)
        sys.stdout.write(json.dumps(response, ensure_ascii=False, default=_json_default) + "\n")
        sys.stdout.flush()


if __name__ == "__main__":
    main()
