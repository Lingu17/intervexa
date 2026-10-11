from test_intelligence import repo_index

from app.intelligence import graph, parse_file
from app.models import RepositoryIndex


def test_declarations_have_real_source_locations_and_do_not_invent_calls():
    row = RepositoryIndex(
        branch="main", files=[parse_file("auth.py", "class Session:\n    def create(self):\n        return 1\n")]
    )
    result = graph(row)
    declarations = [node for node in result["nodes"] if node["kind"] in ("class", "function")]
    assert [(node["label"], node["path"], node["line"]) for node in declarations] == [
        ("Session", "auth.py", 1),
        ("create", "auth.py", 2),
    ]
    assert all(edge["kind"] in ("contains", "declares") for edge in result["edges"])
    assert "calls are unresolved" in result["notice"]
    assert len({node["id"] for node in result["nodes"]}) == len(result["nodes"])


def test_graph_declaration_budget_preserves_all_files():
    files = [
        parse_file(f"file{i}.py", "\n".join(f"def function{j}(): return {j}" for j in range(10))) for i in range(60)
    ]
    result = graph(RepositoryIndex(branch="main", files=files))
    assert len([node for node in result["nodes"] if node["kind"] == "file"]) == 60
    assert len([node for node in result["nodes"] if node["kind"] == "function"]) == 240
    assert "360 declarations omitted" in result["notice"]


def test_repository_list_exposes_pinned_index_metadata(authenticated, database):
    repo, index = repo_index(authenticated, database)
    response = authenticated.get("/api/repositories")
    assert response.status_code == 200
    row = next(row for row in response.json() if row["id"] == repo.id)
    assert row["index"] == {"sha": index.sha, "branch": "main", "created_at": index.created_at}
