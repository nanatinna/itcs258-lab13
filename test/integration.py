#!/usr/bin/env python3
"""Disposable real-Compose checks. Requires Docker, Python 3 and network access."""
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
import json
import os
import socket
import subprocess
import tempfile
import urllib.error
import urllib.request
import uuid

ROOT = Path(__file__).resolve().parents[1]


def main():
    project = "gacha-qa-" + uuid.uuid4().hex[:10]
    with tempfile.TemporaryDirectory(prefix="gacha-qa-") as folder:
        temp = Path(folder)
        with socket.socket() as listener:
            listener.bind(("127.0.0.1", 0))
            port = listener.getsockname()[1]
        (temp / "qa.env").write_text("STUDENT_ID=qa\nPOSTGRES_DB=gacha\nPOSTGRES_USER=gacha\nPOSTGRES_PASSWORD=disposable-qa-only\n")
        (temp / "qa.yml").write_text('services:\n  app:\n    ports:\n      - "127.0.0.1:%s:3000"\n' % port)
        command = ["docker", "compose", "--env-file", str(temp / "qa.env"), "-p", project,
                   "-f", str(ROOT / "compose.yml"), "-f", str(temp / "qa.yml")]
        checks = 0

        def cli(*args):
            result = subprocess.run(command + list(args), cwd=ROOT, capture_output=True, text=True)
            if result.returncode:
                raise RuntimeError("Compose %s failed: %s" % (args, result.stderr[-3000:]))
            return result.stdout.strip()

        def http(route, body=None):
            data = None if body is None else json.dumps(body).encode()
            request = urllib.request.Request("http://127.0.0.1:%s%s" % (port, route), data=data,
                                             headers={"Content-Type": "application/json"})
            try:
                response = urllib.request.urlopen(request, timeout=12)
            except urllib.error.HTTPError as error:
                response = error
            raw = response.read().decode()
            try:
                value = json.loads(raw)
            except json.JSONDecodeError:
                value = raw
            return response.code, value

        def assert_http(route, status, body=None):
            nonlocal checks
            code, value = http(route, body)
            assert code == status, (route, code, value)
            checks += 1
            return value

        def volume_id():
            db_id = cli("ps", "-q", "db")
            result = subprocess.check_output(["docker", "inspect", "--format", "{{json .Mounts}}", db_id], text=True)
            return next(m["Name"] for m in json.loads(result) if m["Type"] == "volume")

        try:
            cli("up", "-d", "--build", "--wait")
            assert_http("/health", 200)
            html = assert_http("/test", 200)
            assert 'data-th=' in html and 'location.pathname.replace' in html
            assert_http("/test/", 200)
            catalog = assert_http("/api/catalog", 200)
            assert len(catalog["legendary"]) == 5 and catalog["rules"]["legendaryPercent"] == 2
            id = "qa-student"
            assert assert_http("/api/accounts/" + id, 200)["wallet"]["coins"] == 0
            for amount in (0, -1, 1.5, "1000", True, 100001):
                assert_http("/api/recharge", 400, {"student_id": id, "coins": amount})
            assert_http("/api/recharge", 400, {"student_id": "bad id", "coins": 100})
            assert_http("/api/exchange", 400, {"student_id": id, "coins": 101})
            assert_http("/api/draw", 409, {"student_id": id})
            assert_http("/api/recharge", 201, {"student_id": id, "coins": 2000})
            wallet = assert_http("/api/exchange", 201, {"student_id": id, "coins": 2000})["wallet"]
            assert wallet["coins"] == 0 and wallet["gems"] == 20
            with ThreadPoolExecutor(max_workers=4) as executor:
                results = list(executor.map(lambda _: http("/api/draw", {"student_id": id}), range(4)))
            assert sorted(status for status, _ in results) == [201, 201, 409, 409], results
            checks += 1
            history = assert_http("/api/accounts/" + id + "/history", 200)
            assert len(history["draws"]) == 2 and len(history["transactions"]) == 4
            assert assert_http("/api/accounts/" + id, 200)["wallet"]["gems"] == 0
            sql_count = cli("exec", "-T", "db", "psql", "-U", "gacha", "-d", "gacha", "-Atc", "SELECT COUNT(*) FROM draws;")
            assert sql_count == "2"
            original_db, original_volume = cli("ps", "-q", "db"), volume_id()
            cli("restart")
            cli("up", "-d", "--wait")
            assert cli("ps", "-q", "db") == original_db
            assert assert_http("/api/accounts/" + id + "/history", 200) == history
            cli("down")
            cli("up", "-d", "--wait")
            assert cli("ps", "-q", "db") != original_db and volume_id() == original_volume
            assert assert_http("/api/accounts/" + id + "/history", 200) == history
            app_id = cli("ps", "-q", "app")
            cli("stop", "db")
            assert_http("/health", 503)
            assert_http("/api/accounts/" + id + "/history", 503)
            cli("up", "-d", "--wait")
            assert cli("ps", "-q", "app") == app_id
            assert_http("/health", 200)
            assert assert_http("/api/accounts/" + id + "/history", 200) == history
            print(json.dumps({"http_checks": checks, "transactions": "atomic concurrent draws passed", "persistence": "restart + new DB / same volume + same draw rows", "recovery": "503 then connected without replacing app"}))
        finally:
            cli("down", "-v", "--rmi", "local", "--remove-orphans")
            print("Removed disposable QA containers, volumes and app image for " + project)


if __name__ == "__main__":
    main()
