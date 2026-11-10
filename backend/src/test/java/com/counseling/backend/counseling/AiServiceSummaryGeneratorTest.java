package com.counseling.backend.counseling;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;

import com.sun.net.httpserver.HttpExchange;
import com.sun.net.httpserver.HttpServer;
import java.io.IOException;
import java.net.InetSocketAddress;
import java.nio.charset.StandardCharsets;
import java.util.concurrent.atomic.AtomicReference;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.web.server.ResponseStatusException;

/** Runs the AI summary connector against a local fake AI service (no network, no API key). */
class AiServiceSummaryGeneratorTest {
    private static final String GOOD = "{\"complaint\":\"최근 \\\"잠\\\"을 못 잠\\n함\",\"intervention\":\"기록에 없음\","
        + "\"nextPlan\":\" 수면 기록 \",\"status\":\"DRAFT\",\"aiGenerated\":true,\"reviewRequired\":true,"
        + "\"model\":\"gemini-3.5-flash-lite\",\"promptVersion\":\"v5\"}";

    private HttpServer server;
    private final AtomicReference<String> lastBody = new AtomicReference<>();
    private String base;

    @BeforeEach
    void start() throws IOException {
        server = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
        route("/ok", 200, GOOD);
        route("/unicode", 200, "{\"complaint\":\"\\ud55c\\uae00\",\"intervention\":\"b\",\"nextPlan\":\"c\",\"model\":\"m\"}");
        route("/empty", 400, "{\"error\":\"EMPTY_RECORD\",\"manualInput\":false}");
        route("/long", 413, "{\"error\":\"RECORD_TOO_LONG\"}");
        route("/rate", 429, "{\"error\":\"AI_RATE_LIMITED\",\"retryAfterSeconds\":9}");
        route("/down", 502, "{\"error\":\"AI_UNAVAILABLE\",\"manualInput\":true}");
        route("/garbage", 200, "<html>nope</html>");
        route("/missing", 200, "{\"complaint\":\"a\",\"intervention\":\"b\",\"model\":\"m\"}");
        route("/nomodel", 200, "{\"complaint\":\"a\",\"intervention\":\"b\",\"nextPlan\":\"c\"}");
        server.createContext("/slow", exchange -> {
            try {
                Thread.sleep(3000);
            } catch (InterruptedException ignored) {
                Thread.currentThread().interrupt();
            }
            reply(exchange, 200, "{}");
        });
        server.start();
        base = "http://127.0.0.1:" + server.getAddress().getPort();
    }

    @AfterEach
    void stop() {
        server.stop(0);
    }

    @Test
    void returnsDraftFieldsAndModelName() {
        GeneratedSummary result = new AiServiceSummaryGenerator(base + "/ok", 5).generate("기록");

        assertEquals("최근 \"잠\"을 못 잠\n함", result.draft().complaint());
        assertEquals("수면 기록", result.draft().nextPlan());
        assertEquals("gemini-3.5-flash-lite", result.modelName());
    }

    @Test
    void turnsNothingInTheRecordIntoNull() {
        GeneratedSummary result = new AiServiceSummaryGenerator(base + "/ok", 5).generate("기록");

        assertNull(result.draft().intervention());
        assertEquals("수면 기록", result.draft().validated().nextPlan());
    }

    @Test
    void sendsTheNoteAsEscapedJson() {
        new AiServiceSummaryGenerator(base + "/ok", 5).generate("내담자가 \"잠\"을\n못 잠\t(탭)\\");

        assertEquals("{\"recordText\":\"내담자가 \\\"잠\\\"을\\n못 잠\\t(탭)\\\\\"}", lastBody.get());
    }

    @Test
    void readsUnicodeEscapes() {
        assertEquals("한글", new AiServiceSummaryGenerator(base + "/unicode", 5).generate("x").draft().complaint());
    }

    @Test
    void mapsEmptyNoteTo400() {
        assertStatus(400, "Counseling note is empty or invalid for AI summary", base + "/empty", 5);
    }

    @Test
    void mapsTooLongNoteTo413() {
        assertStatus(413, "Counseling note is too long for AI summary", base + "/long", 5);
    }

    @Test
    void mapsRateLimitTo429() {
        assertStatus(429, "AI rate limit exceeded, retry later", base + "/rate", 5);
    }

    @Test
    void mapsAiFailureTo502WithTheAiErrorCode() {
        assertStatus(502, "AI summary failed: AI_UNAVAILABLE", base + "/down", 5);
    }

    @Test
    void rejectsAnswersThatAreNotTheAgreedJson() {
        assertStatus(502, "Invalid AI summary response", base + "/garbage", 5);
        assertStatus(502, "Invalid AI summary response", base + "/missing", 5);
        assertStatus(502, "Invalid AI summary response", base + "/nomodel", 5);
    }

    @Test
    void mapsAnUnreachableServiceTo503() {
        assertStatus(503, "AI summary service is not reachable", "http://127.0.0.1:1/api/ai/summary", 5);
    }

    @Test
    void mapsASlowServiceTo503() {
        assertStatus(503, "AI summary service is not reachable", base + "/slow", 1);
    }

    @Test
    void escapesControlCharacters() {
        assertEquals("\"a\\u0001b\"", AiServiceSummaryGenerator.quote("a\u0001b"));
    }

    private void assertStatus(int status, String reason, String url, long timeoutSeconds) {
        ResponseStatusException e = assertThrows(ResponseStatusException.class,
            () -> new AiServiceSummaryGenerator(url, timeoutSeconds).generate("기록"));
        assertEquals(status, e.getStatusCode().value());
        assertEquals(reason, e.getReason());
    }

    private void route(String path, int status, String body) {
        server.createContext(path, exchange -> reply(exchange, status, body));
    }

    private void reply(HttpExchange exchange, int status, String body) throws IOException {
        lastBody.set(new String(exchange.getRequestBody().readAllBytes(), StandardCharsets.UTF_8));
        byte[] bytes = body.getBytes(StandardCharsets.UTF_8);
        exchange.getResponseHeaders().add("Content-Type", "application/json; charset=utf-8");
        exchange.sendResponseHeaders(status, bytes.length);
        exchange.getResponseBody().write(bytes);
        exchange.close();
    }
}
