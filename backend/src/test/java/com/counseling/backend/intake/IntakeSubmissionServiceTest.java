package com.counseling.backend.intake;

import org.junit.jupiter.api.Test;
import org.springframework.web.server.ResponseStatusException;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

class IntakeSubmissionServiceTest {
    @Test
    void publicSubmissionStoresConsentButDoesNotEchoSensitiveContent() {
        IntakeFormRepository repository = mock(IntakeFormRepository.class);
        when(repository.saveAndFlush(any(IntakeForm.class))).thenAnswer(inv -> inv.getArgument(0));
        IntakeSubmissionService service = new IntakeSubmissionService(repository);
        IntakeAcceptedResponse response = service.submit(new SubmitIntakeRequest(
            "가상 내담자", null, "진로·학업", "졸업 후 진로를 고민하고 있음", false, true));
        var captor = org.mockito.ArgumentCaptor.forClass(IntakeForm.class);
        verify(repository).saveAndFlush(captor.capture());
        assertThat(captor.getValue().getPrivacyConsentAt()).isNotNull();
        assertThat(captor.getValue().getConcernDescription()).contains("졸업 후");
        assertThat(response.status()).isEqualTo(IntakeStatus.SUBMITTED);
        assertThat(response.toString()).doesNotContain("졸업 후", "가상 내담자");
    }

    @Test
    void refusesMissingPrivacyConsent() {
        IntakeFormRepository repository = mock(IntakeFormRepository.class);
        IntakeSubmissionService service = new IntakeSubmissionService(repository);
        assertThatThrownBy(() -> service.submit(new SubmitIntakeRequest(
            "가상 내담자", null, "진로", "상담 신청 내용", null, false)))
            .isInstanceOf(ResponseStatusException.class);
        verifyNoInteractions(repository);
    }
}
