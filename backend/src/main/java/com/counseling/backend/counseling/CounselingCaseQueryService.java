package com.counseling.backend.counseling;

import com.counseling.backend.user.User;
import com.counseling.backend.user.UserRepository;
import com.counseling.backend.user.UserRole;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

@Service
@Transactional(readOnly = true)
public class CounselingCaseQueryService {

    private final CounselingCaseRepository cases;
    private final UserRepository users;

    public CounselingCaseQueryService(CounselingCaseRepository cases, UserRepository users) {
        this.cases = cases;
        this.users = users;
    }

    @PreAuthorize("hasAnyRole('ADMIN', 'COUNSELOR')")
    public CaseResponse getById(Long caseId, Authentication authentication) {
        User actor = requireActiveUser(authentication);
        // A counselor can never load another counselor's case through this query.
        CounselingCase found = (actor.getRole() == UserRole.ADMIN
                ? cases.findById(caseId)
                : cases.findByIdAndCounselor_Id(caseId, actor.getId()))
            // A 404 does not disclose whether a case exists but belongs to someone else.
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Case not found"));
        return CaseResponse.from(found);
    }

    @PreAuthorize("hasAnyRole('ADMIN', 'COUNSELOR')")
    public CasePageResponse list(Authentication authentication, int page, int size) {
        if (page < 0 || size < 1 || size > 50) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "page must be >= 0 and size between 1 and 50");
        }
        User actor = requireActiveUser(authentication);
        Pageable pageable = PageRequest.of(page, size, Sort.by(Sort.Direction.DESC, "id"));
        Page<CounselingCase> result = (actor.getRole() == UserRole.ADMIN)
            ? cases.findAll(pageable)
            : cases.findByCounselor_Id(actor.getId(), pageable);
        return new CasePageResponse(
            result.getContent().stream().map(CaseResponse::from).toList(),
            result.getNumber(), result.getSize(), result.getTotalElements(), result.getTotalPages()
        );
    }

    private User requireActiveUser(Authentication authentication) {
        if (authentication == null || !authentication.isAuthenticated()) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Login required");
        }
        User actor = users.findByEmail(authentication.getName())
            .filter(User::isActive)
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Active account required"));

        // If a role changed in the DB, do not honor stale session authorities.
        String expectedAuthority = "ROLE_" + actor.getRole().name();
        boolean sameRoleAsSession = authentication.getAuthorities().stream()
            .anyMatch(a -> expectedAuthority.equals(a.getAuthority()));
        if (!sameRoleAsSession) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Please sign in again after role change");
        }
        return actor;
    }
}
