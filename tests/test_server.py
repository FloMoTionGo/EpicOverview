"""Tests for server.py (standard library only).

    python -I -m unittest discover -s tests -p "test_*.py" -v

Each test starts the real server in a thread on a free port, with a
temporary data folder and a temporary web folder.
"""

import http.client
import importlib.util
import json
import re
import tempfile
import threading
import time
import unittest
import urllib.request
from pathlib import Path
from unittest import mock
from urllib.parse import quote

ROOT = Path(__file__).resolve().parent.parent


def load_server_module():
    spec = importlib.util.spec_from_file_location("epic_overview_server", ROOT / "server.py")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


server = load_server_module()

INDEX_HTML = "<!doctype html><title>EPIC Overview test</title>"
APP_JS = "export const answer = 42;\n"


class RunningServer:
    """server.make_server() on 127.0.0.1, serving from a background thread."""

    def __init__(self, data_dir, web_dir, allowed_origins=()):
        self.httpd = server.make_server(0, data_dir, web_dir, host="127.0.0.1", allowed_origins=allowed_origins)
        self.port = self.httpd.server_address[1]
        self.thread = threading.Thread(
            target=self.httpd.serve_forever, kwargs={"poll_interval": 0.05}, daemon=True)
        self.thread.start()
        self.stopped = False

    def stop(self):
        if self.stopped:
            return
        self.stopped = True
        self.httpd.shutdown()
        self.httpd.server_close()
        self.thread.join(timeout=5)

    def connect(self, timeout=5):
        return http.client.HTTPConnection("127.0.0.1", self.port, timeout=timeout)

    def request(self, method, path, body=None, raw=None):
        """Returns (status, response, body bytes)."""
        data = raw if raw is not None else (None if body is None else json.dumps(body).encode("utf-8"))
        headers = {"Content-Type": "application/json"} if data is not None else {}
        conn = self.connect()
        try:
            conn.request(method, path, body=data, headers=headers)
            response = conn.getresponse()
            return response.status, response, response.read()
        finally:
            conn.close()

    def json(self, method, path, body=None, raw=None):
        """Returns (status, parsed JSON body)."""
        status, response, payload = self.request(method, path, body, raw)
        content_type = response.getheader("Content-Type")
        assert content_type == "application/json; charset=utf-8", content_type
        return status, json.loads(payload)


def read_event(response):
    """The next server-sent event as (event name, parsed data); skips comments."""
    name, data = None, None
    while True:
        line = response.readline()
        if not line:
            raise AssertionError("the event stream closed")
        line = line.decode("utf-8").rstrip("\r\n")
        if line == "":
            if name is not None or data is not None:
                return name, json.loads(data)
            continue
        if line.startswith(":"):
            continue
        field, _, value = line.partition(":")
        value = value[1:] if value.startswith(" ") else value
        if field == "event":
            name = value
        elif field == "data":
            data = value


class ServerTestCase(unittest.TestCase):
    def setUp(self):
        temp = tempfile.TemporaryDirectory()
        self.addCleanup(temp.cleanup)  # registered first, so it runs after the servers stop
        self.root = Path(temp.name)
        self.web_dir = self.root / "web"
        (self.web_dir / "js").mkdir(parents=True)
        (self.web_dir / "index.html").write_text(INDEX_HTML, encoding="utf-8")
        (self.web_dir / "js" / "app.js").write_bytes(APP_JS.encode("utf-8"))
        (self.web_dir / "art.webp").write_bytes(b"RIFF\x00\x00\x00\x00WEBP")
        (self.root / "secret.txt").write_text("outside web/", encoding="utf-8")
        self.data_dir = self.root / "save"
        self.srv = self.start()

    def start(self, data_dir=None):
        running = RunningServer(data_dir or self.data_dir, self.web_dir)
        self.addCleanup(running.stop)
        return running

    def act(self, base_version, game, summary="Change", srv=None, **entry):
        srv = srv or self.srv
        body = {"baseVersion": base_version, "state": game, "entry": {"summary": summary, **entry}}
        return srv.json("POST", "/api/action", body)

    def undo(self, house=None, srv=None):
        srv = srv or self.srv
        return srv.json("POST", "/api/undo", {"house": house})

    def state(self, srv=None):
        status, doc = (srv or self.srv).json("GET", "/api/state")
        self.assertEqual(status, 200)
        return doc


