"""EPIC Overview local server.

Serves the companion web app from web/ and keeps one shared game for every
phone and tablet on the home Wi-Fi. Python standard library only.

    python server.py [--port N] [--data DIR]       (env EPIC_PORT also sets the port)

API (JSON in and out):

    GET  /api/state    -> 200 {version, game, log}
    POST /api/action   {baseVersion, state, entry: {summary, house, round, step, kind, houses}}
                       -> 200 {version, entry}
                       -> 409 {version, game, log} when baseVersion is stale; the device
                          re-applies its action to that state and tries again
    POST /api/undo     {house} -> 200 {version, game, log}
                       -> 409 {error: "nothing to undo", version, game, log}
    GET  /api/events   server-sent events: "event: version" with data {version} on connect
                       and after every accepted change, ": ping" every 15 s
    GET  /api/export   the whole document {version, game, log} as a file download
    POST /api/import   {game, log, house?} -> 200 {version}; the replaced game can be undone

    Pages from other origins (the GitHub Pages copy of web/) may call the API when
    the origin is listed in env EPIC_ALLOW_ORIGINS (comma-separated); OPTIONS
    answers the CORS preflight.

    Bad JSON or missing fields -> 400 {error}; unknown /api/... -> 404 {error};
    bodies over 5 MB -> 413 {error}.

Files in the data folder (default data/save next to this file), both written
atomically (temporary file in the same folder, then os.replace):

    current.json     {version, game, log}
    snapshots.json   up to 300 previous {version, game}, newest last, for undo
"""

import argparse
import datetime
import errno
import json
import os
import queue
import socket
import socketserver
import sys
import tempfile
import threading
import time
import traceback
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import unquote

HERE = Path(__file__).resolve().parent
DEFAULT_WEB_DIR = HERE / "web"
DEFAULT_DATA_DIR = HERE / "data" / "save"
DEFAULT_PORT = 8765

MAX_BODY_BYTES = 5 * 1024 * 1024
MAX_SNAPSHOTS = 300
PING_SECONDS = 15

MIME_TYPES = {
    ".html": "text/html; charset=utf-8",
    ".js": "text/javascript; charset=utf-8",
    ".mjs": "text/javascript; charset=utf-8",
    ".css": "text/css; charset=utf-8",
    ".json": "application/json; charset=utf-8",
    ".webp": "image/webp",
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".svg": "image/svg+xml",
    ".woff2": "font/woff2",
    ".ico": "image/x-icon",
}
NO_CACHE_SUFFIXES = {".html", ".js", ".mjs", ".css", ".json"}


# ---------------------------------------------------------------- helpers

class ApiError(Exception):
    """A request the API refuses; becomes a JSON {"error": message} reply."""

    def __init__(self, status, message):
        super().__init__(message)
        self.status = status
        self.message = message


def now_iso():
    """Local time with UTC offset, to the second: 2026-11-12T21:05:09+01:00."""
    return datetime.datetime.now().astimezone().isoformat(timespec="seconds")


def reject_constant(name):
    """json.loads hook: NaN and Infinity are not JSON and would break the browsers."""
    raise ValueError(f"{name} is not allowed in JSON")


def require_int(value, name):
    if isinstance(value, bool) or not isinstance(value, int):
        raise ApiError(400, f"{name} must be an integer")
    return value


def optional_int(value, name):
    return None if value is None else require_int(value, name)


def optional_str(value, name):
    if value is not None and not isinstance(value, str):
        raise ApiError(400, f"{name} must be a string or null")
    return value


def str_list(value, name):
    if value is None:
        return []
    if not isinstance(value, list) or not all(isinstance(item, str) for item in value):
        raise ApiError(400, f"{name} must be a list of strings")
    return value


