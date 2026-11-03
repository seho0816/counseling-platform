package com.counseling.backend.counseling;

import com.counseling.backend.client.Client;
import com.counseling.backend.user.User;
import com.counseling.backend.user.UserRepository;
import com.counseling.backend.user.UserRole;
import org.junit.jupiter.api.Test;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.Pageable;
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
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;

class CounselingCaseQueryServiceTest {

    private final CounselingCaseRepository cases = mock(CounselingCaseRepository.class);
    private final UserRepository users = mock(UserRepository.class);
    private final CounselingCaseQueryService service = new CounselingCaseQueryService(cases, users);

    private User user(long id, String email, UserRole role) {
        User user = new User(email, "test-hash", "가상 사용자", role);
        ReflectionTestUtils.setField(user, "id", id);
        return user;
    }

    private CounselingCase aCase(long caseId, User owner) {
        Client client = new Client("가상 내담자", null);
        ReflectionTestUtils.setField(client, "id", 300L);
        CounselingCase result = new CounselingCase(client, owner, "가상 상담 사례");
        ReflectionTestUtils.setField(result, "id", caseId);
        return result;
    }

    private Authentication authentication(String email, UserRole role) {
        return new UsernamePasswordAuthenticationToken(email, "none",
            List.of(new SimpleGrantedAuthority("ROLE_" + role.name())));
    }

    @Test
    void adminCanReadAnUnassignedCase() {
        User admin = user(1L, "admin@example.test", UserRole.ADMIN);
        CounselingCase found = aCase(10L, null);
        when(users.findByEmail(admin.getEmail())).thenReturn(Optional.of(admin));
        when(cases.findById(10L)).thenReturn(Optional.of(found));

        CaseResponse response = service.getById(10L, authentication(admin.getEmail(), UserRole.ADMIN));
        assertThat(response.id()).isEqualTo(10L);
        assertThat(response.counselorId()).isNull();
        verify(cases, never()).findByIdAndCounselor_Id(any(), any());
    }

    @Test
    void counselorReadsOnlyTheirOwnCase() {
        User counselor = user(7L, "owner@example.test", UserRole.COUNSELOR);
        CounselingCase found = aCase(20L, counselor);
        when(users.findByEmail(counselor.getEmail())).thenReturn(Optional.of(counselor));
        when(cases.findByIdAndCounselor_Id(20L, 7L)).thenReturn(Optional.of(found));

        CaseResponse response = service.getById(20L, authentication(counselor.getEmail(), UserRole.COUNSELOR));
        assertThat(response.counselorId()).isEqualTo(7L);
        verify(cases, never()).findById(any());
    }

    @Test
    void anotherCounselorsCaseIsNotDisclosed() {
        User counselor = user(7L, "outsider@example.test", UserRole.COUNSELOR);
        when(users.findByEmail(counselor.getEmail())).thenReturn(Optional.of(counselor));
        when(cases.findByIdAndCounselor_Id(99L, 7L)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> service.getById(99L, authentication(counselor.getEmail(), UserRole.COUNSELOR)))
            .isInstanceOfSatisfying(ResponseStatusException.class,
                e -> assertThat(e.getStatusCode()).isEqualTo(HttpStatus.NOT_FOUND));
        verify(cases, never()).findById(any());
    }

    @Test
    void listFiltersByCounselorRatherThanReturningAll() {
        User counselor = user(7L, "owner@example.test", UserRole.COUNSELOR);
        when(users.findByEmail(counselor.getEmail())).thenReturn(Optional.of(counselor));
        when(cases.findByCounselor_Id(eq(7L), any(Pageable.class)))
            .thenReturn(new PageImpl<>(List.of(aCase(20L, counselor))));

        CasePageResponse response = service.list(authentication(counselor.getEmail(), UserRole.COUNSELOR), 0, 20);
        assertThat(response.items()).hasSize(1);
        assertThat(response.items().get(0).id()).isEqualTo(20L);
        verify(cases, never()).findAll(any(Pageable.class));
    }

    @Test
    void staleRoleCannotAccessCases() {
        User nowCounselor = user(7L, "changed@example.test", UserRole.COUNSELOR);
        when(users.findByEmail(nowCounselor.getEmail())).thenReturn(Optional.of(nowCounselor));

        assertThatThrownBy(() -> service.getById(1L, authentication(nowCounselor.getEmail(), UserRole.ADMIN)))
            .isInstanceOfSatisfying(ResponseStatusException.class,
                e -> assertThat(e.getStatusCode()).isEqualTo(HttpStatus.FORBIDDEN));
        verifyNoInteractions(cases);
    }

    @Test
    void inactiveOrMissingAccountCannotAccessCases() {
        when(users.findByEmail("missing@example.test")).thenReturn(Optional.empty());
        assertThatThrownBy(() -> service.getById(1L, authentication("missing@example.test", UserRole.COUNSELOR)))
            .isInstanceOfSatisfying(ResponseStatusException.class,
                e -> assertThat(e.getStatusCode()).isEqualTo(HttpStatus.UNAUTHORIZED));
        verifyNoInteractions(cases);
    }

    @Test
    void invalidPageSizeIsRejected() {
        assertThatThrownBy(() -> service.list(authentication("test@example.test", UserRole.ADMIN), 0, 1000))
            .isInstanceOfSatisfying(ResponseStatusException.class,
                e -> assertThat(e.getStatusCode()).isEqualTo(HttpStatus.BAD_REQUEST));
        verifyNoInteractions(users, cases);
    }
}
