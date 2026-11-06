package com.counseling.backend.counseling;

import com.counseling.backend.client.Client;
import com.counseling.backend.security.ActiveActorService;
import com.counseling.backend.user.User;
import com.counseling.backend.user.UserRepository;
import com.counseling.backend.user.UserRole;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.test.util.ReflectionTestUtils;
import org.springframework.web.server.ResponseStatusException;
import tools.jackson.databind.json.JsonMapper;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

class CounselingSummaryServiceTest {
    private final CounselingSessionRepository sessions = mock(CounselingSessionRepository.class);
    private final CounselingSummaryRepository summaries = mock(CounselingSummaryRepository.class);
    private final UserRepository users = mock(UserRepository.class);
    private final SummaryGenerator generator = mock(SummaryGenerator.class);
    private final JsonMapper mapper = JsonMapper.builder().build();
    private final CounselingSummaryService service = new CounselingSummaryService(
        sessions, summaries, new ActiveActorService(users), generator, mapper);

    private User user(long id, String email, UserRole role) {
        User user = new User(email, "unused", "가상 계정", role);
        ReflectionTestUtils.setField(user, "id", id);
        when(users.findByEmail(email)).thenReturn(Optional.of(user));
        return user;
    }

    private Authentication auth(User user) {
        return new UsernamePasswordAuthenticationToken(user.getEmail(), "unused", List.of(
            new SimpleGrantedAuthority("ROLE_" + user.getRole().name())));
    }

    private CounselingSession session(User assignedCounselor, User author) {
        Client client = new Client("가상 내담자", null);
        CounselingCase counselingCase = new CounselingCase(client, assignedCounselor, "진로 상담");
        CounselingSession session = new CounselingSession(counselingCase, 1,
            LocalDate.of(2026, 11, 6), "내담자가 진로 불안을 표현함. 상담사는 관심 직무를 조사하도록 안내함.", author);
        ReflectionTestUtils.setField(session, "id", 700L);
        return session;
    }

    private CounselingSummary draft(CounselingSession session) {
        CounselingSummary summary = new CounselingSummary(session,
            mapper.writeValueAsString(new SummaryFields("진로 불안", "진로 탐색", "관심 직무 조사")),
            "test-model");
        ReflectionTestUtils.setField(summary, "id", 900L);
        return summary;
    }

    @Test
    void generatesStructuredDraftAndPersistsIt() {
        User admin = user(1, "admin@example.test", UserRole.ADMIN);
        CounselingSession existing = session(null, admin);
        when(sessions.findById(700L)).thenReturn(Optional.of(existing));
        when(generator.generate(existing.getContent())).thenReturn(
            new GeneratedSummary(new SummaryFields("졸업 후 진로 고민", "선택지 정리", "직무 조사"), "ai-test-model"));
        when(summaries.saveAndFlush(any(CounselingSummary.class))).thenAnswer(invocation -> {
            CounselingSummary saved = invocation.getArgument(0);
            ReflectionTestUtils.setField(saved, "id", 901L);
            return saved;
        });

        SummaryResponse result = service.generate(700L, auth(admin));

        assertThat(result.id()).isEqualTo(901L);
        assertThat(result.aiDraft().complaint()).isEqualTo("졸업 후 진로 고민");
        assertThat(result.aiDraft().nextPlan()).isEqualTo("직무 조사");
        assertThat(result.finalSummary()).isNull();
        assertThat(result.status()).isEqualTo(SummaryStatus.DRAFT);
        assertThat(result.modelName()).isEqualTo("ai-test-model");
        verify(summaries).saveAndFlush(any(CounselingSummary.class));
    }

    @Test
    void unconfiguredAiReturns503AndDoesNotCreateDraft() {
        User admin = user(1, "admin2@example.test", UserRole.ADMIN);
        CounselingSession existing = session(null, admin);
        when(sessions.findById(700L)).thenReturn(Optional.of(existing));
        when(generator.generate(any())).thenThrow(new ResponseStatusException(
            HttpStatus.SERVICE_UNAVAILABLE, "AI summary generator is not connected yet"));

        assertThatThrownBy(() -> service.generate(700L, auth(admin)))
            .isInstanceOfSatisfying(ResponseStatusException.class,
                ex -> assertThat(ex.getStatusCode()).isEqualTo(HttpStatus.SERVICE_UNAVAILABLE));
        verify(summaries, never()).saveAndFlush(any());
    }

