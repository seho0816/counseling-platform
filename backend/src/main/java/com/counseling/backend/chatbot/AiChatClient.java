package com.counseling.backend.chatbot;

import java.net.URI;
import java.net.http.HttpClient;
import java.time.Duration;
import java.util.Map;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.MediaType;
import org.springframework.http.client.JdkClientHttpRequestFactory;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClientResponseException;
import org.springframework.web.client.RestClient;
import tools.jackson.databind.json.JsonMapper;

/** Calls the Python AI guide endpoint. Never logs a user message or authentication token. */
@Component
public class AiChatClient {
    private final RestClient restClient;
    private final URI endpoint;
    private final String token;
    private static final JsonMapper JSON = JsonMapper.builder().build();

    public AiChatClient(
            @Value("${ai.chat.url:}") String url,
            @Value("${ai.chat.token:}") String token,
            @Value("${ai.chat.timeout-seconds:25}") long timeoutSeconds) {
        this.endpoint = url == null || url.isBlank() ? null : URI.create(url);
        this.token = token == null ? "" : token.strip();

        HttpClient httpClient = HttpClient.newBuilder()
                .connectTimeout(Duration.ofSeconds(5)).build();
        JdkClientHttpRequestFactory requestFactory = new JdkClientHttpRequestFactory(httpClient);
        requestFactory.setReadTimeout(Duration.ofSeconds(Math.max(1, timeoutSeconds)));
        this.restClient = RestClient.builder().requestFactory(requestFactory).build();
    }

    public String generateGuide(String message) {
        if (endpoint == null) {
            throw new IllegalStateException("AI chat endpoint is not configured");
        }
        RestClient.RequestBodySpec request = restClient.post()
                .uri(endpoint)
                .contentType(MediaType.APPLICATION_JSON);
        if (!token.isBlank()) {
            request.header("X-AI-Token", token);
        }
        AiReply response;
        try {
            byte[] jsonBytes = JSON.writeValueAsBytes(
                Map.of("message", message)
            );

            response = request
                .contentLength(jsonBytes.length)
                .body(jsonBytes)
                .retrieve()
                .body(AiReply.class);
        } catch (RestClientResponseException e) {
            // Python returns 422 {"error":"CRISIS_DETECTED", ...} when its
            // secondary safety check catches a crisis that Java did not catch.
            if (e.getStatusCode().value() == 422 && crisisCodeInBody(e)) {
                throw new CrisisDetectedException();
            }
            throw e; // other 4xx/5xx errors use the service's fixed fallback
        }
        if (response == null || response.reply() == null
                || response.reply().isBlank() || response.reply().length() > 1500) {
            throw new IllegalStateException("Invalid AI chat response");
        }
        return response.reply().strip();
    }

    private static boolean crisisCodeInBody(RestClientResponseException e) {
        try {
            // Read the structured error field; do not mistake arbitrary error
            // messages containing the word CRISIS_DETECTED for this code.
            Map<?, ?> body = e.getResponseBodyAs(Map.class);
            return body != null && "CRISIS_DETECTED".equals(body.get("error"));
        } catch (RuntimeException ignored) {
            // Malformed/unknown upstream responses are not trusted as crisis codes.
            return false;
        }
    }

    /** Internal signal, not an HTTP error exposed to the browser. */
    static final class CrisisDetectedException extends RuntimeException {
        CrisisDetectedException() {
            super("Python AI safety check detected a crisis");
        }
    }

    private record AiRequest(String message) {}
    private record AiReply(String reply) {}
}
