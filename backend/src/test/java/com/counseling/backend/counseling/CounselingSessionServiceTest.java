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

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

class CounselingSessionServiceTest {
    private final CounselingCaseRepository cases = mock(CounselingCaseRepository.class);
    private final CounselingSessionRepository sessions = mock(CounselingSessionRepository.class);
    private final CounselingSummaryRepository summaries = mock(CounselingSummaryRepository.class);
    private final UserRepository users = mock(UserRepository.class);
    private final CounselingSessionService service = new CounselingSessionService(
        cases, sessions, summaries, new ActiveActorService(users)
    );

    private User user(long id, String email, UserRole role) {
        User user = new User(email, "unused-hash", "테스트 계정", role);
        ReflectionTestUtils.setField(user, "id", id);
        when(users.findByEmail(email)).thenReturn(Optional.of(user));
        return user;
    }

    private Authentication auth(User actor) {
        return new UsernamePasswordAuthenticationToken(actor.getEmail(), "unused",
            List.of(new SimpleGrantedAuthority("ROLE_" + actor.getRole().name())));
    }

    private CounselingCase counselingCase(long id, User owner) {
        Client client = new Client("가상내담자", null);
        ReflectionTestUtils.setField(client, "id", 100L);
        CounselingCase result = new CounselingCase(client, owner, "가상 상담 사례");
        ReflectionTestUtils.setField(result, "id", id);
        return result;
    }

    private CounselingSession session(CounselingCase counselingCase, User author) {
        CounselingSession result = new CounselingSession(
            counselingCase, 1, LocalDate.of(2026, 11, 5), "가상의 상담 기록", author);
        ReflectionTestUtils.setField(result, "id", 700L);
        return result;
    }

    @Test
    void assignedCounselorCanCreateSession() {
        User counselor = user(5L, "counselor@example.test", UserRole.COUNSELOR);
        CounselingCase found = counselingCase(44L, counselor);
        when(cases.findByIdAndCounselor_Id(44L, 5L)).thenReturn(Optional.of(found));
        when(sessions.saveAndFlush(any(CounselingSession.class))).thenAnswer(invocation -> {
            CounselingSession saved = invocation.getArgument(0);
            ReflectionTestUtils.setField(saved, "id", 701L);
            return saved;
        });

        SessionResponse result = service.create(44L,
            new CreateSessionRequest(2, LocalDate.of(2026, 11, 6), "  테스트 상담 기록  "),
            auth(counselor));

        assertThat(result.id()).isEqualTo(701L);
        assertThat(result.caseId()).isEqualTo(44L);
        assertThat(result.sessionNumber()).isEqualTo(2);
        assertThat(result.content()).isEqualTo("테스트 상담 기록");
        assertThat(result.authorUserId()).isEqualTo(5L);
    }

    @Test
    void counselorCannotAccessUnassignedOrOtherCounselorsCase() {
        User counselor = user(5L, "outside@example.test", UserRole.COUNSELOR);
        when(cases.findByIdAndCounselor_Id(44L, 5L)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> service.list(44L, auth(counselor)))
            .isInstanceOfSatisfying(ResponseStatusException.class,
                ex -> assertThat(ex.getStatusCode()).isEqualTo(HttpStatus.NOT_FOUND));
        verifyNoInteractions(sessions);
        verify(cases, never()).findById(any());
    }

    @Test
    void adminCanReadSessionsOfAnyCase() {
        User admin = user(1L, "admin@example.test", UserRole.ADMIN);
        CounselingCase found = counselingCase(44L, null);
        when(cases.findById(44L)).thenReturn(Optional.of(found));
        when(sessions.findByCounselingCase_IdOrderBySessionNumberAsc(44L))
            .thenReturn(List.of(session(found, admin)));

        List<SessionResponse> result = service.list(44L, auth(admin));
        assertThat(result).hasSize(1);
        assertThat(result.get(0).content()).isEqualTo("가상의 상담 기록");
    }

