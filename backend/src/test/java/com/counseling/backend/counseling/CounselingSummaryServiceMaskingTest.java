package com.counseling.backend.counseling;

import com.counseling.backend.client.Client;
import com.counseling.backend.security.ActiveActorService;
import com.counseling.backend.user.User;
import com.counseling.backend.user.UserRepository;
import com.counseling.backend.user.UserRole;
import org.junit.jupiter.api.Test;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.test.util.ReflectionTestUtils;
import tools.jackson.databind.json.JsonMapper;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/** The summary service must hide the client's name before the note reaches the AI service. */
class CounselingSummaryServiceMaskingTest {
    private final CounselingSessionRepository sessions = mock(CounselingSessionRepository.class);
    private final CounselingSummaryRepository summaries = mock(CounselingSummaryRepository.class);
    private final UserRepository users = mock(UserRepository.class);
    private final SummaryGenerator generator = mock(SummaryGenerator.class);
    private final JsonMapper mapper = JsonMapper.builder().build();
    private final CounselingSummaryService service = new CounselingSummaryService(
        sessions, summaries, new ActiveActorService(users), generator, mapper);

    @Test
    void sendsTheNoteWithTheClientNameReplaced() {
        User admin = new User("admin-mask@example.test", "unused", "가상 계정", UserRole.ADMIN);
        ReflectionTestUtils.setField(admin, "id", 1L);
        when(users.findByEmail("admin-mask@example.test")).thenReturn(Optional.of(admin));
        Authentication auth = new UsernamePasswordAuthenticationToken("admin-mask@example.test", "unused",
            List.of(new SimpleGrantedAuthority("ROLE_ADMIN")));

        Client client = new Client("김하늘", null);
        CounselingCase counselingCase = new CounselingCase(client, null, "진로 상담");
        CounselingSession session = new CounselingSession(counselingCase, 1, LocalDate.of(2026, 11, 6),
            "김하늘 내담자는 진로 불안을 표현함. 하늘 님은 직무를 조사하기로 함.", admin);
        ReflectionTestUtils.setField(session, "id", 800L);
        when(sessions.findById(800L)).thenReturn(Optional.of(session));
        when(generator.generate(any())).thenReturn(
            new GeneratedSummary(new SummaryFields("진로 불안", "기록에 없음", "직무 조사"), "ai-test-model"));
        when(summaries.saveAndFlush(any(CounselingSummary.class))).thenAnswer(invocation -> {
            CounselingSummary saved = invocation.getArgument(0);
            ReflectionTestUtils.setField(saved, "id", 901L);
            return saved;
        });

        service.generate(800L, auth);

        verify(generator).generate("[이름] 내담자는 진로 불안을 표현함. [이름] 님은 직무를 조사하기로 함.");
    }
}