def parse_entry(raw):
    """The log fields a device sends with an action, checked and with defaults."""
    if not isinstance(raw, dict):
        raise ApiError(400, "entry must be an object")
    summary = raw.get("summary")
    if not isinstance(summary, str) or not summary.strip():
        raise ApiError(400, "entry.summary must be a non-empty string")
    kind = optional_str(raw.get("kind"), "entry.kind")
    if kind == "undo":
        raise ApiError(400, 'entry.kind "undo" is reserved for /api/undo')
    return {
        "summary": summary,
        "house": optional_str(raw.get("house"), "entry.house"),
        "round": optional_int(raw.get("round"), "entry.round"),
        "step": optional_str(raw.get("step"), "entry.step"),
        "kind": kind,
        "houses": str_list(raw.get("houses"), "entry.houses"),
    }


def next_entry_id(log):
    """One more than the highest log entry id (1 for an empty log)."""
    ids = [entry.get("id") for entry in log if isinstance(entry, dict)]
    ids = [i for i in ids if isinstance(i, int) and not isinstance(i, bool)]
    return max(ids, default=0) + 1


def make_entry(log, version, summary, house=None, round=None, step=None, kind=None, houses=()):
    """A new log entry that will be appended to `log`."""
    return {
        "id": next_entry_id(log),
        "time": now_iso(),
        "version": version,
        "summary": summary,
        "house": house,
        "round": round,
        "step": step,
        "kind": kind,
        "houses": list(houses),
        "undone": False,
    }


def newest_undoable_index(log):
    """Index of the newest entry that is neither undone nor an undo itself."""
    for index in range(len(log) - 1, -1, -1):
        entry = log[index]
        if isinstance(entry, dict) and not entry.get("undone") and entry.get("kind") != "undo":
            return index
    return None


# ---------------------------------------------------------------- files

def read_json_file(path):
    """The parsed content of a JSON file, or None when the file does not exist."""
    if not path.exists():
        return None
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except ValueError as err:
        raise ValueError(f"{path} is not valid JSON ({err})") from err


def replace_file(source, target):
    """os.replace, retried briefly: on Windows a virus scanner or an open
    editor can hold the target for a moment."""
    for attempt in range(5):
        try:
            os.replace(source, target)
            return
        except PermissionError:
            if attempt == 4:
                raise
            time.sleep(0.05 * (attempt + 1))


def write_json_atomic(path, value, indent=None):
    """Write JSON to a temporary file next to `path`, then swap it in, so a
    crash never leaves a half-written file behind."""
    separators = None if indent else (",", ":")
    text = json.dumps(value, ensure_ascii=False, indent=indent, separators=separators)
    fd, temp_name = tempfile.mkstemp(prefix=path.name + ".", suffix=".tmp", dir=path.parent)
    try:
        with os.fdopen(fd, "w", encoding="utf-8", newline="\n") as file:
            file.write(text)
            file.flush()
            os.fsync(file.fileno())
        replace_file(temp_name, path)
    except BaseException:
        try:
            os.unlink(temp_name)
        except OSError:
            pass
        raise


# ---------------------------------------------------------------- state

