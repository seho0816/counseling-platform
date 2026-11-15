package com.counseling.backend.chatbot;

import java.net.URI;
import java.net.http.HttpClient;
import java.time.Duration;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.MediaType;
import org.springframework.http.client.JdkClientHttpRequestFactory;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;

/** Calls the Python AI guide endpoint. Never logs a user message or authentication token. */
@Component
public class AiChatClient {
    private final RestClient restClient;
    private final URI endpoint;
    private final String token;

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
        AiReply response = request.body(new AiRequest(message))
                .retrieve().body(AiReply.class);
        if (response == null || response.reply() == null
                || response.reply().isBlank() || response.reply().length() > 1500) {
            throw new IllegalStateException("Invalid AI chat response");
        }
        return response.reply().strip();
    }

    private record AiRequest(String message) {}
    private record AiReply(String reply) {}
}
