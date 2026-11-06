package com.counseling.backend.counseling;

import com.counseling.backend.security.ActiveActorService;
import com.counseling.backend.user.User;
import com.counseling.backend.user.UserRole;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

@Service
public class CounselingCaseStatusService {
    private final CounselingCaseRepository cases;
    private final ActiveActorService activeActors;

    public CounselingCaseStatusService(CounselingCaseRepository cases,
                                       ActiveActorService activeActors) {
        this.cases = cases;
        this.activeActors = activeActors;
    }

    @Transactional
    @PreAuthorize("hasAnyRole('ADMIN', 'COUNSELOR')")
    public CaseResponse changeStatus(Long caseId, UpdateCaseStatusRequest request,
                                     Authentication authentication) {
        User actor = activeActors.requireAny(authentication, UserRole.ADMIN, UserRole.COUNSELOR);
        if (caseId == null || caseId < 1 || request == null || request.status() == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Valid case id and status are required");
        }

        // Lookup at repository level prevents counselors from modifying another person's case.
        CounselingCase found = (actor.getRole() == UserRole.ADMIN
            ? cases.findById(caseId)
            : cases.findByIdAndCounselor_Id(caseId, actor.getId()))
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Case not found"));

        // A repeated update to the current status is harmless and does not write to DB.
        if (found.getStatus() == request.status()) {
            return CaseResponse.from(found);
        }
        if (!found.getStatus().canTransitionTo(request.status())) {
            throw new ResponseStatusException(HttpStatus.CONFLICT,
                "Status transition not allowed: " + found.getStatus() + " -> " + request.status());
        }
        found.changeStatus(request.status());
        return CaseResponse.from(cases.saveAndFlush(found));
    }
}