class StateAndActionTests(ServerTestCase):
    def test_fresh_store_is_empty(self):
        url = f"http://127.0.0.1:{self.srv.port}/api/state"
        with urllib.request.urlopen(url, timeout=5) as response:
            self.assertEqual(response.status, 200)
            self.assertEqual(response.headers["Content-Type"], "application/json; charset=utf-8")
            doc = json.loads(response.read())
        self.assertEqual(doc, {"version": 0, "game": None, "log": []})

    def test_action_with_current_version_is_accepted(self):
        status, reply = self.act(0, {"round": 1, "houses": {"Stark": {"vp": 1}}},
                                 summary="Stark gains 1 VP", house="Stark", round=1,
                                 step="action", kind="vp", houses=["Stark"])
        self.assertEqual(status, 200)
        self.assertEqual(reply["version"], 1)
        entry = reply["entry"]
        self.assertEqual(entry["id"], 1)
        self.assertEqual(entry["version"], 1)
        self.assertEqual(entry["summary"], "Stark gains 1 VP")
        self.assertEqual(entry["house"], "Stark")
        self.assertEqual(entry["round"], 1)
        self.assertEqual(entry["step"], "action")
        self.assertEqual(entry["kind"], "vp")
        self.assertEqual(entry["houses"], ["Stark"])
        self.assertIs(entry["undone"], False)
        self.assertRegex(entry["time"], r"^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d([+-]\d\d:\d\d|Z)?$")

        doc = self.state()
        self.assertEqual(doc["version"], 1)
        self.assertEqual(doc["game"], {"round": 1, "houses": {"Stark": {"vp": 1}}})
        self.assertEqual(doc["log"], [entry])

        status, reply = self.act(1, {"round": 2}, summary="Round 2")
        self.assertEqual(status, 200)
        self.assertEqual(reply["version"], 2)
        self.assertEqual(reply["entry"]["id"], 2)
        self.assertEqual(reply["entry"]["house"], None)
        self.assertEqual(reply["entry"]["houses"], [])

    def test_stale_base_version_is_a_conflict(self):
        self.act(0, {"round": 1}, summary="First")
        status, reply = self.act(0, {"round": 99}, summary="Too late")
        self.assertEqual(status, 409)
        self.assertEqual(reply["version"], 1)
        self.assertEqual(reply["game"], {"round": 1})
        self.assertEqual([e["summary"] for e in reply["log"]], ["First"])
        self.assertEqual(self.state(), reply)

    def test_simultaneous_actions_only_one_wins(self):
        results = []

        def post(number):
            results.append(self.act(0, {"by": number}, summary=f"Device {number}")[0])

        threads = [threading.Thread(target=post, args=(n,)) for n in range(8)]
        for thread in threads:
            thread.start()
        for thread in threads:
            thread.join(timeout=10)
        self.assertEqual(sorted(results), [200] + [409] * 7)
        doc = self.state()
        self.assertEqual(doc["version"], 1)
        self.assertEqual(len(doc["log"]), 1)

    def test_bad_requests(self):
        cases = [
            (b"{not json", "not valid JSON"),
            (b"[1, 2]", "JSON object"),
            (b'{"baseVersion": NaN, "state": {}, "entry": {"summary": "x"}}', "not valid JSON"),
            (json.dumps({"state": {}, "entry": {"summary": "x"}}).encode(), "baseVersion"),
            (json.dumps({"baseVersion": "0", "state": {}, "entry": {"summary": "x"}}).encode(), "baseVersion"),
            (json.dumps({"baseVersion": 0, "entry": {"summary": "x"}}).encode(), "state"),
            (json.dumps({"baseVersion": 0, "state": {}}).encode(), "entry"),
            (json.dumps({"baseVersion": 0, "state": {}, "entry": {"house": "Stark"}}).encode(), "summary"),
            (json.dumps({"baseVersion": 0, "state": {}, "entry": {"summary": "x", "round": "1"}}).encode(), "round"),
            (json.dumps({"baseVersion": 0, "state": {}, "entry": {"summary": "x", "houses": "Stark"}}).encode(), "houses"),
        ]
        for raw, message in cases:
            with self.subTest(raw=raw):
                status, reply = self.srv.json("POST", "/api/action", raw=raw)
                self.assertEqual(status, 400)
                self.assertIn(message, reply["error"])
        status, reply = self.srv.json("POST", "/api/action")
        self.assertEqual(status, 400)
        status, reply = self.srv.json("POST", "/api/import", {"game": {}, "log": "nope"})
        self.assertEqual(status, 400)
        status, reply = self.srv.json("POST", "/api/import", {"log": []})
        self.assertEqual(status, 400)
        status, reply = self.srv.json("POST", "/api/undo", {"house": 7})
        self.assertEqual(status, 400)
        self.assertEqual(self.state()["version"], 0)

    def test_unknown_api_paths(self):
        status, reply = self.srv.json("GET", "/api/nope")
        self.assertEqual(status, 404)
        self.assertIn("error", reply)
        status, reply = self.srv.json("POST", "/api/nope", {})
        self.assertEqual(status, 404)
        status, reply = self.srv.json("GET", "/api/action")
        self.assertEqual(status, 405)

    def test_body_over_5_mb_is_refused(self):
        conn = self.srv.connect()
        self.addCleanup(conn.close)
        conn.putrequest("POST", "/api/action")
        conn.putheader("Content-Type", "application/json")
        conn.putheader("Content-Length", str(5 * 1024 * 1024 + 1))
        conn.endheaders()  # the body is never sent: the server must answer without reading it
        response = conn.getresponse()
        self.assertEqual(response.status, 413)
        self.assertIn("5 MB", json.loads(response.read())["error"])


