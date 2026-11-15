"""백엔드(Spring)가 호출하는 AI 요약 서버. 표준 라이브러리만 쓴다.

POST /api/ai/summary   {"recordText": "...", "maskTerms": ["내담자 이름", ...](선택)}  ->  200 초안 JSON 또는 오류 JSON
GET  /health           ->  {"status": "OK"}
기본은 내 컴퓨터(127.0.0.1)에서만 접속된다. 환경 변수: AI_HOST, AI_PORT (기본 8001, 없으면 호스팅이 주는 PORT)
AI_SHARED_TOKEN을 정하면 POST 요청에 같은 값의 X-AI-Token 헤더가 있어야 한다(/health는 열려 있다).
"""
import hmac
import json
import os
import sys
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


def make_server(service_factory, host="127.0.0.1", port=8001, token=None):
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
            if token and not hmac.compare_digest(self.headers.get("X-AI-Token", "").encode("utf-8"), token.encode("utf-8")):
                return self._send(401, {"error": "UNAUTHORIZED", "message": "접근 토큰이 없거나 틀립니다", "manualInput": True})
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
    port = int(os.environ.get("AI_PORT") or os.environ.get("PORT") or "8001")
    token = os.environ.get("AI_SHARED_TOKEN") or None
    print("AI 요약 서버 시작: http://%s:%d/api/ai/summary%s" % (host, port, " (접근 토큰 확인 켜짐)" if token else ""))
    if host not in ("127.0.0.1", "localhost") and not token:
        print("경고: 밖에서 접속할 수 있는 주소인데 AI_SHARED_TOKEN이 없습니다. 누구나 Gemini 키 한도를 쓸 수 있습니다.", file=sys.stderr)
    make_server(default_service, host, port, token).serve_forever()
