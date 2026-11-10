package com.counseling.backend.audit;

import com.counseling.backend.security.ActiveActorService;
import com.counseling.backend.user.UserRole;
import org.junit.jupiter.api.Test;
import org.springframework.data.domain.PageImpl;
import org.springframework.security.core.Authentication;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;

class AdminAccessLogServiceTest {
    @Test
    void returnsPagedMetadataOnly() {
        AccessLogRepository repository = mock(AccessLogRepository.class);
        ActiveActorService actors = mock(ActiveActorService.class);
        Authentication auth = mock(Authentication.class);
        AccessLog sample = new AccessLog(null, "SUMMARY", 16L, "CONFIRM", AccessResult.SUCCESS);
        when(repository.findAll(any(org.springframework.data.domain.Pageable.class)))
                .thenReturn(new PageImpl<>(List.of(sample)));

        AccessLogPageResponse result = new AdminAccessLogService(repository, actors).list(0, 20, auth);
        assertThat(result.items()).hasSize(1);
        assertThat(result.items().get(0).resourceType()).isEqualTo("SUMMARY");
        assertThat(result.items().get(0).resourceId()).isEqualTo(16L);
        verify(actors).require(eq(auth), eq(UserRole.ADMIN));
    }

    @Test
    void rejectsUnboundedPageSize() {
        AccessLogRepository repository = mock(AccessLogRepository.class);
        ActiveActorService actors = mock(ActiveActorService.class);
        Authentication auth = mock(Authentication.class);
        assertThatThrownBy(() -> new AdminAccessLogService(repository, actors).list(0, 1000, auth))
                .isInstanceOf(ResponseStatusException.class);
        verifyNoInteractions(repository);
    }
}
