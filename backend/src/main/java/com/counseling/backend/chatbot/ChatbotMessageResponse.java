package com.counseling.backend.chatbot;

public record ChatbotMessageResponse(
        String reply,
        String type,
        String action
) {}
