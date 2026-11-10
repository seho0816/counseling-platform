package com.counseling.backend.counseling;

import com.counseling.backend.client.Client;
import com.counseling.backend.client.ClientRepository;
import com.counseling.backend.security.ActiveActorService;
import com.counseling.backend.user.User;
import com.counseling.backend.user.UserRepository;
import com.counseling.backend.user.UserRole;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

@Service
public class AdminCaseWriteService {
    private final CounselingCaseRepository cases;
    private final ClientRepository clients;
    private final UserRepository users;
    private final ActiveActorService activeActors;

    public AdminCaseWriteService(CounselingCaseRepository cases, ClientRepository clients,
                                 UserRepository users, ActiveActorService activeActors) {
        this.cases = cases;
        this.clients = clients;
        this.users = users;
        this.activeActors = activeActors;
    }

    @Transactional
    @PreAuthorize("hasRole('ADMIN')")
    public CaseResponse create(CreateCaseRequest request, Authentication authentication) {
        activeActors.require(authentication, UserRole.ADMIN);
        if (request == null || request.clientId() == null || request.clientId() < 1
                || request.title() == null || request.title().isBlank()
                || request.title().trim().length() > 200) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "clientId and title (1..200) are required");
        }
        Client client = clients.findById(request.clientId())
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Client not found"));
        User counselor = findValidCounselor(request.counselorId());
        String concern = request.concern() == null ? null : request.concern().trim();
        if (concern != null && concern.length() > 2000) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "concern must be at most 2000 characters");
        }
        CounselingCase created = new CounselingCase(client, counselor, request.title().trim(),
            concern == null || concern.isBlank() ? null : concern);
        return CaseResponse.from(cases.saveAndFlush(created));
    }

    @Transactional
    @PreAuthorize("hasRole('ADMIN')")
    public CaseResponse assign(Long caseId, AssignCaseRequest request, Authentication authentication) {
        activeActors.require(authentication, UserRole.ADMIN);
        if (request == null || caseId == null || caseId < 1) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Valid case id and JSON body required");
        }
        CounselingCase counselingCase = cases.findById(caseId)
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Case not found"));
        User counselor = findValidCounselor(request.counselorId());
        counselingCase.assignCounselor(counselor);
        return CaseResponse.from(cases.saveAndFlush(counselingCase));
    }

    private User findValidCounselor(Long counselorId) {
        if (counselorId == null) return null; // A pending case is allowed.
        if (counselorId < 1) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Invalid counselor id");
        }
        User counselor = users.findById(counselorId)
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Counselor not found"));
        if (counselor.getRole() != UserRole.COUNSELOR || !counselor.isActive()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Only active counselors may be assigned");
        }
        return counselor;
    }
}
