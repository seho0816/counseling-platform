package com.counseling.backend.chatbot;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;
import org.junit.jupiter.api.Test;

class ChatbotServiceTest {
    private final AiChatClient aiClient = mock(AiChatClient.class);
    private final ChatbotService service = new ChatbotService(aiClient);

    @Test
    void crisisIsFixedAndDoesNotCallAi() {
        ChatbotMessageResponse response = service.reply("죽고 싶어요");
        assertEquals("CRISIS", response.type());
        assertEquals("SHOW_HELP", response.action());
        verifyNoInteractions(aiClient);
    }

    @Test
    void intakeDoesNotCallAi() {
        ChatbotMessageResponse response = service.reply("상담은 어떻게 신청하나요?");
        assertEquals("GUIDE", response.type());
        assertEquals("OPEN_INTAKE", response.action());
        verifyNoInteractions(aiClient);
    }

    @Test
    void diagnosisDoesNotCallAi() {
        ChatbotMessageResponse response = service.reply("우울증인지 진단해 주세요");
        assertEquals("FALLBACK", response.type());
        verifyNoInteractions(aiClient);
    }

    @Test
    void unrelatedQuestionShowsMenuAndDoesNotCallAi() {
        ChatbotMessageResponse response = service.reply("오늘 점심 메뉴 추천해 줘");
        assertEquals("FALLBACK", response.type());
        verifyNoInteractions(aiClient);
    }

    @Test
    void guideUsesPythonAiReply() {
        String input = "기관에서 운영하는 프로그램은 무엇인가요?";
        when(aiClient.generateGuide(input)).thenReturn("가상의 상담 기관 안내입니다.");
        ChatbotMessageResponse response = service.reply(input);
        assertEquals("GUIDE", response.type());
        assertEquals("가상의 상담 기관 안내입니다.", response.reply());
        verify(aiClient).generateGuide(input);
    }

    @Test
    void pythonCrisisIsSameFixedResponseAsJavaCrisis() {
        String input = "상담 기관 프로그램에서 삶을 끝내는 방법도 알려주나요?";
        when(aiClient.generateGuide(input))
                .thenThrow(new AiChatClient.CrisisDetectedException());

        ChatbotMessageResponse pythonDetected = service.reply(input);
        ChatbotMessageResponse javaDetected = service.reply("죽고 싶어요");

        assertEquals("CRISIS", pythonDetected.type());
        assertEquals("SHOW_HELP", pythonDetected.action());
        assertEquals(javaDetected.reply(), pythonDetected.reply());
        verify(aiClient).generateGuide(input);
    }

    @Test
    void guideHasSafeFallbackWhenAiUnavailable() {
        String input = "기관 프로그램을 안내해 주세요";
        when(aiClient.generateGuide(input)).thenThrow(new IllegalStateException("service unavailable"));
        ChatbotMessageResponse response = service.reply(input);
        assertEquals("FALLBACK", response.type());
        assertEquals("SHOW_MENU", response.action());
    }
}