class Store:
    """The shared game document and its undo snapshots, saved in one folder.

    Every public method takes the lock. The log and snapshot lists are
    replaced, never changed in place, so a document returned by state()
    stays consistent while another thread commits a change.
    """

    def __init__(self, data_dir, on_change=None):
        self.data_dir = Path(data_dir)
        self.data_dir.mkdir(parents=True, exist_ok=True)
        self.current_path = self.data_dir / "current.json"
        self.snapshots_path = self.data_dir / "snapshots.json"
        self.on_change = on_change or (lambda version: None)
        self.lock = threading.Lock()
        self.version = 0
        self.game = None
        self.log = []
        self.snapshots = []
        self._load()

    def _load(self):
        doc = read_json_file(self.current_path)
        if doc is not None:
            if (not isinstance(doc, dict)
                    or isinstance(doc.get("version"), bool)
                    or not isinstance(doc.get("version"), int)
                    or not isinstance(doc.get("log", []), list)):
                raise ValueError(f"{self.current_path} is not an EPIC Overview save file")
            self.version = doc["version"]
            self.game = doc.get("game")
            self.log = doc.get("log", [])
        snapshots = read_json_file(self.snapshots_path)
        if snapshots is not None:
            if not isinstance(snapshots, list) or not all(isinstance(s, dict) for s in snapshots):
                raise ValueError(f"{self.snapshots_path} is not an EPIC Overview snapshot file")
            self.snapshots = snapshots[-MAX_SNAPSHOTS:]

    def _document(self):
        return {"version": self.version, "game": self.game, "log": self.log}

    def _snapshots_with_current(self):
        """The snapshot list plus the current game, capped at MAX_SNAPSHOTS."""
        current = {"version": self.version, "game": self.game}
        return (self.snapshots + [current])[-MAX_SNAPSHOTS:]

    def _commit(self, version, game, log, snapshots):
        """Save to disk first, then switch the memory over, then notify.
        If saving fails, nothing has changed."""
        write_json_atomic(self.current_path, {"version": version, "game": game, "log": log}, indent=1)
        write_json_atomic(self.snapshots_path, snapshots)
        self.version, self.game, self.log, self.snapshots = version, game, log, snapshots
        self.on_change(version)

    def state(self):
        with self.lock:
            return self._document()

    def apply_action(self, base_version, game, fields):
        """Returns (status, payload): 200 {version, entry} or 409 {version, game, log}."""
        with self.lock:
            if base_version != self.version:
                return 409, self._document()
            version = self.version + 1
            entry = make_entry(self.log, version, **fields)
            self._commit(version, game, self.log + [entry], self._snapshots_with_current())
            return 200, {"version": version, "entry": entry}

    def undo(self, house):
        """Returns (status, payload): 200 {version, game, log} or 409 with an error."""
        with self.lock:
            if not self.snapshots:
                return 409, {"error": "nothing to undo", **self._document()}
            snapshot = self.snapshots[-1]
            version = self.version + 1
            stamp = now_iso()
            log = list(self.log)
            index = newest_undoable_index(log)
            if index is None:
                undone = {"summary": "last change"}
            else:
                undone = log[index]
                log[index] = {**undone, "undone": True, "undoneAt": stamp}
            entry = make_entry(
                log, version, "Undone: " + str(undone.get("summary", "")),
                house=house, round=undone.get("round"), step=undone.get("step"),
                kind="undo", houses=undone.get("houses") or [],
            )
            entry["time"] = stamp
            log.append(entry)
            self._commit(version, snapshot.get("game"), log, self.snapshots[:-1])
            return 200, self._document()

    def import_game(self, game, log, house=None):
        """Replace game and log; the old game becomes an undo snapshot."""
        with self.lock:
            version = self.version + 1
            entry = make_entry(log, version, "Game imported", house=house, kind="import")
            self._commit(version, game, log + [entry], self._snapshots_with_current())
            return 200, {"version": version}


class Hub:
    """Fan-out of new version numbers to the open /api/events streams."""

    def __init__(self):
        self._lock = threading.Lock()
        self._queues = []
        self._closed = False

    def subscribe(self):
        updates = queue.Queue()
        with self._lock:
            if self._closed:
                updates.put(None)
            self._queues.append(updates)
        return updates

    def unsubscribe(self, updates):
        with self._lock:
            if updates in self._queues:
                self._queues.remove(updates)

    def subscriber_count(self):
        with self._lock:
            return len(self._queues)

    def publish(self, version):
        with self._lock:
            for updates in self._queues:
                updates.put(version)

    def close(self):
        """Wake every stream with None so its thread ends."""
        with self._lock:
            self._closed = True
            for updates in self._queues:
                updates.put(None)


# ---------------------------------------------------------------- HTTP

