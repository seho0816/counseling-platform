package com.counseling.backend.counseling;

import org.springframework.data.jpa.repository.JpaRepository;
import java.util.Optional;

public interface CounselingSummaryRepository extends JpaRepository<CounselingSummary, Long> {
    Optional<CounselingSummary> findBySession_Id(Long sessionId);
    boolean existsBySession_Id(Long sessionId);
}