    @Test
    void assignedCounselorReadsDraftAndConfirmsReviewedText() {
        User counselor = user(15, "counselor@example.test", UserRole.COUNSELOR);
        CounselingSession existing = session(counselor, counselor);
        CounselingSummary summary = draft(existing);
        when(sessions.findById(700L)).thenReturn(Optional.of(existing));
        when(summaries.findBySession_Id(700L)).thenReturn(Optional.of(summary));
        when(summaries.saveAndFlush(summary)).thenReturn(summary);

        SummaryResponse fetched = service.get(700L, auth(counselor));
        assertThat(fetched.aiDraft().intervention()).isEqualTo("진로 탐색");
        assertThat(fetched.status()).isEqualTo(SummaryStatus.DRAFT);

        SummaryResponse approved = service.confirm(700L,
            new ConfirmSummaryRequest(new SummaryFields("  진로 불안 확인  ", "선택지 함께 정리", "직무 조사")),
            auth(counselor));
        assertThat(approved.status()).isEqualTo(SummaryStatus.CONFIRMED);
        assertThat(approved.finalSummary().complaint()).isEqualTo("진로 불안 확인");
        assertThat(approved.confirmedBy()).isEqualTo(15L);
        assertThat(approved.confirmedAt()).isNotNull();
    }

    @Test
    void otherCounselorCannotReadOrConfirm() {
        User owner = user(15, "owner@example.test", UserRole.COUNSELOR);
        User outsider = user(16, "outsider@example.test", UserRole.COUNSELOR);
        when(sessions.findById(700L)).thenReturn(Optional.of(session(owner, owner)));

        assertThatThrownBy(() -> service.get(700L, auth(outsider)))
            .isInstanceOfSatisfying(ResponseStatusException.class,
                ex -> assertThat(ex.getStatusCode()).isEqualTo(HttpStatus.NOT_FOUND));
        assertThatThrownBy(() -> service.confirm(700L,
            new ConfirmSummaryRequest(new SummaryFields("가상", null, null)), auth(outsider)))
            .isInstanceOfSatisfying(ResponseStatusException.class,
                ex -> assertThat(ex.getStatusCode()).isEqualTo(HttpStatus.NOT_FOUND));
        verifyNoInteractions(summaries);
    }

    @Test
    void adminCannotConfirmOnBehalfOfCounselor() {
        User admin = user(1, "admin3@example.test", UserRole.ADMIN);
        assertThatThrownBy(() -> service.confirm(700L,
            new ConfirmSummaryRequest(new SummaryFields("검토", null, null)), auth(admin)))
            .isInstanceOfSatisfying(ResponseStatusException.class,
                ex -> assertThat(ex.getStatusCode()).isEqualTo(HttpStatus.FORBIDDEN));
        verifyNoInteractions(sessions, summaries);
    }

    @Test
    void duplicateGenerationReturns409WithoutCallingAi() {
        User admin = user(1, "admin4@example.test", UserRole.ADMIN);
        when(sessions.findById(700L)).thenReturn(Optional.of(session(null, admin)));
        when(summaries.existsBySession_Id(700L)).thenReturn(true);
        assertThatThrownBy(() -> service.generate(700L, auth(admin)))
            .isInstanceOfSatisfying(ResponseStatusException.class,
                ex -> assertThat(ex.getStatusCode()).isEqualTo(HttpStatus.CONFLICT));
        verifyNoInteractions(generator);
    }

    @Test
    void blankReviewRejectedAndDuplicateApprovalBlocked() {
        User counselor = user(15, "reviewer@example.test", UserRole.COUNSELOR);
        CounselingSession existing = session(counselor, counselor);
        CounselingSummary summary = draft(existing);
        when(sessions.findById(700L)).thenReturn(Optional.of(existing));
        when(summaries.findBySession_Id(700L)).thenReturn(Optional.of(summary));
        when(summaries.saveAndFlush(summary)).thenReturn(summary);
        assertThatThrownBy(() -> service.confirm(700L,
            new ConfirmSummaryRequest(new SummaryFields(" ", null, null)), auth(counselor)))
            .isInstanceOfSatisfying(ResponseStatusException.class,
                ex -> assertThat(ex.getStatusCode()).isEqualTo(HttpStatus.BAD_REQUEST));
        service.confirm(700L,
            new ConfirmSummaryRequest(new SummaryFields("검토 완료", null, null)), auth(counselor));
        assertThatThrownBy(() -> service.confirm(700L,
            new ConfirmSummaryRequest(new SummaryFields("다시 수정", null, null)), auth(counselor)))
            .isInstanceOfSatisfying(ResponseStatusException.class,
                ex -> assertThat(ex.getStatusCode()).isEqualTo(HttpStatus.CONFLICT));
    }

    @Test
    void malformedAiOutputIsNotStored() {
        User admin = user(1, "admin5@example.test", UserRole.ADMIN);
        CounselingSession existing = session(null, admin);
        when(sessions.findById(700L)).thenReturn(Optional.of(existing));
        when(generator.generate(any())).thenReturn(new GeneratedSummary(new SummaryFields(null, null, null), "test"));

        assertThatThrownBy(() -> service.generate(700L, auth(admin)))
            .isInstanceOfSatisfying(ResponseStatusException.class,
                ex -> assertThat(ex.getStatusCode()).isEqualTo(HttpStatus.BAD_GATEWAY));
        verify(summaries, never()).saveAndFlush(any());
    }
}
