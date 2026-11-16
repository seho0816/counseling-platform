package com.counseling.backend.chatbot;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record ChatbotMessageRequest(
        @NotBlank @Size(max = 500) String message
) {}