    @Test
    void duplicateSessionNumberReturnsConflict() {
        User counselor = user(5L, "duplicate@example.test", UserRole.COUNSELOR);
        when(cases.findByIdAndCounselor_Id(44L, 5L))
            .thenReturn(Optional.of(counselingCase(44L, counselor)));
        when(sessions.existsByCounselingCase_IdAndSessionNumber(44L, 1)).thenReturn(true);

        assertThatThrownBy(() -> service.create(44L,
            new CreateSessionRequest(1, LocalDate.of(2026, 11, 5), "가상 기록"), auth(counselor)))
            .isInstanceOfSatisfying(ResponseStatusException.class,
                ex -> assertThat(ex.getStatusCode()).isEqualTo(HttpStatus.CONFLICT));
        verify(sessions, never()).saveAndFlush(any());
    }

    @Test
    void editingSourceWhenAiSummaryExistsIsBlocked() {
        User counselor = user(5L, "summary@example.test", UserRole.COUNSELOR);
        CounselingCase found = counselingCase(44L, counselor);
        when(cases.findByIdAndCounselor_Id(44L, 5L)).thenReturn(Optional.of(found));
        when(sessions.findByIdAndCounselingCase_Id(700L, 44L))
            .thenReturn(Optional.of(session(found, counselor)));
        when(summaries.existsBySession_Id(700L)).thenReturn(true);

        assertThatThrownBy(() -> service.update(44L, 700L,
            new UpdateSessionRequest(LocalDate.of(2026, 11, 6), "수정된 가상 기록"), auth(counselor)))
            .isInstanceOfSatisfying(ResponseStatusException.class,
                ex -> assertThat(ex.getStatusCode()).isEqualTo(HttpStatus.CONFLICT));
        verify(sessions, never()).saveAndFlush(any());
    }

    @Test
    void updatesExistingSessionBeforeAiSummaryGeneration() {
        User counselor = user(5L, "editing@example.test", UserRole.COUNSELOR);
        CounselingCase found = counselingCase(44L, counselor);
        CounselingSession existing = session(found, counselor);
        when(cases.findByIdAndCounselor_Id(44L, 5L)).thenReturn(Optional.of(found));
        when(sessions.findByIdAndCounselingCase_Id(700L, 44L)).thenReturn(Optional.of(existing));
        when(sessions.saveAndFlush(existing)).thenReturn(existing);

        SessionResponse result = service.update(44L, 700L,
            new UpdateSessionRequest(LocalDate.of(2026, 11, 6), "  수정한 가상 상담 기록  "), auth(counselor));
        assertThat(result.sessionDate()).isEqualTo(LocalDate.of(2026, 11, 6));
        assertThat(result.content()).isEqualTo("수정한 가상 상담 기록");
    }

    @Test
    void inactiveOrChangedRoleSessionCannotRead() {
        User counselor = user(5L, "role@example.test", UserRole.COUNSELOR);
        Authentication staleAdminSession = new UsernamePasswordAuthenticationToken(
            counselor.getEmail(), "unused", List.of(new SimpleGrantedAuthority("ROLE_ADMIN")));
        assertThatThrownBy(() -> service.list(44L, staleAdminSession))
            .isInstanceOfSatisfying(ResponseStatusException.class,
                ex -> assertThat(ex.getStatusCode()).isEqualTo(HttpStatus.FORBIDDEN));
        verifyNoInteractions(cases, sessions);
    }

    @Test
    void invalidContentIsRejectedWithoutSaving() {
        User counselor = user(5L, "validation@example.test", UserRole.COUNSELOR);
        assertThatThrownBy(() -> service.create(44L,
            new CreateSessionRequest(1, LocalDate.of(2026, 11, 6), "  "), auth(counselor)))
            .isInstanceOfSatisfying(ResponseStatusException.class,
                ex -> assertThat(ex.getStatusCode()).isEqualTo(HttpStatus.BAD_REQUEST));
        verifyNoInteractions(cases, sessions);
    }
}
