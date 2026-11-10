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

import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

class CounselingCaseStatusServiceTest {
    private final CounselingCaseRepository cases = mock(CounselingCaseRepository.class);
    private final UserRepository users = mock(UserRepository.class);
    private final CounselingCaseStatusService service = new CounselingCaseStatusService(
        cases, new ActiveActorService(users));

    private User account(long id, String email, UserRole role) {
        User user = new User(email, "hash-unused", "가상 사용자", role);
        ReflectionTestUtils.setField(user, "id", id);
        when(users.findByEmail(email)).thenReturn(Optional.of(user));
        return user;
    }

    private Authentication auth(User user) {
        return new UsernamePasswordAuthenticationToken(user.getEmail(), "unused",
            List.of(new SimpleGrantedAuthority("ROLE_" + user.getRole().name())));
    }

    private CounselingCase fakeCase(long id, User assignedCounselor) {
        Client client = new Client("가상 내담자", null, "20대");
        ReflectionTestUtils.setField(client, "id", 33L);
        CounselingCase result = new CounselingCase(client, assignedCounselor, "진로 고민", "진로 선택의 어려움");
        ReflectionTestUtils.setField(result, "id", id);
        return result;
    }

    @Test
    void adminCanMoveReceivedCaseToInProgress() {
        User admin = account(1L, "admin@example.test", UserRole.ADMIN);
        CounselingCase found = fakeCase(22L, null);
        when(cases.findById(22L)).thenReturn(Optional.of(found));
        when(cases.saveAndFlush(found)).thenReturn(found);

        CaseResponse response = service.changeStatus(22L,
            new UpdateCaseStatusRequest(CaseStatus.IN_PROGRESS), auth(admin));

        assertThat(response.status()).isEqualTo("IN_PROGRESS");
        assertThat(response.clientAlias()).isEqualTo("가상 내담자");
        verify(cases).saveAndFlush(found);
    }

    @Test
    void assignedCounselorCanCloseInProgressCase() {
        User counselor = account(15L, "counselor@example.test", UserRole.COUNSELOR);
        CounselingCase found = fakeCase(22L, counselor);
        found.changeStatus(CaseStatus.IN_PROGRESS);
        when(cases.findByIdAndCounselor_Id(22L, 15L)).thenReturn(Optional.of(found));
        when(cases.saveAndFlush(found)).thenReturn(found);

        CaseResponse response = service.changeStatus(22L,
            new UpdateCaseStatusRequest(CaseStatus.CLOSED), auth(counselor));

        assertThat(response.status()).isEqualTo("CLOSED");
        verify(cases, never()).findById(any());
    }

    @Test
    void counselorCannotChangeAnotherCounselorsCase() {
        User counselor = account(15L, "other@example.test", UserRole.COUNSELOR);
        when(cases.findByIdAndCounselor_Id(22L, 15L)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> service.changeStatus(22L,
            new UpdateCaseStatusRequest(CaseStatus.IN_PROGRESS), auth(counselor)))
            .isInstanceOfSatisfying(ResponseStatusException.class,
                ex -> assertThat(ex.getStatusCode()).isEqualTo(HttpStatus.NOT_FOUND));
        verify(cases, never()).saveAndFlush(any());
    }

    @Test
    void directReceivedToClosedIsConflict() {
        User admin = account(1L, "admin@example.test", UserRole.ADMIN);
        CounselingCase found = fakeCase(22L, null);
        when(cases.findById(22L)).thenReturn(Optional.of(found));

        assertThatThrownBy(() -> service.changeStatus(22L,
            new UpdateCaseStatusRequest(CaseStatus.CLOSED), auth(admin)))
            .isInstanceOfSatisfying(ResponseStatusException.class,
                ex -> assertThat(ex.getStatusCode()).isEqualTo(HttpStatus.CONFLICT));
        verify(cases, never()).saveAndFlush(any());
    }

    @Test
    void repeatedStatusIsIdempotent() {
        User admin = account(1L, "admin@example.test", UserRole.ADMIN);
        CounselingCase found = fakeCase(22L, null);
        when(cases.findById(22L)).thenReturn(Optional.of(found));

        CaseResponse response = service.changeStatus(22L,
            new UpdateCaseStatusRequest(CaseStatus.RECEIVED), auth(admin));

        assertThat(response.status()).isEqualTo("RECEIVED");
        verify(cases, never()).saveAndFlush(any());
    }

    @Test
    void nullStatusIsBadRequest() {
        User admin = account(1L, "admin@example.test", UserRole.ADMIN);
        assertThatThrownBy(() -> service.changeStatus(22L,
            new UpdateCaseStatusRequest(null), auth(admin)))
            .isInstanceOfSatisfying(ResponseStatusException.class,
                ex -> assertThat(ex.getStatusCode()).isEqualTo(HttpStatus.BAD_REQUEST));
        verifyNoInteractions(cases);
    }

    @Test
    void staleRoleCannotChangeStatus() {
        User counselor = account(15L, "changed@example.test", UserRole.COUNSELOR);
        Authentication stale = new UsernamePasswordAuthenticationToken(counselor.getEmail(), "unused",
            List.of(new SimpleGrantedAuthority("ROLE_ADMIN")));

        assertThatThrownBy(() -> service.changeStatus(22L,
            new UpdateCaseStatusRequest(CaseStatus.IN_PROGRESS), stale))
            .isInstanceOfSatisfying(ResponseStatusException.class,
                ex -> assertThat(ex.getStatusCode()).isEqualTo(HttpStatus.FORBIDDEN));
        verifyNoInteractions(cases);
    }
}
