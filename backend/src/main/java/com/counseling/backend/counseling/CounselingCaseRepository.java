package com.counseling.backend.counseling;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface CounselingCaseRepository extends JpaRepository<CounselingCase, Long> {

    List<CounselingCase> findByClient_IdOrderByIdDesc(Long clientId);

    List<CounselingCase> findByCounselor_IdAndStatus(Long counselorId, CaseStatus status);
}
