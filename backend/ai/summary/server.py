"""백엔드(Spring)가 호출하는 AI 요약 서버. 표준 라이브러리만 쓴다.

POST /api/ai/summary   {"recordText": "...", "maskTerms": ["내담자 이름", ...](선택)}  ->  200 초안 JSON 또는 오류 JSON
GET  /health           ->  {"status": "OK"}
기본은 내 컴퓨터(127.0.0.1)에서만 접속된다. 환경 변수: AI_HOST, AI_PORT (기본 8001)
"""
import json
import os
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

from summary_core import SummaryError, SummaryService

MAX_BODY = 1_000_000
_service = None


def default_service():
    global _service
    if _service is None:
        from llm_clients import GeminiClient
        _service = SummaryService(GeminiClient())
    return _service


def make_server(service_factory, host="127.0.0.1", port=8001):
    class Handler(BaseHTTPRequestHandler):
        def _send(self, status, payload):
            body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
            self.send_response(status)
            self.send_header("Content-Type", "application/json; charset=utf-8")
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)

        def do_GET(self):
            if self.path == "/health":
                self._send(200, {"status": "OK"})
            else:
                self._send(404, {"error": "NOT_FOUND"})

        def do_POST(self):
            if self.path != "/api/ai/summary":
                return self._send(404, {"error": "NOT_FOUND"})
            length = int(self.headers.get("Content-Length") or 0)
            if length <= 0 or length > MAX_BODY:
                return self._send(400, {"error": "INVALID_REQUEST", "message": "본문이 비었거나 너무 큽니다", "manualInput": False})
            try:
                body = json.loads(self.rfile.read(length).decode("utf-8"))
            except (UnicodeDecodeError, json.JSONDecodeError):
                return self._send(400, {"error": "INVALID_REQUEST", "message": "JSON을 읽을 수 없습니다", "manualInput": False})
            if not isinstance(body, dict) or "recordText" not in body:
                return self._send(400, {"error": "INVALID_REQUEST", "message": "recordText 필드가 필요합니다", "manualInput": False})
            terms = body.get("maskTerms")
            if terms is not None and not (isinstance(terms, list) and len(terms) <= 50
                                          and all(isinstance(t, str) and len(t) <= 100 for t in terms)):
                return self._send(400, {"error": "INVALID_REQUEST", "message": "maskTerms는 문자열 목록(최대 50개)이어야 합니다", "manualInput": False})
            try:
                self._send(200, service_factory().summarize(body["recordText"], terms))
            except SummaryError as e:
                self._send(e.http_status, e.to_dict())
            except Exception:
                self._send(500, {"error": "INTERNAL_ERROR", "message": "서버 내부 오류", "manualInput": True})

        def log_message(self, fmt, *args):  # 기록 내용이 로그에 남지 않게 요청 줄만 남긴다
            print("[ai-summary]", self.address_string(), fmt % args)

    return ThreadingHTTPServer((host, port), Handler)


if __name__ == "__main__":
    host = os.environ.get("AI_HOST", "127.0.0.1")
    port = int(os.environ.get("AI_PORT", "8001"))
    print("AI 요약 서버 시작: http://%s:%d/api/ai/summary" % (host, port))
    make_server(default_service, host, port).serve_forever()
