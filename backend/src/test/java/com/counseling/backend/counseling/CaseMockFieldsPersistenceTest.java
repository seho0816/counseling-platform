package com.counseling.backend.counseling;

import com.counseling.backend.client.Client;
import com.counseling.backend.client.ClientRepository;
import jakarta.persistence.EntityManager;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.transaction.annotation.Transactional;

import static org.assertj.core.api.Assertions.assertThat;

@SpringBootTest
@Transactional
class CaseMockFieldsPersistenceTest {
    @Autowired private ClientRepository clients;
    @Autowired private CounselingCaseRepository cases;
    @Autowired private EntityManager entityManager;

    @Test
    void persistsAndReturnsCaseUiFields() {
        Client client = clients.saveAndFlush(new Client("가상내담자_연동테스트", null, "20대"));
        CounselingCase created = cases.saveAndFlush(new CounselingCase(
            client, null, "진로 고민 초기 상담", "졸업 이후 진로 선택에 대한 고민"));
        Long caseId = created.getId();
        entityManager.clear();

        CounselingCase found = cases.findById(caseId).orElseThrow();
        CaseResponse response = CaseResponse.from(found);
        assertThat(response.clientAlias()).isEqualTo("가상내담자_연동테스트");
        assertThat(response.ageGroup()).isEqualTo("20대");
        assertThat(response.concern()).isEqualTo("졸업 이후 진로 선택에 대한 고민");
    }
}
