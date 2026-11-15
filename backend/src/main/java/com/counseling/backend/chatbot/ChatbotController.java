package com.counseling.backend.chatbot;

import jakarta.validation.Valid;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;

@RestController
public class ChatbotController {
    private final ChatbotService chatbotService;

    public ChatbotController(ChatbotService chatbotService) {
        this.chatbotService = chatbotService;
    }

    @PostMapping("/api/chatbot/message")
    public ChatbotMessageResponse message(@Valid @RequestBody ChatbotMessageRequest request) {
        return chatbotService.reply(request.message());
    }
}
