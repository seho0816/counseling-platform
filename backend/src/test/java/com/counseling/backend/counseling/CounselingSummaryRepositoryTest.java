package com.counseling.backend.counseling;

import com.counseling.backend.client.Client;
import com.counseling.backend.client.ClientRepository;
import com.counseling.backend.user.User;
import com.counseling.backend.user.UserRepository;
import com.counseling.backend.user.UserRole;
import jakarta.persistence.EntityManager;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

@SpringBootTest
@Transactional
class CounselingSummaryRepositoryTest {

    @Autowired ClientRepository clientRepository;
    @Autowired UserRepository userRepository;
    @Autowired CounselingCaseRepository caseRepository;
    @Autowired CounselingSessionRepository sessionRepository;
    @Autowired CounselingSummaryRepository summaryRepository;
    @Autowired EntityManager entityManager;

    @Test
    void savesDraftAndConfirmsReviewedSummary() {
        Client client = clientRepository.saveAndFlush(new Client("가상내담자", null));
        User counselor = userRepository.saveAndFlush(new User(
            "summary-test-" + UUID.randomUUID() + "@example.invalid",
            "unused-test-hash", "가상상담사", UserRole.COUNSELOR
        ));
        CounselingCase counselingCase = caseRepository.saveAndFlush(
            new CounselingCase(client, counselor, "가상 상담 사례")
        );
        CounselingSession session = sessionRepository.saveAndFlush(new CounselingSession(
            counselingCase, 1, LocalDate.of(2026, 11, 1), "가상의 상담 기록", counselor
        ));

        CounselingSummary saved = summaryRepository.saveAndFlush(
            new CounselingSummary(session, "AI가 작성한 요약 초안", "test-model")
        );
        entityManager.clear();

        CounselingSummary draft = summaryRepository.findBySession_Id(session.getId()).orElseThrow();
        assertThat(draft.getStatus()).isEqualTo(SummaryStatus.DRAFT);
        assertThat(draft.getFinalSummary()).isNull();
        assertThatThrownBy(() -> draft.confirm(counselor, "  "))
            .isInstanceOf(IllegalArgumentException.class);
        draft.confirm(counselor, "상담사가 검토한 최종 요약");
        summaryRepository.flush();
        entityManager.clear();

        CounselingSummary confirmed = summaryRepository.findById(saved.getId()).orElseThrow();
        assertThat(confirmed.getStatus()).isEqualTo(SummaryStatus.CONFIRMED);
        assertThat(confirmed.getFinalSummary()).isEqualTo("상담사가 검토한 최종 요약");
        assertThat(confirmed.getConfirmedBy().getId()).isEqualTo(counselor.getId());
        assertThat(confirmed.getConfirmedAt()).isNotNull();
        assertThat(summaryRepository.existsBySession_Id(session.getId())).isTrue();
    }
}
