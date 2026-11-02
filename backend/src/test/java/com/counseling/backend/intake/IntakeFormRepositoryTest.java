package com.counseling.backend.intake;

import jakarta.persistence.EntityManager;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.transaction.annotation.Transactional;

import static org.assertj.core.api.Assertions.assertThat;

@SpringBootTest
@Transactional
class IntakeFormRepositoryTest {

    @Autowired IntakeFormRepository intakeFormRepository;
    @Autowired EntityManager entityManager;

    @Test
    void savesFindsAndProcessesForm() {
        IntakeForm saved = intakeFormRepository.saveAndFlush(new IntakeForm(
            "가상신청자", "010-0000-0000", "진로", "가상의 상담 신청 내용", false
        ));
        entityManager.clear();

        IntakeForm found = intakeFormRepository.findById(saved.getId()).orElseThrow();
        assertThat(found.getStatus()).isEqualTo(IntakeStatus.SUBMITTED);
        assertThat(found.getConcernCategory()).isEqualTo("진로");
        assertThat(intakeFormRepository.findByStatusOrderByCreatedAtDesc(IntakeStatus.SUBMITTED))
            .extracting(IntakeForm::getId).contains(saved.getId());

        found.markProcessed();
        intakeFormRepository.flush();
        entityManager.clear();

        IntakeForm processed = intakeFormRepository.findById(saved.getId()).orElseThrow();
        assertThat(processed.getStatus()).isEqualTo(IntakeStatus.PROCESSED);
    }
}