class UndoTests(ServerTestCase):
    def test_undo_restores_the_previous_game(self):
        self.act(0, {"round": 1}, summary="Set up", house="Stark", round=1)
        self.act(1, {"round": 1, "castles": 2}, summary="Stark takes a castle",
                 house="Stark", round=1, step="action", kind="castle", houses=["Stark"])

        status, doc = self.undo("Lannister")
        self.assertEqual(status, 200)
        self.assertEqual(doc["version"], 3)
        self.assertEqual(doc["game"], {"round": 1})
        log = doc["log"]
        self.assertEqual(len(log), 3)
        self.assertIs(log[0]["undone"], False)
        self.assertIs(log[1]["undone"], True)
        self.assertIn("undoneAt", log[1])
        undo_entry = log[2]
        self.assertEqual(undo_entry["summary"], "Undone: Stark takes a castle")
        self.assertEqual(undo_entry["kind"], "undo")
        self.assertEqual(undo_entry["house"], "Lannister")
        self.assertEqual(undo_entry["version"], 3)
        self.assertEqual(undo_entry["id"], 3)
        self.assertIs(undo_entry["undone"], False)
        self.assertEqual(self.state(), doc)

        # The next undo skips the undo entry and takes back the first action.
        status, doc = self.undo()
        self.assertEqual(status, 200)
        self.assertEqual(doc["version"], 4)
        self.assertIsNone(doc["game"])
        self.assertIs(doc["log"][0]["undone"], True)
        self.assertEqual(doc["log"][3]["summary"], "Undone: Set up")
        self.assertIsNone(doc["log"][3]["house"])

        status, reply = self.undo()
        self.assertEqual(status, 409)
        self.assertEqual(reply["error"], "nothing to undo")
        self.assertEqual(reply["version"], 4)
        self.assertIsNone(reply["game"])
        self.assertEqual(len(reply["log"]), 4)

    def test_undo_on_a_fresh_store_is_a_conflict(self):
        status, reply = self.srv.json("POST", "/api/undo")  # an empty body is fine
        self.assertEqual(status, 409)
        self.assertEqual(reply, {"error": "nothing to undo", "version": 0, "game": None, "log": []})

    def test_snapshots_are_capped(self):
        with mock.patch.object(server, "MAX_SNAPSHOTS", 3):
            for version in range(5):
                self.act(version, {"step": version + 1})
            for expected in (4, 3, 2):
                status, doc = self.undo()
                self.assertEqual(status, 200)
                self.assertEqual(doc["game"], {"step": expected})
            status, _ = self.undo()
            self.assertEqual(status, 409)