class RequestHandler(BaseHTTPRequestHandler):
    server_version = "EpicOverview/1.0"
    timeout = 30  # seconds a silent connection may wait before it is dropped

    # -- routing

    def do_GET(self):
        path = self.url_path()
        if path == "/api" or path.startswith("/api/"):
            self.dispatch_api("GET", path)
        else:
            self.serve_static(path)

    def do_POST(self):
        self.dispatch_api("POST", self.url_path())

    def do_OPTIONS(self):
        """CORS preflight for the API; end_headers adds Allow-Origin for allowed origins."""
        self.send_response(204)
        self.send_header("Access-Control-Allow-Methods", "GET, POST")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.send_header("Access-Control-Max-Age", "600")
        self.send_header("Content-Length", "0")
        self.end_headers()

    def end_headers(self):
        # The page may come from another origin (GitHub Pages) than this server (Fly.io).
        headers = getattr(self, "headers", None)
        origin = headers.get("Origin") if headers else None
        if origin and origin in self.server.allowed_origins:
            self.send_header("Access-Control-Allow-Origin", origin)
            self.send_header("Access-Control-Expose-Headers", "Content-Disposition")
            self.send_header("Vary", "Origin")
        super().end_headers()

    def url_path(self):
        """The request path without the query string (?v=2 cache busters)."""
        return self.path.split("?", 1)[0].split("#", 1)[0]

    def dispatch_api(self, method, path):
        routes = {
            ("GET", "/api/state"): self.get_state,
            ("GET", "/api/events"): self.get_events,
            ("GET", "/api/export"): self.get_export,
            ("POST", "/api/action"): self.post_action,
            ("POST", "/api/undo"): self.post_undo,
            ("POST", "/api/import"): self.post_import,
        }
        handler = routes.get((method, path))
        if handler is None:
            allowed = [m for (m, p) in routes if p == path]
            if allowed:
                self.send_json(405, {"error": f"use {' or '.join(allowed)} for {path}"},
                               {"Allow": ", ".join(allowed)})
            else:
                self.send_json(404, {"error": f"unknown API path {path}"})
            return
        try:
            handler()
        except ApiError as err:
            self.send_json(err.status, {"error": err.message})
        except (ConnectionError, TimeoutError):
            raise
        except Exception:
            traceback.print_exc()
            self.send_json(500, {"error": "internal server error"})

    # -- API

    def get_state(self):
        self.send_json(200, self.server.store.state())

    def get_export(self):
        name = datetime.datetime.now().strftime("epic-overview-%Y%m%d-%H%M.json")
        self.send_json(200, self.server.store.state(),
                       {"Content-Disposition": f'attachment; filename="{name}"'}, indent=1)

    def post_action(self):
        body = self.read_json_body()
        base_version = require_int(body.get("baseVersion"), "baseVersion")
        game = body.get("state")
        if not isinstance(game, dict):
            raise ApiError(400, "state must be an object")
        fields = parse_entry(body.get("entry"))
        status, payload = self.server.store.apply_action(base_version, game, fields)
        self.send_json(status, payload)

    def post_undo(self):
        body = self.read_json_body(allow_empty=True)
        house = optional_str(body.get("house"), "house")
        status, payload = self.server.store.undo(house)
        self.send_json(status, payload)

    def post_import(self):
        body = self.read_json_body()
        if "game" not in body:
            raise ApiError(400, "game is missing")
        game = body["game"]
        if game is not None and not isinstance(game, dict):
            raise ApiError(400, "game must be an object or null")
        log = body.get("log")
        if not isinstance(log, list) or not all(isinstance(entry, dict) for entry in log):
            raise ApiError(400, "log must be a list of objects")
        house = optional_str(body.get("house"), "house")
        status, payload = self.server.store.import_game(game, log, house)
        self.send_json(status, payload)

    def get_events(self):
        hub = self.server.hub
        updates = hub.subscribe()  # before reading the version, so no change slips through
        try:
            self.send_response(200)
            self.send_header("Content-Type", "text/event-stream")
            self.send_header("Cache-Control", "no-cache")
            self.send_header("Connection", "keep-alive")
            self.end_headers()
            self.send_version_event(self.server.store.state()["version"])
            while True:
                try:
                    version = updates.get(timeout=self.server.ping_seconds)
                except queue.Empty:
                    self.wfile.write(b": ping\n\n")
                    continue
                if version is None:  # the server is shutting down
                    break
                self.send_version_event(version)
        except (ConnectionError, TimeoutError):
            pass  # the device closed the page or lost the Wi-Fi
        finally:
            hub.unsubscribe(updates)
            self.close_connection = True

    def send_version_event(self, version):
        data = json.dumps({"version": version})
        self.wfile.write(f"event: version\ndata: {data}\n\n".encode("utf-8"))

    # -- request and response helpers

    def read_json_body(self, allow_empty=False):
        """The request body as a JSON object; ApiError if it is missing or bad."""
        try:
            length = int(self.headers.get("Content-Length") or 0)
        except ValueError:
            raise ApiError(400, "Content-Length must be a number") from None
        if length < 0:
            raise ApiError(400, "Content-Length must not be negative")
        if length > MAX_BODY_BYTES:
            self.close_connection = True  # the unread body must not be taken for a request
            raise ApiError(413, "request body is larger than 5 MB")
        if length == 0:
            if allow_empty:
                return {}
            raise ApiError(400, "request body is empty")
        raw = self.rfile.read(length)
        try:
            data = json.loads(raw.decode("utf-8"), parse_constant=reject_constant)
        except (UnicodeDecodeError, ValueError, RecursionError):
            raise ApiError(400, "request body is not valid JSON") from None
        if not isinstance(data, dict):
            raise ApiError(400, "request body must be a JSON object")
        return data

    def send_json(self, status, payload, headers=None, indent=None):
        body = json.dumps(payload, ensure_ascii=False, indent=indent).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        for name, value in (headers or {}).items():
            self.send_header(name, value)
        self.end_headers()
        self.wfile.write(body)

    def send_text(self, status, text):
        body = text.encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "text/plain; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    # -- static files

    def static_file(self, url_path):
        """The file under web/ for a URL path, or None if it is missing, a
        folder, or outside web/ (path traversal)."""
        relative = unquote(url_path).lstrip("/\\") or "index.html"
        root = self.server.web_dir
        try:
            target = (root / relative).resolve()
        except (OSError, ValueError):
            return None
        if not target.is_relative_to(root) or not target.is_file():
            return None
        return target

    def serve_static(self, url_path):
        target = self.static_file(url_path)
        try:
            data = target.read_bytes() if target else None
        except OSError:
            data = None
        if data is None:
            self.send_text(404, "Not found")
            return
        suffix = target.suffix.lower()
        self.send_response(200)
        self.send_header("Content-Type", MIME_TYPES.get(suffix, "application/octet-stream"))
        self.send_header("Content-Length", str(len(data)))
        if suffix in NO_CACHE_SUFFIXES:
            self.send_header("Cache-Control", "no-cache")
        self.end_headers()
        self.wfile.write(data)

    # -- logging: quiet unless something is wrong

    def log_request(self, code="-", size="-"):
        if isinstance(code, int) and code >= 500:
            super().log_request(code, size)

    def log_message(self, format, *args):
        stamp = datetime.datetime.now().strftime("%H:%M:%S")
        sys.stderr.write(f"{stamp} {self.address_string()} {format % args}\n")


