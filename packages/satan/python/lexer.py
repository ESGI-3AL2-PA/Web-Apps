"""
SATAN QL — Lexer (PLY)

Tokenise une requête SATAN QL en flux de tokens consommé ensuite par
parser.py. Les mots-clés sont reconnus en case-insensitive (FIND == find).

Tokens produits :
    - Mots-clés : FIND, COUNT, INSERT, INTO, UPDATE, DELETE, FROM, WHERE, SET,
      SELECT, ORDER, BY, LIMIT, SKIP, AND, OR, NOT, LIKE, ILIKE, IEQ, CONTAINS,
      IN, EXISTS, ASC, DESC, TRUE, FALSE, NULL
    - IDENT     : identifiant (avec support des chemins pointés type
                  profile.address.city pour les champs MongoDB imbriqués)
    - STRING    : chaîne entre guillemets doubles, séquences \\n, \\" gérées
    - NUMBER    : entier ou flottant, signe optionnel
    - Opérateurs : =, !=, <, >, <=, >=
    - Ponctuation : ( ) ,
"""

import ply.lex as lex


# ---------------------------------------------------------------------------
# Mots réservés
# ---------------------------------------------------------------------------
# Map "MOT" -> nom de token PLY. La résolution se fait dans t_IDENT.
reserved = {
    "FIND": "FIND",
    "COUNT": "COUNT",
    "INSERT": "INSERT",
    "INTO": "INTO",
    "UPDATE": "UPDATE",
    "DELETE": "DELETE",
    "FROM": "FROM",
    "WHERE": "WHERE",
    "SET": "SET",
    "SELECT": "SELECT",
    "ORDER": "ORDER",
    "BY": "BY",
    "LIMIT": "LIMIT",
    "SKIP": "SKIP",
    "AND": "AND",
    "OR": "OR",
    "NOT": "NOT",
    "LIKE": "LIKE",
    "ILIKE": "ILIKE",
    "IEQ": "IEQ",
    "CONTAINS": "CONTAINS",
    "IN": "IN",
    "EXISTS": "EXISTS",
    "ASC": "ASC",
    "DESC": "DESC",
    "TRUE": "TRUE",
    "FALSE": "FALSE",
    "NULL": "NULL",
}


# ---------------------------------------------------------------------------
# Liste des tokens (PLY exige cette variable au niveau module)
# ---------------------------------------------------------------------------
tokens = [
    "IDENT",
    "STRING",
    "NUMBER",
    "EQ",
    "NEQ",
    "LT",
    "GT",
    "LE",
    "GE",
    "LPAREN",
    "RPAREN",
    "COMMA",
] + list(set(reserved.values()))


# ---------------------------------------------------------------------------
# Règles simples
# ---------------------------------------------------------------------------
# /!\ L'ordre est important : les opérateurs composés (>=, <=, !=) DOIVENT
# être déclarés avant leurs versions simples pour que PLY les essaie en premier.
t_NEQ = r"!="
t_LE = r"<="
t_GE = r">="
t_EQ = r"="
t_LT = r"<"
t_GT = r">"
t_LPAREN = r"\("
t_RPAREN = r"\)"
t_COMMA = r","

# Caractères ignorés (blancs, tabulations, retours chariot)
t_ignore = " \t\r\n"


# ---------------------------------------------------------------------------
# Règles avec action
# ---------------------------------------------------------------------------
def t_NUMBER(t):
    r"-?\d+(\.\d+)?"
    t.value = float(t.value) if "." in t.value else int(t.value)
    return t


# Séquences d'échappement reconnues dans une chaîne. Volontairement limité à ce
# que produit `quote()` côté TS (plus \t) : décoder via `unicode_escape`
# corromprait l'UTF-8 multi-octets (« café ») et lèverait sur un \x/\u malformé
# venant d'une entrée hostile. Un antislash devant tout autre caractère est
# retiré (le caractère est conservé tel quel).
_STRING_ESCAPES = {'"': '"', "\\": "\\", "n": "\n", "r": "\r", "t": "\t"}


def _unescape(raw: str) -> str:
    out = []
    i = 0
    while i < len(raw):
        ch = raw[i]
        if ch == "\\" and i + 1 < len(raw):
            nxt = raw[i + 1]
            out.append(_STRING_ESCAPES.get(nxt, nxt))
            i += 2
        else:
            out.append(ch)
            i += 1
    return "".join(out)


def t_STRING(t):
    r'"([^"\\]|\\.)*"'
    # On retire les guillemets et on décode les séquences d'échappement.
    t.value = _unescape(t.value[1:-1])
    return t


def t_IDENT(t):
    r"[A-Za-z_][A-Za-z0-9_]*(\.[A-Za-z_][A-Za-z0-9_]*)*"
    upper = t.value.upper()
    # Un identifiant pointé (ex: profile.address) ne peut pas être un mot-clé
    if "." not in t.value and upper in reserved:
        t.type = reserved[upper]
        t.value = upper
    return t


def t_error(t):
    raise SyntaxError(f"Caractère illégal {t.value[0]!r} à la position {t.lexpos}")


# ---------------------------------------------------------------------------
# Factory
# ---------------------------------------------------------------------------
def build_lexer(**kwargs):
    """Construit un lexer PLY frais. Appelé par parser.build_parser()."""
    return lex.lex(**kwargs)