class PersistenceTests(ServerTestCase):
    def test_changes_are_saved_atomically(self):
        self.act(0, {"round": 1}, summary="First")
        saved = json.loads((self.data_dir / "current.json").read_text(encoding="utf-8"))
        self.assertEqual(saved, self.state())
        snapshots = json.loads((self.data_dir / "snapshots.json").read_text(encoding="utf-8"))
        self.assertEqual(snapshots, [{"version": 0, "game": None}])
        self.assertEqual(sorted(p.name for p in self.data_dir.iterdir()),
                         ["current.json", "snapshots.json"])

    def test_restart_keeps_game_log_and_snapshots(self):
        self.act(0, {"round": 1}, summary="First", house="Tully")
        self.act(1, {"round": 2}, summary="Second", house="Arryn")
        before = self.state()
        self.srv.stop()

        again = self.start()
        self.assertEqual(self.state(again), before)
        status, doc = self.undo("Tully", srv=again)
        self.assertEqual(status, 200)
        self.assertEqual(doc["game"], {"round": 1})
        status, reply = self.act(3, {"round": 3}, summary="Third", srv=again)
        self.assertEqual(status, 200)
        self.assertEqual(reply["entry"]["id"], 4)

    def test_export_import_round_trip(self):
        self.act(0, {"round": 1, "name": "Rhaenyra's dragon"}, summary="First", house="Martell")
        self.act(1, {"round": 2, "name": "Rhaenyra's dragon"}, summary="Second", house="Tyrell")
        self.undo("Tyrell")
        status, response, body = self.srv.request("GET", "/api/export")
        self.assertEqual(status, 200)
        self.assertEqual(response.getheader("Content-Type"), "application/json; charset=utf-8")
        self.assertRegex(response.getheader("Content-Disposition"),
                         r'^attachment; filename="epic-overview-\d{8}-\d{4}\.json"$')
        exported = json.loads(body)
        self.assertEqual(exported, self.state())

        other = self.start(self.root / "other-save")
        status, reply = other.json("POST", "/api/import", exported)
        self.assertEqual(status, 200)
        self.assertEqual(reply, {"version": 1})
        doc = self.state(other)
        self.assertEqual(doc["game"], exported["game"])
        self.assertEqual(doc["log"][:-1], exported["log"])
        self.assertEqual(doc["log"][-1]["summary"], "Game imported")
        self.assertEqual(doc["log"][-1]["kind"], "import")
        self.assertEqual(doc["log"][-1]["id"], max(e["id"] for e in exported["log"]) + 1)

        # The import itself can be undone: back to the empty game it replaced.
        status, doc = self.undo(srv=other)
        self.assertEqual(status, 200)
        self.assertIsNone(doc["game"])


class EventTests(ServerTestCase):
    def open_events(self):
        conn = self.srv.connect(timeout=3)
        self.addCleanup(conn.close)
        conn.request("GET", "/api/events")
        response = conn.getresponse()
        self.assertEqual(response.status, 200)
        self.assertEqual(response.getheader("Content-Type"), "text/event-stream")
        self.assertEqual(response.getheader("Cache-Control"), "no-cache")
        return conn, response

    def test_events_announce_every_new_version(self):
        _, events = self.open_events()
        self.assertEqual(read_event(events), ("version", {"version": 0}))

        started = time.monotonic()
        self.act(0, {"round": 1})
        self.assertEqual(read_event(events), ("version", {"version": 1}))
        self.assertLess(time.monotonic() - started, 1.0)

        self.undo()
        self.assertEqual(read_event(events), ("version", {"version": 2}))
        self.srv.json("POST", "/api/import", {"game": {"round": 5}, "log": []})
        self.assertEqual(read_event(events), ("version", {"version": 3}))

    def test_ping_and_quiet_disconnect(self):
        self.srv.httpd.ping_seconds = 0.1
        conn, events = self.open_events()
        read_event(events)
        self.assertEqual(events.readline(), b": ping\n")
        self.assertEqual(self.srv.httpd.hub.subscriber_count(), 1)

        conn.close()
        events.close()
        deadline = time.monotonic() + 3
        while self.srv.httpd.hub.subscriber_count() and time.monotonic() < deadline:
            time.sleep(0.05)
        self.assertEqual(self.srv.httpd.hub.subscriber_count(), 0)