class EpicServer(ThreadingHTTPServer):
    daemon_threads = True
    request_queue_size = 32  # many devices may (re)connect at the same moment
    # On Windows SO_REUSEADDR would let a second server share the port silently.
    allow_reuse_address = os.name != "nt"

    def __init__(self, address, web_dir, store, hub, allowed_origins=()):
        self.web_dir = Path(web_dir).resolve()
        self.store = store
        self.hub = hub
        self.ping_seconds = PING_SECONDS
        self.allowed_origins = frozenset(allowed_origins)
        super().__init__(address, RequestHandler)

    def server_bind(self):
        # HTTPServer.server_bind also does a reverse DNS lookup of the host,
        # which can take seconds on Windows; we do not need the name.
        socketserver.TCPServer.server_bind(self)
        self.server_name, self.server_port = self.server_address[:2]

    def server_close(self):
        self.hub.close()
        super().server_close()

    def handle_error(self, request, client_address):
        if isinstance(sys.exc_info()[1], (ConnectionError, TimeoutError)):
            return  # a device went away mid-request; nothing to report
        super().handle_error(request, client_address)


def allowed_origins_from_env():
    """Origins whose pages may use the API (env EPIC_ALLOW_ORIGINS, comma-separated)."""
    raw = os.environ.get("EPIC_ALLOW_ORIGINS", "")
    return [o.strip().rstrip("/") for o in raw.split(",") if o.strip()]


