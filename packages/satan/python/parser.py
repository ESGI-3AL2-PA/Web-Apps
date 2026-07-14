"""
SATAN QL — Parser (PLY yacc)

Transforme un flux de tokens (cf. lexer.py) en AST (dict Python).

Statements pris en charge (CRUD) :

    FIND <collection>
        [WHERE <expr>]
        [SELECT <field>, ...]
        [ORDER BY <field> [ASC|DESC], ...]
        [SKIP <n>]
        [LIMIT <n>]

    COUNT <collection> [WHERE <expr>]

    INSERT INTO <collection> SET <field> = <value>, ...

    UPDATE <collection> SET <field> = <value>, ... [WHERE <expr>]

    DELETE FROM <collection> [WHERE <expr>]

Une <expr> est une combinaison de conditions reliées par AND / OR / NOT
(avec parenthèses), où chaque condition est l'une de :
    field <op> value          (op ∈ =, !=, <, >, <=, >=)
    field LIKE "pattern"      (ancré, sensible à la casse, wildcards * et ?)
    field ILIKE "pattern"     (comme LIKE, insensible à la casse)
    field IEQ "text"          (égalité littérale insensible à la casse, ancrée)
    field CONTAINS "text"     (sous-chaîne littérale, insensible à la casse)
    field IN (val, val, …)
    field EXISTS

Format de l'AST :
    {"type": "find",   "collection": str, "where"?, "select"?, "order"?, "limit"?, "skip"?}
    {"type": "count",  "collection": str, "where": <expr>|None}
    {"type": "insert", "collection": str, "values": [{"field": ..., "value": ...}, ...]}
    {"type": "update", "collection": str, "values": [...], "where": <expr>|None}
    {"type": "delete", "collection": str, "where": <expr>|None}

Une expression :
    {"op": "and"|"or",  "left": <expr>, "right": <expr>}
    {"op": "not", "expr": <expr>}
    {"op": "eq"|"ne"|"lt"|"gt"|"lte"|"gte", "field": str, "value": Any}
    {"op": "like"|"ilike", "field": str, "value": str}  # wildcards * et ?
    {"op": "ieq", "field": str, "value": str}           # égalité littérale (i)
    {"op": "contains", "field": str, "value": str}      # sous-chaîne littérale
    {"op": "in",     "field": str, "value": [Any, ...]}
    {"op": "exists", "field": str}
"""

import ply.yacc as yacc

# Imports locaux — fonctionne quand worker.py ajoute ce dossier à sys.path
from lexer import tokens, build_lexer  # noqa: F401  (tokens est requis par PLY)


# ---------------------------------------------------------------------------
# Précédences (du plus faible au plus fort)
# ---------------------------------------------------------------------------
precedence = (
    ("left", "OR"),
    ("left", "AND"),
    ("right", "NOT"),
)


# ---------------------------------------------------------------------------
# Règle racine
# ---------------------------------------------------------------------------
def p_statement(p):
    """statement : find_stmt
                 | count_stmt
                 | insert_stmt
                 | update_stmt
                 | delete_stmt"""
    p[0] = p[1]


# ---------------------------------------------------------------------------
# FIND
# ---------------------------------------------------------------------------
def p_find_stmt(p):
    "find_stmt : FIND IDENT find_clauses"
    p[0] = {"type": "find", "collection": p[2], **p[3]}


def p_find_clauses_recurse(p):
    "find_clauses : find_clauses find_clause"
    merged = dict(p[1])
    merged.update(p[2])
    p[0] = merged


def p_find_clauses_empty(p):
    "find_clauses : empty"
    p[0] = {}


def p_find_clause_where(p):
    "find_clause : WHERE expression"
    p[0] = {"where": p[2]}


def p_find_clause_select(p):
    "find_clause : SELECT field_list"
    p[0] = {"select": p[2]}


def p_find_clause_order(p):
    "find_clause : ORDER BY order_list"
    p[0] = {"order": p[3]}


def p_find_clause_limit(p):
    "find_clause : LIMIT NUMBER"
    p[0] = {"limit": p[2]}


def p_find_clause_skip(p):
    "find_clause : SKIP NUMBER"
    p[0] = {"skip": p[2]}


# ---------------------------------------------------------------------------
# COUNT
# ---------------------------------------------------------------------------
def p_count_stmt(p):
    "count_stmt : COUNT IDENT opt_where"
    p[0] = {"type": "count", "collection": p[2], "where": p[3]}


# ---------------------------------------------------------------------------
# INSERT / UPDATE / DELETE
# ---------------------------------------------------------------------------
def p_insert_stmt(p):
    "insert_stmt : INSERT INTO IDENT SET assignment_list"
    p[0] = {"type": "insert", "collection": p[3], "values": p[5]}


def p_update_stmt(p):
    "update_stmt : UPDATE IDENT SET assignment_list opt_where"
    p[0] = {"type": "update", "collection": p[2], "values": p[4], "where": p[5]}


def p_delete_stmt(p):
    "delete_stmt : DELETE FROM IDENT opt_where"
    p[0] = {"type": "delete", "collection": p[3], "where": p[4]}


def p_opt_where_some(p):
    "opt_where : WHERE expression"
    p[0] = p[2]


