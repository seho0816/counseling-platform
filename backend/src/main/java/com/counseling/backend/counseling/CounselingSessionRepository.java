
package com.counseling.backend.counseling;

import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;
import java.util.Optional;

public interface CounselingSessionRepository
        extends JpaRepository<CounselingSession, Long> {

    List<CounselingSession>
        findByCounselingCase_IdOrderBySessionNumberAsc(Long caseId);

    Optional<CounselingSession> findByIdAndCounselingCase_Id(Long sessionId, Long caseId);

    boolean existsByCounselingCase_IdAndSessionNumber(
        Long caseId,
        Integer sessionNumber
    );
}
