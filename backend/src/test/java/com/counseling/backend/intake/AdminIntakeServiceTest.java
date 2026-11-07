package com.counseling.backend.intake;

import com.counseling.backend.client.ClientRepository;
import com.counseling.backend.counseling.CounselingCase;
import com.counseling.backend.counseling.CounselingCaseRepository;
import com.counseling.backend.security.ActiveActorService;
import com.counseling.backend.user.UserRole;
import org.junit.jupiter.api.Test;
import org.springframework.security.core.Authentication;
import org.springframework.web.server.ResponseStatusException;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

class AdminIntakeServiceTest {
    private final IntakeFormRepository intakes = mock(IntakeFormRepository.class);
    private final ClientRepository clients = mock(ClientRepository.class);
    private final CounselingCaseRepository cases = mock(CounselingCaseRepository.class);
    private final ActiveActorService actors = mock(ActiveActorService.class);
    private final Authentication auth = mock(Authentication.class);
    private final AdminIntakeService service = new AdminIntakeService(intakes, clients, cases, actors);

    @Test
    void convertsOneConsentedIntakeToUnassignedCase() {
        IntakeForm form = new IntakeForm("가상 내담자", null, "진로", "진로 고민 내용", false);
        form.recordPrivacyConsent();
        // Repository mock does not allocate IDs: simulate persisted IDs with reflection.
        org.springframework.test.util.ReflectionTestUtils.setField(form, "id", 22L);
        when(intakes.findForUpdateById(22L)).thenReturn(Optional.of(form));
        when(clients.saveAndFlush(any())).thenAnswer(inv -> {
            com.counseling.backend.client.Client c = inv.getArgument(0);
            org.springframework.test.util.ReflectionTestUtils.setField(c, "id", 40L);
            return c;
        });
        when(cases.saveAndFlush(any())).thenAnswer(inv -> {
            CounselingCase c = inv.getArgument(0);
            org.springframework.test.util.ReflectionTestUtils.setField(c, "id", 60L);
            return c;
        });
        var converted = service.convert(22L, auth);
        assertThat(converted.id()).isEqualTo(60L);
        assertThat(converted.clientId()).isEqualTo(40L);
        assertThat(converted.concern()).isEqualTo("진로 고민 내용");
        assertThat(form.getStatus()).isEqualTo(IntakeStatus.PROCESSED);
        var capture = org.mockito.ArgumentCaptor.forClass(CounselingCase.class);
        verify(cases).saveAndFlush(capture.capture());
        assertThat(capture.getValue().getIntakeFormId()).isEqualTo(22L);
        verify(actors).require(auth, UserRole.ADMIN);
    }

    @Test
    void preventsDoubleConversion() {
        IntakeForm form = new IntakeForm("가상 내담자", null, "진로", "진로 고민 내용", null);
        form.recordPrivacyConsent();
        form.markProcessed();
        when(intakes.findForUpdateById(22L)).thenReturn(Optional.of(form));
        assertThatThrownBy(() -> service.convert(22L, auth))
            .isInstanceOf(ResponseStatusException.class);
        verifyNoInteractions(clients, cases);
    }
}