def make_server(port=DEFAULT_PORT, data_dir=DEFAULT_DATA_DIR, web_dir=DEFAULT_WEB_DIR, host="0.0.0.0", allowed_origins=None):
    """A ready server; call serve_forever() on it. Port 0 picks a free port."""
    hub = Hub()
    store = Store(data_dir, on_change=hub.publish)
    if allowed_origins is None:
        allowed_origins = allowed_origins_from_env()
    return EpicServer((host, port), web_dir, store, hub, allowed_origins)


# ---------------------------------------------------------------- start-up

def lan_addresses():
    """IPv4 addresses other devices on the network can use to reach us."""
    found = []
    try:
        with socket.socket(socket.AF_INET, socket.SOCK_DGRAM) as probe:
            probe.connect(("8.8.8.8", 80))  # picks the outgoing interface; sends nothing
            found.append(probe.getsockname()[0])
    except OSError:
        pass
    try:
        for info in socket.getaddrinfo(socket.gethostname(), None, socket.AF_INET):
            found.append(info[4][0])
    except OSError:
        pass
    addresses = []
    for address in found:
        if address.startswith(("127.", "169.254.", "0.")) or address in addresses:
            continue
        addresses.append(address)
    return addresses


def print_banner(port, data_dir, web_dir):
    print("EPIC Overview is running.")
    print(f"  This computer:    http://localhost:{port}/")
    addresses = lan_addresses()
    if not addresses:
        print("  Phones, tablets:  no network address found - is the Wi-Fi connected?")
    for number, address in enumerate(addresses):
        label = "Phones, tablets:" if number == 0 else ""
        print(f"  {label:<17} http://{address}:{port}/")
    print(f"  Saved game:       {Path(data_dir).resolve()}")
    if not (Path(web_dir) / "index.html").is_file():
        print(f"  Warning: {Path(web_dir) / 'index.html'} does not exist yet.")
    print("Phones and tablets must be on the same Wi-Fi. If they cannot connect,")
    print("allow Python through the Windows firewall for private networks.")
    print("Press Ctrl+C to stop.", flush=True)


def choose_port(cli_port):
    """--port, else env EPIC_PORT, else 8765. ValueError if not 1..65535."""
    if cli_port is not None:
        port = cli_port
    else:
        port = int(os.environ.get("EPIC_PORT", "").strip() or DEFAULT_PORT)
    if not 1 <= port <= 65535:
        raise ValueError(port)
    return port


def main(argv=None):
    parser = argparse.ArgumentParser(description="EPIC Overview local server")
    parser.add_argument("--port", type=int, help=f"port to listen on (default: env EPIC_PORT or {DEFAULT_PORT})")
    parser.add_argument("--data", default=str(DEFAULT_DATA_DIR),
                        help="folder for current.json and snapshots.json (default: data/save)")
    args = parser.parse_args(argv)

    try:
        port = choose_port(args.port)
    except ValueError:
        print("The port (--port or EPIC_PORT) must be a number from 1 to 65535.")
        return 2
    try:
        httpd = make_server(port, args.data, DEFAULT_WEB_DIR)
    except ValueError as err:
        print(f"Could not load the saved game: {err}")
        return 1
    except OSError as err:
        print(f"Could not start the server: {err}")
        if err.errno in (errno.EADDRINUSE, getattr(errno, "WSAEADDRINUSE", None)):
            print(f"Port {port} is in use - is EPIC Overview already running?")
        return 1

    print_banner(port, args.data, DEFAULT_WEB_DIR)
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print("\nStopped.")
    finally:
        httpd.server_close()
    return 0


if __name__ == "__main__":
    sys.exit(main())
