package com.counseling.backend.counseling;

import java.io.IOException;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;
import org.springframework.web.server.ResponseStatusException;

/**
 * Connects the backend to the AI summary service (backend/ai/summary/server.py).
 *
 * <p>It sends the counseling note as {"recordText": "..."} and turns the answer into a
 * {@link GeneratedSummary}. The AI service only returns a draft; the counselor must still
 * review and approve it (see {@link CounselingSummaryService}). The AI text "기록에 없음"
 * (nothing in the record) becomes null because {@link SummaryFields} keeps missing
 * information as null. The note is never logged.
 *
 * <p>Settings (optional): ai.summary.url (default http://127.0.0.1:8001/api/ai/summary),
 * ai.summary.timeout-seconds (default 30).
 */
@Component
public class AiServiceSummaryGenerator implements SummaryGenerator {
    static final String NO_RECORD = "기록에 없음";

    private final HttpClient client;
    private final URI uri;
    private final Duration timeout;

    public AiServiceSummaryGenerator(
            @Value("${ai.summary.url:http://127.0.0.1:8001/api/ai/summary}") String url,
            @Value("${ai.summary.timeout-seconds:30}") long timeoutSeconds) {
        this.client = HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(5)).build();
        this.uri = URI.create(url);
        this.timeout = Duration.ofSeconds(timeoutSeconds);
    }

    @Override
    public GeneratedSummary generate(String counselingNote) {
        HttpResponse<String> response;
        try {
            HttpRequest request = HttpRequest.newBuilder(uri)
                .timeout(timeout)
                .header("Content-Type", "application/json; charset=utf-8")
                .POST(HttpRequest.BodyPublishers.ofString(
                    "{\"recordText\":" + quote(counselingNote) + "}", StandardCharsets.UTF_8))
                .build();
            response = client.send(request, HttpResponse.BodyHandlers.ofString(StandardCharsets.UTF_8));
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            throw new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE, "AI summary request was interrupted", e);
        } catch (IOException e) {
            throw new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE, "AI summary service is not reachable", e);
        }

        int status = response.statusCode();
        Map<String, Object> body = parseOrNull(response.body());
        if (status == 200) {
            return toSummary(body);
        }
        String code = body != null && body.get("error") instanceof String s ? s : "HTTP " + status;
        if (status == 400) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Counseling note is empty or invalid for AI summary");
        }
        if (status == 413) {
            throw new ResponseStatusException(HttpStatus.PAYLOAD_TOO_LARGE, "Counseling note is too long for AI summary");
        }
        if (status == 429) {
            throw new ResponseStatusException(HttpStatus.TOO_MANY_REQUESTS, "AI rate limit exceeded, retry later");
        }
        throw new ResponseStatusException(HttpStatus.BAD_GATEWAY, "AI summary failed: " + code);
    }

    private static GeneratedSummary toSummary(Map<String, Object> body) {
        if (body == null
                || !(body.get("complaint") instanceof String complaint)
                || !(body.get("intervention") instanceof String intervention)
                || !(body.get("nextPlan") instanceof String nextPlan)
                || !(body.get("model") instanceof String model)) {
            throw new ResponseStatusException(HttpStatus.BAD_GATEWAY, "Invalid AI summary response");
        }
        SummaryFields fields = new SummaryFields(missingToNull(complaint), missingToNull(intervention), missingToNull(nextPlan));
        return new GeneratedSummary(fields, model);
    }

    private static String missingToNull(String value) {
        String trimmed = value.strip();
        return trimmed.isEmpty() || trimmed.equals(NO_RECORD) ? null : trimmed;
    }

    private static Map<String, Object> parseOrNull(String text) {
        try {
            Object value = new JsonReader(text).readValue();
            @SuppressWarnings("unchecked")
            Map<String, Object> map = value instanceof Map<?, ?> ? (Map<String, Object>) value : null;
            return map;
        } catch (RuntimeException e) {
            return null;
        }
    }

    /** Escapes text as a JSON string literal. */
    static String quote(String text) {
        StringBuilder sb = new StringBuilder("\"");
        for (int i = 0; i < text.length(); i++) {
            char c = text.charAt(i);
            switch (c) {
                case '"' -> sb.append("\\\"");
                case '\\' -> sb.append("\\\\");
                case '\n' -> sb.append("\\n");
                case '\r' -> sb.append("\\r");
                case '\t' -> sb.append("\\t");
                default -> {
                    if (c < 0x20) {
                        sb.append(String.format("\\u%04x", (int) c));
                    } else {
                        sb.append(c);
                    }
                }
            }
        }
        return sb.append('"').toString();
    }

    /** Small JSON reader for the AI service answer (objects, arrays, strings, numbers, booleans, null). */
    private static final class JsonReader {
        private final String s;
        private int pos;

        JsonReader(String s) {
            this.s = s == null ? "" : s;
        }

        Object readValue() {
            skipSpaces();
            if (pos >= s.length()) throw new IllegalArgumentException("empty");
            char c = s.charAt(pos);
            if (c == '{') return readObject();
            if (c == '[') return readArray();
            if (c == '"') return readString();
            return readLiteral();
        }

        private Map<String, Object> readObject() {
            Map<String, Object> map = new LinkedHashMap<>();
            pos++;
            skipSpaces();
            if (peek() == '}') { pos++; return map; }
            while (true) {
                skipSpaces();
                String key = readString();
                skipSpaces();
                expect(':');
                map.put(key, readValue());
                skipSpaces();
                char c = next();
                if (c == '}') return map;
                if (c != ',') throw new IllegalArgumentException("object");
            }
        }

        private List<Object> readArray() {
            List<Object> list = new ArrayList<>();
            pos++;
            skipSpaces();
            if (peek() == ']') { pos++; return list; }
            while (true) {
                list.add(readValue());
                skipSpaces();
                char c = next();
                if (c == ']') return list;
                if (c != ',') throw new IllegalArgumentException("array");
            }
        }

        private String readString() {
            expect('"');
            StringBuilder sb = new StringBuilder();
            while (true) {
                char c = next();
                if (c == '"') return sb.toString();
                if (c != '\\') { sb.append(c); continue; }
                char e = next();
                switch (e) {
                    case '"', '\\', '/' -> sb.append(e);
                    case 'b' -> sb.append('\b');
                    case 'f' -> sb.append('\f');
                    case 'n' -> sb.append('\n');
                    case 'r' -> sb.append('\r');
                    case 't' -> sb.append('\t');
                    case 'u' -> {
                        if (pos + 4 > s.length()) throw new IllegalArgumentException("unicode");
                        sb.append((char) Integer.parseInt(s.substring(pos, pos + 4), 16));
                        pos += 4;
                    }
                    default -> throw new IllegalArgumentException("escape");
                }
            }
        }

        private Object readLiteral() {
            int start = pos;
            while (pos < s.length() && ",}] \n\r\t".indexOf(s.charAt(pos)) < 0) pos++;
            String token = s.substring(start, pos);
            return switch (token) {
                case "true" -> Boolean.TRUE;
                case "false" -> Boolean.FALSE;
                case "null" -> null;
                default -> {
                    Double.parseDouble(token);
                    yield token;
                }
            };
        }

        private void skipSpaces() {
            while (pos < s.length() && Character.isWhitespace(s.charAt(pos))) pos++;
        }

        private char peek() {
            if (pos >= s.length()) throw new IllegalArgumentException("end");
            return s.charAt(pos);
        }

        private char next() {
            char c = peek();
            pos++;
            return c;
        }

        private void expect(char c) {
            if (next() != c) throw new IllegalArgumentException("expected " + c);
        }
    }
}
