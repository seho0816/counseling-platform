package com.counseling.backend.counseling;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface CounselingCaseRepository extends JpaRepository<CounselingCase, Long> {

    // Existing repository methods: kept for compatibility with previous tests.
    List<CounselingCase> findByClient_IdOrderByIdDesc(Long clientId);

    List<CounselingCase> findByCounselor_IdAndStatus(Long counselorId, CaseStatus status);

    // Restrict at the query level to the authenticated counselor's own cases.
    Optional<CounselingCase> findByIdAndCounselor_Id(Long id, Long counselorId);

    Page<CounselingCase> findByCounselor_Id(Long counselorId, Pageable pageable);
}
