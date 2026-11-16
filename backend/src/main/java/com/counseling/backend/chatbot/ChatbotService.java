package com.counseling.backend.chatbot;

import java.util.regex.Pattern;
import org.springframework.stereotype.Service;

/**
 * Deterministic safety/intake routing first; only permitted guide queries reach the AI.
 * This is neither psychological counseling nor a comprehensive crisis detector.
 */
@Service
public class ChatbotService {
    private static final Pattern CRISIS = Pattern.compile(
            "자살|자해|죽\\s*고\\s*싶|죽어\\s*버리|죽을래|목숨.{0,8}끊|극단적\\s*선택|살\\s*고\\s*싶\\s*지\\s*않");
    private static final Pattern COUNSELING_REQUEST = Pattern.compile(
            "진단\\s*(해|좀)|치료\\s*(해|법)|처방|상담\\s*(을\\s*)?해\\s*(줘|주세요|줄래)|우울증\\s*(인지|인가|일까)");
    private static final Pattern INTAKE = Pattern.compile(
            "신청|접수|질문지|설문|상담\\s*받|예약");
    private static final Pattern GUIDE = Pattern.compile(
            "기관|프로그램|이용|절차|안내|운영|상담|지원|서비스");

    private static final String CRISIS_REPLY =
            "현재 자신이나 다른 사람의 안전이 위협받는다면 즉시 119 또는 112에 연락해 주세요. "
            + "자살예방상담전화 109에서도 도움을 받을 수 있습니다. "
            + "이 챗봇은 전문 상담을 대신하지 않습니다.";

    private final AiChatClient aiChatClient;

    public ChatbotService(AiChatClient aiChatClient) {
        this.aiChatClient = aiChatClient;
    }

    public ChatbotMessageResponse reply(String message) {
        String input = message == null ? "" : message.strip();
        if (input.isEmpty() || input.length() > 500) {
            throw new IllegalArgumentException("Invalid message");
        }
        if (CRISIS.matcher(input).find()) {
            // Never call Gemini in a recognized crisis branch.
            return crisisResponse();
        }
        if (COUNSELING_REQUEST.matcher(input).find()) {
            return new ChatbotMessageResponse(
                    "이 챗봇은 심리 상담·진단·치료를 제공하지 않습니다. "
                    + "기관 이용 안내와 상담 신청은 도와드릴 수 있습니다.",
                    "FALLBACK", "SHOW_MENU");
        }
        if (INTAKE.matcher(input).find()) {
            return new ChatbotMessageResponse(
                    "상담 신청서에서 기초 정보를 작성하고 개인정보 처리에 동의한 뒤 제출할 수 있습니다. "
                    + "기존 신청서에서 초기 질문 항목을 작성할 수 있습니다.",
                    "GUIDE", "OPEN_INTAKE");
        }
        if (GUIDE.matcher(input).find()) {
            try {
                return new ChatbotMessageResponse(
                        aiChatClient.generateGuide(input), "GUIDE", null);
            } catch (AiChatClient.CrisisDetectedException e) {
                // Python's second-line safety gate found a crisis. Use exactly
                // the same Java-owned fixed message, not AI-generated text.
                return crisisResponse();
            } catch (RuntimeException e) {
                // Never expose upstream errors, credentials or private messages to the browser.
                return new ChatbotMessageResponse(
                        "현재 AI 안내를 제공하기 어렵습니다. 상담 신청서는 계속 작성할 수 있으며, "
                        + "잠시 뒤 다시 시도해 주세요.",
                        "FALLBACK", "SHOW_MENU");
            }
        }
        return new ChatbotMessageResponse(
                "이 챗봇은 기관·프로그램 안내와 상담 신청을 도와드립니다. "
                + "상담 신청 절차나 기관 프로그램에 관해 질문해 주세요.",
                "FALLBACK", "SHOW_MENU");
    }

    private static ChatbotMessageResponse crisisResponse() {
        return new ChatbotMessageResponse(CRISIS_REPLY, "CRISIS", "SHOW_HELP");
    }
}