def p_opt_where_none(p):
    "opt_where : empty"
    p[0] = None


# ---------------------------------------------------------------------------
# Listes : assignments, fields, order, valeurs
# ---------------------------------------------------------------------------
def p_assignment_list_one(p):
    "assignment_list : assignment"
    p[0] = [p[1]]


def p_assignment_list_many(p):
    "assignment_list : assignment_list COMMA assignment"
    p[0] = p[1] + [p[3]]


def p_assignment(p):
    "assignment : IDENT EQ value"
    p[0] = {"field": p[1], "value": p[3]}


def p_field_list_one(p):
    "field_list : IDENT"
    p[0] = [p[1]]


def p_field_list_many(p):
    "field_list : field_list COMMA IDENT"
    p[0] = p[1] + [p[3]]


def p_order_list_one(p):
    "order_list : order_item"
    p[0] = [p[1]]


def p_order_list_many(p):
    "order_list : order_list COMMA order_item"
    p[0] = p[1] + [p[3]]


def p_order_item(p):
    """order_item : IDENT
                  | IDENT ASC
                  | IDENT DESC"""
    direction = "asc"
    if len(p) == 3 and p[2] == "DESC":
        direction = "desc"
    p[0] = {"field": p[1], "direction": direction}


def p_value_list_one(p):
    "value_list : value"
    p[0] = [p[1]]


def p_value_list_many(p):
    "value_list : value_list COMMA value"
    p[0] = p[1] + [p[3]]


# ---------------------------------------------------------------------------
# Expressions booléennes (WHERE)
# ---------------------------------------------------------------------------
def p_expression_or(p):
    "expression : expression OR expression"
    p[0] = {"op": "or", "left": p[1], "right": p[3]}


def p_expression_and(p):
    "expression : expression AND expression"
    p[0] = {"op": "and", "left": p[1], "right": p[3]}


def p_expression_not(p):
    "expression : NOT expression"
    p[0] = {"op": "not", "expr": p[2]}


def p_expression_paren(p):
    "expression : LPAREN expression RPAREN"
    p[0] = p[2]


def p_expression_cond(p):
    "expression : condition"
    p[0] = p[1]


def p_condition_compare(p):
    """condition : IDENT EQ value
                 | IDENT NEQ value
                 | IDENT LT value
                 | IDENT GT value
                 | IDENT LE value
                 | IDENT GE value"""
    op_map = {"=": "eq", "!=": "ne", "<": "lt", ">": "gt", "<=": "lte", ">=": "gte"}
    p[0] = {"op": op_map[p[2]], "field": p[1], "value": p[3]}


def p_condition_like(p):
    "condition : IDENT LIKE STRING"
    p[0] = {"op": "like", "field": p[1], "value": p[3]}


def p_condition_ilike(p):
    "condition : IDENT ILIKE STRING"
    p[0] = {"op": "ilike", "field": p[1], "value": p[3]}


def p_condition_ieq(p):
    "condition : IDENT IEQ STRING"
    p[0] = {"op": "ieq", "field": p[1], "value": p[3]}


def p_condition_contains(p):
    "condition : IDENT CONTAINS STRING"
    p[0] = {"op": "contains", "field": p[1], "value": p[3]}


def p_condition_in(p):
    "condition : IDENT IN LPAREN value_list RPAREN"
    p[0] = {"op": "in", "field": p[1], "value": p[4]}


def p_condition_exists(p):
    "condition : IDENT EXISTS"
    p[0] = {"op": "exists", "field": p[1]}


# ---------------------------------------------------------------------------
# Valeurs littérales
# ---------------------------------------------------------------------------
def p_value_string(p):
    "value : STRING"
    p[0] = p[1]


def p_value_number(p):
    "value : NUMBER"
    p[0] = p[1]


def p_value_true(p):
    "value : TRUE"
    p[0] = True


def p_value_false(p):
    "value : FALSE"
    p[0] = False


def p_value_null(p):
    "value : NULL"
    p[0] = None


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------
def p_empty(p):
    "empty :"
    p[0] = None


def p_error(p):
    if p:
        raise SyntaxError(
            f"Erreur de syntaxe au token {p.type} ({p.value!r}) position {p.lexpos}"
        )
    raise SyntaxError("Erreur de syntaxe : fin d'entrée prématurée")


# ---------------------------------------------------------------------------
# Cache des tables yacc
# ---------------------------------------------------------------------------
# PLY peut écrire des tables LALR pré-calculées dans un fichier pour accélérer
# les démarrages suivants. On les met dans le dossier courant du module.
_PARSER = None


def build_parser():
    """Construit (et met en cache) le parser yacc.

    write_tables=False évite de polluer le système de fichiers du worker
    (utile en mode child_process où on n'a pas forcément les droits d'écriture).
    """
    global _PARSER
    if _PARSER is None:
        _PARSER = yacc.yacc(
            write_tables=False,
            debug=False,
            errorlog=yacc.NullLogger(),
        )
    return _PARSER


def parse(text: str):
    """Pipeline complet lex → parse pour une seule requête SATAN QL."""
    lexer = build_lexer()
    parser = build_parser()
    return parser.parse(text, lexer=lexer)
