"""
SATAN QL — Worker

Boucle ndjson stdin/stdout. Node écrit une ligne JSON {"id", "query"} par
requête ; on répond une ligne JSON {"id", "ok", "result"|"error"|"trace"}.
Le process reste vivant tant que stdin est ouvert (Node le maintient).
"""

import json
import os
import sys
import traceback

# Permet à `from lexer import ...` etc. de fonctionner quand le worker est
# lancé via `python /chemin/vers/worker.py` plutôt que comme module.
_HERE = os.path.dirname(os.path.abspath(__file__))
if _HERE not in sys.path:
    sys.path.insert(0, _HERE)

from parser import parse  # noqa: E402
from translator import translate  # noqa: E402


def _process_line(line: str) -> dict:
    """Traite une ligne JSON. Retourne toujours un dict de réponse."""
    req_id = None
    try:
        req = json.loads(line)
        req_id = req.get("id")
        query = req.get("query", "")
        if not isinstance(query, str):
            raise ValueError("Le champ 'query' doit être une chaîne")
        ast = parse(query)
        result = translate(ast)
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
    from parser import build_parser

    build_parser()

    for raw_line in sys.stdin:
        line = raw_line.strip()
        if not line:
            continue
        response = _process_line(line)
        sys.stdout.write(json.dumps(response, ensure_ascii=False) + "\n")
        sys.stdout.flush()


if __name__ == "__main__":
    main()