class StaticFileTests(ServerTestCase):
    def test_root_serves_index_html(self):
        status, response, body = self.srv.request("GET", "/")
        self.assertEqual(status, 200)
        self.assertEqual(response.getheader("Content-Type"), "text/html; charset=utf-8")
        self.assertEqual(response.getheader("Cache-Control"), "no-cache")
        self.assertEqual(body.decode("utf-8"), INDEX_HTML)

    def test_mime_types(self):
        status, response, body = self.srv.request("GET", "/js/app.js?v=2")
        self.assertEqual(status, 200)
        self.assertEqual(response.getheader("Content-Type"), "text/javascript; charset=utf-8")
        self.assertEqual(response.getheader("Cache-Control"), "no-cache")
        self.assertEqual(body.decode("utf-8"), APP_JS)
        status, response, _ = self.srv.request("GET", "/art.webp")
        self.assertEqual(status, 200)
        self.assertEqual(response.getheader("Content-Type"), "image/webp")
        self.assertIsNone(response.getheader("Cache-Control"))

    def test_traversal_folders_and_missing_files_are_404(self):
        server_py = quote((ROOT / "server.py").as_posix())
        paths = [
            "/../secret.txt",
            "/%2e%2e/secret.txt",
            "/..%2fsecret.txt",
            "/..%5csecret.txt",
            "/..\\secret.txt",
            "/js/../../secret.txt",
            "/../server.py",
            "/" + server_py,
            "//" + server_py,
            "/js",
            "/js/",
            "/missing.js",
            "/index.html%00",
        ]
        for path in paths:
            with self.subTest(path=path):
                status, response, body = self.srv.request("GET", path)
                self.assertEqual(status, 404)
                self.assertNotIn(b"outside web/", body)


class CorsTests(ServerTestCase):
    """The GitHub Pages copy of web/ calls the Fly.io server from another origin."""

    PAGES = "https://flomotiongo.github.io"

    def setUp(self):
        super().setUp()
        running = RunningServer(self.root / "cors-save", self.web_dir, allowed_origins=[self.PAGES])
        self.addCleanup(running.stop)
        self.cors = running

    def call(self, srv, method, path, origin, body=None, extra=None):
        conn = srv.connect()
        try:
            headers = {"Origin": origin, **(extra or {})}
            data = None if body is None else json.dumps(body).encode("utf-8")
            if data is not None:
                headers["Content-Type"] = "application/json"
            conn.request(method, path, body=data, headers=headers)
            response = conn.getresponse()
            response.read()
            return response
        finally:
            conn.close()

    def test_allowed_origin_gets_the_header_on_state_and_actions(self):
        r = self.call(self.cors, "GET", "/api/state", self.PAGES)
        self.assertEqual(r.status, 200)
        self.assertEqual(r.getheader("Access-Control-Allow-Origin"), self.PAGES)
        self.assertEqual(r.getheader("Vary"), "Origin")
        body = {"baseVersion": 0, "state": {"round": 1}, "entry": {"summary": "From Pages"}}
        r = self.call(self.cors, "POST", "/api/action", self.PAGES, body)
        self.assertEqual(r.status, 200)
        self.assertEqual(r.getheader("Access-Control-Allow-Origin"), self.PAGES)

    def test_preflight_allows_json_posts(self):
        r = self.call(self.cors, "OPTIONS", "/api/action", self.PAGES,
                      extra={"Access-Control-Request-Method": "POST", "Access-Control-Request-Headers": "content-type"})
        self.assertEqual(r.status, 204)
        self.assertEqual(r.getheader("Access-Control-Allow-Origin"), self.PAGES)
        self.assertIn("POST", r.getheader("Access-Control-Allow-Methods"))
        self.assertIn("Content-Type", r.getheader("Access-Control-Allow-Headers"))

    def test_export_exposes_the_file_name(self):
        r = self.call(self.cors, "GET", "/api/export", self.PAGES)
        self.assertEqual(r.getheader("Access-Control-Allow-Origin"), self.PAGES)
        self.assertIn("Content-Disposition", r.getheader("Access-Control-Expose-Headers"))

    def test_events_stream_carries_the_header(self):
        conn = self.cors.connect()
        try:
            conn.request("GET", "/api/events", headers={"Origin": self.PAGES})
            response = conn.getresponse()
            self.assertEqual(response.getheader("Access-Control-Allow-Origin"), self.PAGES)
            self.assertEqual(read_event(response)[0], "version")
        finally:
            conn.close()

    def test_other_origins_and_the_default_server_get_no_header(self):
        r = self.call(self.cors, "GET", "/api/state", "https://example.com")
        self.assertIsNone(r.getheader("Access-Control-Allow-Origin"))
        r = self.call(self.srv, "GET", "/api/state", self.PAGES)   # no origins configured
        self.assertIsNone(r.getheader("Access-Control-Allow-Origin"))

    def test_origins_come_from_the_environment(self):
        with mock.patch.dict("os.environ", {"EPIC_ALLOW_ORIGINS": " https://a.example/, https://b.example "}):
            self.assertEqual(server.allowed_origins_from_env(), ["https://a.example", "https://b.example"])


if __name__ == "__main__":
    unittest.main()
